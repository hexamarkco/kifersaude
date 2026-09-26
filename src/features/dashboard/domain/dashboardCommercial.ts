import type { Contract } from '../../contracts';
import type { Lead } from '../../leads';
import { normalizeOperadoraLabel } from '../../../lib/textNormalization';
import { parseDashboardDateValue } from '../shared/dashboardUtils';
import type {
  DashboardCommercialAnalysis,
  DashboardCommercialInput,
  DashboardDateRange,
  DashboardInteraction,
  DashboardOpportunity,
  DashboardPerformanceRow,
  DashboardReminder,
  DashboardStageMetric,
  DashboardStatusHistory,
} from '../shared/dashboardTypes';
import { resolveDashboardDateRange } from './dashboardOperations';

// Não há SLA/aging persistido para oportunidades no modelo atual; manter o
// limite centralizado evita espalhar um número operacional pela UI e domínio.
export const DASHBOARD_STALE_OPPORTUNITY_HOURS = 48;
const STALE_FOLLOW_UP_DAYS = 7;
const DAY_IN_MS = 86_400_000;
const terminalStatusPattern = /^(fechado|perdido|convertido)$/i;
const proposalPattern = /proposta|cot[aã]ç[aã]o/iu;
const decisionPattern = /decis[aã]o|negocia/iu;
const advancedStagePattern = /proposta|decis[aã]o|negocia|contrata/iu;

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const parseDate = (value?: string | null) => parseDashboardDateValue(value);
const leadDate = (lead: Lead) => lead.data_criacao || lead.created_at;
const contractDate = (contract: Contract) => contract.data_inicio || contract.created_at;
const percentage = (numerator: number, denominator: number) =>
  denominator > 0 ? (numerator / denominator) * 100 : null;

const isAgendaOverdue = (value: string | null | undefined, now: Date) => {
  const date = parseDate(value);
  return Boolean(date && startOfDay(date).getTime() < startOfDay(now).getTime());
};

const isSameAgendaDay = (value: string | null | undefined, now: Date) => {
  const date = parseDate(value);
  return Boolean(date && startOfDay(date).getTime() === startOfDay(now).getTime());
};

const isInside = (value: string | null | undefined, range: DashboardDateRange | null) => {
  if (!range) return true;
  const date = parseDate(value);
  return Boolean(date && date >= range.start && date <= range.end);
};

const average = (values: number[]) =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const daysBetween = (start: Date, end: Date) =>
  Math.max(0, Math.floor((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_IN_MS));

const getLatestDate = (values: Array<string | null | undefined>) => {
  const dates = values.map(parseDate).filter((date): date is Date => Boolean(date));
  return dates.sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
};

const hasPendingNextStep = (
  lead: Lead,
  remindersByLead: Map<string, DashboardReminder[]>,
  now: Date,
) => {
  const nextReturn = parseDate(lead.proximo_retorno);
  if (nextReturn && nextReturn >= startOfDay(now)) return true;

  return (remindersByLead.get(lead.id) ?? []).some((reminder) => {
    const date = parseDate(reminder.data_lembrete);
    return Boolean(date && date >= startOfDay(now) && !reminder.lido);
  });
};

const getContractValue = (contracts: Contract[], leadId: string) => {
  const linked = contracts.filter((contract) => contract.lead_id === leadId);
  const values = linked
    .map((contract) => contract.mensalidade_total)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) : null;
};

const buildPerformanceRows = (
  labels: string[],
  getLeadLabel: (lead: Lead) => string,
  leads: Lead[],
  contracts: Contract[],
  leadsById: Map<string, Lead>,
): DashboardPerformanceRow[] => {
  const rows = new Map<string, DashboardPerformanceRow>();
  labels.forEach((label) => rows.set(label, {
    label,
    leads: 0,
    proposals: null,
    contracts: 0,
    conversion: null,
    monthlyValue: 0,
    averageTicket: null,
    commissionExpected: 0,
  }));

  leads.forEach((lead) => {
    const label = getLeadLabel(lead) || 'Não informado';
    const row = rows.get(label) ?? {
      label,
      leads: 0,
      proposals: null,
      contracts: 0,
      conversion: null,
      monthlyValue: 0,
      averageTicket: null,
      commissionExpected: 0,
    };
    row.leads += 1;
    rows.set(label, row);
  });

  contracts.forEach((contract) => {
    const label = contract.lead_id
      ? getLeadLabel(leadsById.get(contract.lead_id) ?? ({ origem: null } as Lead)) || 'Não informado'
      : 'Não informado';
    const row = rows.get(label) ?? {
      label,
      leads: 0,
      proposals: null,
      contracts: 0,
      conversion: null,
      monthlyValue: 0,
      averageTicket: null,
      commissionExpected: 0,
    };
    row.contracts += 1;
    row.monthlyValue += contract.mensalidade_total ?? 0;
    row.commissionExpected += contract.comissao_prevista ?? 0;
    row.averageTicket = row.contracts > 0 ? row.monthlyValue / row.contracts : null;
    row.conversion = percentage(row.contracts, row.leads);
    rows.set(label, row);
  });

  return [...rows.values()]
    .filter((row) => row.leads > 0 || row.contracts > 0)
    .sort((left, right) => right.contracts - left.contracts || right.leads - left.leads);
};

const getTransitionDate = (
  histories: DashboardStatusHistory[],
  matcher: RegExp,
) => histories
  .filter((history) => matcher.test(history.status_novo))
  .map((history) => parseDate(history.created_at))
  .filter((date): date is Date => Boolean(date))
  .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

export const buildDashboardCommercialAnalysis = ({
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
}: DashboardCommercialInput): DashboardCommercialAnalysis => {
  const currentRange = resolveDashboardDateRange(periodFilter, customStartDate, customEndDate, now);
  const currentLeads = leads.filter((lead) => isInside(leadDate(lead), currentRange));
  const currentContracts = contracts.filter((contract) => isInside(contractDate(contract), currentRange));
  const openLeads = leads.filter((lead) => !lead.arquivado && !terminalStatusPattern.test(lead.status ?? ''));
  const periodOpenLeads = currentRange
    ? openLeads.filter((lead) => isInside(leadDate(lead), currentRange))
    : openLeads;
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const interactionsByLead = new Map<string, DashboardInteraction[]>();
  interactions.forEach((interaction) => {
    if (!interaction.lead_id) return;
    const items = interactionsByLead.get(interaction.lead_id) ?? [];
    items.push(interaction);
    interactionsByLead.set(interaction.lead_id, items);
  });
  const historiesByLead = new Map<string, DashboardStatusHistory[]>();
  statusHistory.forEach((history) => {
    const items = historiesByLead.get(history.lead_id) ?? [];
    items.push(history);
    historiesByLead.set(history.lead_id, items);
  });
  historiesByLead.forEach((items) => items.sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()));
  const statusColorByName = new Map(leadStatuses.map((status) => [status.nome, status.cor]));
  const orderedStatuses = [...leadStatuses]
    .filter((status) => status.ativo && !terminalStatusPattern.test(status.nome))
    .sort((left, right) => left.ordem - right.ordem);
  const contractsByLead = new Map<string, Contract[]>();
  contracts.forEach((contract) => {
    if (!contract.lead_id) return;
    const items = contractsByLead.get(contract.lead_id) ?? [];
    items.push(contract);
    contractsByLead.set(contract.lead_id, items);
  });
  const contractLeadById = new Map(
    contracts.filter((contract) => contract.lead_id).map((contract) => [contract.id, contract.lead_id as string]),
  );
  const resolveReminderLeadId = (reminder: DashboardReminder) =>
    reminder.lead_id ?? (reminder.contract_id ? contractLeadById.get(reminder.contract_id) : undefined);
  const remindersByLead = new Map<string, DashboardReminder[]>();
  reminders.forEach((reminder) => {
    const leadId = resolveReminderLeadId(reminder);
    if (!leadId) return;
    const items = remindersByLead.get(leadId) ?? [];
    items.push(reminder);
    remindersByLead.set(leadId, items);
  });

  const stageMetrics: DashboardStageMetric[] = orderedStatuses.map((status, index) => {
    const stageLeads = periodOpenLeads.filter((lead) => lead.status === status.nome);
    const ages = stageLeads.map((lead) => {
      const matchingHistory = historiesByLead.get(lead.id)?.filter((history) => history.status_novo === status.nome) ?? [];
      const latestStatus = matchingHistory[matchingHistory.length - 1];
      const startedAt = parseDate(latestStatus?.created_at || lead.updated_at || leadDate(lead));
      return startedAt ? daysBetween(startedAt, now) : 0;
    });
    const monthlyValues = stageLeads
      .map((lead) => getContractValue(contractsByLead.get(lead.id) ?? [], lead.id))
      .filter((value): value is number => value !== null);
    const fromCount = statusHistory.filter((history) => history.status_anterior === status.nome).length;
    const nextStatus = orderedStatuses[index + 1];
    const nextCount = nextStatus
      ? statusHistory.filter((history) => history.status_anterior === status.nome && history.status_novo === nextStatus.nome).length
      : 0;
    return {
      status: status.nome,
      color: status.cor || null,
      count: stageLeads.length,
      share: periodOpenLeads.length > 0 ? (stageLeads.length / periodOpenLeads.length) * 100 : 0,
      averageDays: average(ages) ?? 0,
      monthlyValue: monthlyValues.length > 0 ? monthlyValues.reduce((sum, value) => sum + value, 0) : null,
      nextStageConversion: nextStatus ? percentage(nextCount, fromCount) : null,
    };
  });
  const pipelineStages = stageMetrics.filter((stage) => stage.count > 0 || stage.monthlyValue !== null);
  const pipelineValues = periodOpenLeads
    .map((lead) => getContractValue(contractsByLead.get(lead.id) ?? [], lead.id))
    .filter((value): value is number => value !== null);

  const currentLeadsWithContracts = new Set(currentContracts.map((contract) => contract.lead_id).filter((id): id is string => Boolean(id)));
  const conversion = percentage(currentLeadsWithContracts.size, new Set(currentLeads.map((lead) => lead.id)).size);
  const commissionInstallments = contracts.flatMap((contract) => {
    if (!Array.isArray(contract.comissao_parcelas)) return [];
    return contract.comissao_parcelas
      .filter((installment) => installment.data_pagamento && typeof installment.valor === 'number')
      .map((installment) => ({ date: installment.data_pagamento as string, value: installment.valor as number }));
  });
  const commissionReceived = commissionInstallments.length > 0
    ? commissionInstallments.filter((item) => isInside(item.date, currentRange)).reduce((sum, item) => sum + item.value, 0)
    : null;

  const pendingReminders = reminders.filter((reminder) => !reminder.lido);
  const overdueReminders = pendingReminders.filter((reminder) => isAgendaOverdue(reminder.data_lembrete, now));
  const pendingToday = pendingReminders.filter((reminder) => isSameAgendaDay(reminder.data_lembrete, now));
  const completedToday = reminders.filter((reminder) => reminder.lido && isSameAgendaDay(reminder.data_lembrete, now));
  const overdueReminderLeadIds = new Set(
    overdueReminders
      .map(resolveReminderLeadId)
      .filter((leadId): leadId is string => Boolean(leadId)),
  );
  const agendaItems = [...overdueReminders, ...pendingToday]
    .sort((left, right) => new Date(left.data_lembrete).getTime() - new Date(right.data_lembrete).getTime())
    .slice(0, 8)
    .map((reminder) => {
      const leadId = resolveReminderLeadId(reminder);
      return {
        id: reminder.id,
        title: reminder.titulo,
        type: reminder.tipo,
        date: reminder.data_lembrete,
        leadId: leadId ?? null,
        leadName: leadId ? leadsById.get(leadId)?.nome_completo ?? null : null,
        overdue: overdueReminders.some((item) => item.id === reminder.id),
        completed: Boolean(reminder.concluido_em),
      };
    });

  const opportunityDetails: DashboardOpportunity[] = periodOpenLeads.map((lead) => {
    const leadInteractions = interactionsByLead.get(lead.id) ?? [];
    const interactionDate = leadInteractions[leadInteractions.length - 1]?.data_interacao;
    const lastContact = getLatestDate([lead.ultimo_contato, interactionDate]);
    const idleDays = lastContact ? daysBetween(lastContact, now) : null;
    const hasNextStep = hasPendingNextStep(lead, remindersByLead, now);
    const overdue = overdueReminderLeadIds.has(lead.id);
    const advanced = advancedStagePattern.test(lead.status ?? '');
    const stale = idleDays === null || idleDays >= STALE_FOLLOW_UP_DAYS;
    const signal = overdue ? 'Follow-up vencido' : advanced ? 'Etapa avançada' : !hasNextStep ? 'Sem próximo passo' : stale ? 'Sem interação recente' : 'Atenção';
    const tone = overdue ? 'danger' : !hasNextStep || stale ? 'warning' : 'info';
    return {
      leadId: lead.id,
      name: lead.nome_completo,
      status: lead.status || 'Sem estágio',
      statusColor: statusColorByName.get(lead.status ?? '') ?? null,
      monthlyValue: getContractValue(contractsByLead.get(lead.id) ?? [], lead.id),
      lastContact: lastContact?.toISOString() ?? null,
      idleDays,
      nextStep: lead.proximo_retorno ?? null,
      responsavel: lead.responsavel ?? null,
      signal,
      tone,
    };
  });
  const opportunityPriority = (opportunity: DashboardOpportunity) => {
    if (opportunity.signal === 'Follow-up vencido') return 0;
    if (opportunity.signal === 'Etapa avançada') return 1;
    if (opportunity.signal === 'Sem próximo passo') return 2;
    return 3;
  };
  const opportunities = [...opportunityDetails]
    .filter((opportunity) => opportunity.signal !== 'Atenção' || opportunity.idleDays === null || opportunity.idleDays >= STALE_FOLLOW_UP_DAYS)
    .sort((left, right) => opportunityPriority(left) - opportunityPriority(right) || (right.idleDays ?? 0) - (left.idleDays ?? 0))
    .slice(0, 10);

  const withoutNextStepLeadIds = periodOpenLeads
    .filter((lead) => !hasPendingNextStep(lead, remindersByLead, now))
    .map((lead) => lead.id);
  const overdueFollowUpCount = overdueReminders.length;

  const stageHistoryByLead = new Map<string, DashboardStatusHistory[]>();
  statusHistory.forEach((history) => {
    if (!isInside(history.created_at, currentRange)) return;
    const items = stageHistoryByLead.get(history.lead_id) ?? [];
    items.push(history);
    stageHistoryByLead.set(history.lead_id, items);
  });
  const leadToProposalDays: number[] = [];
  const proposalToDecisionDays: number[] = [];
  const decisionToClosedDays: number[] = [];
  const leadToClosedDays: number[] = [];
  currentLeads.forEach((lead) => {
    const leadStartedAt = parseDate(leadDate(lead));
    const history = stageHistoryByLead.get(lead.id) ?? [];
    const proposalAt = getTransitionDate(history, proposalPattern);
    const decisionAt = getTransitionDate(history, decisionPattern);
    if (leadStartedAt && proposalAt && proposalAt >= leadStartedAt) leadToProposalDays.push(daysBetween(leadStartedAt, proposalAt));
    if (proposalAt && decisionAt && decisionAt >= proposalAt) proposalToDecisionDays.push(daysBetween(proposalAt, decisionAt));
    if (decisionAt) {
      const closedAt = currentContracts.find((contract) => contract.lead_id === lead.id);
      const closedDate = closedAt ? parseDate(contractDate(closedAt)) : null;
      if (closedDate && closedDate >= decisionAt) decisionToClosedDays.push(daysBetween(decisionAt, closedDate));
    }
  });
  currentContracts.forEach((contract) => {
    const lead = contract.lead_id ? leadsById.get(contract.lead_id) : undefined;
    const leadStartedAt = lead ? parseDate(leadDate(lead)) : null;
    const closedAt = parseDate(contractDate(contract));
    if (leadStartedAt && closedAt && closedAt >= leadStartedAt) leadToClosedDays.push(daysBetween(leadStartedAt, closedAt));
  });
  const ageBuckets = [
    { label: 'Hoje', min: 0, max: 0 },
    { label: '1–2 dias', min: 1, max: 2 },
    { label: '3–7 dias', min: 3, max: 7 },
    { label: '8–15 dias', min: 8, max: 15 },
    { label: '16–30 dias', min: 16, max: 30 },
    { label: '+30 dias', min: 31, max: null },
  ].map((bucket) => {
    const bucketLeads = periodOpenLeads.filter((lead) => {
      const createdAt = parseDate(leadDate(lead));
      const age = createdAt ? daysBetween(createdAt, now) : 0;
      return age >= bucket.min && (bucket.max === null || age <= bucket.max);
    });
    return { label: bucket.label, count: bucketLeads.length, leadIds: bucketLeads.map((lead) => lead.id) };
  });

  const stuckLeads = periodOpenLeads.filter((lead) => {
    if (!advancedStagePattern.test(lead.status ?? '')) return false;
    const leadInteractions = interactionsByLead.get(lead.id) ?? [];
    const interactionDate = leadInteractions[leadInteractions.length - 1]?.data_interacao;
    const lastActivity = getLatestDate([lead.ultimo_contato, interactionDate, lead.updated_at, leadDate(lead)]);
    return Boolean(lastActivity && now.getTime() - lastActivity.getTime() >= DASHBOARD_STALE_OPPORTUNITY_HOURS * 3_600_000);
  });
  const stuckValues = stuckLeads.map((lead) => getContractValue(contractsByLead.get(lead.id) ?? [], lead.id)).filter((value): value is number => value !== null);

  const origins = buildPerformanceRows([], (lead) => lead.origem || 'Não informado', currentLeads, currentContracts, leadsById);
  const operatorLabels = [...new Set(currentContracts.map((contract) => normalizeOperadoraLabel(contract.operadora)).filter(Boolean))];
  const operators: DashboardPerformanceRow[] = operatorLabels.map((label) => {
    const matchingContracts = currentContracts.filter((contract) => normalizeOperadoraLabel(contract.operadora) === label);
    const monthlyValue = matchingContracts.reduce((sum, contract) => sum + (contract.mensalidade_total ?? 0), 0);
    return {
      label,
      leads: 0,
      proposals: null,
      contracts: matchingContracts.length,
      conversion: null,
      monthlyValue,
      averageTicket: matchingContracts.length > 0 ? monthlyValue / matchingContracts.length : null,
      commissionExpected: matchingContracts.reduce((sum, contract) => sum + (contract.comissao_prevista ?? 0), 0),
    };
  });
  const recentProposalLeads = periodOpenLeads
    .filter((lead) => proposalPattern.test(lead.status ?? ''))
    .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
    .slice(0, 8)
    .map((lead) => opportunityDetails.find((item) => item.leadId === lead.id))
    .filter((item): item is DashboardOpportunity => Boolean(item));

  const stageConversions = orderedStatuses.slice(0, -1).map((status, index) => {
    const nextStatus = orderedStatuses[index + 1];
    const denominator = statusHistory.filter((history) => history.status_anterior === status.nome).length;
    const numerator = statusHistory.filter((history) => history.status_anterior === status.nome && history.status_novo === nextStatus.nome).length;
    return { from: status.nome, to: nextStatus.nome, rate: percentage(numerator, denominator), numerator, denominator };
  });

  return {
    salesCount: currentContracts.length,
    monthlyRevenue: currentContracts.reduce((sum, contract) => sum + (contract.mensalidade_total ?? 0), 0),
    commissionExpected: currentContracts.reduce((sum, contract) => sum + (contract.comissao_prevista ?? 0), 0),
    commissionReceived,
    averageTicket: currentContracts.length > 0
      ? currentContracts.reduce((sum, contract) => sum + (contract.mensalidade_total ?? 0), 0) / currentContracts.length
      : null,
    conversion,
    leadsReceived: currentLeads.length,
    goal: null,
    currentRange,
    pipelineValue: pipelineValues.reduce((sum, value) => sum + value, 0),
    pipelineValueAvailable: pipelineValues.length > 0,
    pipelineStages,
    stageMetrics,
    stageConversions,
    opportunities,
    agenda: {
      pending: pendingToday.length,
      overdue: overdueReminders.length,
      completed: completedToday.length,
      items: agendaItems,
    },
    followUp: {
      openOpportunities: periodOpenLeads.length,
      withNextStep: periodOpenLeads.length - withoutNextStepLeadIds.length,
      coverage: percentage(periodOpenLeads.length - withoutNextStepLeadIds.length, periodOpenLeads.length),
      withoutNextStep: withoutNextStepLeadIds.length,
      withoutNextStepLeadIds,
      overdue: overdueFollowUpCount,
    },
    stuck: {
      amount: stuckValues.reduce((sum, value) => sum + value, 0),
      count: stuckLeads.length,
      leadIds: stuckLeads.map((lead) => lead.id),
      thresholdHours: DASHBOARD_STALE_OPPORTUNITY_HOURS,
      valueAvailable: stuckValues.length > 0,
    },
    velocity: {
      leadToProposalDays: average(leadToProposalDays),
      proposalToDecisionDays: average(proposalToDecisionDays),
      decisionToClosedDays: average(decisionToClosedDays),
      leadToClosedDays: average(leadToClosedDays),
      ageBuckets,
    },
    origins,
    operators,
    recentProposals: recentProposalLeads,
    lossReasonsAvailable: false,
    dataCoverage: {
      monthlyRevenue: currentContracts.some((contract) => typeof contract.mensalidade_total === 'number'),
      commissionExpected: currentContracts.some((contract) => typeof contract.comissao_prevista === 'number'),
      commissionsReceived: commissionInstallments.length > 0,
      opportunitiesValue: pipelineValues.length > 0,
      proposals: recentProposalLeads.length > 0,
      lossReasons: false,
    },
  };
};
