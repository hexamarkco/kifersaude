import { useMemo, useState } from 'react';
import { BadgePercent, Layers3, MapPin, Search, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import FilterSingleSelect from '../../../components/FilterSingleSelect';
import Input from '../../../components/ui/Input';
import { Button } from '../../../design-system';
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
        ? 'border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]'
        : 'border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]',
    )}>
      <div className="space-y-5">
        <div>
          <p className={cx('text-xs font-semibold uppercase tracking-[0.18em]', isDarkTheme ? 'text-[color:var(--text-secondary)]' : 'text-[color:var(--text-primary)]')}>Modalidade</p>
          <div className={cx(
            'mt-3 grid grid-cols-3 gap-1 rounded-[var(--kds-radius-md)] border p-1',
            isDarkTheme
              ? 'border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]'
              : 'border-[color:var(--border-default)] bg-[var(--bg-surface)]',
          )}>
            {COTADOR_MODALITY_OPTIONS.map((option) => {
              const isActive = activeModalityTab === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChangeModality(option.value)}
                  className={cx(
                     'cursor-pointer rounded-[var(--kds-radius-sm)] px-3 py-2 text-sm font-semibold transition-colors',
                    isActive
                      ? isDarkTheme
                        ? 'bg-[color:var(--bg-elevated)] text-[color:var(--text-primary)] shadow-sm'
                        : 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : isDarkTheme
                        ? 'text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-elevated)] hover:text-[var(--text-primary)]'
                        : 'text-[color:var(--text-primary)] hover:bg-[var(--bg-surface)] hover:text-[color:var(--text-primary)]',
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
                ? '!border-[color:var(--border-default)] !bg-[color:var(--bg-elevated)] !text-[color:var(--text-primary)] !shadow-none placeholder:!text-[color:var(--text-secondary)] focus:!border-[color:var(--border-default)] focus:!ring-[color:var(--border-subtle)]'
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
                  ? '!border-[color:var(--border-default)] !bg-[color:var(--bg-elevated)] !text-[color:var(--text-primary)] !shadow-none placeholder:!text-[color:var(--text-secondary)] focus:!border-[color:var(--border-default)] focus:!ring-[color:var(--border-subtle)]'
                  : undefined,
              )}
            />

            {showNetworkLocationSuggestions && (
              <div
                className={cx(
                   'absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[var(--kds-radius-md)] border shadow-sm',
                  isDarkTheme
                    ? 'border-[color:var(--border-default)] bg-[color:var(--bg-elevated)]'
                    : 'border-[color:var(--border-default)] bg-[var(--bg-surface)]',
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
                            ? 'hover:bg-[color:var(--bg-elevated)]'
                            : 'hover:bg-[var(--bg-surface)]',
                        )}
                      >
                        <span className={cx('min-w-0 truncate text-sm font-medium', isDarkTheme ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-primary)]')}>
                          {option.value}
                        </span>
                        {count !== null && (
                          <span className={cx('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', isDarkTheme ? 'border-[color:var(--border-default)] bg-[color:var(--bg-elevated)] text-[color:var(--text-secondary)]' : 'border-[color:var(--border-default)] bg-[var(--bg-surface)] text-[color:var(--text-primary)]')}>
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
              ? '!border-[color:var(--border-default)] !bg-[color:var(--bg-elevated)] !text-[color:var(--text-primary)] !shadow-none hover:!border-[color:var(--border-default)] hover:!bg-[color:var(--bg-elevated)] hover:!text-[color:var(--text-primary)]'
              : undefined,
          )}
        >
          Limpar filtros
        </Button>
      </div>
    </aside>
  );
}
