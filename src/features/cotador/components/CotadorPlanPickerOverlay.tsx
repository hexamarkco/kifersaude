import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgePercent,
  Building2,
  CheckCircle2,
  Layers3,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import { cx } from '../../../lib/cx';
import { COTADOR_MODALITY_OPTIONS, type CotadorQuoteModality } from '../shared/cotadorConstants';
import { formatCotadorModality } from '../shared/cotadorUtils';
import type { CotadorCatalogActor, CotadorCatalogFilters, CotadorCatalogItem, CotadorQuote } from '../shared/cotadorTypes';

type SelectOption = {
  value: string;
  label: string;
};

type CotadorPlanPickerOverlayProps = {
  isOpen: boolean;
  quote: CotadorQuote;
  catalogItems: CotadorCatalogItem[];
  filteredItems: CotadorCatalogItem[];
  filters: CotadorCatalogFilters;
  filterOptions: {
    operadoras: SelectOption[];
    linhas: SelectOption[];
    administradoras: SelectOption[];
    entidades: SelectOption[];
    perfisEmpresariais: SelectOption[];
    coparticipacoes: SelectOption[];
    abrangencias: SelectOption[];
    acomodacoes: SelectOption[];
  };
  busy?: boolean;
  onClose: () => void;
  onSelectItem: (itemId: string) => void;
  onUpdateFilters: (updates: Partial<CotadorCatalogFilters>) => void;
  onResetFilters: () => void;
  onChangeQuoteModality: (modality: CotadorQuoteModality) => void;
};

type OperatorCard = {
  actor: CotadorCatalogActor;
  lineCount: number;
  itemCount: number;
  productCount: number;
};

type LineCard = {
  actor: CotadorCatalogActor;
  productCount: number;
  tableCount: number;
  businessProfiles: string[];
  coparticipacoes: string[];
};

type ProductGroup = {
  key: string;
  title: string;
  lineName: string | null;
  itemCount: number;
  tableCount: number;
  lowestPrice: number | null;
  items: CotadorCatalogItem[];
};

const formatBusinessProfile = (value: string | null | undefined) => {
  if (value === 'mei') return 'MEI';
  if (value === 'nao_mei') return 'Nao MEI';
  if (value === 'todos') return 'Todos';
  return 'Livre';
};

const formatCoparticipacao = (value: string | null | undefined) => {
  if (value === 'parcial') return 'Parcial';
  if (value === 'total') return 'Completa';
  if (value === 'sem') return 'Sem copart.';
  return 'A definir';
};

const getInitials = (value: string | null | undefined) =>
  (value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const formatLivesRange = (item: CotadorCatalogItem) => {
  if (item.vidasMin === null && item.vidasMax === null) {
    return 'Sem faixa de vidas';
  }

  return `${item.vidasMin ?? 1} a ${item.vidasMax ?? '...'} vidas`;
};

export default function CotadorPlanPickerOverlay({
  isOpen,
  quote,
  catalogItems,
  filteredItems,
  filters,
  filterOptions,
  busy = false,
  onClose,
  onSelectItem,
  onUpdateFilters,
  onResetFilters,
  onChangeQuoteModality,
}: CotadorPlanPickerOverlayProps) {
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSelectedProductKey(null);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    setSelectedProductKey(null);
  }, [filters.operadoraId, filters.linhaId, filters.search, quote.modality, isOpen]);

  const selectedIds = useMemo(
    () => new Set(quote.selectedItems.map((item) => item.catalogItemKey)),
    [quote.selectedItems],
  );

  const operatorCards = useMemo<OperatorCard[]>(() => {
    const grouped = new Map<string, OperatorCard>();

    catalogItems.forEach((item) => {
      const current = grouped.get(item.operadora.id);
      if (current) {
        current.itemCount += 1;
        if (item.linha?.id) {
          current.lineCount = new Set([
            ...Array.from({ length: current.lineCount }, (_, index) => `${index}`),
          ]).size;
        }
        return;
      }

      grouped.set(item.operadora.id, {
        actor: item.operadora,
        lineCount: 0,
        itemCount: 0,
        productCount: 0,
      });
    });

    const lineMap = new Map<string, Set<string>>();
    const productMap = new Map<string, Set<string>>();

    catalogItems.forEach((item) => {
      const lineSet = lineMap.get(item.operadora.id) ?? new Set<string>();
      if (item.linha?.id) lineSet.add(item.linha.id);
      lineMap.set(item.operadora.id, lineSet);

      const productSet = productMap.get(item.operadora.id) ?? new Set<string>();
      productSet.add(item.titulo);
      productMap.set(item.operadora.id, productSet);

      const current = grouped.get(item.operadora.id);
      if (current) {
        current.itemCount += 1;
      }
    });

    return Array.from(grouped.values())
      .map((card) => ({
        ...card,
        lineCount: lineMap.get(card.actor.id)?.size ?? 0,
        productCount: productMap.get(card.actor.id)?.size ?? 0,
      }))
      .sort((left, right) => (left.actor.name ?? '').localeCompare(right.actor.name ?? '', 'pt-BR'));
  }, [catalogItems]);

  const operatorScopedItems = useMemo(
    () => (filters.operadoraId ? catalogItems.filter((item) => item.operadora.id === filters.operadoraId) : []),
    [catalogItems, filters.operadoraId],
  );

  const lineCards = useMemo<LineCard[]>(() => {
    const grouped = new Map<string, { actor: CotadorCatalogActor; items: CotadorCatalogItem[] }>();

    operatorScopedItems.forEach((item) => {
      if (!item.linha?.id) return;
      const current = grouped.get(item.linha.id);
      if (current) {
        current.items.push(item);
        return;
      }

      grouped.set(item.linha.id, {
        actor: item.linha,
        items: [item],
      });
    });

    return Array.from(grouped.values())
      .map(({ actor, items }) => ({
        actor,
        productCount: new Set(items.map((item) => item.titulo)).size,
        tableCount: items.filter((item) => item.source === 'cotador_tabela').length,
        businessProfiles: Array.from(new Set(items.map((item) => formatBusinessProfile(item.perfilEmpresarial)).filter(Boolean))),
        coparticipacoes: Array.from(new Set(items.map((item) => formatCoparticipacao(item.coparticipacao)).filter(Boolean))),
      }))
      .sort((left, right) => (left.actor.name ?? '').localeCompare(right.actor.name ?? '', 'pt-BR'));
  }, [operatorScopedItems]);

  const productGroups = useMemo<ProductGroup[]>(() => {
    const grouped = new Map<string, ProductGroup>();
    const sourceItems = filters.linhaId
      ? filteredItems
      : lineCards.length > 0
        ? filteredItems.filter((item) => item.linha?.id === filters.linhaId)
        : filteredItems;

    sourceItems
      .filter((item) => item.source !== 'operadora')
      .forEach((item) => {
        const key = `${item.linha?.id ?? 'sem-linha'}:${item.titulo}`;
        const current = grouped.get(key);
        if (current) {
          current.itemCount += 1;
          current.tableCount += item.source === 'cotador_tabela' ? 1 : 0;
          current.items.push(item);
          if (item.estimatedMonthlyTotal !== null) {
            current.lowestPrice = current.lowestPrice === null
              ? item.estimatedMonthlyTotal
              : Math.min(current.lowestPrice, item.estimatedMonthlyTotal);
          }
          return;
        }

        grouped.set(key, {
          key,
          title: item.titulo,
          lineName: item.linha?.name ?? null,
          itemCount: 1,
          tableCount: item.source === 'cotador_tabela' ? 1 : 0,
          lowestPrice: item.estimatedMonthlyTotal,
          items: [item],
        });
      });

    return Array.from(grouped.values()).sort((left, right) => left.title.localeCompare(right.title, 'pt-BR'));
  }, [filteredItems, filters.linhaId, lineCards.length]);

  const activeProductGroup = useMemo(
    () => productGroups.find((group) => group.key === selectedProductKey) ?? null,
    [productGroups, selectedProductKey],
  );

  const tableCandidates = useMemo(() => {
    if (!activeProductGroup) return [];

    return [...activeProductGroup.items].sort((left, right) => {
      const priceLeft = left.estimatedMonthlyTotal ?? Number.MAX_SAFE_INTEGER;
      const priceRight = right.estimatedMonthlyTotal ?? Number.MAX_SAFE_INTEGER;
      if (priceLeft !== priceRight) {
        return priceLeft - priceRight;
      }

      return (left.tabelaNome ?? left.titulo).localeCompare(right.tabelaNome ?? right.titulo, 'pt-BR');
    });
  }, [activeProductGroup]);

  const selectedOperator = useMemo(
    () => operatorCards.find((card) => card.actor.id === filters.operadoraId) ?? null,
    [filters.operadoraId, operatorCards],
  );

  const selectedLine = useMemo(
    () => lineCards.find((card) => card.actor.id === filters.linhaId) ?? null,
    [filters.linhaId, lineCards],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(7,11,23,0.72)] backdrop-blur-sm">
      <div className="absolute inset-4 overflow-hidden rounded-[32px] border border-[rgba(120,146,201,0.18)] bg-[linear-gradient(180deg,#101827_0%,#111c2d_100%)] text-slate-100 shadow-[0_40px_120px_rgba(0,0,0,0.45)] md:inset-6">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[rgba(120,146,201,0.15)] px-6 py-5 md:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/80">Adicionar plano</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                {!filters.operadoraId
                  ? 'Escolha a operadora'
                  : !filters.linhaId && lineCards.length > 0
                    ? `Escolha a linha em ${selectedOperator?.actor.name ?? 'operadora'}`
                    : activeProductGroup
                      ? 'Escolha a tabela comercial'
                      : 'Escolha o produto'}
              </h3>
              <p className="mt-1 text-sm text-slate-300">
                Use os filtros da lateral para chegar rapido na carteira certa para {quote.name}.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(120,146,201,0.18)] bg-white/5 text-slate-200 transition-colors hover:bg-white/10"
              aria-label="Fechar seletor"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="overflow-y-auto border-r border-[rgba(120,146,201,0.12)] bg-[rgba(8,13,24,0.62)] px-5 py-5 md:px-6">
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Modalidade</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-[rgba(120,146,201,0.14)] bg-[rgba(255,255,255,0.03)] p-1.5">
                    {COTADOR_MODALITY_OPTIONS.map((option) => {
                      const isActive = quote.modality === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onChangeQuoteModality(option.value)}
                          className={cx(
                            'cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition-all',
                            isActive
                              ? 'bg-white text-slate-950 shadow-sm'
                              : 'text-slate-300 hover:bg-white/8 hover:text-white',
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-[rgba(120,146,201,0.14)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Distribuicao</p>
                      <p className="mt-1 text-base font-semibold text-white">{quote.totalLives} vidas</p>
                    </div>
                    <span className="rounded-full bg-cyan-400/12 px-3 py-1 text-xs font-semibold text-cyan-200">
                      {formatCotadorModality(quote.modality)}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    value={filters.search}
                    onChange={(event) => onUpdateFilters({ search: event.target.value })}
                    placeholder="Buscar por operadora, linha, produto ou tabela"
                    leftIcon={Search}
                  />
                  <FilterSingleSelect
                    icon={ShieldCheck}
                    options={filterOptions.administradoras}
                    placeholder="Todas as administradoras"
                    value={filters.administradoraId}
                    onChange={(next) => onUpdateFilters({ administradoraId: next })}
                  />
                  <FilterSingleSelect
                    icon={UserRound}
                    options={filterOptions.entidades}
                    placeholder="Todas as entidades"
                    value={filters.entidadeId}
                    onChange={(next) => onUpdateFilters({ entidadeId: next })}
                  />
                  <FilterSingleSelect
                    icon={BadgePercent}
                    options={filterOptions.perfisEmpresariais}
                    placeholder="Perfil empresarial"
                    value={filters.perfilEmpresarial}
                    onChange={(next) => onUpdateFilters({ perfilEmpresarial: next as CotadorCatalogFilters['perfilEmpresarial'] })}
                  />
                  <FilterSingleSelect
                    icon={Sparkles}
                    options={filterOptions.coparticipacoes}
                    placeholder="Coparticipacao"
                    value={filters.coparticipacao}
                    onChange={(next) => onUpdateFilters({ coparticipacao: next as CotadorCatalogFilters['coparticipacao'] })}
                  />
                  <FilterSingleSelect
                    icon={MapPin}
                    options={filterOptions.abrangencias}
                    placeholder="Todas as abrangencias"
                    value={filters.abrangencia}
                    onChange={(next) => onUpdateFilters({ abrangencia: next })}
                  />
                  <FilterSingleSelect
                    icon={Layers3}
                    options={filterOptions.acomodacoes}
                    placeholder="Todas as acomodacoes"
                    value={filters.acomodacao}
                    onChange={(next) => onUpdateFilters({ acomodacao: next })}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={onResetFilters} fullWidth>
                    Limpar filtros
                  </Button>
                </div>
              </div>
            </aside>

            <section className="min-h-0 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
              <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                {filters.operadoraId && (
                  <button
                    type="button"
                    onClick={() => onUpdateFilters({ operadoraId: '', linhaId: '' })}
                    className="inline-flex items-center gap-2 rounded-full border border-[rgba(120,146,201,0.2)] bg-white/5 px-3 py-1.5 transition-colors hover:bg-white/10"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para operadoras
                  </button>
                )}
                {filters.linhaId && (
                  <button
                    type="button"
                    onClick={() => onUpdateFilters({ linhaId: '' })}
                    className="inline-flex items-center gap-2 rounded-full border border-[rgba(120,146,201,0.2)] bg-white/5 px-3 py-1.5 transition-colors hover:bg-white/10"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para linhas
                  </button>
                )}
                {selectedOperator?.actor.name && (
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-cyan-100">
                    {selectedOperator.actor.name}
                  </span>
                )}
                {selectedLine?.actor.name && (
                  <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-white">
                    {selectedLine.actor.name}
                  </span>
                )}
              </div>

              {!filters.operadoraId ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Selecione a operadora</h4>
                    <p className="mt-1 text-sm text-slate-400">Comece pela operadora e depois aprofunde por linha, produto e tabela.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {operatorCards.map((card) => (
                      <button
                        key={card.actor.id}
                        type="button"
                        onClick={() => onUpdateFilters({ operadoraId: card.actor.id, linhaId: '' })}
                        className="cursor-pointer rounded-[28px] border border-[rgba(120,146,201,0.15)] bg-[rgba(16,23,38,0.82)] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-[rgba(18,31,52,0.94)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="rounded-2xl bg-[linear-gradient(135deg,rgba(93,164,255,0.26),rgba(17,24,39,0.1))] px-4 py-3 text-3xl font-semibold tracking-tight text-white">
                            {getInitials(card.actor.name) || 'OP'}
                          </div>
                          <Building2 className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="mt-5 text-lg font-semibold text-white">{card.actor.name}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                          <span className="rounded-full bg-white/6 px-2.5 py-1">{card.lineCount} linhas</span>
                          <span className="rounded-full bg-white/6 px-2.5 py-1">{card.productCount} produtos</span>
                          <span className="rounded-full bg-white/6 px-2.5 py-1">{card.itemCount} ofertas</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : !filters.linhaId && lineCards.length > 0 ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Selecione a linha</h4>
                    <p className="mt-1 text-sm text-slate-400">Cada linha pode abrir produtos e tabelas diferentes para MEI, não MEI e coparticipação.</p>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {lineCards.map((line) => (
                      <button
                        key={line.actor.id}
                        type="button"
                        onClick={() => onUpdateFilters({ linhaId: line.actor.id })}
                        className="cursor-pointer rounded-[28px] border border-[rgba(120,146,201,0.15)] bg-[rgba(9,14,26,0.92)] p-5 text-left transition-all hover:border-cyan-400/38 hover:bg-[rgba(11,18,34,0.98)]"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-2xl font-semibold text-white">{line.actor.name}</p>
                            <p className="mt-2 text-sm text-slate-400">{line.productCount} produto(s) | {line.tableCount} tabela(s)</p>
                          </div>
                          <ArrowLeft className="h-5 w-5 rotate-180 text-slate-400" />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                          {line.coparticipacoes.map((item) => (
                            <span key={`${line.actor.id}-${item}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                              {item}
                            </span>
                          ))}
                          {line.businessProfiles.map((item) => (
                            <span key={`${line.actor.id}-${item}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                              {item}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : activeProductGroup ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-semibold text-white">Selecione a tabela</h4>
                      <p className="mt-1 text-sm text-slate-400">
                        {activeProductGroup.title}
                        {activeProductGroup.lineName ? ` | ${activeProductGroup.lineName}` : ''}
                      </p>
                    </div>
                    <Button variant="secondary" onClick={() => setSelectedProductKey(null)}>
                      Voltar aos produtos
                    </Button>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {tableCandidates.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={cx(
                            'rounded-[28px] border p-5 transition-all',
                            isSelected
                              ? 'border-emerald-400/35 bg-emerald-500/10'
                              : 'border-[rgba(120,146,201,0.15)] bg-[rgba(16,23,38,0.82)]',
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-semibold text-white">{item.tabelaNome ?? item.titulo}</p>
                              <p className="mt-1 text-sm text-slate-400">{item.tabelaCodigo ?? item.linha?.name ?? 'Tabela comercial'}</p>
                            </div>
                            <Button
                              onClick={() => {
                                if (isSelected) return;
                                onSelectItem(item.id);
                              }}
                              disabled={busy || isSelected}
                              variant={isSelected ? 'success' : 'primary'}
                            >
                              {isSelected ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4" />
                                  Adicionado
                                </>
                              ) : (
                                'Adicionar'
                              )}
                            </Button>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{formatBusinessProfile(item.perfilEmpresarial)}</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{formatCoparticipacao(item.coparticipacao)}</span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{formatLivesRange(item)}</span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                            {Object.entries(item.pricesByAgeRange).map(([range, value]) => (
                              <div key={`${item.id}-${range}`} className="rounded-2xl border border-white/8 bg-white/4 px-3 py-2 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{range}</p>
                                <p className="mt-1 text-sm font-semibold text-white">R$ {value?.toFixed(2)}</p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-cyan-400/15 bg-cyan-400/8 px-4 py-3">
                            <span className="text-sm text-cyan-100">Mensalidade estimada</span>
                            <span className="text-lg font-semibold text-white">
                              {item.estimatedMonthlyTotal !== null ? `R$ ${item.estimatedMonthlyTotal.toFixed(2)}` : 'A calcular'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-lg font-semibold text-white">Selecione o produto</h4>
                    <p className="mt-1 text-sm text-slate-400">Depois disso voce escolhe a tabela ideal para a faixa de vidas desta cotacao.</p>
                  </div>
                  {productGroups.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-white/12 bg-white/4 px-8 py-16 text-center">
                      <Search className="mx-auto h-10 w-10 text-slate-400" />
                      <h4 className="mt-4 text-lg font-semibold text-white">Nenhum produto disponivel</h4>
                      <p className="mt-2 text-sm text-slate-400">Ajuste os filtros ou revise o catalogo do Cotador nas Configuracoes.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {productGroups.map((group) => (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => setSelectedProductKey(group.key)}
                          className={cx(
                            'cursor-pointer rounded-[28px] border p-5 text-left transition-all',
                            selectedProductKey === group.key
                              ? 'border-cyan-400/45 bg-cyan-400/10'
                              : 'border-[rgba(120,146,201,0.15)] bg-[rgba(16,23,38,0.82)] hover:border-cyan-400/30 hover:bg-[rgba(18,31,52,0.94)]',
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xl font-semibold text-white">{group.title}</p>
                              <p className="mt-2 text-sm text-slate-400">{group.lineName ?? 'Produto avulso'}</p>
                            </div>
                            <ArrowLeft className="h-5 w-5 rotate-180 text-slate-400" />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{group.tableCount || group.itemCount} opcao(oes)</span>
                            {group.lowestPrice !== null && <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">A partir de R$ {group.lowestPrice.toFixed(2)}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
