import type { Contract } from '../../contracts';
import type { Lead, LeadStatusHistory } from '../../leads';
import type { Interaction } from '../../activity';
import type { Reminder } from '../../reminders';
import type {
  DashboardDateRange,
  DashboardAttentionItem,
  DashboardOperationsAnalysis,
  DashboardOperationsInput,
  DashboardPeriodFilter,
} from '../shared/dashboardTypes';
import { parseDashboardDateString, parseDashboardDateValue } from '../shared/dashboardUtils';

const terminalStatusPattern = /^(fechado|perdido|convertido)$/i;
const wonStatusPattern = /^(fechado|convertido)$/i;
const lostStatusPattern = /^perdido$/i;
const DAY_IN_MS = 86_400_000;

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const formatRangeLabel = (range: DashboardDateRange) => {
  const formatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
  return `${formatter.format(range.start)} – ${formatter.format(range.end)}`;
};

export const resolveDashboardDateRange = (
  period: DashboardPeriodFilter,
  customStartDate: string,
  customEndDate: string,
  now = new Date(),
): DashboardDateRange | null => {
  const today = startOfDay(now);
  const makeRange = (start: Date, end: Date): DashboardDateRange => {
    const range = { start: startOfDay(start), end: endOfDay(end), label: '' };
    return { ...range, label: formatRangeLabel(range) };
  };

  if (period === 'todo-periodo') return null;
  if (period === '7d') return makeRange(new Date(today.getTime() - (6 * DAY_IN_MS)), today);
  if (period === '30d') return makeRange(new Date(today.getTime() - (29 * DAY_IN_MS)), today);
  if (period === 'mes-atual') return makeRange(new Date(today.getFullYear(), today.getMonth(), 1), today);
  if (period === 'mes-anterior') {
    return makeRange(
      new Date(today.getFullYear(), today.getMonth() - 1, 1),
      new Date(today.getFullYear(), today.getMonth(), 0),
    );
  }
  if (customStartDate.length !== 10 || customEndDate.length !== 10) return null;
  const start = parseDashboardDateString(customStartDate);
  const end = parseDashboardDateString(customEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  return makeRange(start, end);
};

export const getPreviousDashboardDateRange = (
  range: DashboardDateRange | null,
): DashboardDateRange | null => {
  if (!range) return null;
  const length = Math.round((startOfDay(range.end).getTime() - startOfDay(range.start).getTime()) / DAY_IN_MS) + 1;
  const end = new Date(range.start.getTime() - DAY_IN_MS);
  const start = new Date(end.getTime() - ((length - 1) * DAY_IN_MS));
  const result = { start: startOfDay(start), end: endOfDay(end), label: '' };
  return { ...result, label: formatRangeLabel(result) };
};

const isInside = (value: string | null | undefined, range: DashboardDateRange | null) => {
  if (!range) return true;
  const date = parseDashboardDateValue(value);
  return Boolean(date && date >= range.start && date <= range.end);
};

const leadDate = (lead: Lead) => lead.data_criacao || lead.created_at;
const contractDate = (contract: Contract) => contract.data_inicio || contract.created_at;
const isOpenLead = (lead: Lead) => !lead.arquivado && !terminalStatusPattern.test(lead.status ?? '');
const percentage = (numerator: number, denominator: number) =>
  denominator > 0 ? (numerator / denominator) * 100 : null;
const daysBetween = (start: Date, end: Date) => Math.max(0, Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_IN_MS));

export const buildDashboardOperationsAnalysis = ({
  leads,
  contracts,
  reminders,
  interactions,
  statusHistory,
  leadStatuses,
  periodFilter,
  customStartDate,
  customEndDate,
  now = new Date(),
}: DashboardOperationsInput): DashboardOperationsAnalysis => {
  const currentRange = resolveDashboardDateRange(periodFilter, customStartDate, customEndDate, now);
  const comparisonRange = getPreviousDashboardDateRange(currentRange);
  const countIn = <T,>(items: T[], getDate: (item: T) => string | null | undefined, range: DashboardDateRange | null) =>
    items.filter((item) => isInside(getDate(item), range)).length;
  const openLeads = leads.filter(isOpenLead);
  const historiesInCurrent = statusHistory.filter((item) => isInside(item.created_at, currentRange));
  const historiesInPrevious = statusHistory.filter((item) => isInside(item.created_at, comparisonRange));
  const won = historiesInCurrent.filter((item) => wonStatusPattern.test(item.status_novo)).length;
  const lost = historiesInCurrent.filter((item) => lostStatusPattern.test(item.status_novo)).length;
  const wonPrevious = comparisonRange === null ? null : historiesInPrevious.filter((item) => wonStatusPattern.test(item.status_novo)).length;
  const lostPrevious = comparisonRange === null ? null : historiesInPrevious.filter((item) => lostStatusPattern.test(item.status_novo)).length;

  const historiesByLead = new Map<string, LeadStatusHistory[]>();
  statusHistory.forEach((history) => {
    const current = historiesByLead.get(history.lead_id) ?? [];
    current.push(history);
    historiesByLead.set(history.lead_id, current);
  });
  historiesByLead.forEach((history) => history.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()));

  const interactionsByLead = new Map<string, Interaction[]>();
  interactions.forEach((interaction) => {
    if (!interaction.lead_id) return;
    const current = interactionsByLead.get(interaction.lead_id) ?? [];
    current.push(interaction);
    interactionsByLead.set(interaction.lead_id, current);
  });
  interactionsByLead.forEach((items) => items.sort((left, right) => new Date(right.data_interacao).getTime() - new Date(left.data_interacao).getTime()));

  const remindersByLead = new Map<string, Reminder[]>();
  reminders.forEach((reminder) => {
    if (!reminder.lead_id) return;
    const current = remindersByLead.get(reminder.lead_id) ?? [];
    current.push(reminder);
    remindersByLead.set(reminder.lead_id, current);
  });

  const orderedStatuses = [...leadStatuses]
    .filter((status) => status.ativo && !terminalStatusPattern.test(status.nome))
    .sort((left, right) => left.ordem - right.ordem);
  const stageHealth = orderedStatuses.map((status) => {
    const stageLeads = openLeads.filter((lead) => lead.status === status.nome);
    const totalDays = stageLeads.reduce((sum, lead) => {
      const latestChange = historiesByLead.get(lead.id)?.[0]?.created_at || lead.updated_at || leadDate(lead);
      const changedAt = parseDashboardDateValue(latestChange);
      return sum + (changedAt ? daysBetween(changedAt, now) : 0);
    }, 0);
    return {
      status: status.nome,
      count: stageLeads.length,
      share: openLeads.length > 0 ? (stageLeads.length / openLeads.length) * 100 : 0,
      averageDays: stageLeads.length > 0 ? totalDays / stageLeads.length : 0,
    };
  });
  const bottleneck = stageHealth
    .filter((stage) => stage.count > 0)
    .sort((left, right) => ((right.averageDays * right.count) - (left.averageDays * left.count)))[0] ?? null;

  const overdue = openLeads
    .filter((lead) => {
      const date = parseDashboardDateValue(lead.proximo_retorno);
      return Boolean(date && date < startOfDay(now));
    })
    .sort((left, right) => (parseDashboardDateValue(left.proximo_retorno)?.getTime() ?? 0) - (parseDashboardDateValue(right.proximo_retorno)?.getTime() ?? 0));
  const missingNextStep = openLeads.filter((lead) => {
    const pendingReminder = (remindersByLead.get(lead.id) ?? []).some((reminder) => !reminder.concluido_em && !reminder.lido && new Date(reminder.data_lembrete) >= startOfDay(now));
    return !lead.proximo_retorno && !pendingReminder;
  });
  const noRecentActivity = openLeads.filter((lead) => {
    const interactionDate = interactionsByLead.get(lead.id)?.[0]?.data_interacao;
    const contactDate = interactionDate || lead.ultimo_contato;
    const parsed = parseDashboardDateValue(contactDate);
    return !parsed || daysBetween(parsed, now) >= 7;
  });
  const lastOpenStatus = orderedStatuses.length > 0 ? orderedStatuses[orderedStatuses.length - 1].nome : undefined;
  const closeReady = lastOpenStatus ? openLeads.filter((lead) => lead.status === lastOpenStatus) : [];
  const attention: DashboardAttentionItem[] = [];
  if (overdue.length > 0) attention.push({ kind: 'overdue-follow-up', title: 'Retornos vencidos', description: 'Leads com próximo retorno já ultrapassado.', count: overdue.length, leadIds: overdue.slice(0, 5).map((lead) => lead.id), tone: 'danger' });
  if (missingNextStep.length > 0) attention.push({ kind: 'missing-next-step', title: 'Sem próximo passo', description: 'Leads ativos sem retorno ou lembrete pendente.', count: missingNextStep.length, leadIds: missingNextStep.slice(0, 5).map((lead) => lead.id), tone: 'warning' });
  if (noRecentActivity.length > 0) attention.push({ kind: 'stale-activity', title: 'Sem atividade recente', description: 'Sem contato registrado nos últimos 7 dias.', count: noRecentActivity.length, leadIds: noRecentActivity.slice(0, 5).map((lead) => lead.id), tone: 'warning' });
  if (closeReady.length > 0) attention.push({ kind: 'close-ready', title: 'Próximos do fechamento', description: `Leads na última etapa ativa (${lastOpenStatus}).`, count: closeReady.length, leadIds: closeReady.slice(0, 5).map((lead) => lead.id), tone: 'success' });

  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const contractsCurrent = contracts.filter((contract) => isInside(contractDate(contract), currentRange));
  const sources = new Map<string, { leads: number; contracts: number }>();
  leads.filter((lead) => isInside(leadDate(lead), currentRange)).forEach((lead) => {
    const origin = lead.origem || 'Não informado';
    const current = sources.get(origin) ?? { leads: 0, contracts: 0 };
    current.leads += 1;
    sources.set(origin, current);
  });
  contractsCurrent.forEach((contract) => {
    const origin = contract.lead_id ? leadsById.get(contract.lead_id)?.origem || 'Não informado' : 'Não informado';
    const current = sources.get(origin) ?? { leads: 0, contracts: 0 };
    current.contracts += 1;
    sources.set(origin, current);
  });
  const cycleDays = contractsCurrent.flatMap((contract) => {
    const lead = contract.lead_id ? leadsById.get(contract.lead_id) : undefined;
    const start = lead ? parseDashboardDateValue(leadDate(lead)) : null;
    const end = parseDashboardDateValue(contractDate(contract));
    return start && end && end >= start ? [daysBetween(start, end)] : [];
  });

  return {
    currentRange,
    comparisonRange,
    leadsCreated: countIn(leads, leadDate, currentRange),
    leadsCreatedPrevious: comparisonRange ? countIn(leads, leadDate, comparisonRange) : null,
    contractsCreated: countIn(contracts, contractDate, currentRange),
    contractsCreatedPrevious: comparisonRange ? countIn(contracts, contractDate, comparisonRange) : null,
    won,
    wonPrevious,
    lost,
    lostPrevious,
    conversion: percentage(won, won + lost),
    conversionPrevious: wonPrevious === null || lostPrevious === null ? null : percentage(wonPrevious, wonPrevious + lostPrevious),
    activePipeline: openLeads.length,
    activeContracts: contracts.filter((contract) => contract.status === 'Ativo').length,
    averageCycleDays: cycleDays.length ? cycleDays.reduce((sum, value) => sum + value, 0) / cycleDays.length : null,
    stageHealth,
    bottleneck,
    attention,
    sourcePerformance: [...sources.entries()]
      .map(([origin, metrics]) => ({ origin, ...metrics, conversion: percentage(metrics.contracts, metrics.leads) }))
      .sort((left, right) => right.leads - left.leads || right.contracts - left.contracts),
    dataCoverage: { statusHistory: statusHistory.length > 0, interactions: interactions.length > 0, reminders: reminders.length > 0 },
  };
};
