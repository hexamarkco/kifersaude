import { useEffect, useMemo, useState } from 'react';
import { supabase, Lead, Contract } from '../lib/supabase';
import { parseDateWithoutTimezone } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import {
  TrendingUp,
  Users,
  FileText,
  DollarSign,
  Calendar,
  Target,
  Activity,
  Cake,
  Filter,
} from 'lucide-react';
import AnimatedStatCard from './AnimatedStatCard';
import DonutChart from './charts/DonutChart';
import LeadFunnel from './LeadFunnel';
import {
  calculateConversionRate,
  getLeadStatusDistribution,
  getOperadoraDistribution,
  getContractsToRenew,
} from '../lib/analytics';
import { useConfig } from '../contexts/ConfigContext';

type Holder = {
  id: string;
  contract_id: string;
  nome_completo: string;
  data_nascimento: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
};

type Dependent = {
  id: string;
  contract_id: string;
  nome_completo: string;
  data_nascimento: string;
};

export default function Dashboard() {
  const { isObserver } = useAuth();
  const { leadStatuses } = useConfig();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<'mes-atual' | 'todo-periodo' | 'personalizado'>('mes-atual');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    leadStatuses.forEach(status => {
      map[status.nome] = status.cor || '#64748b';
    });
    return map;
  }, [leadStatuses]);

  useEffect(() => {
    loadData();

    const leadsChannel = supabase
      .channel('dashboard-leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    const contractsChannel = supabase
      .channel('dashboard-contracts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contracts',
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(contractsChannel);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [leadsRes, contractsRes, holdersRes, dependentsRes] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('contract_holders').select('*'),
        supabase.from('dependents').select('*'),
      ]);

      let filteredLeads = leadsRes.data || [];
      if (isObserver) {
        filteredLeads = filteredLeads.filter(lead => lead.origem !== 'Ully');
      }

      setLeads(filteredLeads);
      setContracts(contractsRes.data || []);
      setHolders(holdersRes.data || []);
      setDependents(dependentsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStartOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const parseDateString = (dateStr: string): Date => {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  };

  const parseDateValue = (value?: string | null): Date | null => {
    if (!value) return null;

    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (dateOnlyPattern.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const filterByPeriod = <T,>(items: T[], getDate: (item: T) => Date | null): T[] => {
    if (periodFilter === 'todo-periodo') return items;

    if (periodFilter === 'personalizado') {
      if (!customStartDate || !customEndDate) return items;

      const startDate = parseDateString(customStartDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = parseDateString(customEndDate);
      endDate.setHours(23, 59, 59, 999);

      return items.filter((item) => {
        const itemDate = getDate(item);
        if (!itemDate) return true;
        return itemDate >= startDate && itemDate <= endDate;
      });
    }

    const startOfMonth = getStartOfMonth();
    return items.filter((item) => {
      const itemDate = getDate(item);
      if (!itemDate) return true;
      return itemDate >= startOfMonth;
    });
  };

  const filteredLeads = filterByPeriod(leads, (lead) => {
    const dateValue = lead.data_criacao || lead.created_at;
    return parseDateValue(dateValue);
  });

  const filteredContracts = filterByPeriod(contracts, (contract) => {
    return (
      parseDateValue(contract.data_inicio) ||
      parseDateValue(contract.previsao_recebimento_comissao) ||
      parseDateValue(contract.created_at)
    );
  });

  const leadsAtivos = filteredLeads.filter(
    (l) => !l.arquivado && !['Fechado', 'Perdido'].includes(l.status)
  ).length;

  const contratosAtivos = filteredContracts.filter((c) => c.status === 'Ativo');
  const comissaoTotal = contratosAtivos.reduce((sum, c) => sum + (c.comissao_prevista || 0), 0);

  const mensalidadeTotal = contratosAtivos.reduce(
    (sum, c) => sum + (c.mensalidade_total || 0),
    0
  );

  const ticketMedio =
    contratosAtivos.length > 0 ? mensalidadeTotal / contratosAtivos.length : 0;

  const conversionRate = calculateConversionRate(filteredLeads, filteredContracts);

  const leadStatusData = getLeadStatusDistribution(filteredLeads.filter(l => !l.arquivado && !['Fechado', 'Perdido'].includes(l.status)));
  const operadoraData = getOperadoraDistribution(filteredContracts);
  const upcomingRenewals = getContractsToRenew(contracts, 30);

  const getUpcomingBirthdays = () => {
    const hoje = new Date();
    const daysAhead = 30;
    const futureDate = new Date(hoje.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const birthdays: Array<{
      nome: string;
      data_nascimento: string;
      tipo: 'Titular' | 'Dependente';
      contract_id: string;
      contract?: Contract;
      holder?: Holder;
      isPJ: boolean;
    }> = [];

    const activeContractIds = contratosAtivos.map(c => c.id);
    const contractsMap = new Map(contratosAtivos.map(c => [c.id, c]));
    const holdersMap = new Map(holders.map(h => [h.contract_id, h]));

    holders
      .filter(h => activeContractIds.includes(h.contract_id))
      .forEach(h => {
        birthdays.push({
          nome: h.nome_completo,
          data_nascimento: h.data_nascimento,
          tipo: 'Titular',
          contract_id: h.contract_id,
          contract: contractsMap.get(h.contract_id),
          holder: h,
          isPJ: !!h.cnpj
        });
      });

    dependents
      .filter(d => activeContractIds.includes(d.contract_id))
      .forEach(d => {
        birthdays.push({
          nome: d.nome_completo,
          data_nascimento: d.data_nascimento,
          tipo: 'Dependente',
          contract_id: d.contract_id,
          contract: contractsMap.get(d.contract_id),
          holder: holdersMap.get(d.contract_id),
          isPJ: false
        });
      });

    const upcomingBirthdays = birthdays.filter(b => {
      const { month, day } = parseDateWithoutTimezone(b.data_nascimento);
      const thisYearBirthday = new Date(hoje.getFullYear(), month - 1, day);
      const nextYearBirthday = new Date(hoje.getFullYear() + 1, month - 1, day);

      const nextBirthday = thisYearBirthday >= hoje ? thisYearBirthday : nextYearBirthday;
      return nextBirthday <= futureDate && nextBirthday >= hoje;
    }).map(b => {
      const { month, day } = parseDateWithoutTimezone(b.data_nascimento);
      const thisYearBirthday = new Date(hoje.getFullYear(), month - 1, day);
      const nextBirthday = thisYearBirthday >= hoje ? thisYearBirthday : new Date(hoje.getFullYear() + 1, month - 1, day);

      return { ...b, nextBirthday };
    }).sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime());

    return upcomingBirthdays;
  };

  const upcomingBirthdays = getUpcomingBirthdays();

  const donutChartData = leadStatusData.map((item) => ({
    label: item.status,
    value: item.count,
    color: statusColorMap[item.status] || '#64748b',
  }));

  const operadoraColors = [
    '#14b8a6',
    '#3b82f6',
    '#8b5cf6',
    '#f59e0b',
    '#10b981',
  ];

  const operadoraChartData = operadoraData.map((item, index) => ({
    label: item.operadora,
    value: item.count,
    color: operadoraColors[index % operadoraColors.length],
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  const validateDate = (dateStr: string): boolean => {
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateStr.match(dateRegex);

    if (!match) return false;

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > 2100) return false;

    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
  };

  const formatDateInput = (value: string): string => {
    const numbers = value.replace(/\D/g, '');

    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    } else {
      return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
    }
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateInput(e.target.value);
    setCustomStartDate(formatted);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDateInput(e.target.value);
    setCustomEndDate(formatted);
  };

  const isCustomPeriodValid = periodFilter !== 'personalizado' ||
    (customStartDate.length === 10 && customEndDate.length === 10 &&
     validateDate(customStartDate) && validateDate(customEndDate));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-600 mt-1">
            Visão geral do seu negócio em tempo real
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value as 'mes-atual' | 'todo-periodo' | 'personalizado');
                if (e.target.value !== 'personalizado') {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-medium bg-white"
            >
              <option value="mes-atual">Mês Atual</option>
              <option value="todo-periodo">Todo Período</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {periodFilter === 'personalizado' && (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={customStartDate}
                onChange={handleStartDateChange}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className={`w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm ${
                  customStartDate && !validateDate(customStartDate)
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-300'
                }`}
              />
              <span className="text-slate-500 text-sm">até</span>
              <input
                type="text"
                value={customEndDate}
                onChange={handleEndDateChange}
                placeholder="DD/MM/AAAA"
                maxLength={10}
                className={`w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm ${
                  customEndDate && !validateDate(customEndDate)
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-300'
                }`}
              />
            </div>
          )}
        </div>
      </div>

      {!isCustomPeriodValid && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            Por favor, preencha as datas de início e fim no formato DD/MM/AAAA para visualizar o período personalizado.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatedStatCard
          label="Leads Ativos"
          value={leadsAtivos}
          icon={Users}
          gradient="from-blue-500 to-blue-600"
          iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
          subtitle="Em negociação"
        />
        <AnimatedStatCard
          label="Contratos Ativos"
          value={contratosAtivos.length}
          icon={FileText}
          gradient="from-teal-500 to-cyan-600"
          iconBg="bg-gradient-to-br from-teal-500 to-cyan-600"
          subtitle="Vigentes"
        />
        <AnimatedStatCard
          label="Comissão Prevista"
          value={comissaoTotal}
          icon={DollarSign}
          gradient="from-emerald-500 to-green-600"
          iconBg="bg-gradient-to-br from-emerald-500 to-green-600"
          prefix="R$"
          subtitle="Mensal"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AnimatedStatCard
          label="Taxa de Conversão"
          value={conversionRate}
          icon={Target}
          gradient="from-violet-500 to-purple-600"
          iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
          suffix="%"
          subtitle="Lead → Contrato"
        />
        <AnimatedStatCard
          label="Ticket Médio"
          value={ticketMedio}
          icon={Activity}
          gradient="from-orange-500 to-red-600"
          iconBg="bg-gradient-to-br from-orange-500 to-red-600"
          prefix="R$"
          subtitle="Por contrato"
        />
      </div>

      <LeadFunnel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Distribuição de Leads por Status
          </h3>
          {leadStatusData.length > 0 ? (
            <DonutChart data={donutChartData} size={240} strokeWidth={35} />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Nenhum lead ativo
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Contratos por Operadora
          </h3>
          {operadoraChartData.length > 0 ? (
            <DonutChart data={operadoraChartData} size={240} strokeWidth={35} />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Nenhum contrato ativo
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Renovações Próximas</h3>
            <Calendar className="w-5 h-5 text-orange-500" />
          </div>
          {upcomingRenewals.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {upcomingRenewals.map((contract) => {
                let dataRenovacao: Date;

                if (contract.data_renovacao) {
                  const [year, month] = contract.data_renovacao.split('-').map(Number);
                  dataRenovacao = new Date(year, month - 1, 1);
                } else if (contract.data_inicio) {
                  const { year, month, day } = parseDateWithoutTimezone(contract.data_inicio);
                  dataRenovacao = new Date(year + 1, month - 1, day);
                } else {
                  return null;
                }

                const diasRestantes = Math.ceil(
                  (dataRenovacao.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <div
                    key={contract.id}
                    className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border border-orange-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 text-sm">
                        {contract.codigo_contrato}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">{contract.operadora}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-600">
                        {diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {dataRenovacao.toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Calendar className="w-12 h-12 mb-2" />
              <p className="text-sm">Nenhuma renovação próxima</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Aniversários Próximos</h3>
            <Cake className="w-5 h-5 text-pink-500" />
          </div>
          {upcomingBirthdays.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {upcomingBirthdays.map((birthday, index) => {
                const diasRestantes = Math.ceil(
                  (birthday.nextBirthday.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );

                return (
                  <div
                    key={`${birthday.contract_id}-${birthday.nome}-${index}`}
                    className="flex flex-col p-4 bg-gradient-to-r from-pink-50 to-pink-100 rounded-lg border border-pink-200 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 text-sm">{birthday.nome}</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {birthday.tipo}
                          {birthday.tipo === 'Dependente' && birthday.holder && (
                            <span className="text-slate-500"> • Titular: {birthday.holder.nome_completo}</span>
                          )}
                        </p>
                        {birthday.isPJ && birthday.holder && (birthday.holder.razao_social || birthday.holder.nome_fantasia) && (
                          <p className="text-xs text-blue-600 mt-1 font-medium">
                            {birthday.holder.razao_social || birthday.holder.nome_fantasia}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-pink-600">
                          {diasRestantes === 0
                            ? 'Hoje!'
                            : `${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`}
                        </p>
                        <p className="text-xs text-slate-500">
                          {birthday.nextBirthday.toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    {birthday.contract && (
                      <div className="pt-2 border-t border-pink-200">
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Contrato:</span> {birthday.contract.codigo_contrato}
                        </p>
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Operadora:</span> {birthday.contract.operadora}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Cake className="w-12 h-12 mb-2" />
              <p className="text-sm">Nenhum aniversário próximo</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold mb-2">Continue crescendo!</h3>
            <p className="text-teal-50 mb-4">
              Mantenha seu pipeline ativo e acompanhe suas métricas em tempo real
            </p>
          </div>
          <div className="hidden lg:block">
            <TrendingUp className="w-32 h-32 opacity-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
