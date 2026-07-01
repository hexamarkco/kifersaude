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
      eyebrow="Visao geral"
      title="Dashboard"
      description="Visao geral do seu negocio em tempo real"
      data-panel-animate
    >
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <div className="w-full sm:w-56">
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
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              <Input
                type="text"
                value={customStartDate}
                onChange={onStartDateChange}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className="sm:w-32"
                invalid={isCustomStartInvalid}
              />
              <span className="text-center text-xs sm:hidden" style={{ color: 'var(--text-muted)' }}>
                ate
              </span>
              <span className="hidden text-sm sm:inline" style={{ color: 'var(--text-muted)' }}>
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

          <div className="w-full sm:w-56">
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

          <div className="w-full sm:w-56">
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Badge tone="neutral" className="h-11 gap-2 px-3 text-sm normal-case tracking-normal">
            <Clock className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
            <span>{lastUpdatedLabel || 'Aguardando atualizacao...'}</span>
          </Badge>

          <Button type="button" onClick={onRefresh} disabled={loading} size="lg">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar agora</span>
          </Button>
        </div>
      </div>
    </PageHeader>
  );
}
