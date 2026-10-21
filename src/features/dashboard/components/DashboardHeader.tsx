import { useState } from 'react';
import { Filter, Layers3, SlidersHorizontal, Stethoscope, Tag, Target, Users } from 'lucide-react';

import {
  Badge,
  Button,
  Input,
  PageHeader,
  FilterSelect,
  Surface,
} from '../../../design-system';
import { DASHBOARD_PERIOD_OPTIONS } from '../shared/dashboardConstants';
import type { DashboardPeriodFilter } from '../shared/dashboardTypes';

type OriginOption = {
  nome: string;
};

type OwnerOption = {
  value: string;
  label: string;
};

type DashboardHeaderProps = {
  periodFilter: DashboardPeriodFilter;
  customStartDate: string;
  customEndDate: string;
  dashboardOriginFilter: string;
  dashboardOwnerFilter: string;
  dashboardOperatorFilter: string;
  dashboardContractTypeFilter: string;
  dashboardStatusFilter: string;
  visibleLeadOrigins: OriginOption[];
  responsavelOptions: OwnerOption[];
  operatorOptions: string[];
  contractTypeOptions: OwnerOption[];
  statusOptions: OwnerOption[];
  onPeriodFilterChange: (value: DashboardPeriodFilter) => void;
  onStartDateChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOriginFilterChange: (value: string) => void;
  onOwnerFilterChange: (value: string) => void;
  onOperatorFilterChange: (value: string) => void;
  onContractTypeFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  isCustomStartInvalid: boolean;
  isCustomEndInvalid: boolean;
};

export function DashboardHeader({
  periodFilter,
  customStartDate,
  customEndDate,
  dashboardOriginFilter,
  dashboardOwnerFilter,
  dashboardOperatorFilter,
  dashboardContractTypeFilter,
  dashboardStatusFilter,
  visibleLeadOrigins,
  responsavelOptions,
  operatorOptions,
  contractTypeOptions,
  statusOptions,
  onPeriodFilterChange,
  onStartDateChange,
  onEndDateChange,
  onOriginFilterChange,
  onOwnerFilterChange,
  onOperatorFilterChange,
  onContractTypeFilterChange,
  onStatusFilterChange,
  isCustomStartInvalid,
  isCustomEndInvalid,
}: DashboardHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [
    dashboardOriginFilter,
    dashboardOwnerFilter,
    dashboardOperatorFilter,
    dashboardContractTypeFilter,
    dashboardStatusFilter,
  ].filter(Boolean).length;

  return (
    <PageHeader
      eyebrow="Operação comercial"
      title="Dashboard"
      description="Veja o que pede atenção e escolha o próximo passo da operação."
      data-panel-animate
      className="border-b border-[var(--border-subtle)] pb-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-52">
            <FilterSelect
              icon={Filter}
              value={periodFilter}
              onChange={(value) => onPeriodFilterChange(value as DashboardPeriodFilter)}
              placeholder="Período"
              includePlaceholderOption={false}
              neutralValues={['todo-periodo']}
              options={DASHBOARD_PERIOD_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>

          {periodFilter === 'personalizado' && (
            <div className="flex min-w-0 items-center gap-2">
              <Input
                type="text"
                value={customStartDate}
                onChange={onStartDateChange}
                placeholder="De · DD/MM/AAAA"
                aria-label="Data inicial do período"
                maxLength={10}
                className="w-36"
                invalid={isCustomStartInvalid}
              />
              <span className="text-sm text-[var(--text-muted)]">até</span>
              <Input
                type="text"
                value={customEndDate}
                onChange={onEndDateChange}
                placeholder="Até · DD/MM/AAAA"
                aria-label="Data final do período"
                maxLength={10}
                className="w-36"
                invalid={isCustomEndInvalid}
              />
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          aria-expanded={filtersOpen}
          aria-controls="dashboard-advanced-filters"
          onClick={() => setFiltersOpen((open) => !open)}
          className="shrink-0"
        >
          <SlidersHorizontal aria-hidden="true" />
          Filtros avançados
          {activeFilterCount > 0 && <Badge tone="info" size="sm">{activeFilterCount}</Badge>}
        </Button>
      </div>

      {filtersOpen && (
        <Surface
          id="dashboard-advanced-filters"
          variant="muted"
          padding="sm"
          className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
          aria-label="Filtros avançados do dashboard"
        >
          <FilterSelect
            icon={Target}
            value={dashboardOriginFilter}
            onChange={onOriginFilterChange}
            placeholder="Todas as origens"
            neutralValues={['']}
            options={visibleLeadOrigins.map((origin) => ({ value: origin.nome, label: origin.nome }))}
          />
          <FilterSelect
            icon={Users}
            value={dashboardOwnerFilter}
            onChange={onOwnerFilterChange}
            placeholder="Todos os responsáveis"
            options={responsavelOptions.map((option) => ({ value: option.value, label: option.label }))}
          />
          <FilterSelect
            icon={Stethoscope}
            value={dashboardOperatorFilter}
            onChange={onOperatorFilterChange}
            placeholder="Todas as operadoras"
            neutralValues={['']}
            options={operatorOptions.map((operator) => ({ value: operator, label: operator }))}
          />
          <FilterSelect
            icon={Tag}
            value={dashboardContractTypeFilter}
            onChange={onContractTypeFilterChange}
            placeholder="Todos os tipos"
            neutralValues={['']}
            options={contractTypeOptions.map((option) => ({ value: option.value, label: option.label }))}
          />
          <FilterSelect
            icon={Layers3}
            value={dashboardStatusFilter}
            onChange={onStatusFilterChange}
            placeholder="Todos os estágios"
            neutralValues={['']}
            options={statusOptions.map((option) => ({ value: option.value, label: option.label }))}
          />
        </Surface>
      )}
    </PageHeader>
  );
}
