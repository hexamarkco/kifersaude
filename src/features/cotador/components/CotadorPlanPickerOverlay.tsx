import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { isPanelDarkTheme } from '../../../components/ui/dropdownStyles';
import { COTADOR_MODALITY_OPTIONS, type CotadorQuoteModality } from '../shared/cotadorConstants';
import { formatCotadorCurrency } from '../shared/cotadorUtils';
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
  if (value === 'nao_mei') return 'Não MEI';
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
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedProductKey, setSelectedProductKey] = useState<string | null>(null);
  const isDarkTheme = isPanelDarkTheme();

  useEffect(() => {
    if (!isOpen) {
      setSelectedOperatorId(null);
      setSelectedLineId(null);
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
    if (!isOpen) return;
    setSelectedProductKey(null);
  }, [filters.search, filters.administradoraId, filters.entidadeId, filters.perfilEmpresarial, filters.coparticipacao, filters.abrangencia, filters.acomodacao, quote.modality, isOpen]);

  const selectedIds = useMemo(
    () => new Set(quote.selectedItems.map((item) => item.catalogItemKey)),
    [quote.selectedItems],
  );

  const discoveryItems = useMemo(
    () => filteredItems.filter((item) => item.source !== 'operadora'),
    [filteredItems],
  );

  const operatorCards = useMemo<OperatorCard[]>(() => {
    const grouped = new Map<string, OperatorCard>();
    const lineMap = new Map<string, Set<string>>();
    const productMap = new Map<string, Set<string>>();

    discoveryItems.forEach((item) => {
      const current = grouped.get(item.operadora.id);
      if (current) {
        current.itemCount += 1;
      } else {
        grouped.set(item.operadora.id, {
          actor: item.operadora,
          lineCount: 0,
          itemCount: 1,
          productCount: 0,
        });
      }

      const lineSet = lineMap.get(item.operadora.id) ?? new Set<string>();
      if (item.linha?.id) lineSet.add(item.linha.id);
      lineMap.set(item.operadora.id, lineSet);

      const productSet = productMap.get(item.operadora.id) ?? new Set<string>();
      productSet.add(item.titulo);
      productMap.set(item.operadora.id, productSet);
    });

    return Array.from(grouped.values())
      .map((card) => ({
        ...card,
        lineCount: lineMap.get(card.actor.id)?.size ?? 0,
        productCount: productMap.get(card.actor.id)?.size ?? 0,
      }))
      .sort((left, right) => (left.actor.name ?? '').localeCompare(right.actor.name ?? '', 'pt-BR'));
  }, [discoveryItems]);

  const operatorScopedItems = useMemo(
    () => (selectedOperatorId ? discoveryItems.filter((item) => item.operadora.id === selectedOperatorId) : []),
    [discoveryItems, selectedOperatorId],
  );

  const lineCards = useMemo<LineCard[]>(() => {
    const grouped = new Map<string, { actor: CotadorCatalogActor; items: CotadorCatalogItem[] }>();

    operatorScopedItems.forEach((item) => {
      if (!item.linha?.id) return;
      const current = grouped.get(item.linha.id);
      if (current) {
        current.items.push(item);
      } else {
        grouped.set(item.linha.id, { actor: item.linha, items: [item] });
      }
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

  const lineScopedItems = useMemo(
    () => (selectedLineId ? operatorScopedItems.filter((item) => item.linha?.id === selectedLineId) : operatorScopedItems),
    [operatorScopedItems, selectedLineId],
  );

  const productGroups = useMemo<ProductGroup[]>(() => {
    const grouped = new Map<string, ProductGroup>();
    const sourceItems = lineScopedItems;

    sourceItems.forEach((item) => {
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
  }, [lineScopedItems]);

  const activeProductGroup = useMemo(
    () => productGroups.find((group) => group.key === selectedProductKey) ?? null,
    [productGroups, selectedProductKey],
  );

  const tableCandidates = useMemo(() => {
    if (!activeProductGroup) return [];

    return [...activeProductGroup.items].sort((left, right) => {
      const priceLeft = left.estimatedMonthlyTotal ?? Number.MAX_SAFE_INTEGER;
      const priceRight = right.estimatedMonthlyTotal ?? Number.MAX_SAFE_INTEGER;
      if (priceLeft !== priceRight) return priceLeft - priceRight;
      return (left.tabelaNome ?? left.titulo).localeCompare(right.tabelaNome ?? right.titulo, 'pt-BR');
    });
  }, [activeProductGroup]);

  const selectedOperator = useMemo(
    () => operatorCards.find((card) => card.actor.id === selectedOperatorId) ?? null,
    [selectedOperatorId, operatorCards],
  );

  const selectedLine = useMemo(
    () => lineCards.find((card) => card.actor.id === selectedLineId) ?? null,
    [selectedLineId, lineCards],
  );

  useEffect(() => {
    if (selectedOperatorId && !operatorCards.some((card) => card.actor.id === selectedOperatorId)) {
      setSelectedOperatorId(null);
      setSelectedLineId(null);
      setSelectedProductKey(null);
    }
  }, [operatorCards, selectedOperatorId]);

  useEffect(() => {
    if (selectedLineId && !lineCards.some((card) => card.actor.id === selectedLineId)) {
      setSelectedLineId(null);
      setSelectedProductKey(null);
    }
  }, [lineCards, selectedLineId]);

  useEffect(() => {
    if (selectedProductKey && !productGroups.some((group) => group.key === selectedProductKey)) {
      setSelectedProductKey(null);
    }
  }, [productGroups, selectedProductKey]);

  const currentStep = !selectedOperatorId
    ? 'operator'
    : activeProductGroup
      ? 'table'
      : lineCards.length > 0 && !selectedLineId
        ? 'line'
        : 'product';

  const floatingPanelTitle = currentStep === 'line'
    ? selectedOperator?.actor.name ?? 'Linhas disponíveis'
    : currentStep === 'table'
      ? activeProductGroup?.title ?? 'Tabelas comerciais'
      : selectedLine?.actor.name ?? selectedOperator?.actor.name ?? 'Produtos disponíveis';

  const floatingPanelSubtitle = currentStep === 'line'
    ? 'Escolha a linha comercial para continuar.'
    : currentStep === 'table'
      ? 'Selecione a melhor tabela para adicionar à cotação.'
      : 'Veja as opções disponíveis dentro do contexto filtrado.';

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className={cx(
      'painel-theme fixed inset-0 z-[145] bg-[color:rgba(12,16,25,0.58)] backdrop-blur-sm',
      isDarkTheme ? 'theme-dark dark' : 'theme-light',
    )}>
      <div className="flex h-full items-stretch justify-center p-4 md:p-6">
        <div className={cx(
          'flex h-full w-full max-w-[1880px] flex-col overflow-hidden rounded-[32px] border shadow-[0_40px_120px_rgba(0,0,0,0.28)]',
          isDarkTheme
            ? 'border-[color:rgba(255,255,255,0.08)] bg-[linear-gradient(180deg,#16100c_0%,#1f1711_100%)] text-[color:#fff8ef]'
            : 'border-[var(--panel-border,#d4c0a7)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--panel-surface,#fffdfa)_90%,var(--panel-surface-soft,#f4ede3))_0%,color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_82%,var(--panel-surface,#fffdfa))_100%)] text-[color:var(--panel-text,#1a120d)]',
        )}>
          <div className="flex items-center justify-between border-b border-[color:var(--panel-border-subtle,#e7dac8)] px-6 py-5 md:px-8">
            <div>
              <p className={cx('text-xs font-semibold uppercase tracking-[0.24em]', isDarkTheme ? 'text-[color:#f3c892]' : 'text-[var(--panel-accent-ink,#6f3f16)]')}>Adicionar plano</p>
              <h3 className={cx('mt-2 text-2xl font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>
                {!filters.operadoraId
                  ? 'Escolha a operadora'
                  : !filters.linhaId && lineCards.length > 0
                    ? `Escolha a linha em ${selectedOperator?.actor.name ?? 'operadora'}`
                    : activeProductGroup
                      ? 'Escolha a tabela comercial'
                      : 'Escolha o produto'}
              </h3>
              <p className={cx('mt-1 text-sm', isDarkTheme ? 'text-[color:rgba(255,243,209,0.72)]' : 'text-[color:var(--panel-text-soft,#5b4635)]')}>{quote.name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cx(
                'inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors',
                isDarkTheme
                  ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)] text-[color:rgba(255,243,209,0.8)] hover:bg-[color:rgba(255,255,255,0.08)] hover:text-white'
                  : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)] hover:text-[color:var(--panel-text,#1a120d)]',
              )}
              aria-label="Fechar seletor"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className={cx(
              'overflow-y-auto border-r px-5 py-5 md:px-6',
              isDarkTheme
                ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.03)]'
                : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[color:color-mix(in_srgb,var(--panel-surface-soft,#f4ede3)_82%,var(--panel-surface,#fffdfa))]',
            )}>
              <div className="space-y-5">
                <div>
                    <p className={cx('text-xs font-semibold uppercase tracking-[0.18em]', isDarkTheme ? 'text-[color:rgba(255,243,209,0.62)]' : 'text-[color:var(--panel-text-muted,#876f5c)]')}>Modalidade</p>
                    <div className={cx(
                      'mt-3 grid grid-cols-3 gap-2 rounded-2xl border p-1.5 shadow-sm',
                      isDarkTheme
                        ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)]'
                        : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]',
                    )}>
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
                              ? isDarkTheme
                                ? 'bg-[color:rgba(251,191,36,0.16)] text-[color:#fde68a] shadow-sm'
                                : 'bg-[var(--panel-accent-soft,#f6e4c7)] text-[var(--panel-accent-ink-strong,#4a2411)] shadow-sm'
                              : isDarkTheme
                                ? 'text-[color:rgba(255,243,209,0.82)] hover:bg-[color:rgba(255,255,255,0.06)] hover:text-white'
                                : 'text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)] hover:text-[color:var(--panel-text,#1a120d)]',
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    value={filters.search}
                    onChange={(event) => onUpdateFilters({ search: event.target.value })}
                    placeholder="Buscar por operadora, linha, produto ou tabela"
                    leftIcon={Search}
                    className={cx(
                      isDarkTheme
                        ? '[--panel-input-text:#fff8ef] [--panel-placeholder:rgba(255,243,209,0.42)] !border-[color:rgba(255,255,255,0.1)] !bg-[color:rgba(255,255,255,0.06)] !text-[color:#fff8ef] !shadow-none placeholder:!text-[color:rgba(255,243,209,0.42)] focus:!border-[color:rgba(251,191,36,0.28)] focus:!ring-[color:rgba(251,191,36,0.26)]'
                        : undefined,
                    )}
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
                    placeholder="Coparticipação"
                    value={filters.coparticipacao}
                    onChange={(next) => onUpdateFilters({ coparticipacao: next as CotadorCatalogFilters['coparticipacao'] })}
                  />
                  <FilterSingleSelect
                    icon={MapPin}
                    options={filterOptions.abrangencias}
                    placeholder="Todas as abrangências"
                    value={filters.abrangencia}
                    onChange={(next) => onUpdateFilters({ abrangencia: next })}
                  />
                  <FilterSingleSelect
                    icon={Layers3}
                    options={filterOptions.acomodacoes}
                    placeholder="Todas as acomodações"
                    value={filters.acomodacao}
                    onChange={(next) => onUpdateFilters({ acomodacao: next })}
                  />
                </div>

                <Button
                  variant="secondary"
                  onClick={onResetFilters}
                  fullWidth
                  className={cx(
                    isDarkTheme
                      ? '!border-[color:rgba(251,191,36,0.72)] !bg-[color:rgba(180,83,9,0.14)] !text-[color:#f4c95d] !shadow-none hover:!border-[color:#f4c95d] hover:!bg-[color:rgba(251,191,36,0.16)] hover:!text-[color:#ffe7a8]'
                      : undefined,
                  )}
                >
                  Limpar filtros
                </Button>
              </div>
            </aside>

            <section className="min-h-0 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
              <div className={cx('mb-6 flex flex-wrap items-center gap-3 text-sm', isDarkTheme ? 'text-[color:rgba(255,243,209,0.78)]' : 'text-[color:var(--panel-text-soft,#5b4635)]')}>
                {filters.operadoraId && (
                  <button
                    type="button"
                    onClick={() => onUpdateFilters({ operadoraId: '', linhaId: '' })}
                    className={cx(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors',
                      isDarkTheme
                        ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)] text-[color:#fff8ef] hover:bg-[color:rgba(255,255,255,0.08)]'
                        : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]',
                    )}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para operadoras
                  </button>
                )}
                {filters.linhaId && (
                  <button
                    type="button"
                    onClick={() => onUpdateFilters({ linhaId: '' })}
                    className={cx(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors',
                      isDarkTheme
                        ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)] text-[color:#fff8ef] hover:bg-[color:rgba(255,255,255,0.08)]'
                        : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] text-[color:var(--panel-text-soft,#5b4635)] hover:bg-[var(--panel-surface-soft,#f4ede3)]',
                    )}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para linhas
                  </button>
                )}
                {selectedOperator?.actor.name && (
                  <span className={cx(
                    'rounded-full border px-3 py-1.5',
                    isDarkTheme
                      ? 'border-[color:rgba(14,165,233,0.18)] bg-[color:rgba(14,165,233,0.12)] text-[color:#d5f3ff]'
                      : 'border-[color:rgba(8,145,178,0.2)] bg-[color:rgba(8,145,178,0.08)] text-[color:var(--panel-text,#1a120d)]',
                  )}>
                    {selectedOperator.actor.name}
                  </span>
                )}
                {selectedLine?.actor.name && (
                  <span className={cx(
                    'rounded-full border px-3 py-1.5',
                    isDarkTheme
                      ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.06)] text-[color:#fff8ef]'
                      : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] text-[color:var(--panel-text,#1a120d)]',
                  )}>
                    {selectedLine.actor.name}
                  </span>
                )}
              </div>

              {!filters.operadoraId ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Selecione a operadora</h4>
                    
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {operatorCards.map((card) => (
                      <button
                        key={card.actor.id}
                        type="button"
                        onClick={() => onUpdateFilters({ operadoraId: card.actor.id, linhaId: '' })}
                        className="cursor-pointer rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_70%,var(--panel-accent-soft,#f6e4c7))] dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:color-mix(in_srgb,var(--panel-surface,#1b1611)_92%,black)] dark:hover:border-[color:rgba(251,191,36,0.28)] dark:hover:bg-[color:rgba(251,191,36,0.08)]"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex h-[76px] w-[76px] items-center justify-center rounded-2xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--panel-accent-soft,#f6e4c7)_84%,var(--panel-surface,#fffdfa)),color-mix(in_srgb,var(--panel-focus,#c86f1d)_30%,var(--panel-accent-ink,#6f3f16)))] text-3xl font-semibold tracking-tight text-[var(--panel-accent-ink-strong,#4a2411)] shadow-sm dark:bg-[linear-gradient(135deg,rgba(251,191,36,0.26),rgba(180,83,9,0.62))] dark:text-[color:#fff3d1]">
                            {getInitials(card.actor.name) || 'OP'}
                          </div>
                          <Building2 className="h-5 w-5 text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:rgba(255,243,209,0.7)]" />
                        </div>
                        <p className="mt-5 text-lg font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{card.actor.name}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.82)]">
                          <span className="rounded-full bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1 dark:bg-[color:rgba(255,255,255,0.08)]">{card.lineCount} linhas</span>
                          <span className="rounded-full bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1 dark:bg-[color:rgba(255,255,255,0.08)]">{card.productCount} produtos</span>
                          <span className="rounded-full bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1 dark:bg-[color:rgba(255,255,255,0.08)]">{card.itemCount} ofertas</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : !filters.linhaId && lineCards.length > 0 ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Selecione a linha</h4>
                    
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {lineCards.map((line) => (
                      <button
                        key={line.actor.id}
                        type="button"
                        onClick={() => onUpdateFilters({ linhaId: line.actor.id })}
                        className="cursor-pointer rounded-[28px] border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-5 text-left shadow-sm transition-all hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_74%,var(--panel-surface-soft,#f4ede3))] dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:color-mix(in_srgb,var(--panel-surface,#1b1611)_92%,black)] dark:hover:border-[color:rgba(251,191,36,0.28)] dark:hover:bg-[color:rgba(251,191,36,0.08)]"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-2xl font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-[color:#fff8ef]">{line.actor.name}</p>
                            <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.76)]">{line.productCount} produto(s) | {line.tableCount} tabela(s)</p>
                          </div>
                          <ArrowLeft className="h-5 w-5 rotate-180 text-[color:var(--panel-text-muted,#876f5c)] dark:text-[color:rgba(255,243,209,0.66)]" />
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)] dark:text-[color:rgba(255,243,209,0.82)]">
                          {line.coparticipacoes.map((item) => (
                            <span key={`${line.actor.id}-${item}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1 dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.08)]">
                              {item}
                            </span>
                          ))}
                          {line.businessProfiles.map((item) => (
                            <span key={`${line.actor.id}-${item}`} className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1 dark:border-[color:rgba(255,255,255,0.08)] dark:bg-[color:rgba(255,255,255,0.08)]">
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
                      <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Selecione a tabela</h4>
                      <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">
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
                            'rounded-[28px] border p-5 transition-all shadow-sm',
                            isSelected
                              ? 'border-emerald-300/60 bg-emerald-50 dark:border-emerald-400/35 dark:bg-emerald-500/10'
                              : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]',
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">{item.tabelaNome ?? item.titulo}</p>
                              <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{item.tabelaCodigo ?? item.linha?.name ?? 'Tabela comercial'}</p>
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

                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                            <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1">{formatBusinessProfile(item.perfilEmpresarial)}</span>
                            <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1">{formatCoparticipacao(item.coparticipacao)}</span>
                            <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1">{formatLivesRange(item)}</span>
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                            {Object.entries(item.pricesByAgeRange).map(([range, value]) => (
                              <div key={`${item.id}-${range}`} className="rounded-2xl border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-2 text-center">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--panel-text-muted,#876f5c)]">{range}</p>
                                <p className="mt-1 text-sm font-semibold text-[color:var(--panel-text,#1a120d)]">{formatCotadorCurrency(value)}</p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-[color:rgba(8,145,178,0.22)] bg-[color:rgba(8,145,178,0.08)] px-4 py-3 dark:border-cyan-300/18 dark:bg-cyan-300/10">
                            <span className="text-sm text-[color:var(--panel-text-soft,#5b4635)] dark:text-cyan-100">Mensalidade estimada</span>
                            <span className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)] dark:text-white">
                              {item.estimatedMonthlyTotal !== null ? formatCotadorCurrency(item.estimatedMonthlyTotal) : 'A calcular'}
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
                    <h4 className="text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Selecione o produto</h4>
                    <p className="mt-1 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Depois disso você escolhe a tabela ideal para a faixa de vidas desta cotação.</p>
                  </div>
                  {productGroups.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-soft,#f4ede3)] px-8 py-16 text-center">
                      <Search className="mx-auto h-10 w-10 text-[color:var(--panel-text-muted,#876f5c)]" />
                      <h4 className="mt-4 text-lg font-semibold text-[color:var(--panel-text,#1a120d)]">Nenhum produto disponível</h4>
                      <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">Ajuste os filtros.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {productGroups.map((group) => (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => setSelectedProductKey(group.key)}
                          className={cx(
                            'cursor-pointer rounded-[28px] border p-5 text-left shadow-sm transition-all',
                            selectedProductKey === group.key
                              ? 'border-[color:rgba(8,145,178,0.3)] bg-[color:rgba(8,145,178,0.08)]'
                              : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_74%,var(--panel-surface-soft,#f4ede3))]',
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xl font-semibold text-[color:var(--panel-text,#1a120d)]">{group.title}</p>
                              <p className="mt-2 text-sm text-[color:var(--panel-text-soft,#5b4635)]">{group.lineName ?? 'Produto avulso'}</p>
                            </div>
                            <ArrowLeft className="h-5 w-5 rotate-180 text-[color:var(--panel-text-muted,#876f5c)]" />
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[color:var(--panel-text-soft,#5b4635)]">
                            <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1">{group.tableCount || group.itemCount} opção(ões)</span>
                            {group.lowestPrice !== null && <span className="rounded-full border border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-2.5 py-1">A partir de {formatCotadorCurrency(group.lowestPrice)}</span>}
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
    </div>,
    document.body,
  );
}
