import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, ChevronRight, FileText, MapPin, Search, ShieldCheck, WalletCards } from 'lucide-react';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ModalShell from '../../../components/ui/ModalShell';
import { formatCotadorCurrency, mergeCotadorHospitalNetworkEntries } from '../shared/cotadorUtils';
import type { CotadorQuoteItem } from '../shared/cotadorTypes';

type CotadorPlanDetailsPageProps = {
  item: CotadorQuoteItem;
  onBack: () => void;
};

type DetailSection = {
  id: string;
  title: string;
  content: string;
  icon: typeof ShieldCheck;
  description: string;
};

type SummaryBlock = {
  label: string;
  value: string;
  helper?: string;
};

type ParsedDetailBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

const formatPerfil = (value: CotadorQuoteItem['perfilEmpresarial']) => {
  if (value === 'mei') return 'MEI';
  if (value === 'nao_mei') return 'Nao MEI';
  if (value === 'todos') return 'Perfil livre';
  return 'Perfil livre';
};

const formatCopart = (value: CotadorQuoteItem['coparticipacao']) => {
  if (value === 'parcial') return 'Copart. parcial';
  if (value === 'total') return 'Copart. total';
  if (value === 'sem') return 'Sem copart.';
  return 'Copart. indefinida';
};

const cleanDetailText = (value?: string | null) => value?.trim() ?? '';

const parseTableRow = (line: string) => line
  .split('|')
  .map((cell) => cell.trim())
  .filter(Boolean);

const isMarkdownTableSeparator = (line: string) => {
  const trimmed = line.trim();
  return trimmed.includes('|') && /^[:\-|\s]+$/.test(trimmed);
};

const parseDetailContent = (content: string): ParsedDetailBlock[] => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const blocks: ParsedDetailBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    blocks.push({ type: 'paragraph', text: paragraphBuffer.join(' ') });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push({ type: 'list', items: listBuffer });
    listBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] ?? '';

    if (line.includes('|') && isMarkdownTableSeparator(nextLine)) {
      flushParagraph();
      flushList();

      const headers = parseTableRow(line);
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length && lines[index].includes('|')) {
        const row = parseTableRow(lines[index]);
        if (row.length > 0) rows.push(row);
        index += 1;
      }

      index -= 1;
      if (headers.length > 0 && rows.length > 0) {
        blocks.push({ type: 'table', headers, rows });
        continue;
      }
    }

    if (/^[-*•]\s+/.test(line)) {
      flushParagraph();
      listBuffer.push(line.replace(/^[-*•]\s+/, '').trim());
      continue;
    }

    flushList();
    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
};

const compareNetworkEntries = (left: CotadorQuoteItem['redeHospitalar'][number], right: CotadorQuoteItem['redeHospitalar'][number]) => {
  const cityComparison = (left.cidade ?? '').localeCompare(right.cidade ?? '', 'pt-BR');
  if (cityComparison !== 0) return cityComparison;

  const regionComparison = (left.regiao ?? '').localeCompare(right.regiao ?? '', 'pt-BR');
  if (regionComparison !== 0) return regionComparison;

  const bairroComparison = (left.bairro ?? '').localeCompare(right.bairro ?? '', 'pt-BR');
  if (bairroComparison !== 0) return bairroComparison;

  return (left.hospital ?? '').localeCompare(right.hospital ?? '', 'pt-BR');
};

const networkLegend = [
  'H: Hospital Eletivo',
  'H CARD: Hospital Cardiologico',
  'HD: Hospital Dia',
  'H ORT: Hospital Cirurgia Ortopedica',
  'M: Maternidade',
  'HP: Hospital Pediatrico',
  'PA: Pronto Atendimento',
  'PS: Pronto Socorro',
  'PS CARD: Pronto Socorro Cardiologico',
  'PS OBST: Pronto Socorro Obstetrico',
  'PSI: Pronto Socorro Infantil',
  'PSO: Pronto Socorro Ortopedico',
  '*: prestador habilitado apenas na acomodacao QP',
  '**: prestador habilitado apenas na acomodacao QC',
];

export default function CotadorPlanDetailsPage({ item, onBack }: CotadorPlanDetailsPageProps) {
  const sections = useMemo<DetailSection[]>(() => {
    const entries: Array<DetailSection | null> = [
      cleanDetailText(item.carencias)
        ? { id: 'carencias', title: 'Carencias', content: cleanDetailText(item.carencias), icon: ShieldCheck, description: 'Consulte regras, prazos e reducoes aplicadas ao plano.' }
        : null,
      cleanDetailText(item.documentosNecessarios)
        ? { id: 'documentos', title: 'Documentos necessarios', content: cleanDetailText(item.documentosNecessarios), icon: FileText, description: 'Veja a documentacao exigida para titular e dependentes.' }
        : null,
      cleanDetailText(item.reembolso)
        ? { id: 'reembolso', title: 'Reembolso', content: cleanDetailText(item.reembolso), icon: WalletCards, description: 'Limites e observacoes do reembolso informado.' }
        : null,
      cleanDetailText(item.informacoesImportantes)
        ? { id: 'informacoes', title: 'Informacoes importantes', content: cleanDetailText(item.informacoesImportantes), icon: FileText, description: 'Notas operacionais e condicoes adicionais do produto.' }
        : null,
    ];

    return entries.filter((entry): entry is DetailSection => entry !== null);
  }, [item.carencias, item.documentosNecessarios, item.informacoesImportantes, item.reembolso]);

  const [networkSearch, setNetworkSearch] = useState('');
  const [networkCity, setNetworkCity] = useState('');
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const mergedNetworkEntries = useMemo(
    () => mergeCotadorHospitalNetworkEntries(item.redeHospitalar),
    [item.redeHospitalar],
  );
  const networkEntriesCount = mergedNetworkEntries.length;
  const networkCitiesCount = useMemo(
    () => new Set(mergedNetworkEntries.map((entry) => entry.cidade).filter(Boolean)).size,
    [mergedNetworkEntries],
  );

  const summaryBlocks = useMemo<SummaryBlock[]>(() => {
    return [
      { label: 'Coparticipacao', value: formatCopart(item.coparticipacao) },
      { label: 'Acomodacao', value: item.acomodacao ?? '-' },
      { label: 'Abrangencia', value: item.abrangencia ?? 'Nao informada' },
      {
        label: 'Rede hospitalar',
        value: networkEntriesCount > 0 ? `${networkEntriesCount} prestador(es)` : 'Nao cadastrada',
        helper: networkCitiesCount > 0 ? `${networkCitiesCount} cidade(s)` : undefined,
      },
    ];
  }, [item.acomodacao, item.abrangencia, item.coparticipacao, networkCitiesCount, networkEntriesCount]);

  const commercialNotes = useMemo(() => {
    const notes: string[] = [];
    if (cleanDetailText(item.observacao)) notes.push(cleanDetailText(item.observacao));
    return notes;
  }, [item.observacao]);

  const pricesByAgeRangeEntries = useMemo(
    () => Object.entries(item.pricesByAgeRange ?? {}).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)),
    [item.pricesByAgeRange],
  );

  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? null,
    [activeSectionId, sections],
  );

  const activeSectionBlocks = useMemo(
    () => (activeSection ? parseDetailContent(activeSection.content) : []),
    [activeSection],
  );

  useEffect(() => {
    setNetworkSearch('');
    setNetworkCity('');
    setNetworkModalOpen(false);
    setActiveSectionId(null);
  }, [item.id]);

  const sortedNetwork = useMemo(
    () => [...mergedNetworkEntries].sort(compareNetworkEntries),
    [mergedNetworkEntries],
  );

  const cityOptions = useMemo(
    () => Array.from(new Set(sortedNetwork.map((entry) => entry.cidade).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'pt-BR')).map((city) => ({ value: city, label: city })),
    [sortedNetwork],
  );

  const filteredNetwork = useMemo(() => {
    const normalizedSearch = networkSearch.trim().toLowerCase();

    return sortedNetwork.filter((entry) => {
      if (networkCity && entry.cidade !== networkCity) return false;
      if (!normalizedSearch) return true;

        const haystack = [entry.hospital, entry.bairro, entry.regiao, entry.cidade, entry.atendimentos.join(' ')].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [networkCity, networkSearch, sortedNetwork]);

  const groupedFilteredNetwork = useMemo(() => {
    const groups = new Map<string, typeof filteredNetwork>();

    filteredNetwork.forEach((entry) => {
      const city = entry.cidade || 'Cidade nao informada';
      const current = groups.get(city) ?? [];
      current.push(entry);
      groups.set(city, current);
    });

    return Array.from(groups.entries()).map(([city, entries]) => ({ city, entries }));
  }, [filteredNetwork]);

  return (
    <div className="panel-page-shell space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar para a cotacao
        </Button>
      </div>

      <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--panel-accent-soft,#f6e4c7)_74%,var(--panel-surface,#fffdfa)),color-mix(in_srgb,var(--panel-surface,#fffdfa)_92%,var(--panel-surface-soft,#f4ede3))_48%,color-mix(in_srgb,var(--panel-surface-muted,#f8f2e8)_90%,var(--panel-surface,#fffdfa))_100%)] p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">{item.operadora.name ?? 'Operadora'}</p>
            <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.linha?.name ?? 'Linha'}</p>
            <h1 className="mt-3 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)]">{item.titulo}</h1>
            <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
              {formatPerfil(item.perfilEmpresarial)} | {formatCopart(item.coparticipacao)}
              {item.vidasMin !== null || item.vidasMax !== null ? ` | ${item.vidasMin ?? 1} a ${item.vidasMax ?? '...'} vidas` : ''}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3 xl:min-w-[260px] xl:items-end">
            {item.estimatedMonthlyTotal !== null && (
              <div className="rounded-2xl border border-[color:rgba(111,63,22,0.18)] bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_68%,var(--panel-surface-soft,#f4ede3))] px-5 py-4 text-right dark:border-[color:rgba(243,200,146,0.16)] dark:bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#2a2119)_84%,var(--panel-surface,#1b1611))]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:#c8b29b]">Mensalidade</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{formatCotadorCurrency(item.estimatedMonthlyTotal)}</p>
              </div>
            )}

            <Button variant="secondary" onClick={() => setNetworkModalOpen(true)} disabled={networkEntriesCount === 0}>
              <MapPin className="h-4 w-4" />
              Ver rede do plano
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryBlocks.map((block) => (
            <div key={block.label} className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">{block.label}</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{block.value}</p>
              {block.helper && <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{block.helper}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-6 shadow-sm md:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">Condições do plano</p>
          <h2 className="mt-2 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">Informacoes objetivas para decisao</h2>
        </div>

        {sections.length === 0 && commercialNotes.length === 0 && pricesByAgeRangeEntries.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center text-sm text-[color:var(--panel-text-soft,#5b4635)]">
            Este produto ainda nao possui informacoes adicionais cadastradas.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 xl:grid-cols-2">
            {pricesByAgeRangeEntries.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveSectionId('faixas-preco')}
                className="flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-5 py-5 text-left transition-colors hover:border-[var(--panel-border,#d4c0a7)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_82%,var(--panel-surface,#fffdfa))]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-2 text-[var(--panel-accent-ink,#6f3f16)]">
                      <WalletCards className="h-4 w-4" />
                    </span>
                    <span className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">Mensalidade por faixa etaria</span>
                  </div>
                  <p className="mt-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                    Confira todos os valores da tabela comercial por idade antes de comparar o plano.
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--panel-text-muted,#876f5c)]" />
              </button>
            )}

            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSectionId(section.id)}
                  className="flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-5 py-5 text-left transition-colors hover:border-[var(--panel-border,#d4c0a7)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_82%,var(--panel-surface,#fffdfa))]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-2 text-[var(--panel-accent-ink,#6f3f16)]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{section.title}</span>
                    </div>
                    <p className="mt-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{section.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--panel-text-muted,#876f5c)]" />
                </button>
              );
            })}

            {commercialNotes.map((_, index) => (
              <button
                key={`note-${index}`}
                type="button"
                onClick={() => setActiveSectionId(`nota-${index}`)}
                className="flex items-center justify-between gap-4 overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-5 py-5 text-left transition-colors hover:border-[var(--panel-border,#d4c0a7)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_82%,var(--panel-surface,#fffdfa))] xl:col-span-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-2 text-[var(--panel-accent-ink,#6f3f16)]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">Observacoes comerciais</span>
                  </div>
                  <p className="mt-3 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Abra para ler observacoes e notas complementares do plano.</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[color:var(--panel-text-muted,#876f5c)]" />
              </button>
            ))}
          </div>
        )}
      </section>

      <ModalShell
        isOpen={activeSectionId !== null}
        onClose={() => setActiveSectionId(null)}
        title={
          activeSectionId === 'faixas-preco'
            ? 'Mensalidade por faixa etaria'
            : activeSectionId?.startsWith('nota-')
              ? 'Observacoes comerciais'
              : activeSection?.title ?? 'Detalhes do plano'
        }
        description={
          activeSectionId === 'faixas-preco'
            ? 'Valores base da tabela comercial para cada faixa etaria desta selecao.'
            : 'Conteudo detalhado do plano em leitura dedicada.'
        }
        size="xl"
      >
        {activeSectionId === 'faixas-preco' ? (
          <div className="overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]">
            <div className="grid grid-cols-[minmax(140px,1fr)_minmax(160px,1fr)] border-b border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">
              <span>Faixa etaria</span>
              <span>Valor</span>
            </div>
            <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
              {pricesByAgeRangeEntries.map(([ageRange, value]) => (
                <div key={ageRange} className="grid grid-cols-[minmax(140px,1fr)_minmax(160px,1fr)] px-5 py-4 text-sm text-[color:var(--panel-text,#1a120d)]">
                  <span className="font-semibold">{ageRange}</span>
                  <span className="font-semibold tabular-nums">{formatCotadorCurrency(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : activeSectionId?.startsWith('nota-') ? (
          <div className="space-y-4 text-sm leading-7 text-[color:var(--panel-text-soft,#5b4635)]">
            {parseDetailContent(commercialNotes[Number(activeSectionId.replace('nota-', ''))] ?? '').map((block, index) => {
              if (block.type === 'list') {
                return (
                  <ul key={`note-list-${index}`} className="list-disc space-y-2 pl-5">
                    {block.items.map((listItem) => <li key={listItem}>{listItem}</li>)}
                  </ul>
                );
              }

              if (block.type === 'table') {
                return (
                  <div key={`note-table-${index}`} className="overflow-auto rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[var(--panel-surface-soft,#f4ede3)] text-[color:var(--panel-text,#1a120d)]">
                        <tr>
                          {block.headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, rowIndex) => (
                          <tr key={`note-row-${rowIndex}`} className="border-t border-[color:var(--panel-border-subtle,#e7dac8)]">
                            {row.map((cell, cellIndex) => <td key={`note-cell-${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top">{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              return <p key={`note-paragraph-${index}`}>{block.text}</p>;
            })}
          </div>
        ) : (
          <div className="space-y-4 text-sm leading-7 text-[color:var(--panel-text-soft,#5b4635)]">
            {activeSectionBlocks.map((block, index) => {
              if (block.type === 'list') {
                return (
                  <ul key={`section-list-${index}`} className="list-disc space-y-2 pl-5">
                    {block.items.map((listItem) => <li key={listItem}>{listItem}</li>)}
                  </ul>
                );
              }

              if (block.type === 'table') {
                return (
                  <div key={`section-table-${index}`} className="overflow-auto rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[var(--panel-surface-soft,#f4ede3)] text-[color:var(--panel-text,#1a120d)]">
                        <tr>
                          {block.headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, rowIndex) => (
                          <tr key={`section-row-${rowIndex}`} className="border-t border-[color:var(--panel-border-subtle,#e7dac8)]">
                            {row.map((cell, cellIndex) => <td key={`section-cell-${rowIndex}-${cellIndex}`} className="px-4 py-3 align-top">{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              }

              return <p key={`section-paragraph-${index}`}>{block.text}</p>;
            })}
          </div>
        )}
      </ModalShell>

      <ModalShell
        isOpen={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
        title="Rede do plano"
        description="A rede esta ordenada por cidade, regiao e bairro. Use os filtros para localizar um prestador especifico."
        size="xl"
      >
        {networkEntriesCount === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center text-sm text-[color:var(--panel-text-soft,#5b4635)]">
            Este plano ainda nao possui rede hospitalar cadastrada para exibicao.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <FilterSingleSelect
                icon={MapPin}
                options={cityOptions}
                placeholder="Todas as cidades"
                value={networkCity}
                onChange={setNetworkCity}
              />
              <Input
                value={networkSearch}
                onChange={(event) => setNetworkSearch(event.target.value)}
                placeholder="Buscar hospital, bairro, regiao ou atendimento"
                leftIcon={Search}
              />
            </div>

            {groupedFilteredNetwork.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                Nenhum hospital encontrado para os filtros aplicados.
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)]">
                {groupedFilteredNetwork.map((group, groupIndex) => (
                  <section
                    key={group.city}
                    className={groupIndex > 0 ? 'border-t border-[color:var(--panel-border-subtle,#e7dac8)]' : ''}
                  >
                    <div className="border-b border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-5 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">
                        {group.entries.length} prestador(es)
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{group.city}</h3>
                    </div>

                    <div className="divide-y divide-[color:var(--panel-border-subtle,#e7dac8)]">
                      {group.entries.map((entry, index) => (
                        <article key={`${group.city}-${entry.regiao}-${entry.bairro}-${entry.hospital}-${index}`} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-3">
                              <span className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-2 text-[var(--panel-accent-ink,#6f3f16)]">
                                <Building2 className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-base font-semibold text-[color:var(--panel-text,#1a120d)]">{entry.hospital}</p>
                                <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                                  {[entry.bairro, entry.regiao, entry.cidade].filter(Boolean).join(' | ')}
                                </p>
                                {entry.observacoes && <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{entry.observacoes}</p>}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 md:max-w-[320px] md:justify-end">
                            {entry.atendimentos.map((service) => (
                              <span key={`${entry.hospital}-${service}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1 text-xs font-medium text-[color:var(--panel-text,#1a120d)]">
                                {service}
                              </span>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4 shadow-sm">
              <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Legenda das siglas</p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)] md:grid-cols-2">
                {networkLegend.map((legendItem) => (
                  <p key={legendItem}>{legendItem}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </ModalShell>
    </div>
  );
}
