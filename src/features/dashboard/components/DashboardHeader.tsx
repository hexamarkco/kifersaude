import { useState } from 'react';
import { CalendarDays, MoreHorizontal } from 'lucide-react';

import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DateTimePicker,
  Field,
  PageHeader,
  Radio,
  Select,
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
  title?: string;
  description?: string;
  showFilters?: boolean;
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
  title = 'Um olhar sobre a operação',
  description = 'Tudo o que precisa da sua atenção, em um só lugar.',
  showFilters = true,
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
  const [filterDraft, setFilterDraft] = useState({ owner: dashboardOwnerFilter, status: dashboardStatusFilter, origin: dashboardOriginFilter, contractType: dashboardContractTypeFilter, operator: dashboardOperatorFilter });
  const openFilters = () => {
    setFilterDraft({ owner: dashboardOwnerFilter, status: dashboardStatusFilter, origin: dashboardOriginFilter, contractType: dashboardContractTypeFilter, operator: dashboardOperatorFilter });
    setFiltersOpen(true);
  };
  const applyFilters = () => {
    onOwnerFilterChange(filterDraft.owner);
    onStatusFilterChange(filterDraft.status);
    onOriginFilterChange(filterDraft.origin);
    onContractTypeFilterChange(filterDraft.contractType);
    onOperatorFilterChange(filterDraft.operator);
    setFiltersOpen(false);
  };
  const [periodOpen, setPeriodOpen] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState(periodFilter);
  const [draftStartDate, setDraftStartDate] = useState(customStartDate);
  const [draftEndDate, setDraftEndDate] = useState(customEndDate);
  const [periodStep, setPeriodStep] = useState<DashboardPeriodStep>('options');

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
      variant="ghost"
      aria-label="Filtros avançados"
      aria-haspopup="dialog"
      aria-expanded={filtersOpen}
      aria-controls="dashboard-advanced-filters"
      onClick={() => filtersOpen ? setFiltersOpen(false) : openFilters()}
      className="shrink-0"
    >
      <MoreHorizontal aria-hidden="true" />
      {activeFilterCount > 0 && <Badge tone="info" size="sm">{activeFilterCount}</Badge>}
    </Button>
  );

  const periodTrigger = (
    <Button
      type="button"
      variant="secondary"
      className="kds-dashboard-period-trigger"
      aria-label={`Período: ${periodLabel}`}
      aria-haspopup="dialog"
      aria-expanded={periodOpen}
      aria-controls="dashboard-period-filter"
      onClick={openPeriodPanel}
    >
      <CalendarDays aria-hidden="true" />
      <span className="kds-dashboard-period-trigger-label">Selecionar período</span>
    </Button>
  );

  const filters = [
    { label: 'Responsável', all: 'Todos os responsáveis', value: filterDraft.owner, onChange: (value: string) => setFilterDraft((draft) => ({ ...draft, owner: value })), options: responsavelOptions },
    { label: 'Etapa do lead', all: 'Todos os estágios', value: filterDraft.status, onChange: (value: string) => setFilterDraft((draft) => ({ ...draft, status: value })), options: statusOptions },
    { label: 'Origem', all: 'Todas as origens', value: filterDraft.origin, onChange: (value: string) => setFilterDraft((draft) => ({ ...draft, origin: value })), options: visibleLeadOrigins.map(({ nome }) => ({ value: nome, label: nome })) },
    { label: 'Tipo de contratação', all: 'Todos os tipos', value: filterDraft.contractType, onChange: (value: string) => setFilterDraft((draft) => ({ ...draft, contractType: value })), options: contractTypeOptions },
    { label: 'Operadora', all: 'Todas as operadoras', value: filterDraft.operator, onChange: (value: string) => setFilterDraft((draft) => ({ ...draft, operator: value })), options: operatorOptions.map((operator) => ({ value: operator, label: operator })) },
  ];

  const filterActions = (
    <>
      <Button
        type="button"
        variant="text"
        size="sm"
        onClick={() => setFilterDraft({ owner: '', status: '', origin: '', contractType: '', operator: '' })}
      >
        Limpar filtros
      </Button>
      <Button type="button" variant="secondary" onClick={() => setFiltersOpen(false)}>Cancelar</Button>
      <Button type="button" onClick={applyFilters}>Aplicar filtros</Button>
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
      <Field label="Data inicial" required description="Data inicial do intervalo.">
        <DateTimePicker
          type="date"
          value={toDatePickerValue(draftStartDate)}
          onChange={(event) => setDraftStartDate(fromDatePickerValue(event.target.value))}
          placeholder="Selecionar"
          aria-label="Data inicial do período"
        />
      </Field>
      <Field
        label="Data final"
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

  const periodTitle = <DialogTitle>{periodStep === 'custom' ? 'Período personalizado' : 'Selecionar período'}</DialogTitle>;
  const periodBody = (
    periodStep === 'custom' ? customPeriodFields : periodOptions
  );
  const periodFooter = (
    <div className={`kds-dashboard-period-footer${periodStep === 'custom' ? ' kds-dashboard-period-footer-custom' : ''}`}>
      {periodStep === 'custom' ? (
        <Button type="button" variant="secondary" onClick={() => setPeriodStep('options')}>Voltar</Button>
      ) : null}
      <Button type="button" variant="secondary" onClick={() => setPeriodOpen(false)}>Cancelar</Button>
      {draftPeriod === 'personalizado' && periodStep === 'options' ? (
        <Button type="button" variant="primary" onClick={() => setPeriodStep('custom')}>Continuar</Button>
      ) : (
        <Button type="button" variant="primary" disabled={periodStep === 'custom' && !customRangeIsValid} onClick={applyPeriod}>
          Aplicar filtros
        </Button>
      )}
    </div>
  );

  const advancedFiltersPanel = filtersOpen && (
    <Dialog
      id="dashboard-advanced-filters"
      open
      onOpenChange={setFiltersOpen}
      className="kds-crm-dialog kds-dashboard-filter-dialog"
      aria-label="Filtros avançados do dashboard"
    >
      <DialogHeader onClose={() => setFiltersOpen(false)}>
        <Text className="kds-dialog-eyebrow">Visão geral</Text>
        <DialogTitle>Filtros do dashboard</DialogTitle>
      </DialogHeader>
      <DialogBody className="kds-dashboard-filter-fields">
        {filters.map(({ label, all, value, onChange, options }) => (
          <Field key={label} label={label}>
            <Select
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={all}
              options={options.some((option) => option.value === '') ? options : [{ value: '', label: all }, ...options]}
            />
          </Field>
        ))}
      </DialogBody>
      <DialogFooter className="kds-dashboard-filter-footer">{filterActions}</DialogFooter>
    </Dialog>
  );

  const periodPanel = periodOpen && (
    <Dialog
      id="dashboard-period-filter"
      open
      onOpenChange={setPeriodOpen}
      className="kds-crm-dialog kds-dashboard-period-dialog"
      aria-label="Período do dashboard"
    >
      <DialogHeader onClose={() => setPeriodOpen(false)}>
        <Text className="kds-dialog-eyebrow">Visão geral</Text>
        {periodTitle}
      </DialogHeader>
      <DialogBody className="kds-dashboard-period-body">{periodBody}</DialogBody>
      <DialogFooter>{periodFooter}</DialogFooter>
    </Dialog>
  );

  return (
    <>
      <PageHeader
        className="kds-dashboard-page-header"
        eyebrow={new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date())}
        title={title}
        description={description}
        actions={showFilters && (
          <div className="kds-dashboard-header-actions">
            {filterTrigger()}
            {periodTrigger}
          </div>
        )}
        data-panel-animate
      />
      {showFilters && advancedFiltersPanel}
      {showFilters && periodPanel}
    </>
  );
}
