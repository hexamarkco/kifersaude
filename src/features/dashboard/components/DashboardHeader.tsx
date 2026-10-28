import { useEffect, useState } from 'react';
import { Filter, Layers3, SlidersHorizontal, Stethoscope, Tag, Target, Users } from 'lucide-react';

import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  Input,
  PageHeader,
  FilterSelect,
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
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 767,
  );

  useEffect(() => {
    const updateViewport = () => setIsMobileViewport(window.innerWidth <= 767);
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const activeFilterCount = [
    dashboardOriginFilter,
    dashboardOwnerFilter,
    dashboardOperatorFilter,
    dashboardContractTypeFilter,
    dashboardStatusFilter,
  ].filter(Boolean).length;

  const filterTrigger = () => (
    <Button
      type="button"
      variant="secondary"
      aria-label="Filtros avançados"
      aria-haspopup="dialog"
      aria-expanded={filtersOpen}
      aria-controls="dashboard-advanced-filters"
      onClick={() => setFiltersOpen((open) => !open)}
      className="shrink-0"
    >
      <SlidersHorizontal aria-hidden="true" />
      <span className="hidden sm:inline">Filtros avançados</span>
      <span className="kds-dashboard-filter-label sm:hidden">Filtros</span>
      {activeFilterCount > 0 && <Badge tone="info" size="sm">{activeFilterCount}</Badge>}
    </Button>
  );

  const filterTitleCopy = (
    <DialogTitle>Filtros do dashboard</DialogTitle>
  );

  const filterFieldControls = (
    <>
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
    </>
  );

  const filterActions = (
    <>
      <Button
        type="button"
        variant="text"
        size="sm"
        onClick={() => {
          onOriginFilterChange('');
          onOwnerFilterChange('');
          onOperatorFilterChange('');
          onContractTypeFilterChange('');
          onStatusFilterChange('');
        }}
      >
        Limpar filtros
      </Button>
      <Button type="button" variant="secondary" onClick={() => setFiltersOpen(false)}>
        Concluído
      </Button>
    </>
  );

  return (
    <PageHeader
      eyebrow="Operação comercial"
      title="Dashboard"
      description="Veja o que pede atenção e escolha o próximo passo da operação."
      data-panel-animate
      className="border-b border-[var(--border-subtle)] pb-5"
    >
      <div className="kds-dashboard-filter-actions flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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

        {isMobileViewport ? (
          filterTrigger()
        ) : (
          <>
            {filterTrigger()}
            <Dialog
              id="dashboard-advanced-filters"
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              size="sm"
              aria-label="Filtros avançados do dashboard"
              className="kds-dashboard-filter-dialog"
            >
              <DialogHeader onClose={() => setFiltersOpen(false)} className="kds-dashboard-filter-header">
                {filterTitleCopy}
              </DialogHeader>
              <DialogBody className="kds-dashboard-filter-fields">{filterFieldControls}</DialogBody>
              <DialogFooter className="kds-dashboard-filter-footer">{filterActions}</DialogFooter>
            </Dialog>
          </>
        )}
      </div>

      {isMobileViewport && (
        <Drawer
          id="dashboard-advanced-filters"
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          side="right"
          size="sm"
          aria-label="Filtros avançados do dashboard"
          className="kds-dashboard-filter-drawer"
        >
          <DrawerHeader onClose={() => setFiltersOpen(false)} className="kds-dashboard-filter-header">
            {filterTitleCopy}
          </DrawerHeader>
          <DrawerBody className="kds-dashboard-filter-fields">{filterFieldControls}</DrawerBody>
          <DrawerFooter className="kds-dashboard-filter-footer">{filterActions}</DrawerFooter>
        </Drawer>
      )}
    </PageHeader>
  );
}
