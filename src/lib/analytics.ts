import { Lead, Contract } from './supabase';

export type DateRange = {
  start: Date;
  end: Date;
};

export type DashboardMetrics = {
  totalLeads: number;
  leadsAtivos: number;
  totalContratos: number;
  contratosAtivos: number;
  mensalidadeTotal: number;
  comissaoTotal: number;
  contratosRenovar30Dias: number;
  conversionRate: number;
  averageDealValue: number;
  winRate: number;
  lossRate: number;
  averageTimeToClose: number;
  monthlyRecurringRevenue: number;
  mrrGrowth: number;
};

export type LeadStatusDistribution = {
  status: string;
  count: number;
  percentage: number;
};

export type TrendData = {
  date: string;
  leads: number;
  contracts: number;
  revenue: number;
};

export type OperadoraDistribution = {
  operadora: string;
  count: number;
  revenue: number;
};

export function calculateConversionRate(leads: Lead[], contracts: Contract[]): number {
  const totalLeads = leads.filter(l => !l.arquivado).length;
  if (totalLeads === 0) return 0;

  const activeContracts = contracts.filter(
    (contract): contract is Contract & { lead_id: string } =>
      contract.status === 'Ativo' && typeof contract.lead_id === 'string' && contract.lead_id.length > 0,
  );

  if (activeContracts.length === 0) {
    const closedLeads = leads.filter(l => !l.arquivado && l.status === 'Fechado').length;
    return (closedLeads / totalLeads) * 100;
  }

  const leadsWithContracts = new Set(activeContracts.map(contract => contract.lead_id)).size;
  return (leadsWithContracts / totalLeads) * 100;
}

export function calculateWinRate(leads: Lead[]): number {
  const activeLeads = leads.filter(l => !l.arquivado);
  const closedOrLost = activeLeads.filter(l => ['Fechado', 'Perdido'].includes(l.status));

  if (closedOrLost.length === 0) return 0;

  const won = activeLeads.filter(l => l.status === 'Fechado').length;
  return (won / closedOrLost.length) * 100;
}

export function calculateLossRate(leads: Lead[]): number {
  const activeLeads = leads.filter(l => !l.arquivado);
  const closedOrLost = activeLeads.filter(l => ['Fechado', 'Perdido'].includes(l.status));

  if (closedOrLost.length === 0) return 0;

  const lost = activeLeads.filter(l => l.status === 'Perdido').length;
  return (lost / closedOrLost.length) * 100;
}

export function calculateAverageTimeToClose(leads: Lead[], contracts: Contract[]): number {
  const contractsWithLeads = contracts.filter(c => c.lead_id);

  if (contractsWithLeads.length === 0) return 0;

  let totalDays = 0;
  let validCount = 0;

  contractsWithLeads.forEach(contract => {
    const lead = leads.find(l => l.id === contract.lead_id);
    if (lead && contract.created_at) {
      const leadDate = new Date(lead.data_criacao);
      const contractDate = new Date(contract.created_at);
      const days = Math.floor((contractDate.getTime() - leadDate.getTime()) / (1000 * 60 * 60 * 24));
      totalDays += days;
      validCount++;
    }
  });

  return validCount > 0 ? Math.round(totalDays / validCount) : 0;
}

export function getLeadStatusDistribution(leads: Lead[]): LeadStatusDistribution[] {
  const activeLeads = leads.filter(l => !l.arquivado);
  const total = activeLeads.length;

  if (total === 0) return [];

  const statusCount = activeLeads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(statusCount)
    .map(([status, count]) => ({
      status,
      count,
      percentage: (count / total) * 100
    }))
    .sort((a, b) => b.count - a.count);
}

export function getTrendData(leads: Lead[], contracts: Contract[], days: number = 30): TrendData[] {
  const today = new Date();
  const trendData: TrendData[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const leadsCount = leads.filter(l => {
      const createdAt = new Date(l.data_criacao);
      return createdAt >= date && createdAt < nextDate;
    }).length;

    const contractsCount = contracts.filter(c => {
      const createdAt = new Date(c.created_at);
      return createdAt >= date && createdAt < nextDate;
    }).length;

    const revenue = contracts
      .filter(c => {
        const createdAt = new Date(c.created_at);
        return createdAt >= date && createdAt < nextDate && c.status === 'Ativo';
      })
      .reduce((sum, c) => sum + (c.mensalidade_total || 0), 0);

    trendData.push({
      date: date.toISOString().split('T')[0],
      leads: leadsCount,
      contracts: contractsCount,
      revenue
    });
  }

  return trendData;
}

export function getOperadoraDistribution(contracts: Contract[]): OperadoraDistribution[] {
  const activeContracts = contracts.filter(c => c.status === 'Ativo');

  const operadoraData = activeContracts.reduce((acc, contract) => {
    const operadora = contract.operadora;
    if (!acc[operadora]) {
      acc[operadora] = { count: 0, revenue: 0 };
    }
    acc[operadora].count++;
    acc[operadora].revenue += contract.mensalidade_total || 0;
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>);

  return Object.entries(operadoraData)
    .map(([operadora, data]) => ({
      operadora,
      count: data.count,
      revenue: data.revenue
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function calculateMRRGrowth(contracts: Contract[], previousMonthContracts: Contract[]): number {
  const currentMRR = contracts
    .filter(c => c.status === 'Ativo')
    .reduce((sum, c) => sum + (c.mensalidade_total || 0), 0);

  const previousMRR = previousMonthContracts
    .filter(c => c.status === 'Ativo')
    .reduce((sum, c) => sum + (c.mensalidade_total || 0), 0);

  if (previousMRR === 0) return 0;

  return ((currentMRR - previousMRR) / previousMRR) * 100;
}

export function getContractsToRenew(contracts: Contract[], daysAhead: number = 30): Contract[] {
  const hoje = new Date();
  const futureDate = new Date(hoje.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return contracts.filter(c => {
    if (c.status !== 'Ativo') return false;

    let dataRenovacao: Date;

    if (c.data_renovacao) {
      const [year, month] = c.data_renovacao.split('-').map(Number);
      dataRenovacao = new Date(year, month - 1, 1);
    } else if (c.data_inicio) {
      const dataInicio = new Date(c.data_inicio);
      dataRenovacao = new Date(
        dataInicio.getFullYear() + 1,
        dataInicio.getMonth(),
        dataInicio.getDate()
      );
    } else {
      return false;
    }

    return dataRenovacao <= futureDate && dataRenovacao >= hoje;
  }).sort((a, b) => {
    const getRenewalDate = (contract: Contract): Date => {
      if (contract.data_renovacao) {
        const [year, month] = contract.data_renovacao.split('-').map(Number);
        return new Date(year, month - 1, 1);
      }
      const dataInicio = new Date(contract.data_inicio!);
      return new Date(dataInicio.getFullYear() + 1, dataInicio.getMonth(), dataInicio.getDate());
    };

    return getRenewalDate(a).getTime() - getRenewalDate(b).getTime();
  });
}

export function getOverdueLeads(leads: Lead[]): Lead[] {
  const hoje = new Date();

  return leads.filter(l => {
    if (l.arquivado || ['Fechado', 'Perdido'].includes(l.status)) return false;

    if (l.proximo_retorno) {
      const proximoRetorno = new Date(l.proximo_retorno);
      return proximoRetorno < hoje;
    }

    return false;
  }).sort((a, b) => {
    const dateA = new Date(a.proximo_retorno!);
    const dateB = new Date(b.proximo_retorno!);
    return dateA.getTime() - dateB.getTime();
  });
}
