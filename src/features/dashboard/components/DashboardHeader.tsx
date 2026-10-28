import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, Layers3, SlidersHorizontal, Stethoscope, Tag, Target, Users } from 'lucide-react';

import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DateTimePicker,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  Field,
  PageHeader,
  FilterSelect,
  Radio,
  Text,
} from '../../../design-system';
import { DASHBOARD_PERIOD_OPTIONS } from '../shared/dashboardConstants';
import type { DashboardPeriodFilter } from '../shared/dashboardTypes';
import { parseDashboardDateString, validateDashboardDate } from '../shared/dashboardUtils';

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
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onOriginFilterChange: (value: string) => void;
  onOwnerFilterChange: (value: string) => void;
  onOperatorFilterChange: (value: string) => void;
  onContractTypeFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
};

type DashboardPeriodStep = 'options' | 'custom';

const toDatePickerValue = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
};

const fromDatePickerValue = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
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
}: DashboardHeaderProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState(periodFilter);
  const [draftStartDate, setDraftStartDate] = useState(customStartDate);
  const [draftEndDate, setDraftEndDate] = useState(customEndDate);
  const [periodStep, setPeriodStep] = useState<DashboardPeriodStep>('options');
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

  const periodLabel = DASHBOARD_PERIOD_OPTIONS.find((option) => option.value === periodFilter)?.label ?? 'Período';
  const startIsValid = validateDashboardDate(draftStartDate);
  const endIsValid = validateDashboardDate(draftEndDate);
  const customRangeIsValid = startIsValid
    && endIsValid
    && parseDashboardDateString(draftStartDate) <= parseDashboardDateString(draftEndDate);
  const customRangeIsInverted = startIsValid
    && endIsValid
    && parseDashboardDateString(draftStartDate) > parseDashboardDateString(draftEndDate);

  const openPeriodPanel = () => {
    setDraftPeriod(periodFilter);
    setDraftStartDate(customStartDate);
    setDraftEndDate(customEndDate);
    setPeriodStep(periodFilter === 'personalizado' ? 'custom' : 'options');
    setPeriodOpen(true);
  };

  const applyPeriod = () => {
    if (draftPeriod === 'personalizado') {
      if (!customRangeIsValid) return;
      onStartDateChange(draftStartDate);
      onEndDateChange(draftEndDate);
    }
    onPeriodFilterChange(draftPeriod);
    setPeriodOpen(false);
  };

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

  const periodTrigger = (
    <Button
      type="button"
      variant="primary"
      className="kds-dashboard-period-trigger"
      aria-label={`Período: ${periodLabel}`}
      aria-haspopup="dialog"
      aria-expanded={periodOpen}
      aria-controls="dashboard-period-filter"
      onClick={openPeriodPanel}
    >
      <CalendarDays aria-hidden="true" />
      <span className="kds-dashboard-period-trigger-label">{periodLabel}</span>
      <ChevronDown aria-hidden="true" />
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

  const periodOptions = (
    <fieldset className="kds-dashboard-period-options">
      <legend className="sr-only">Escolha um período</legend>
      {DASHBOARD_PERIOD_OPTIONS.map((option) => (
        <Radio
          key={option.value}
          name="dashboard-period-filter"
          value={option.value}
          checked={draftPeriod === option.value}
          onChange={() => {
            setDraftPeriod(option.value);
            setPeriodStep(option.value === 'personalizado' ? 'custom' : 'options');
          }}
          label={option.label}
          className="kds-dashboard-period-option"
        />
      ))}
    </fieldset>
  );

  const customPeriodFields = (
    <div className="kds-dashboard-period-custom-fields">
      <Text className="kds-dashboard-period-help">Defina as datas inicial e final para atualizar o dashboard.</Text>
      <Field label="De" required description="Data inicial do intervalo.">
        <DateTimePicker
          type="date"
          value={toDatePickerValue(draftStartDate)}
          onChange={(event) => setDraftStartDate(fromDatePickerValue(event.target.value))}
          placeholder="Selecionar"
          aria-label="Data inicial do período"
        />
      </Field>
      <Field
        label="Até"
        required
        description="Data final do intervalo."
        error={customRangeIsInverted ? 'A data final deve ser igual ou posterior à data inicial.' : undefined}
      >
        <DateTimePicker
          type="date"
          value={toDatePickerValue(draftEndDate)}
          onChange={(event) => setDraftEndDate(fromDatePickerValue(event.target.value))}
          placeholder="Selecionar"
          aria-label="Data final do período"
          aria-invalid={customRangeIsInverted}
        />
      </Field>
    </div>
  );

  const periodTitle = <DialogTitle>{periodStep === 'custom' ? 'Período personalizado' : 'Período do dashboard'}</DialogTitle>;
  const periodBody = (
    periodStep === 'custom' ? customPeriodFields : periodOptions
  );
  const periodFooter = (
    <div className={`kds-dashboard-period-footer${periodStep === 'custom' ? ' kds-dashboard-period-footer-custom' : ''}`}>
      {periodStep === 'custom' ? (
        <Button type="button" variant="secondary" onClick={() => setPeriodStep('options')}>Voltar</Button>
      ) : null}
      {draftPeriod === 'personalizado' && periodStep === 'options' ? (
        <Button type="button" variant="primary" onClick={() => setPeriodStep('custom')}>Continuar</Button>
      ) : (
        <Button type="button" variant="primary" disabled={periodStep === 'custom' && !customRangeIsValid} onClick={applyPeriod}>
          Aplicar filtros
        </Button>
      )}
    </div>
  );

  const advancedFiltersPanel = filtersOpen ? (
    isMobileViewport ? (
      <Drawer
        id="dashboard-advanced-filters"
        open
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
    ) : (
      <Dialog
        id="dashboard-advanced-filters"
        open
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
    )
  ) : null;

  const periodPanel = periodOpen ? (
    isMobileViewport ? (
      <Drawer
        id="dashboard-period-filter"
        open
        onOpenChange={setPeriodOpen}
        side="right"
        size="sm"
        aria-label="Período do dashboard"
        className="kds-dashboard-period-drawer"
      >
        <DrawerHeader onClose={() => setPeriodOpen(false)} className="kds-dashboard-filter-header">
          {periodTitle}
        </DrawerHeader>
        <DrawerBody className="kds-dashboard-period-body">{periodBody}</DrawerBody>
        <DrawerFooter className="kds-dashboard-period-footer-wrap">{periodFooter}</DrawerFooter>
      </Drawer>
    ) : (
      <Dialog
        id="dashboard-period-filter"
        open
        onOpenChange={setPeriodOpen}
        size="sm"
        aria-label="Período do dashboard"
        className="kds-dashboard-period-dialog"
      >
        <DialogHeader onClose={() => setPeriodOpen(false)} className="kds-dashboard-filter-header">
          {periodTitle}
        </DialogHeader>
        <DialogBody className="kds-dashboard-period-body">{periodBody}</DialogBody>
        <DialogFooter className="kds-dashboard-period-footer-wrap">{periodFooter}</DialogFooter>
      </Dialog>
    )
  ) : null;

  return (
    <>
      <PageHeader
        eyebrow="Operação comercial"
        title="Dashboard"
        description="Veja o que pede atenção e escolha o próximo passo da operação."
        actions={(
          <div className="kds-dashboard-header-actions">
            {filterTrigger()}
            {periodTrigger}
          </div>
        )}
        data-panel-animate
        className="border-b border-[var(--border-subtle)] pb-5"
      />
      {advancedFiltersPanel}
      {periodPanel}
    </>
  );
}
