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
    () => filteredItems.filter((item) => item.source === 'cotador_tabela'),
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

    return Array.from(grouped.values()).sort((left, right) => {
      const leftPrice = left.lowestPrice ?? Number.MAX_SAFE_INTEGER;
      const rightPrice = right.lowestPrice ?? Number.MAX_SAFE_INTEGER;
      if (leftPrice !== rightPrice) return leftPrice - rightPrice;
      return left.title.localeCompare(right.title, 'pt-BR');
    });
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
      : lineCards.length > 1 && !selectedLineId
        ? 'line'
        : 'product';

  const floatingPanelTitle = currentStep === 'line'
    ? selectedOperator?.actor.name ?? 'Linhas'
    : currentStep === 'table'
      ? activeProductGroup?.title ?? 'Tabelas'
      : selectedLine?.actor.name ?? selectedOperator?.actor.name ?? 'Produtos';

  const floatingPanelSectionLabel = currentStep === 'line'
    ? 'Linhas'
    : currentStep === 'table'
      ? 'Tabelas'
      : 'Produtos';

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
                {!selectedOperatorId
                  ? 'Escolha a operadora'
                  : !selectedLineId && lineCards.length > 1
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
                  onClick={() => {
                    onResetFilters();
                    setSelectedOperatorId(null);
                    setSelectedLineId(null);
                    setSelectedProductKey(null);
                  }}
                  fullWidth
                  className={cx(
                    isDarkTheme
                      ? '!border-[color:rgba(251,191,36,0.72)] !bg-[color:rgba(180,83,9,0.14)] !text-[color:#f4c95d] !shadow-none hover:!border-[color:#f4c95d] hover:!bg-[color:rgba(251,191,36,0.16)] hover:!text-[color:#ffe7a8]'
                      : undefined,
                  )}
                >
                  Limpar filtros
                </Button>

                {(selectedOperator || selectedLine || activeProductGroup) && (
                  <div className={cx(
                    'rounded-[24px] border p-4',
                    isDarkTheme
                      ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)]'
                      : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]',
                  )}>
                    <p className={cx('text-[11px] font-semibold uppercase tracking-[0.18em]', isDarkTheme ? 'text-[color:#f3c892]' : 'text-[var(--panel-accent-ink,#6f3f16)]')}>Contexto atual</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {selectedOperator?.actor.name && <span className={cx('rounded-full border px-2.5 py-1', isDarkTheme ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.06)] text-[color:var(--panel-text,#f8efe3)]' : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] text-[color:var(--panel-text,#1a120d)]')}>{selectedOperator.actor.name}</span>}
                      {selectedLine?.actor.name && <span className={cx('rounded-full border px-2.5 py-1', isDarkTheme ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.06)] text-[color:var(--panel-text,#f8efe3)]' : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] text-[color:var(--panel-text,#1a120d)]')}>{selectedLine.actor.name}</span>}
                      {activeProductGroup?.title && <span className={cx('rounded-full border px-2.5 py-1', isDarkTheme ? 'border-[color:rgba(251,191,36,0.18)] bg-[color:rgba(251,191,36,0.12)] text-[color:#fde68a]' : 'border-[color:rgba(8,145,178,0.2)] bg-[color:rgba(8,145,178,0.08)] text-[color:var(--panel-text,#1a120d)]')}>{activeProductGroup.title}</span>}
                    </div>
                  </div>
                )}
              </div>
            </aside>

            <section className="min-h-0 overflow-y-auto px-5 py-5 md:px-8 md:py-6">
              <div className="flex min-h-full flex-col gap-6">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h4 className={cx('text-2xl font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>Quais planos deseja comparar?</h4>
                    <p className={cx('mt-2 text-sm', isDarkTheme ? 'text-[color:rgba(255,243,209,0.72)]' : 'text-[color:var(--panel-text-soft,#5b4635)]')}>
                      Escolha a operadora e avance por linha, produto e tabela sem perder o contexto da cotação.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className={cx(
                      'rounded-full border px-3 py-1.5',
                      isDarkTheme
                        ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)] text-[color:#fff8ef]'
                        : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] text-[color:var(--panel-text,#1a120d)]',
                    )}>
                      {quote.name}
                    </span>
                    <span className={cx(
                      'rounded-full border px-3 py-1.5',
                      isDarkTheme
                        ? 'border-[color:rgba(251,191,36,0.18)] bg-[color:rgba(251,191,36,0.12)] text-[color:#fde68a]'
                        : 'border-[color:rgba(8,145,178,0.2)] bg-[color:rgba(8,145,178,0.08)] text-[color:var(--panel-text,#1a120d)]',
                    )}>
                      {quote.totalLives} vidas
                    </span>
                  </div>
                </div>

                {operatorCards.length === 0 ? (
                  <div className={cx(
                    'rounded-[28px] border border-dashed px-8 py-16 text-center',
                    isDarkTheme
                      ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.03)]'
                      : 'border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-soft,#f4ede3)]',
                  )}>
                    <Search className={cx('mx-auto h-10 w-10', isDarkTheme ? 'text-[color:rgba(255,243,209,0.62)]' : 'text-[color:var(--panel-text-muted,#876f5c)]')} />
                    <h4 className={cx('mt-4 text-lg font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>Nenhuma operadora disponível</h4>
                    <p className={cx('mt-2 text-sm', isDarkTheme ? 'text-[color:rgba(255,243,209,0.72)]' : 'text-[color:var(--panel-text-soft,#5b4635)]')}>Ajuste os filtros para liberar resultados.</p>
                  </div>
                ) : (
                  <div className="relative min-h-[560px] xl:min-h-[640px]">
                    <div className="grid gap-4 transition-all sm:grid-cols-2 xl:grid-cols-5">
                      {operatorCards.map((card) => {
                        const isActive = selectedOperatorId === card.actor.id;
                        return (
                          <div key={card.actor.id} className={cx('relative', isActive ? 'z-20' : undefined)}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOperatorId(card.actor.id);
                                setSelectedLineId(null);
                                setSelectedProductKey(null);
                              }}
                              className={cx(
                                'group w-full cursor-pointer rounded-[26px] border p-5 text-left transition-all duration-200',
                                isActive
                                  ? isDarkTheme
                                    ? 'border-[color:rgba(251,191,36,0.34)] bg-[color:rgba(251,191,36,0.08)] shadow-[0_18px_42px_rgba(0,0,0,0.22)]'
                                    : 'border-[color:var(--panel-border-strong,#9d7f5a)] bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_72%,var(--panel-accent-soft,#f6e4c7))] shadow-sm'
                                  : isDarkTheme
                                    ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.02)] hover:-translate-y-0.5 hover:border-[color:rgba(251,191,36,0.22)] hover:bg-[color:rgba(255,255,255,0.04)]'
                                    : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] hover:-translate-y-0.5 hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:color-mix(in_srgb,var(--panel-surface,#fffdfa)_70%,var(--panel-accent-soft,#f6e4c7))]',
                              )}
                            >
                              <div className="flex min-h-[132px] flex-col items-center justify-center gap-4 text-center">
                                <div className={cx(
                                  'flex h-14 w-14 items-center justify-center rounded-2xl border',
                                  isDarkTheme
                                    ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)] text-[color:#fff3d1]'
                                    : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] text-[color:var(--panel-accent-ink,#6f3f16)]',
                                )}>
                                  <Building2 className="h-6 w-6" />
                                </div>
                                <p className={cx('text-lg font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>{card.actor.name}</p>
                              </div>
                            </button>

                            {isActive && (
                              <div className="absolute inset-x-0 top-0">
                                <div className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] shadow-[0_28px_60px_rgba(15,10,6,0.34)]">
                                  <div className="border-b border-[color:var(--panel-border-subtle,#e7dac8)] px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (currentStep === 'table') {
                                          setSelectedProductKey(null);
                                          return;
                                        }
                                        if (currentStep === 'product' && selectedLineId) {
                                          setSelectedLineId(null);
                                          setSelectedProductKey(null);
                                          return;
                                        }
                                        setSelectedOperatorId(null);
                                        setSelectedLineId(null);
                                        setSelectedProductKey(null);
                                      }}
                                      className={cx(
                                        'inline-flex items-center gap-2 text-xs font-medium transition-colors',
                                        isDarkTheme ? 'text-[color:rgba(255,243,209,0.72)] hover:text-white' : 'text-[color:var(--panel-text-soft,#5b4635)] hover:text-[color:var(--panel-text,#1a120d)]',
                                      )}
                                    >
                                      <ArrowLeft className="h-4 w-4" />
                                      {currentStep === 'table'
                                        ? 'Voltar aos produtos'
                                        : currentStep === 'product' && selectedLineId
                                          ? 'Voltar às linhas'
                                          : 'Voltar às operadoras'}
                                    </button>
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className={cx('text-[11px] font-semibold uppercase tracking-[0.16em]', isDarkTheme ? 'text-[color:rgba(255,243,209,0.54)]' : 'text-[color:var(--panel-text-muted,#876f5c)]')}>{floatingPanelSectionLabel}</p>
                                        <p className={cx('mt-1 truncate text-base font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>{floatingPanelTitle}</p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="max-h-[320px] overflow-y-auto">
                                    {currentStep === 'line' ? (
                                      lineCards.length === 0 ? (
                                        <div className="px-4 py-6 text-center">
                                          <p className={cx('text-sm', isDarkTheme ? 'text-[color:rgba(255,243,209,0.68)]' : 'text-[color:var(--panel-text-soft,#5b4635)]')}>Nenhuma linha disponível.</p>
                                        </div>
                                      ) : (
                                        <div className={cx('divide-y', isDarkTheme ? 'divide-[color:rgba(255,255,255,0.06)]' : 'divide-[color:var(--panel-border-subtle,#e7dac8)]')}>
                                          {lineCards.map((line) => (
                                            <button
                                              key={line.actor.id}
                                              type="button"
                                              onClick={() => {
                                                setSelectedLineId(line.actor.id);
                                                setSelectedProductKey(null);
                                              }}
                                              className={cx(
                                                'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors',
                                                isDarkTheme ? 'hover:bg-[color:rgba(255,255,255,0.04)]' : 'hover:bg-[color:var(--panel-surface-soft,#f4ede3)]',
                                              )}
                                            >
                                              <p className={cx('min-w-0 flex-1 truncate text-sm font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>{line.actor.name}</p>
                                              <ArrowLeft className={cx('h-4 w-4 rotate-180 shrink-0', isDarkTheme ? 'text-[color:rgba(255,243,209,0.62)]' : 'text-[color:var(--panel-text-muted,#876f5c)]')} />
                                            </button>
                                          ))}
                                        </div>
                                      )
                                    ) : currentStep === 'table' ? (
                                      tableCandidates.length === 0 ? (
                                        <div className="px-4 py-6 text-center">
                                          <p className={cx('text-sm', isDarkTheme ? 'text-[color:rgba(255,243,209,0.68)]' : 'text-[color:var(--panel-text-soft,#5b4635)]')}>Nenhuma tabela disponível.</p>
                                        </div>
                                      ) : (
                                        <div className={cx('divide-y', isDarkTheme ? 'divide-[color:rgba(255,255,255,0.06)]' : 'divide-[color:var(--panel-border-subtle,#e7dac8)]')}>
                                          {tableCandidates.map((item) => {
                                            const isSelected = selectedIds.has(item.id);
                                            return (
                                              <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => {
                                                  if (isSelected || busy) return;
                                                  onSelectItem(item.id);
                                                }}
                                                disabled={busy || isSelected}
                                                className={cx(
                                                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors disabled:cursor-default',
                                                  isSelected
                                                    ? isDarkTheme
                                                      ? 'bg-emerald-500/10'
                                                      : 'bg-emerald-50'
                                                    : isDarkTheme
                                                      ? 'hover:bg-[color:rgba(255,255,255,0.04)]'
                                                      : 'hover:bg-[color:var(--panel-surface-soft,#f4ede3)]',
                                                )}
                                              >
                                                <div>
                                                  {isSelected ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                                  ) : (
                                                    <div className={cx('h-2 w-2 rounded-full', isDarkTheme ? 'bg-[color:rgba(255,243,209,0.34)]' : 'bg-[color:var(--panel-text-muted,#876f5c)]')} />
                                                  )}
                                                </div>
                                                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                                  <p className={cx('min-w-0 flex-1 truncate text-sm font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>{item.tabelaNome ?? item.titulo}</p>
                                                  <span className={cx('shrink-0 text-sm font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>
                                                    {item.estimatedMonthlyTotal !== null ? formatCotadorCurrency(item.estimatedMonthlyTotal) : '-'}
                                                  </span>
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )
                                    ) : productGroups.length === 0 ? (
                                      <div className="px-4 py-6 text-center">
                                        <p className={cx('text-sm', isDarkTheme ? 'text-[color:rgba(255,243,209,0.68)]' : 'text-[color:var(--panel-text-soft,#5b4635)]')}>Nenhum produto disponível.</p>
                                      </div>
                                    ) : (
                                      <div className={cx('divide-y', isDarkTheme ? 'divide-[color:rgba(255,255,255,0.06)]' : 'divide-[color:var(--panel-border-subtle,#e7dac8)]')}>
                                        {productGroups.map((group) => (
                                          <button
                                            key={group.key}
                                            type="button"
                                            onClick={() => setSelectedProductKey(group.key)}
                                            className={cx(
                                              'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors',
                                              isDarkTheme ? 'hover:bg-[color:rgba(255,255,255,0.04)]' : 'hover:bg-[color:var(--panel-surface-soft,#f4ede3)]',
                                            )}
                                          >
                                            <p className={cx('min-w-0 flex-1 truncate text-sm font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>{group.title}</p>
                                            <div className="flex items-center gap-3">
                                              {group.lowestPrice !== null && <span className={cx('shrink-0 text-sm font-semibold', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>{formatCotadorCurrency(group.lowestPrice)}</span>}
                                              <ArrowLeft className={cx('h-4 w-4 rotate-180 shrink-0', isDarkTheme ? 'text-[color:rgba(255,243,209,0.62)]' : 'text-[color:var(--panel-text-muted,#876f5c)]')} />
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
