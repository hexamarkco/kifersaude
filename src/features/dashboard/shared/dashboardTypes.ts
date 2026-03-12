import type { Contract, Lead } from '../../../lib/supabase';
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
export type DashboardPeriodFilter = 'mes-atual' | 'todo-periodo' | 'personalizado';
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
