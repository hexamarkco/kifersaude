import { useMemo, useState } from 'react';
import { BadgePercent, Layers3, MapPin, Search, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { cx } from '../../../lib/cx';
import { COTADOR_MODALITY_OPTIONS, type CotadorQuoteModality } from '../shared/cotadorConstants';
import type { CotadorCatalogFilters } from '../shared/cotadorTypes';

type SelectOption = {
  value: string;
  label: string;
};

type CotadorPlanPickerSidebarProps = {
  isDarkTheme: boolean;
  activeModalityTab: CotadorQuoteModality;
  filters: CotadorCatalogFilters;
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
  onUpdateFilters: (updates: Partial<CotadorCatalogFilters>) => void;
  onResetAll: () => void;
  onChangeModality: (modality: CotadorQuoteModality) => void;
};

const normalizeAutocompleteTerm = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const extractOptionCount = (label: string) => {
  const match = label.match(/\((\d+)\)\s*$/);
  return match ? Number(match[1]) : null;
};

export default function CotadorPlanPickerSidebar({
  isDarkTheme,
  activeModalityTab,
  filters,
  filterOptions,
  onUpdateFilters,
  onResetAll,
  onChangeModality,
}: CotadorPlanPickerSidebarProps) {
  const [networkLocationFocused, setNetworkLocationFocused] = useState(false);
  const [networkLocationSuggestionOpen, setNetworkLocationSuggestionOpen] = useState(false);

  const networkLocationSuggestions = useMemo(() => {
    const search = normalizeAutocompleteTerm(filters.networkLocation);
    if (!search) return [];

    return filterOptions.networkLocations
      .filter((option) => normalizeAutocompleteTerm(option.value).includes(search))
      .sort((left, right) => {
        const leftValue = normalizeAutocompleteTerm(left.value);
        const rightValue = normalizeAutocompleteTerm(right.value);
        const leftStarts = leftValue.startsWith(search) ? 0 : 1;
        const rightStarts = rightValue.startsWith(search) ? 0 : 1;
        if (leftStarts !== rightStarts) return leftStarts - rightStarts;

        const leftCount = extractOptionCount(left.label) ?? 0;
        const rightCount = extractOptionCount(right.label) ?? 0;
        if (leftCount !== rightCount) return rightCount - leftCount;

        return left.value.localeCompare(right.value, 'pt-BR');
      })
      .slice(0, 8);
  }, [filterOptions.networkLocations, filters.networkLocation]);

  const showNetworkLocationSuggestions = networkLocationFocused
    && networkLocationSuggestionOpen
    && filters.networkLocation.trim().length > 0
    && networkLocationSuggestions.length > 0;

  return (
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
              const isActive = activeModalityTab === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChangeModality(option.value)}
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
          <div className="relative">
            <Input
              value={filters.networkLocation}
              onChange={(event) => {
                onUpdateFilters({ networkLocation: event.target.value });
                setNetworkLocationSuggestionOpen(true);
              }}
              onFocus={() => setNetworkLocationFocused(true)}
              onBlur={() => {
                setNetworkLocationFocused(false);
                setNetworkLocationSuggestionOpen(false);
              }}
              placeholder="Filtrar por cidade ou bairro da rede"
              leftIcon={MapPin}
              autoComplete="off"
              className={cx(
                isDarkTheme
                  ? '[--panel-input-text:#fff8ef] [--panel-placeholder:rgba(255,243,209,0.42)] !border-[color:rgba(255,255,255,0.1)] !bg-[color:rgba(255,255,255,0.06)] !text-[color:#fff8ef] !shadow-none placeholder:!text-[color:rgba(255,243,209,0.42)] focus:!border-[color:rgba(251,191,36,0.28)] focus:!ring-[color:rgba(251,191,36,0.26)]'
                  : undefined,
              )}
            />

            {showNetworkLocationSuggestions && (
              <div
                className={cx(
                  'absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[22px] border shadow-[0_20px_48px_rgba(15,10,6,0.26)]',
                  isDarkTheme
                    ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:#201814]'
                    : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)]',
                )}
              >
                <div className="max-h-64 overflow-y-auto py-2">
                  {networkLocationSuggestions.map((option) => {
                    const count = extractOptionCount(option.label);

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          onUpdateFilters({ networkLocation: option.value });
                          setNetworkLocationFocused(false);
                          setNetworkLocationSuggestionOpen(false);
                        }}
                        className={cx(
                          'flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors',
                          isDarkTheme
                            ? 'hover:bg-[color:rgba(255,255,255,0.06)]'
                            : 'hover:bg-[var(--panel-surface-soft,#f4ede3)]',
                        )}
                      >
                        <span className={cx('min-w-0 truncate text-sm font-medium', isDarkTheme ? 'text-[color:#fff8ef]' : 'text-[color:var(--panel-text,#1a120d)]')}>
                          {option.value}
                        </span>
                        {count !== null && (
                          <span className={cx('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', isDarkTheme ? 'border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)] text-[color:rgba(255,243,209,0.72)]' : 'border-[color:var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] text-[color:var(--panel-text-soft,#5b4635)]')}>
                            {count} produto(s)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {activeModalityTab === 'ADESAO' && (
            <>
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
            </>
          )}
          {activeModalityTab === 'PME' && (
            <FilterSingleSelect
              icon={BadgePercent}
              options={filterOptions.perfisEmpresariais}
              placeholder="Perfil empresarial"
              value={filters.perfilEmpresarial}
              onChange={(next) => onUpdateFilters({ perfilEmpresarial: next as CotadorCatalogFilters['perfilEmpresarial'] })}
            />
          )}
          <FilterSingleSelect
            icon={Sparkles}
            options={filterOptions.coparticipacoes}
            placeholder="Coparticipação"
            value={filters.coparticipacao}
            onChange={(next) => onUpdateFilters({ coparticipacao: next as CotadorCatalogFilters['coparticipacao'] })}
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
            onResetAll();
            setNetworkLocationFocused(false);
            setNetworkLocationSuggestionOpen(false);
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
      </div>
    </aside>
  );
}
