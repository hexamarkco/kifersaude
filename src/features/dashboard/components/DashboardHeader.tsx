import { Clock, Filter, RefreshCw, Target, Users } from 'lucide-react';

import FilterSingleSelect from '../../../components/FilterSingleSelect';
import { Badge, Button, Input, PageHeader } from '../../../design-system';
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
  visibleLeadOrigins: OriginOption[];
  responsavelOptions: OwnerOption[];
  lastUpdatedLabel: string;
  loading: boolean;
  onPeriodFilterChange: (value: DashboardPeriodFilter) => void;
  onStartDateChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOriginFilterChange: (value: string) => void;
  onOwnerFilterChange: (value: string) => void;
  onRefresh: () => void;
  isCustomStartInvalid: boolean;
  isCustomEndInvalid: boolean;
};

export function DashboardHeader({
  periodFilter,
  customStartDate,
  customEndDate,
  dashboardOriginFilter,
  dashboardOwnerFilter,
  visibleLeadOrigins,
  responsavelOptions,
  lastUpdatedLabel,
  loading,
  onPeriodFilterChange,
  onStartDateChange,
  onEndDateChange,
  onOriginFilterChange,
  onOwnerFilterChange,
  onRefresh,
  isCustomStartInvalid,
  isCustomEndInvalid,
}: DashboardHeaderProps) {
  return (
    <PageHeader
      eyebrow="Operacao comercial"
      title="Dashboard"
      description="Acompanhe o ritmo do pipeline, da carteira e das conversoes."
      data-panel-animate
      className="border-b border-[var(--border-subtle)] pb-5"
    >
      <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid w-full gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap xl:items-center">
          <div className="min-w-0 xl:w-52">
            <FilterSingleSelect
              icon={Filter}
              value={periodFilter}
              onChange={(value) => onPeriodFilterChange(value as DashboardPeriodFilter)}
              placeholder="Periodo"
              includePlaceholderOption={false}
              neutralValues={['todo-periodo']}
              options={DASHBOARD_PERIOD_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>

          {periodFilter === 'personalizado' && (
            <div className="flex min-w-0 flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center xl:w-auto">
              <Input
                type="text"
                value={customStartDate}
                onChange={onStartDateChange}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="sm:w-32"
                invalid={isCustomStartInvalid}
              />
              <span className="text-center text-xs text-[var(--text-muted)] sm:hidden">
                ate
              </span>
              <span className="hidden text-sm text-[var(--text-muted)] sm:inline">
                ate
              </span>
              <Input
                type="text"
                value={customEndDate}
                onChange={onEndDateChange}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="sm:w-32"
                invalid={isCustomEndInvalid}
              />
            </div>
          )}

          <div className="min-w-0 xl:w-52">
            <FilterSingleSelect
              icon={Target}
              value={dashboardOriginFilter}
              onChange={onOriginFilterChange}
              placeholder="Todas as origens"
              neutralValues={['']}
              options={visibleLeadOrigins.map((origin) => ({
                value: origin.nome,
                label: origin.nome,
              }))}
            />
          </div>

          <div className="min-w-0 xl:w-56">
            <FilterSingleSelect
              icon={Users}
              value={dashboardOwnerFilter}
              onChange={onOwnerFilterChange}
              placeholder="Todos os responsaveis"
              options={responsavelOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Badge tone="neutral" size="sm" className="h-10 justify-center gap-2 rounded-[var(--radius-lg)] whitespace-nowrap normal-case tracking-normal">
            <Clock className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>{lastUpdatedLabel || 'Aguardando atualizacao...'}</span>
          </Badge>

          <Button type="button" onClick={onRefresh} disabled={loading} size="md" className="w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar agora</span>
          </Button>
        </div>
      </div>
    </PageHeader>
  );
}
