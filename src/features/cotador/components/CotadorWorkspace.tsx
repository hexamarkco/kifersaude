import { useMemo, useState } from 'react';
import { Building2, Check, Link2, MapPin, Minus, Plus, Search, ShieldCheck, Sparkles, Trash2, UserRound, Users } from 'lucide-react';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ModalShell from '../../../components/ui/ModalShell';
import {
  buildCotadorComparableHospitalKey,
  countCotadorUniqueNetworkProviders,
  formatCotadorCurrency,
  formatCotadorDateTime,
  mergeCotadorHospitalNetworkEntries,
} from '../shared/cotadorUtils';
import type { CotadorCatalogFilters, CotadorCatalogItem, CotadorQuote, CotadorQuoteItem } from '../shared/cotadorTypes';
import CotadorPlanPickerOverlay from './CotadorPlanPickerOverlay';

type SelectOption = {
  value: string;
  label: string;
};

type CotadorWorkspaceProps = {
  quote: CotadorQuote;
  linkedLeadLabel: string;
  leadOptions: Array<{ value: string; label: string }>;
  catalogItems: CotadorCatalogItem[];
  filteredItems: CotadorCatalogItem[];
  selectedItems: CotadorQuoteItem[];
  filterOptions: {
    operadoras: SelectOption[];
    linhas: SelectOption[];
    administradoras: SelectOption[];
    entidades: SelectOption[];
    perfisEmpresariais: SelectOption[];
    coparticipacoes: SelectOption[];
    networkLocations: SelectOption[];
    abrangencias: SelectOption[];
    acomodacoes: SelectOption[];
  };
  filters: CotadorCatalogFilters;
  busy?: boolean;
  onUpdateFilters: (updates: Partial<CotadorCatalogFilters>) => void;
  onResetFilters: () => void;
  onToggleCatalogItem: (itemId: string) => void;
  onOpenPlanDetails: (catalogItemKey: string) => void;
  onEditQuote: () => void;
  onUpdateLead: (leadId: string | null) => void;
  leadBusy?: boolean;
};

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--panel-text-muted,#876f5c)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{value}</p>
    </div>
  );
}

const formatPerfil = (value: CotadorQuoteItem['perfilEmpresarial']) => {
  if (value === 'mei') return 'MEI';
  if (value === 'nao_mei') return 'Não MEI';
  if (value === 'todos') return 'Todos';
  return 'Livre';
};

const formatCopart = (value: CotadorQuoteItem['coparticipacao']) => {
  if (value === 'parcial') return 'Copart. parcial';
  if (value === 'total') return 'Copart. total';
  if (value === 'sem') return 'Sem copart.';
  return 'A definir';
};

const getRestrictiveScore = (item: CotadorQuoteItem) => {
  let score = 0;

  if (item.perfilEmpresarial && item.perfilEmpresarial !== 'todos') score += 3;
  if (item.administradora?.name) score += 2;
  score += Math.min(item.entidadesClasse.length, 3) * 2;

  if (item.vidasMin !== null || item.vidasMax !== null) {
    const minLives = item.vidasMin ?? 1;
    const maxLives = item.vidasMax ?? minLives;
    const rangeSize = Math.max(maxLives - minLives, 0);
    score += Math.max(1, 10 - Math.min(rangeSize, 9));
  }

  return score;
};

const getRestrictiveReasons = (item: CotadorQuoteItem) => {
  const reasons: string[] = [];

  if (item.perfilEmpresarial && item.perfilEmpresarial !== 'todos') reasons.push(formatPerfil(item.perfilEmpresarial));
  if (item.administradora?.name) reasons.push('administradora');
  if (item.entidadesClasse.length > 0) reasons.push('entidades');
  if (item.vidasMin !== null || item.vidasMax !== null) reasons.push('faixa de vidas');

  return reasons;
};

type NetworkCompareMode = 'all' | 'shared' | 'differentials';

type NetworkCompareRow = {
  key: string;
  hospital: string;
  cidade: string;
  bairro: string | null;
  regiao: string | null;
  services: string[];
  observacoes: string[];
  planPresence: Partial<Record<string, { services: string[] }>>;
  hitsCount: number;
};

const normalizeNetworkText = (value?: string | null) => (
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
);

const compareNetworkCompareRows = (left: NetworkCompareRow, right: NetworkCompareRow) => {
  const cityComparison = left.cidade.localeCompare(right.cidade, 'pt-BR');
  if (cityComparison !== 0) return cityComparison;

  const bairroComparison = (left.bairro ?? '').localeCompare(right.bairro ?? '', 'pt-BR');
  if (bairroComparison !== 0) return bairroComparison;

  return left.hospital.localeCompare(right.hospital, 'pt-BR');
};

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

export default function CotadorWorkspace({
  quote,
  linkedLeadLabel,
  leadOptions,
  catalogItems,
  filteredItems,
  selectedItems,
  filterOptions,
  filters,
  busy = false,
  onUpdateFilters,
  onResetFilters,
  onToggleCatalogItem,
  onOpenPlanDetails,
  onEditQuote,
  onUpdateLead,
  leadBusy = false,
}: CotadorWorkspaceProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [networkCompareOpen, setNetworkCompareOpen] = useState(false);
  const [networkCompareSearch, setNetworkCompareSearch] = useState('');
  const [networkCompareCity, setNetworkCompareCity] = useState('');
  const [networkCompareMode, setNetworkCompareMode] = useState<NetworkCompareMode>('all');

  const filledDistribution = useMemo(
    () => Object.entries(quote.ageDistribution).filter(([, quantity]) => quantity > 0),
    [quote.ageDistribution],
  );

  const networkPlansHaveData = useMemo(
    () => selectedItems.some((item) => countCotadorUniqueNetworkProviders(item.redeHospitalar) > 0),
    [selectedItems],
  );

  const networkSummaryByItemId = useMemo(
    () => new Map(selectedItems.map((item) => {
      const entries = mergeCotadorHospitalNetworkEntries(item.redeHospitalar);
      return [item.id, { entries, count: entries.length }] as const;
    })),
    [selectedItems],
  );

  const networkComparisonRows = useMemo<NetworkCompareRow[]>(() => {
    const rows = new Map<string, NetworkCompareRow>();

    selectedItems.forEach((item) => {
      const networkEntries = networkSummaryByItemId.get(item.id)?.entries ?? [];

      networkEntries.forEach((entry) => {
        const key = buildCotadorComparableHospitalKey(entry);
        const current = rows.get(key) ?? {
          key,
          hospital: entry.hospital,
          cidade: entry.cidade || 'Cidade nao informada',
          bairro: entry.bairro ?? null,
          regiao: entry.regiao ?? null,
          services: [],
          observacoes: [],
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

        if (entry.observacoes?.trim()) {
          current.observacoes = Array.from(new Set([...current.observacoes, entry.observacoes.trim()]));
        }

        current.hitsCount = Object.keys(current.planPresence).length;
        rows.set(key, current);
      });
    });

    return Array.from(rows.values()).sort(compareNetworkCompareRows);
  }, [networkSummaryByItemId, selectedItems]);

  const networkComparisonCityOptions = useMemo(
    () => Array.from(new Set(networkComparisonRows.map((row) => row.cidade).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))
      .map((city) => ({ value: city, label: city })),
    [networkComparisonRows],
  );

  const filteredNetworkComparisonRows = useMemo(() => {
    const normalizedSearch = networkCompareSearch.trim().toLowerCase();

    return networkComparisonRows.filter((row) => {
      if (networkCompareCity && row.cidade !== networkCompareCity) return false;
      if (networkCompareMode === 'shared' && row.hitsCount !== selectedItems.length) return false;
      if (networkCompareMode === 'differentials' && row.hitsCount === selectedItems.length) return false;

      if (!normalizedSearch) return true;

        const haystack = [
          row.hospital,
          row.cidade,
          row.bairro,
          row.regiao,
          row.services.join(' '),
          row.observacoes.join(' '),
        ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [networkCompareCity, networkCompareMode, networkCompareSearch, networkComparisonRows, selectedItems.length]);

  const networkSharedRowsCount = useMemo(
    () => networkComparisonRows.filter((row) => row.hitsCount === selectedItems.length).length,
    [networkComparisonRows, selectedItems.length],
  );

  const networkExclusiveRowsCount = useMemo(
    () => networkComparisonRows.filter((row) => row.hitsCount === 1).length,
    [networkComparisonRows],
  );

  const networkComparisonMatrixStyle = useMemo(
    () => ({ gridTemplateColumns: `minmax(300px, 1.6fr) repeat(${Math.max(selectedItems.length, 1)}, minmax(180px, 1fr))` }),
    [selectedItems.length],
  );

  const planHighlightsById = useMemo(() => {
    const highlights = new Map<string, { bestPrice: boolean; largestNetwork: boolean; mostRestrictive: boolean; restrictiveReason: string | null }>();

    if (selectedItems.length <= 1) {
      selectedItems.forEach((item) => {
        highlights.set(item.id, {
          bestPrice: false,
          largestNetwork: false,
          mostRestrictive: false,
          restrictiveReason: null,
        });
      });
      return highlights;
    }

    const priceValues = selectedItems
      .map((item) => item.estimatedMonthlyTotal)
      .filter((value): value is number => value !== null);
    const lowestPrice = new Set(priceValues).size > 1 ? Math.min(...priceValues) : null;

    const networkCounts = selectedItems.map((item) => networkSummaryByItemId.get(item.id)?.count ?? 0);
    const largestNetwork = new Set(networkCounts).size > 1 ? Math.max(...networkCounts) : null;

    const restrictiveScores = selectedItems.map((item) => ({
      id: item.id,
      score: getRestrictiveScore(item),
      reasons: getRestrictiveReasons(item),
    }));
    const distinctRestrictiveScores = new Set(restrictiveScores.map((entry) => entry.score));
    const highestRestrictiveScore = distinctRestrictiveScores.size > 1 ? Math.max(...restrictiveScores.map((entry) => entry.score)) : null;

    selectedItems.forEach((item) => {
      const restrictiveEntry = restrictiveScores.find((entry) => entry.id === item.id);
      const restrictiveReason = restrictiveEntry?.reasons.length ? restrictiveEntry.reasons.slice(0, 2).join(' · ') : null;

      highlights.set(item.id, {
        bestPrice: lowestPrice !== null && item.estimatedMonthlyTotal === lowestPrice,
        largestNetwork: largestNetwork !== null && (networkSummaryByItemId.get(item.id)?.count ?? 0) === largestNetwork,
        mostRestrictive: highestRestrictiveScore !== null && restrictiveEntry?.score === highestRestrictiveScore,
        restrictiveReason,
      });
    });

    return highlights;
  }, [networkSummaryByItemId, selectedItems]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--panel-accent-soft,#f6e4c7)_74%,var(--panel-surface,#fffdfa)),color-mix(in_srgb,var(--panel-surface,#fffdfa)_92%,var(--panel-surface-soft,#f4ede3))_48%,color-mix(in_srgb,var(--panel-surface-muted,#f8f2e8)_90%,var(--panel-surface,#fffdfa))_100%)] p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:rgba(157,127,90,0.24)] bg-[color:rgba(255,253,250,0.82)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)] dark:border-[color:rgba(251,191,36,0.2)] dark:bg-[color:rgba(251,191,36,0.12)] dark:text-[color:#fde68a]">
              <Sparkles className="h-3.5 w-3.5" />
              Cotação ativa
            </div>
            <h2 className="mt-3 text-3xl font-semibold text-[color:var(--panel-text,#1a120d)]">{quote.name}</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:max-w-2xl">
          <SummaryMetric label="Criada em" value={formatCotadorDateTime(quote.createdAt)} />
          <SummaryMetric label="Atualizada em" value={formatCotadorDateTime(quote.updatedAt)} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[32px] border border-[var(--panel-border,#d4c0a7)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-surface,#fffdfa)_90%,var(--panel-surface-soft,#f4ede3))_0%,color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_80%,var(--panel-surface,#fffdfa))_100%)] p-6 text-[color:var(--panel-text,#1a120d)] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[color:var(--panel-border-subtle,#e7dac8)] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">Planos da cotação</p>
              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{selectedItems.length} plano(s)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setNetworkCompareOpen(true)} disabled={!networkPlansHaveData}>
                <MapPin className="h-4 w-4" />
                Ver rede
              </Button>
              <Button onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" />
                Adicionar plano
              </Button>
            </div>
          </div>

          {selectedItems.length === 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-6 flex min-h-[320px] w-full cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-[var(--panel-border,#d4c0a7)] bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_84%,var(--panel-surface-soft,#f4ede3))] px-6 text-center transition-all hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_72%,var(--panel-accent-soft,#f6e4c7))]"
            >
              <div className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 text-[var(--panel-accent-ink,#6f3f16)]">
                <Plus className="h-7 w-7" />
              </div>
              <p className="mt-5 text-xl font-semibold text-[color:var(--panel-text,#1a120d)]">Adicionar plano</p>
              <p className="mt-2 max-w-md text-sm text-[color:var(--panel-text-soft,#5b4635)]">Selecione um plano.</p>
            </button>
          ) : (
            <div className="mt-6 grid gap-3 xl:grid-cols-2">
              {selectedItems.map((item) => {
                const highlights = planHighlightsById.get(item.id) ?? {
                  bestPrice: false,
                  largestNetwork: false,
                  mostRestrictive: false,
                  restrictiveReason: null,
                };
                const networkCount = networkSummaryByItemId.get(item.id)?.count ?? 0;

                return (
                  <article
                    key={item.id}
                    className={[
                      'rounded-[24px] border bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm transition-colors',
                      highlights.bestPrice
                        ? 'border-[color:rgba(184,92,31,0.28)] shadow-[0_12px_28px_rgba(111,63,22,0.08)]'
                        : 'border-[color:var(--panel-border-subtle,#e7dac8)]',
                    ].join(' ')}
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">
                        {item.operadora.name ?? 'OPERADORA'}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.linha?.name ?? 'LINHA'}</p>
                      <h4 className="mt-3 text-2xl font-semibold text-[color:var(--panel-text,#1a120d)]">{item.titulo}</h4>
                      <div className="mt-3 min-h-[2.25rem]">
                        <div className="flex flex-wrap gap-2">
                          {highlights.bestPrice && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:rgba(184,92,31,0.24)] bg-[color:rgba(184,92,31,0.1)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--panel-accent-ink,#6f3f16)]">
                              <Sparkles className="h-3.5 w-3.5" />
                              Melhor preço
                            </span>
                          )}
                          {highlights.largestNetwork && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:rgba(111,63,22,0.18)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--panel-text-soft,#5b4635)]">
                              <MapPin className="h-3.5 w-3.5" />
                              Maior rede
                            </span>
                          )}
                          {highlights.mostRestrictive && (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full border border-[color:rgba(92,53,23,0.2)] bg-[color:rgba(92,53,23,0.08)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--panel-text,#1a120d)]"
                              title={highlights.restrictiveReason ?? undefined}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Mais restritivo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.perfilEmpresarial && (
                          <span className="rounded-full border border-[color:rgba(111,63,22,0.18)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_82%,var(--panel-surface,#fffdfa))] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--panel-text-soft,#5b4635)]">
                            {formatPerfil(item.perfilEmpresarial)}
                          </span>
                        )}
                        {item.coparticipacao && (
                          <span className="rounded-full border border-[color:rgba(111,63,22,0.18)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_82%,var(--panel-surface,#fffdfa))] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--panel-text-soft,#5b4635)]">
                            {formatCopart(item.coparticipacao)}
                          </span>
                        )}
                        {(item.vidasMin !== null || item.vidasMax !== null) && (
                          <span className="rounded-full border border-[color:rgba(111,63,22,0.18)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_82%,var(--panel-surface,#fffdfa))] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--panel-text-soft,#5b4635)]">
                            {`${item.vidasMin ?? 1} a ${item.vidasMax ?? '...'} vidas`}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onToggleCatalogItem(item.catalogItemKey)} disabled={busy}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-1 xl:grid-cols-1">
                    <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_92%,var(--panel-surface,#fffdfa))] px-3 py-2 dark:bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#2a2119)_78%,var(--panel-surface,#1b1611))]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Acomodação</p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.acomodacao ?? '-'}</p>
                    </div>
                  </div>

                  {item.estimatedMonthlyTotal !== null && (
                    <div className="mt-3 rounded-2xl border border-[color:rgba(111,63,22,0.22)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_82%,var(--panel-surface,#fffdfa))] px-3 py-2.5 dark:border-[color:rgba(243,200,146,0.16)] dark:bg-[color:var(--panel-surface-soft,#2a2119)]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Mensalidade</p>
                        <p className="text-2xl font-semibold tabular-nums text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{formatCotadorCurrency(item.estimatedMonthlyTotal)}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={() => onOpenPlanDetails(item.catalogItemKey)}>
                      Ver mais detalhes
                    </Button>
                  </div>

                  <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {networkCount > 0
                          ? `${networkCount} prestador(es) na rede`
                          : 'Rede hospitalar ainda nao cadastrada'}
                      </span>
                    </div>

                  {(item.administradora?.name || item.entidadesClasse.length > 0 || item.observacao) && (
                    <div className="mt-3 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_90%,var(--panel-surface,#fffdfa))] px-4 py-3 text-sm text-[color:var(--panel-text-soft,#5b4635)] dark:bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#2a2119)_76%,var(--panel-surface,#1b1611))]">
                      {item.administradora?.name && <p>Administradora: {item.administradora.name}</p>}
                      {item.entidadesClasse.length > 0 && <p>Entidades: {item.entidadesClasse.map((entity) => entity.name).filter(Boolean).join(', ')}</p>}
                      {item.observacao && <p>{item.observacao}</p>}
                    </div>
                  )}
                  </article>
                );
              })}

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-[var(--panel-border,#d4c0a7)] bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_84%,var(--panel-surface-soft,#f4ede3))] px-6 text-center transition-all hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_72%,var(--panel-accent-soft,#f6e4c7))]"
              >
                <div className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 text-[var(--panel-accent-ink,#6f3f16)]">
                  <Plus className="h-6 w-6" />
                </div>
                <p className="mt-4 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Adicionar outro plano</p>
                <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Compare mais uma opção sem sair da cotação.</p>
              </button>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-[color:rgba(111,63,22,0.14)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_84%,var(--panel-surface,#fffdfa))] p-2.5 text-[var(--panel-accent-ink,#6f3f16)]">
                <Link2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Lead CRM</p>
                <h3 className="mt-2 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Vincular lead</h3>
                <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Busque por nome, telefone ou email para conectar esta cotação ao lead certo.</p>
              </div>
            </div>

            <div className="mt-4">
              <FilterSingleSelect
                icon={UserRound}
                options={leadOptions}
                placeholder="Sem lead vinculado"
                value={quote.leadId ?? ''}
                onChange={(value) => onUpdateLead(value || null)}
                searchable
                searchPlaceholder="Digite para buscar um lead"
                emptyMessage="Nenhum lead encontrado para a busca."
                disabled={leadBusy}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Lead atual</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{linkedLeadLabel}</p>
            </div>
          </section>

          <section className="rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-muted,#876f5c)]">Distribuição</p>
                <h3 className="mt-2 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Resumo da cotação</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={onEditQuote}>
                Editar
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
                <Users className="h-4 w-4" />
                Faixas preenchidas
              </div>
              <div className="mt-3 space-y-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                {filledDistribution.length > 0 ? (
                  filledDistribution.map(([range, quantity]) => (
                    <div key={range} className="flex items-center justify-between gap-4">
                      <span>{range}</span>
                      <span className="font-semibold text-[color:var(--panel-text,#1a120d)]">{quantity}</span>
                    </div>
                  ))
                ) : (
                  <p>Nenhuma vida distribuída.</p>
                )}
              </div>
            </div>
          </section>

        </aside>
      </div>

      <ModalShell
        isOpen={networkCompareOpen}
        onClose={() => setNetworkCompareOpen(false)}
        title="Comparativo de rede"
        description="Cruze os prestadores de todos os planos selecionados para ver o que se repete e o que muda entre as opções da shortlist."
        size="xl"
      >
        {!networkPlansHaveData ? (
          <div className="rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center text-sm text-[color:var(--panel-text-soft,#5b4635)]">
            Adicione planos com rede hospitalar cadastrada para comparar os prestadores.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Prestadores únicos</p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{networkComparisonRows.length}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Em todos os planos</p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{networkSharedRowsCount}</p>
              </div>
              <div className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Exclusivos</p>
                <p className="mt-1 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{networkExclusiveRowsCount}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--panel-accent-ink,#6f3f16)]">Planos comparados</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {selectedItems.map((item) => (
                  <div key={item.id} className="min-w-[180px] rounded-2xl border border-[color:rgba(111,63,22,0.16)] bg-[var(--panel-surface,#fffdfa)] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">
                      {item.operadora.name ?? 'Operadora'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.titulo}</p>
                    <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{networkSummaryByItemId.get(item.id)?.count ?? 0} prestador(es)</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
              <Input
                value={networkCompareSearch}
                onChange={(event) => setNetworkCompareSearch(event.target.value)}
                placeholder="Buscar hospital, bairro, regiao, cidade ou atendimento"
                leftIcon={Search}
              />
              <FilterSingleSelect
                icon={MapPin}
                options={networkComparisonCityOptions}
                placeholder="Todas as cidades"
                value={networkCompareCity}
                onChange={setNetworkCompareCity}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'shared', label: 'Comuns' },
                { value: 'differentials', label: 'Diferenciais' },
              ].map((option) => {
                const isActive = networkCompareMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setNetworkCompareMode(option.value as NetworkCompareMode)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                      isActive
                        ? 'border-[color:rgba(111,63,22,0.28)] bg-[color:var(--panel-surface,#fffdfa)] text-[color:var(--panel-text,#1a120d)]'
                        : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface-soft,#f4ede3)] text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[color:var(--panel-surface,#fffdfa)]',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {filteredNetworkComparisonRows.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-6 py-12 text-center text-sm text-[color:var(--panel-text-soft,#5b4635)]">
                Nenhum prestador encontrado para os filtros aplicados.
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]">
                <div className="overflow-x-auto">
                  <div className="min-w-[960px]">
                    <div className="grid border-b border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)]" style={networkComparisonMatrixStyle}>
                      <div className="px-4 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">Prestador</p>
                        <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">Comparativo por plano</p>
                      </div>
                      {selectedItems.map((item) => (
                        <div key={item.id} className="border-l border-[color:var(--panel-border-subtle,#e7dac8)] px-4 py-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">
                            {item.operadora.name ?? 'Operadora'}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{item.titulo}</p>
                          <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">{networkSummaryByItemId.get(item.id)?.count ?? 0} prestador(es)</p>
                        </div>
                      ))}
                    </div>

                    {filteredNetworkComparisonRows.map((row) => (
                      <div key={row.key} className="grid" style={networkComparisonMatrixStyle}>
                        <div className="border-b border-[color:var(--panel-border-subtle,#e7dac8)] px-4 py-4">
                          <div className="flex items-start gap-3">
                            <span className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-2 text-[var(--panel-accent-ink,#6f3f16)]">
                              <Building2 className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{row.hospital}</p>
                                <span className="rounded-full border border-[color:rgba(111,63,22,0.16)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--panel-text-soft,#5b4635)]">
                                  {row.hitsCount === selectedItems.length ? 'Em todos' : `${row.hitsCount}/${selectedItems.length}`}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                                {[row.bairro, row.regiao, row.cidade].filter(Boolean).join(' | ')}
                              </p>
                              {row.services.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {row.services.slice(0, 6).map((service) => (
                                    <span key={`${row.key}-${service}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                                      {service}
                                    </span>
                                  ))}
                                  {row.services.length > 6 && (
                                    <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                                      +{row.services.length - 6}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {selectedItems.map((item) => {
                          const presence = row.planPresence[item.id];

                          return (
                            <div key={`${row.key}-${item.id}`} className="border-b border-l border-[color:var(--panel-border-subtle,#e7dac8)] p-3">
                              {presence ? (
                                <div className="rounded-2xl border border-[color:rgba(111,63,22,0.14)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_72%,var(--panel-surface,#fffdfa))] p-3">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">
                                    <Check className="h-4 w-4 text-[var(--panel-accent-ink,#6f3f16)]" />
                                    Na rede
                                  </div>
                                  {presence.services.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {presence.services.slice(0, 4).map((service) => (
                                        <span key={`${row.key}-${item.id}-${service}`} className="rounded-full border border-[color:rgba(111,63,22,0.12)] bg-[var(--panel-surface,#fffdfa)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                                          {service}
                                        </span>
                                      ))}
                                      {presence.services.length > 4 && (
                                        <span className="rounded-full border border-[color:rgba(111,63,22,0.12)] bg-[var(--panel-surface,#fffdfa)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                                          +{presence.services.length - 4}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">Sem detalhamento de atendimento.</p>
                                  )}
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-dashed border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-3">
                                  <div className="flex items-center gap-2 text-sm font-medium text-[color:var(--panel-text-soft,#5b4635)]">
                                    <Minus className="h-4 w-4" />
                                    Nao consta
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ModalShell>

      <CotadorPlanPickerOverlay
        isOpen={pickerOpen}
        quote={quote}
        catalogItems={catalogItems}
        filteredItems={filteredItems}
        filters={filters}
        filterOptions={filterOptions}
        busy={busy}
        onClose={() => setPickerOpen(false)}
        onSelectItem={(itemId) => {
          onToggleCatalogItem(itemId);
        }}
        onUpdateFilters={onUpdateFilters}
        onResetFilters={onResetFilters}
      />
    </div>
  );
}
