import jsPDF from 'jspdf';
import type { CotadorAgeDistribution, CotadorQuoteItem, CotadorQuoteSharePayload } from '../shared/cotadorTypes';
import {
  buildCotadorComparableHospitalKey,
  countCotadorUniqueNetworkProviders,
  formatCotadorCurrency,
  formatCotadorDateTime,
  formatCotadorSelectedModalities,
  mergeCotadorHospitalNetworkEntries,
  summarizeCotadorNetworkServices,
} from '../shared/cotadorUtils';

type ExportCotadorQuotePdfInput = {
  payload: CotadorQuoteSharePayload;
  includeNetworkComparison: boolean;
  fileName: string;
};

type NetworkCompareRow = {
  key: string;
  hospital: string;
  cidade: string;
  bairro: string | null;
  regiao: string | null;
  services: string[];
  planPresence: Partial<Record<string, { services: string[] }>>;
  hitsCount: number;
};

const PAGE_MARGIN = 36;
const PAGE_BOTTOM_MARGIN = 42;
const CARD_GAP = 14;
const FONT_FAMILY = 'helvetica';

const COLORS = {
  text: [28, 28, 28] as const,
  muted: [92, 92, 92] as const,
  accent: [155, 93, 20] as const,
  border: [214, 214, 214] as const,
  soft: [248, 248, 248] as const,
  white: [255, 255, 255] as const,
  success: [22, 101, 52] as const,
};

const formatCopart = (value: CotadorQuoteItem['coparticipacao']) => {
  if (value === 'parcial') return 'Copart. parcial';
  if (value === 'total') return 'Copart. total';
  if (value === 'sem') return 'Sem copart.';
  return 'A definir';
};

const normalizeNetworkText = (value?: string | null) => (
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
);

const mergeCompareLabel = (current?: string | null, next?: string | null) => {
  const values = Array.from(new Map([current, next]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => [normalizeNetworkText(value), value.trim()])).values());

  if (values.length === 0) return null;
  if (values.length === 1) return values[0];
  return values.join(' / ');
};

const preferHospitalLabel = (current: string, next: string) => {
  if (!current) return next;
  if (!next) return current;

  if (next.trim().length !== current.trim().length) {
    return next.trim().length < current.trim().length ? next : current;
  }

  return next.localeCompare(current, 'pt-BR') < 0 ? next : current;
};

const compareNetworkCompareRows = (left: NetworkCompareRow, right: NetworkCompareRow) => {
  const cityComparison = left.cidade.localeCompare(right.cidade, 'pt-BR');
  if (cityComparison !== 0) return cityComparison;

  const bairroComparison = (left.bairro ?? '').localeCompare(right.bairro ?? '', 'pt-BR');
  if (bairroComparison !== 0) return bairroComparison;

  return left.hospital.localeCompare(right.hospital, 'pt-BR');
};

const buildNetworkComparisonRows = (items: CotadorQuoteItem[]): NetworkCompareRow[] => {
  const rows = new Map<string, NetworkCompareRow>();

  items.forEach((item) => {
    const networkEntries = mergeCotadorHospitalNetworkEntries(item.redeHospitalar);

    networkEntries.forEach((entry) => {
      const key = buildCotadorComparableHospitalKey(entry);
      const current = rows.get(key) ?? {
        key,
        hospital: entry.hospital,
        cidade: entry.cidade || 'Cidade nao informada',
        bairro: entry.bairro ?? null,
        regiao: entry.regiao ?? null,
        services: [],
        planPresence: {},
        hitsCount: 0,
      };

      const mergedServices = Array.from(new Set([...(current.planPresence[item.id]?.services ?? []), ...entry.atendimentos.filter(Boolean)]))
        .sort((left, right) => left.localeCompare(right, 'pt-BR'));

      current.hospital = preferHospitalLabel(current.hospital, entry.hospital);
      current.bairro = mergeCompareLabel(current.bairro, entry.bairro);
      current.regiao = mergeCompareLabel(current.regiao, entry.regiao);
      current.planPresence[item.id] = { services: mergedServices };
      current.services = Array.from(new Set([...current.services, ...entry.atendimentos.filter(Boolean)]))
        .sort((left, right) => left.localeCompare(right, 'pt-BR'));
      current.hitsCount = Object.keys(current.planPresence).length;
      rows.set(key, current);
    });
  });

  return Array.from(rows.values()).sort(compareNetworkCompareRows);
};

const setTextColor = (doc: jsPDF, color: readonly [number, number, number]) => {
  doc.setTextColor(color[0], color[1], color[2]);
};

const setFillColor = (doc: jsPDF, color: readonly [number, number, number]) => {
  doc.setFillColor(color[0], color[1], color[2]);
};

const setDrawColor = (doc: jsPDF, color: readonly [number, number, number]) => {
  doc.setDrawColor(color[0], color[1], color[2]);
};

const drawWrappedText = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
) => {
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
};

const getWrappedLines = (doc: jsPDF, text: string, width: number) => doc.splitTextToSize(text, width) as string[];

const ensurePageSpace = (doc: jsPDF, currentY: number, neededHeight: number) => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededHeight <= pageHeight - PAGE_BOTTOM_MARGIN) {
    return currentY;
  }

  doc.addPage();
  return PAGE_MARGIN;
};

const drawSectionTitle = (doc: jsPDF, title: string, y: number, subtitle?: string) => {
  let currentY = ensurePageSpace(doc, y, subtitle ? 44 : 26);
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(10);
  setTextColor(doc, COLORS.accent);
  doc.text(title.toUpperCase(), PAGE_MARGIN, currentY);
  currentY += 16;

  if (subtitle) {
    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(20);
    setTextColor(doc, COLORS.text);
    doc.text(subtitle, PAGE_MARGIN, currentY);
    currentY += 10;
  }

  return currentY;
};

const drawSummaryCards = (doc: jsPDF, cards: Array<{ label: string; value: string; helper?: string }>, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - PAGE_MARGIN * 2;
  const cardWidth = (availableWidth - CARD_GAP) / 2;
  const cardHeight = 58;
  const currentY = ensurePageSpace(doc, startY, cardHeight * Math.ceil(cards.length / 2) + CARD_GAP * 2);

  cards.forEach((card, index) => {
    const row = Math.floor(index / 2);
    const column = index % 2;
    const x = PAGE_MARGIN + column * (cardWidth + CARD_GAP);
    const y = currentY + row * (cardHeight + CARD_GAP);

    setFillColor(doc, COLORS.white);
    setDrawColor(doc, COLORS.border);
    doc.roundedRect(x, y, cardWidth, cardHeight, 12, 12, 'FD');

    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(9);
    setTextColor(doc, COLORS.muted);
    doc.text(card.label.toUpperCase(), x + 12, y + 16);

    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(14);
    setTextColor(doc, COLORS.text);
    doc.text(card.value, x + 12, y + 34);

    if (card.helper) {
      doc.setFont(FONT_FAMILY, 'normal');
      doc.setFontSize(9);
      setTextColor(doc, COLORS.muted);
      doc.text(card.helper, x + 12, y + 48);
    }
  });

  return currentY + Math.ceil(cards.length / 2) * (cardHeight + CARD_GAP);
};

const getQuotedAgeRows = (item: CotadorQuoteItem, distribution: CotadorAgeDistribution) =>
  Object.entries(distribution)
    .filter(([, quantity]) => quantity > 0)
    .map(([ageRange, quantity]) => ({
      ageRange,
      quantity,
      value: item.pricesByAgeRange[ageRange as keyof typeof item.pricesByAgeRange] ?? null,
    }));

const drawPlanCard = (doc: jsPDF, item: CotadorQuoteItem, distribution: CotadorAgeDistribution, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardX = PAGE_MARGIN;
  const cardWidth = pageWidth - PAGE_MARGIN * 2;
  const priceRows = getQuotedAgeRows(item, distribution);
  const entityText = item.entidadesClasse.map((entity) => entity.name).filter(Boolean).join(', ');
  const entityLines = entityText ? getWrappedLines(doc, entityText, 184) : [];
  const detailRowCount = 5 + (item.administradora?.name ? 1 : 0);
  const detailHeight = 18 + detailRowCount * 15 + (entityLines.length > 0 ? Math.max(18, entityLines.length * 12 + 6) : 0);
  const priceBlockHeight = 28 + Math.max(priceRows.length, 1) * 14 + 18;
  const bodyHeight = Math.max(detailHeight, priceBlockHeight);
  const cardHeight = 68 + bodyHeight + 18;
  const y = ensurePageSpace(doc, startY, cardHeight + 16);

  setFillColor(doc, COLORS.white);
  setDrawColor(doc, COLORS.border);
  doc.roundedRect(cardX, y, cardWidth, cardHeight, 14, 14, 'FD');

  setFillColor(doc, COLORS.white);
  doc.roundedRect(cardX, y, cardWidth, 54, 14, 14, 'F');
  doc.line(cardX, y + 54, cardX + cardWidth, y + 54);

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(9);
  setTextColor(doc, COLORS.muted);
  doc.text((item.operadora.name ?? 'Operadora').toUpperCase(), cardX + 16, y + 16);
  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(11);
  doc.text(item.linha?.name ?? item.subtitulo ?? 'Linha', cardX + 16, y + 30);
  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(24);
  setTextColor(doc, COLORS.text);
  doc.text(item.titulo, cardX + 16, y + 48);

  const detailX = cardX + 16;
  let detailY = y + 74;

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(10);
  setTextColor(doc, COLORS.muted);
  doc.text('Detalhes principais', detailX, detailY);
  detailY += 14;

  const detailRows = [
    ['Acomodação', item.acomodacao ?? '-'],
    ['Coparticipação', formatCopart(item.coparticipacao)],
    ['Abrangência', item.abrangencia ?? '-'],
    ['Mensalidade estimada', formatCotadorCurrency(item.estimatedMonthlyTotal)],
    ['Rede hospitalar', `${countCotadorUniqueNetworkProviders(item.redeHospitalar)} prestador(es)`],
  ];

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(11);
  detailRows.forEach(([label, value]) => {
    setTextColor(doc, COLORS.muted);
    doc.text(`${label}:`, detailX, detailY);
    setTextColor(doc, COLORS.text);
    doc.text(value, detailX + 98, detailY);
    detailY += 14;
  });

  if (item.administradora?.name) {
    setTextColor(doc, COLORS.muted);
    doc.text('Administradora:', detailX, detailY);
    setTextColor(doc, COLORS.text);
    doc.text(item.administradora.name, detailX + 98, detailY);
    detailY += 14;
  }

  if (item.entidadesClasse.length > 0) {
    setTextColor(doc, COLORS.muted);
    doc.text('Entidades:', detailX, detailY);
    setTextColor(doc, COLORS.text);
    detailY = drawWrappedText(doc, entityText, detailX + 98, detailY, 184, 12);
  }

  const priceTableX = cardX + cardWidth - 216;
  const priceTableY = y + 72;
  const priceTableWidth = 200;
  const priceTableHeight = Math.max(96, priceBlockHeight + 12);

  setDrawColor(doc, COLORS.border);
  doc.roundedRect(priceTableX, priceTableY, priceTableWidth, priceTableHeight, 12, 12, 'FD');

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(10);
  setTextColor(doc, COLORS.text);
  doc.text('Faixas cotadas', priceTableX + 12, priceTableY + 16);

  let rowY = priceTableY + 32;
  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(10);
  if (priceRows.length === 0) {
    setTextColor(doc, COLORS.muted);
    doc.text('Nenhuma faixa etária foi preenchida.', priceTableX + 12, rowY);
  }
  priceRows.forEach(({ ageRange, quantity, value }) => {
    doc.line(priceTableX + 12, rowY - 8, priceTableX + priceTableWidth - 12, rowY - 8);
    setTextColor(doc, COLORS.muted);
    doc.text(ageRange, priceTableX + 12, rowY);
    doc.text(`${quantity}x`, priceTableX + 96, rowY, { align: 'center' });
    setTextColor(doc, COLORS.text);
    doc.text(formatCotadorCurrency(value), priceTableX + priceTableWidth - 12, rowY, { align: 'right' });
    rowY += 14;
  });

  return y + cardHeight + 14;
};

const drawHeader = (doc: jsPDF, payload: CotadorQuoteSharePayload) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const modalitiesSummary = formatCotadorSelectedModalities(payload.items);
  const infoX = pageWidth - PAGE_MARGIN - 132;
  const modalityLines = modalitiesSummary ? getWrappedLines(doc, `Modalidades: ${modalitiesSummary}`, 118) : [];
  const infoStartY = PAGE_MARGIN + 50;
  const vidasY = infoStartY + Math.max(modalityLines.length, 1) * 10 + 2;
  const updatedY = vidasY + 12;

  setFillColor(doc, COLORS.white);
  setDrawColor(doc, COLORS.border);
  doc.roundedRect(PAGE_MARGIN, PAGE_MARGIN, pageWidth - PAGE_MARGIN * 2, 108, 18, 18, 'FD');

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(11);
  setTextColor(doc, COLORS.accent);
  doc.text('COTAÇÃO COMPARTILHADA', PAGE_MARGIN + 16, PAGE_MARGIN + 18);

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(24);
  setTextColor(doc, COLORS.text);
  doc.text(payload.quote.name, PAGE_MARGIN + 16, PAGE_MARGIN + 42);

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(11);
  setTextColor(doc, COLORS.muted);
  drawWrappedText(
    doc,
    'Compare os planos selecionados, veja o valor total da simulação e consulte os detalhes essenciais de cada opção.',
    PAGE_MARGIN + 16,
    PAGE_MARGIN + 60,
    pageWidth - PAGE_MARGIN * 2 - 180,
    13,
  );

  setFillColor(doc, COLORS.soft);
  setDrawColor(doc, COLORS.border);
  doc.roundedRect(pageWidth - PAGE_MARGIN - 148, PAGE_MARGIN + 12, 132, 68, 14, 14, 'FD');

  doc.setFont(FONT_FAMILY, 'bold');
  doc.setFontSize(22);
  setTextColor(doc, COLORS.accent);
  doc.text('KS', pageWidth - PAGE_MARGIN - 132, PAGE_MARGIN + 36);

  doc.setFont(FONT_FAMILY, 'normal');
  doc.setFontSize(9);
  setTextColor(doc, COLORS.muted);
  if (modalitiesSummary) {
    doc.text(modalityLines, infoX, infoStartY);
  }
  doc.text(`Vidas: ${payload.quote.totalLives}`, infoX, vidasY);
  doc.text(`Atualizada: ${formatCotadorDateTime(payload.quote.updatedAt)}`, infoX, updatedY);

  return PAGE_MARGIN + 110;
};

const drawNetworkComparison = (doc: jsPDF, items: CotadorQuoteItem[], rows: NetworkCompareRow[]) => {
  doc.addPage('a4', 'landscape');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftColWidth = 250;
  const planColWidth = (pageWidth - PAGE_MARGIN * 2 - leftColWidth) / Math.max(items.length, 1);
  const drawTableHeader = (y: number) => {
    setFillColor(doc, COLORS.soft);
    setDrawColor(doc, COLORS.border);
    doc.rect(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN * 2, 34, 'FD');

    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    setTextColor(doc, COLORS.text);
    doc.text('Prestador', PAGE_MARGIN + 10, y + 20);

    items.forEach((item, index) => {
      doc.text(item.titulo, PAGE_MARGIN + leftColWidth + planColWidth * index + 10, y + 20, {
        maxWidth: planColWidth - 20,
      });
    });
  };

  let y = drawSectionTitle(doc, 'Comparativo de rede', PAGE_MARGIN, 'Prestadores por plano') + 8;
  y = drawSummaryCards(doc, [
    { label: 'Prestadores únicos', value: `${rows.length}` },
    { label: 'Em todos os planos', value: `${rows.filter((row) => row.hitsCount === items.length).length}` },
    { label: 'Exclusivos', value: `${rows.filter((row) => row.hitsCount === 1).length}` },
  ], y);
  y += 6;
  drawTableHeader(y);
  y += 34;

  rows.forEach((row) => {
    const hospitalLines = getWrappedLines(doc, row.hospital, leftColWidth - 20);
    const locationLines = getWrappedLines(doc, [row.bairro, row.regiao, row.cidade].filter(Boolean).join(' | '), leftColWidth - 20);
    const leftHeight = 10 + hospitalLines.length * 11 + (locationLines.length > 0 ? locationLines.length * 10 + 6 : 0);

    const cellHeights = items.map((item) => {
      const presence = row.planPresence[item.id];
      const serviceSummary = summarizeCotadorNetworkServices(presence?.services ?? []);
      const statusLines = getWrappedLines(doc, presence ? 'Na rede' : 'Não consta', planColWidth - 20);
      const serviceText = presence
        ? serviceSummary.hasStructuredInfo
          ? serviceSummary.badges.join(' · ')
          : serviceSummary.fallbackNote
        : '';
      const serviceLines = serviceText ? getWrappedLines(doc, serviceText, planColWidth - 20) : [];
      return 10 + statusLines.length * 11 + (serviceLines.length > 0 ? serviceLines.length * 10 + 6 : 0);
    });

    const rowHeight = Math.max(50, leftHeight, ...cellHeights) + 10;
    if (y + rowHeight > pageHeight - PAGE_BOTTOM_MARGIN) {
      doc.addPage('a4', 'landscape');
      y = PAGE_MARGIN;
      drawTableHeader(y);
      y += 34;
    }

    setDrawColor(doc, COLORS.border);
    setFillColor(doc, COLORS.white);
    doc.rect(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN * 2, rowHeight, 'FD');
    doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);

    doc.setFont(FONT_FAMILY, 'bold');
    doc.setFontSize(10);
    setTextColor(doc, COLORS.text);
    doc.text(hospitalLines, PAGE_MARGIN + 10, y + 14);

    doc.setFont(FONT_FAMILY, 'normal');
    doc.setFontSize(8);
    setTextColor(doc, COLORS.muted);
    if (locationLines.length > 0) {
      doc.text(locationLines, PAGE_MARGIN + 10, y + 14 + hospitalLines.length * 11 + 4);
    }

    items.forEach((item, index) => {
      const cellX = PAGE_MARGIN + leftColWidth + planColWidth * index;
      const presence = row.planPresence[item.id];
      const serviceSummary = summarizeCotadorNetworkServices(presence?.services ?? []);
      const statusLines = getWrappedLines(doc, presence ? 'Na rede' : 'Não consta', planColWidth - 20);
      const serviceText = presence
        ? serviceSummary.hasStructuredInfo
          ? serviceSummary.badges.join(' · ')
          : serviceSummary.fallbackNote
        : '';
      const serviceLines = serviceText ? getWrappedLines(doc, serviceText, planColWidth - 20) : [];

      setDrawColor(doc, COLORS.border);
      doc.line(cellX, y, cellX, y + rowHeight);

      doc.setFont(FONT_FAMILY, presence ? 'bold' : 'normal');
      doc.setFontSize(9);
      setTextColor(doc, presence ? COLORS.success : COLORS.muted);
      doc.text(statusLines, cellX + 10, y + 14);

      if (serviceLines.length > 0) {
        doc.setFont(FONT_FAMILY, 'normal');
        doc.setFontSize(8);
        setTextColor(doc, COLORS.muted);
        doc.text(serviceLines, cellX + 10, y + 14 + statusLines.length * 11 + 4);
      }
    });

    y += rowHeight;
  });

  setDrawColor(doc, COLORS.border);
  doc.line(PAGE_MARGIN, y, pageWidth - PAGE_MARGIN, y);
};

export async function exportCotadorQuotePdf({
  payload,
  includeNetworkComparison,
  fileName,
}: ExportCotadorQuotePdfInput) {
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

  let y = drawHeader(doc, payload);
  y = drawSectionTitle(doc, 'Planos cotados', y + 8, 'Resumo das opções') + 6;

  payload.items.forEach((item) => {
    y = drawPlanCard(doc, item, payload.quote.ageDistribution, y);
  });

  if (includeNetworkComparison) {
    const networkRows = buildNetworkComparisonRows(payload.items);
    if (networkRows.length > 0) {
      drawNetworkComparison(doc, payload.items, networkRows);
    }
  }

  doc.save(fileName);
}
