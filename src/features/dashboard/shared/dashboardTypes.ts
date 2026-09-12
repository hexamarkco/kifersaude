import type { Contract } from '../../contracts';
import type { Lead, LeadStatusConfig } from '../../leads';
import type { Interaction } from '../../activity';
import type { Reminder } from '../../reminders';
import type { TabNavigationOptions } from '../../../types/navigation';

export type Holder = {
  id: string;
  contract_id: string;
  nome_completo: string;
  data_nascimento: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
};

export type Dependent = {
  id: string;
  contract_id: string;
  nome_completo: string;
  data_nascimento: string;
};

export type ReminderRequest = {
  contractId?: string;
  leadId?: string;
  title?: string;
  description?: string;
};

export type DashboardProps = {
  onNavigateToTab?: (tab: string, options?: TabNavigationOptions) => void;
  onCreateReminder?: (options: ReminderRequest) => void;
};

export type DashboardMetric = 'leads' | 'contratos' | 'comissoes';
export type DashboardPeriodFilter =
  | '7d'
  | '30d'
  | 'mes-atual'
  | 'mes-anterior'
  | 'todo-periodo'
  | 'personalizado';
export type DashboardChartRange = 6 | 12;
export type DashboardCalendarView = 'day' | 'week' | 'month';

export type DashboardMonthlyPoint = {
  label: string;
  value: number;
  date: Date;
  variation?: number | null;
};

export type AgeBand = {
  min: number;
  max: number | null;
};

export type AdjustmentItem = {
  id: string;
  date: Date;
  tipo: 'idade' | 'anual';
  contract?: Contract;
  personName?: string;
  role?: string;
  age?: number;
};

export type BirthdayEvent = {
  nome: string;
  data_nascimento: string;
  tipo: 'Titular' | 'Dependente';
  contract_id: string;
  contract?: Contract;
  holder?: Holder;
  isPJ: boolean;
  nextBirthday: Date;
};

export type CalendarEvent =
  | {
      id: string;
      date: Date;
      kind: 'adjustment';
      adjustment: AdjustmentItem;
    }
  | {
      id: string;
      date: Date;
      kind: 'birthday';
      birthday: BirthdayEvent;
    };

export type DashboardStatusDistributionItem = {
  status: string;
  count: number;
};

export type DashboardOperadoraDistributionItem = {
  operadora: string;
  count: number;
};

export type DashboardChartDatum = {
  label: string;
  value: number;
  color: string;
};

export type DashboardLeadNavigationHandler = (leadId?: string | null) => void;
export type DashboardContractNavigationHandler = (contract?: Contract | null) => void;
export type DashboardReminderRequestHandler = (options: ReminderRequest) => void | Promise<void>;

export type DashboardSelectedLead = Lead | null;

export type DashboardDateRange = {
  start: Date;
  end: Date;
  label: string;
};

export type DashboardAttentionKind =
  | 'overdue-follow-up'
  | 'missing-next-step'
  | 'stale-activity'
  | 'close-ready';

export type DashboardAttentionItem = {
  kind: DashboardAttentionKind;
  title: string;
  description: string;
  count: number;
  leadIds: string[];
  tone: 'danger' | 'warning' | 'info' | 'success';
};

export type DashboardStageHealth = {
  status: string;
  count: number;
  share: number;
  averageDays: number;
};

export type DashboardSourcePerformance = {
  origin: string;
  leads: number;
  contracts: number;
  conversion: number | null;
};

export type DashboardOperationsAnalysis = {
  currentRange: DashboardDateRange | null;
  comparisonRange: DashboardDateRange | null;
  leadsCreated: number;
  leadsCreatedPrevious: number | null;
  contractsCreated: number;
  contractsCreatedPrevious: number | null;
  won: number;
  wonPrevious: number | null;
  lost: number;
  lostPrevious: number | null;
  conversion: number | null;
  conversionPrevious: number | null;
  activePipeline: number;
  activeContracts: number;
  averageCycleDays: number | null;
  stageHealth: DashboardStageHealth[];
  bottleneck: DashboardStageHealth | null;
  attention: DashboardAttentionItem[];
  sourcePerformance: DashboardSourcePerformance[];
  dataCoverage: {
    statusHistory: boolean;
    interactions: boolean;
    reminders: boolean;
  };
};

export type DashboardOperationsInput = {
  leads: Lead[];
  contracts: Contract[];
  reminders: Reminder[];
  interactions: Interaction[];
  statusHistory: import('../../leads').LeadStatusHistory[];
  leadStatuses: LeadStatusConfig[];
  periodFilter: DashboardPeriodFilter;
  customStartDate: string;
  customEndDate: string;
  now?: Date;
};
