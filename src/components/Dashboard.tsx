import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useSearchParams } from 'react-router-dom';
import { supabase, Lead, Contract, fetchAllPages } from '../lib/supabase';
import { parseDateWithoutTimezone, parseDateWithoutTimezoneAsDate } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import type { TabNavigationOptions } from '../types/navigation';
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
  RefreshCw,
  Clock,
  BadgePercent,
} from 'lucide-react';
import AnimatedStatCard from './AnimatedStatCard';
import DonutChart from './charts/DonutChart';
import LineChart from './charts/LineChart';
import LeadFunnel from './LeadFunnel';
import {
  calculateConversionRate,
  getLeadStatusDistribution,
  getOperadoraDistribution,
} from '../lib/analytics';
import { useConfig } from '../contexts/ConfigContext';
import { mapLeadRelations } from '../lib/leadRelations';

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

type ReminderRequest = {
  contractId?: string;
  leadId?: string;
  title?: string;
  description?: string;
};

type DashboardProps = {
  onNavigateToTab?: (tab: string, options?: TabNavigationOptions) => void;
  onCreateReminder?: (options: ReminderRequest) => void;
};

export default function Dashboard({ onNavigateToTab, onCreateReminder }: DashboardProps) {
  const { isObserver } = useAuth();
  const { leadStatuses, leadOrigins, options, loading: configLoading } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [hiddenLeadIdsForObserver, setHiddenLeadIdsForObserver] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'leads' | 'contratos' | 'comissoes'>('leads');
  const [chartRangeInMonths, setChartRangeInMonths] = useState<6 | 12>(6);
  const isInitialLoadRef = useRef(true);
  const lastBirthdayReminderSync = useRef<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<'mes-atual' | 'todo-periodo' | 'personalizado'>(() => {
    const urlValue = searchParams.get('periodFilter');
    const validValues = ['mes-atual', 'todo-periodo', 'personalizado'];

    if (urlValue && validValues.includes(urlValue)) {
      return urlValue as 'mes-atual' | 'todo-periodo' | 'personalizado';
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dashboardPeriodFilter');
      if (stored && validValues.includes(stored)) {
        return stored as 'mes-atual' | 'todo-periodo' | 'personalizado';
      }
    }

    return 'mes-atual';
  });
  const [customStartDate, setCustomStartDate] = useState(() => {
    const urlValue = searchParams.get('customStartDate');

    if (urlValue && validateDate(urlValue)) {
      return urlValue;
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dashboardCustomStartDate');
      if (stored && validateDate(stored)) {
        return stored;
      }
    }

    return '';
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const urlValue = searchParams.get('customEndDate');

    if (urlValue && validateDate(urlValue)) {
      return urlValue;
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dashboardCustomEndDate');
      if (stored && validateDate(stored)) {
        return stored;
      }
    }

    return '';
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [daysAhead, setDaysAhead] = useState(30);
  const [timelineDirection, setTimelineDirection] = useState<'future' | 'past'>('future');
  const [dashboardOriginFilter, setDashboardOriginFilter] = useState(
    () => searchParams.get('dashboardOrigin') || '',
  );
  const [dashboardOwnerFilter, setDashboardOwnerFilter] = useState(
    () => searchParams.get('dashboardOwner') || '',
  );
  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    leadStatuses.forEach(status => {
      map[status.nome] = status.cor || '#64748b';
    });
    return map;
  }, [leadStatuses]);

  const resolvePeriodFilter = useCallback(() => {
    const urlValue = searchParams.get('periodFilter');
    const validValues = ['mes-atual', 'todo-periodo', 'personalizado'];

    if (urlValue && validValues.includes(urlValue)) {
      return urlValue as 'mes-atual' | 'todo-periodo' | 'personalizado';
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dashboardPeriodFilter');
      if (stored && validValues.includes(stored)) {
        return stored as 'mes-atual' | 'todo-periodo' | 'personalizado';
      }
    }

    return 'mes-atual';
  }, [searchParams]);

  const resolveCustomDate = useCallback(
    (key: 'customStartDate' | 'customEndDate') => {
      const urlValue = searchParams.get(key);

      if (urlValue && validateDate(urlValue)) {
        return urlValue;
      }

      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(`dashboard${key.charAt(0).toUpperCase() + key.slice(1)}`);
        if (stored && validateDate(stored)) {
          return stored;
        }
      }

      return '';
    },
    [searchParams],
  );

  const persistFilters = useCallback(
    (
      nextPeriod: 'mes-atual' | 'todo-periodo' | 'personalizado' = periodFilter,
      nextStart: string = customStartDate,
      nextEnd: string = customEndDate,
      nextOrigin: string = dashboardOriginFilter,
      nextOwner: string = dashboardOwnerFilter,
    ) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('dashboardPeriodFilter', nextPeriod);
        localStorage.setItem('dashboardCustomStartDate', nextStart);
        localStorage.setItem('dashboardCustomEndDate', nextEnd);
      }

      const params = new URLSearchParams(searchParams);
      params.set('periodFilter', nextPeriod);

      if (
        nextPeriod === 'personalizado' &&
        nextStart &&
        nextEnd &&
        validateDate(nextStart) &&
        validateDate(nextEnd)
      ) {
        params.set('customStartDate', nextStart);
        params.set('customEndDate', nextEnd);
      } else {
        params.delete('customStartDate');
        params.delete('customEndDate');
      }

      if (nextOrigin) {
        params.set('dashboardOrigin', nextOrigin);
      } else {
        params.delete('dashboardOrigin');
      }

      if (nextOwner) {
        params.set('dashboardOwner', nextOwner);
      } else {
        params.delete('dashboardOwner');
      }

      if (params.toString() !== searchParams.toString()) {
        setSearchParams(params, { replace: true });
      }
    },
    [
      customEndDate,
      customStartDate,
      dashboardOriginFilter,
      dashboardOwnerFilter,
      periodFilter,
      searchParams,
      setSearchParams,
    ],
  );

  const restrictedOriginNamesForObservers = useMemo(
    () => leadOrigins.filter((origin) => origin.visivel_para_observadores === false).map((origin) => origin.nome),
    [leadOrigins],
  );

  const mapLeadWithRelations = useCallback(
    (lead: Lead | null | undefined) =>
      lead
        ? mapLeadRelations(lead, {
            origins: leadOrigins,
            statuses: leadStatuses,
            tipoContratacao: options.lead_tipo_contratacao || [],
            responsaveis: options.lead_responsavel || [],
          })
        : null,
    [leadOrigins, leadStatuses, options.lead_responsavel, options.lead_tipo_contratacao],
  );

  const areSetsEqual = useCallback((a: Set<string>, b: Set<string>) => {
    if (a.size !== b.size) {
      return false;
    }

    for (const value of a) {
      if (!b.has(value)) {
        return false;
      }
    }

    return true;
  }, []);

  const isOriginVisibleToObserver = useCallback(
    (originName: string | null | undefined) => {
      if (!originName) {
        return true;
      }
      return !restrictedOriginNamesForObservers.includes(originName);
    },
    [restrictedOriginNamesForObservers],
  );

  const isContractVisibleToObserver = useCallback(
    (contract: Contract | null | undefined) => {
      if (!isObserver) {
        return true;
      }

      if (!contract) {
        return false;
      }

      if (!contract.lead_id) {
        return true;
      }

      return !hiddenLeadIdsForObserver.has(contract.lead_id);
    },
    [hiddenLeadIdsForObserver, isObserver],
  );

  const visibleLeadIdsForObserver = useMemo(() => {
    if (!isObserver) {
      return null;
    }

    return new Set(leads.map((lead) => lead.id));
  }, [isObserver, leads]);

  const contractsVisibleToUser = useMemo(() => {
    if (!isObserver) {
      return contracts;
    }

    const visibleLeadIds = visibleLeadIdsForObserver;

    if (!visibleLeadIds) {
      return contracts;
    }

    return contracts.filter((contract) => {
      const leadId = contract.lead_id;

      if (!leadId) {
        return true;
      }

      if (hiddenLeadIdsForObserver.has(leadId)) {
        return false;
      }

      return visibleLeadIds.has(leadId);
    });
  }, [contracts, hiddenLeadIdsForObserver, isObserver, visibleLeadIdsForObserver]);

  const leadsById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);

  const visibleContractIds = useMemo(() => new Set(contractsVisibleToUser.map((contract) => contract.id)), [
    contractsVisibleToUser,
  ]);

  const holdersVisibleToUser = useMemo(() => {
    if (!isObserver) {
      return holders;
    }

    return holders.filter((holder) => visibleContractIds.has(holder.contract_id));
  }, [holders, isObserver, visibleContractIds]);

  const dependentsVisibleToUser = useMemo(() => {
    if (!isObserver) {
      return dependents;
    }

    return dependents.filter((dependent) => visibleContractIds.has(dependent.contract_id));
  }, [dependents, isObserver, visibleContractIds]);

  const sortByCreatedAtDesc = <T extends { created_at?: string | null }>(items: T[]) => {
    return [...items].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : NaN;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : NaN;
      const safeATime = Number.isNaN(aTime) ? 0 : aTime;
      const safeBTime = Number.isNaN(bTime) ? 0 : bTime;
      return safeBTime - safeATime;
    });
  };

  const loadData = useCallback(async () => {
    if (configLoading) {
      return;
    }

    if (isInitialLoadRef.current) {
      setIsInitialLoad(true);
    } else {
      setIsRefreshing(true);
    }

    setLoading(true);
    setError(null);
    try {
      const [leadsData, contractsData, holdersData, dependentsData] = await Promise.all([
        fetchAllPages<Lead>((from, to) =>
          supabase.from('leads').select('*').order('created_at', { ascending: false }).range(from, to),
        ),
        fetchAllPages<Contract>((from, to) =>
          supabase.from('contracts').select('*').order('created_at', { ascending: false }).range(from, to),
        ),
        fetchAllPages<Holder>((from, to) =>
          supabase.from('contract_holders').select('*').range(from, to),
        ),
        fetchAllPages<Dependent>((from, to) =>
          supabase.from('dependents').select('*').range(from, to),
        ),
      ]);

      const mappedLeads = (leadsData || [])
        .map((lead) => mapLeadWithRelations(lead))
        .filter((lead): lead is Lead => Boolean(lead));

      if (isObserver) {
        const hiddenLeadIds = new Set(
          mappedLeads
            .filter((lead) => !isOriginVisibleToObserver(lead.origem))
            .map((lead) => lead.id),
        );

        setHiddenLeadIdsForObserver((currentHidden) =>
          areSetsEqual(currentHidden, hiddenLeadIds) ? currentHidden : hiddenLeadIds,
        );
        setLeads(mappedLeads.filter((lead) => !hiddenLeadIds.has(lead.id)));
      } else {
        setHiddenLeadIdsForObserver((currentHidden) => (currentHidden.size === 0 ? currentHidden : new Set()));
        setLeads(mappedLeads);
      }

      setContracts(contractsData || []);
      setHolders(holdersData || []);
      setDependents(dependentsData || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      const message = error instanceof Error ? error.message : 'Erro desconhecido.';
      setError(`Não foi possível carregar os dados. ${message}`);
    } finally {
      setLoading(false);
      setIsRefreshing(false);

      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        setIsInitialLoad(false);
      }
    }
  }, [configLoading, isObserver, isOriginVisibleToObserver]);

  useEffect(() => {
    if (configLoading) {
      return;
    }

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
        (payload: RealtimePostgresChangesPayload<Lead>) => {
          const { eventType } = payload;
          const newLead = mapLeadWithRelations(payload.new as Lead | null);
          const oldLead = payload.old as Lead | null;

          setLeads((currentLeads) => {
            let updatedLeads = currentLeads;

            switch (eventType) {
              case 'INSERT':
                if (!newLead) return currentLeads;
                if (isObserver && !isOriginVisibleToObserver(newLead.origem)) {
                  return currentLeads.filter((lead) => lead.id !== newLead.id);
                }
                updatedLeads = [newLead, ...currentLeads.filter((lead) => lead.id !== newLead.id)];
                break;
              case 'UPDATE':
                if (!newLead) return currentLeads;
                updatedLeads = currentLeads.filter((lead) => lead.id !== newLead.id);
                if (!(isObserver && !isOriginVisibleToObserver(newLead.origem))) {
                  updatedLeads = [...updatedLeads, newLead];
                }
                break;
              case 'DELETE':
                if (!oldLead) return currentLeads;
                updatedLeads = currentLeads.filter((lead) => lead.id !== oldLead.id);
                break;
              default:
                return currentLeads;
            }

            return sortByCreatedAtDesc(updatedLeads);
          });

          setHiddenLeadIdsForObserver((currentHidden) => {
            if (!isObserver) {
              return currentHidden.size === 0 ? currentHidden : new Set();
            }

            const updatedHidden = new Set(currentHidden);
            let hasChanged = false;

            switch (eventType) {
              case 'INSERT':
              case 'UPDATE':
                if (!newLead) {
                  return currentHidden;
                }

                if (isOriginVisibleToObserver(newLead.origem)) {
                  hasChanged = updatedHidden.delete(newLead.id) || hasChanged;
                } else if (!updatedHidden.has(newLead.id)) {
                  updatedHidden.add(newLead.id);
                  hasChanged = true;
                }
                break;
              case 'DELETE':
                if (oldLead && updatedHidden.delete(oldLead.id)) {
                  hasChanged = true;
                }
                break;
              default:
                return currentHidden;
            }

            return hasChanged ? updatedHidden : currentHidden;
          });
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
        (
          payload: RealtimePostgresChangesPayload<
            Contract & { holders?: Holder[]; dependents?: Dependent[] }
          >
        ) => {
          const { eventType } = payload;
          const newContract = payload.new as (Contract & {
            holders?: Holder[];
            dependents?: Dependent[];
          }) | null;
          const oldContract = payload.old as (Contract & {
            holders?: Holder[];
            dependents?: Dependent[];
          }) | null;
          const contractId = newContract?.id || oldContract?.id;
          const newContractVisible = isContractVisibleToObserver(newContract);

          setContracts((currentContracts) => {
            let updatedContracts = currentContracts;

            switch (eventType) {
              case 'INSERT':
                if (!newContract) return currentContracts;
                if (!newContractVisible) {
                  return currentContracts.filter((contract) => contract.id !== newContract.id);
                }
                updatedContracts = [
                  newContract,
                  ...currentContracts.filter((contract) => contract.id !== newContract.id),
                ];
                break;
              case 'UPDATE':
                if (!newContract) return currentContracts;
                updatedContracts = currentContracts.filter(
                  (contract) => contract.id !== newContract.id,
                );

                if (!newContractVisible) {
                  return sortByCreatedAtDesc(updatedContracts);
                }

                updatedContracts = [...updatedContracts, newContract];
                break;
              case 'DELETE':
                if (!oldContract) return currentContracts;
                updatedContracts = currentContracts.filter(
                  (contract) => contract.id !== oldContract.id
                );
                break;
              default:
                return currentContracts;
            }

            return sortByCreatedAtDesc(updatedContracts);
          });

          setHolders((currentHolders) => {
            if (!contractId) return currentHolders;

            const hasHolderPayload =
              !!newContract && Object.prototype.hasOwnProperty.call(newContract, 'holders');

            if (isObserver && newContract && !newContractVisible) {
              return currentHolders.filter((holder) => holder.contract_id !== contractId);
            }

            switch (eventType) {
              case 'DELETE':
                return currentHolders.filter((holder) => holder.contract_id !== contractId);
              case 'INSERT':
              case 'UPDATE': {
                if (!hasHolderPayload) {
                  return currentHolders;
                }

                const incomingHolders = newContract?.holders ?? [];
                const filteredHolders = currentHolders.filter(
                  (holder) => holder.contract_id !== contractId
                );

                if (incomingHolders.length === 0) {
                  return filteredHolders;
                }

                return [...filteredHolders, ...incomingHolders];
              }
              default:
                return currentHolders;
            }
          });

          setDependents((currentDependents) => {
            if (!contractId) return currentDependents;

            const hasDependentPayload =
              !!newContract && Object.prototype.hasOwnProperty.call(newContract, 'dependents');

            if (isObserver && newContract && !newContractVisible) {
              return currentDependents.filter((dependent) => dependent.contract_id !== contractId);
            }

            switch (eventType) {
              case 'DELETE':
                return currentDependents.filter(
                  (dependent) => dependent.contract_id !== contractId
                );
              case 'INSERT':
              case 'UPDATE': {
                if (!hasDependentPayload) {
                  return currentDependents;
                }

                const incomingDependents = newContract?.dependents ?? [];
                const filteredDependents = currentDependents.filter(
                  (dependent) => dependent.contract_id !== contractId
                );

                if (incomingDependents.length === 0) {
                  return filteredDependents;
                }

                return [...filteredDependents, ...incomingDependents];
              }
              default:
                return currentDependents;
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(contractsChannel);
    };
  }, [configLoading, isContractVisibleToObserver, isObserver, isOriginVisibleToObserver, loadData]);

  useEffect(() => {
    const storedPeriod = resolvePeriodFilter();
    const storedStart = resolveCustomDate('customStartDate');
    const storedEnd = resolveCustomDate('customEndDate');
    const availableOrigins = leadOrigins
      .filter((origin) => origin.ativo && (!isObserver || isOriginVisibleToObserver(origin.nome)))
      .map((origin) => origin.nome);
    const availableOwners = (options.lead_responsavel || [])
      .filter((option) => option.ativo)
      .map((option) => option.value);

    const resolvedOrigin =
      searchParams.get('dashboardOrigin') &&
      availableOrigins.includes(searchParams.get('dashboardOrigin') || '')
        ? (searchParams.get('dashboardOrigin') as string)
        : '';

    const resolvedOwner =
      searchParams.get('dashboardOwner') &&
      availableOwners.includes(searchParams.get('dashboardOwner') || '')
        ? (searchParams.get('dashboardOwner') as string)
        : '';

    setPeriodFilter((current) => (current === storedPeriod ? current : storedPeriod));
    setCustomStartDate((current) => (current === storedStart ? current : storedStart));
    setCustomEndDate((current) => (current === storedEnd ? current : storedEnd));
    setDashboardOriginFilter((current) => (current === resolvedOrigin ? current : resolvedOrigin));
    setDashboardOwnerFilter((current) => (current === resolvedOwner ? current : resolvedOwner));
  }, [
    isObserver,
    isOriginVisibleToObserver,
    leadOrigins,
    options.lead_responsavel,
    resolveCustomDate,
    resolvePeriodFilter,
    searchParams,
  ]);

  useEffect(() => {
    persistFilters();
  }, [
    customEndDate,
    customStartDate,
    dashboardOriginFilter,
    dashboardOwnerFilter,
    periodFilter,
    persistFilters,
  ]);

  const getStartOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const formatLastUpdated = () => {
    if (!lastUpdated) return '';

    const date = lastUpdated.toLocaleDateString('pt-BR');
    const time = lastUpdated.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return `${date} às ${time}`;
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

  const formatMonthLabel = (date: Date) =>
    date.toLocaleDateString('pt-BR', {
      month: 'short',
      year: '2-digit',
    });

  const aggregateMonthlyTotals = <T,>(
    items: T[],
    getDate: (item: T) => Date | null,
    getValue: (item: T) => number = () => 1,
  ) => {
    const totals = new Map<
      string,
      {
        date: Date;
        total: number;
      }
    >();

    items.forEach((item) => {
      const date = getDate(item);
      if (!date) return;

      const monthDate = new Date(date.getFullYear(), date.getMonth(), 1);
      const key = monthDate.toISOString();
      const current = totals.get(key) || { date: monthDate, total: 0 };

      totals.set(key, {
        date: monthDate,
        total: current.total + getValue(item),
      });
    });

    return Array.from(totals.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => ({
        label: formatMonthLabel(item.date),
        value: item.total,
        date: item.date,
      }));
  };

  const getContractRenewalDate = (contract: Contract): Date | null => {
    if (contract.data_renovacao) {
      const [year, month] = contract.data_renovacao.split('-').map(Number);
      return new Date(year, month - 1, 1);
    }

    if (contract.data_inicio) {
      const startDate = new Date(contract.data_inicio);
      return new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
    }

    return null;
  };

  function validateDate(dateStr: string): boolean {
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
  }

  const isCustomPeriodValid =
    periodFilter !== 'personalizado' ||
    (customStartDate.length === 10 &&
      customEndDate.length === 10 &&
      validateDate(customStartDate) &&
      validateDate(customEndDate));

  const filterByPeriod = <T,>(items: T[], getDate: (item: T) => Date | null): T[] => {
    if (periodFilter === 'todo-periodo') return items;

    if (periodFilter === 'personalizado') {
      if (!isCustomPeriodValid) return items;

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

  const periodFilteredLeads = filterByPeriod(leads, (lead) => {
    const dateValue = lead.data_criacao || lead.created_at;
    return parseDateValue(dateValue);
  });

  const visibleLeadOrigins = useMemo(
    () =>
      leadOrigins.filter(
        (origin) => origin.ativo && (!isObserver || isOriginVisibleToObserver(origin.nome)),
      ),
    [isObserver, isOriginVisibleToObserver, leadOrigins],
  );

  const responsavelOptions = useMemo(
    () => (options.lead_responsavel || []).filter((option) => option.ativo),
    [options.lead_responsavel],
  );

  const filteredLeads = useMemo(
    () =>
      periodFilteredLeads.filter((lead) => {
        if (dashboardOriginFilter && lead.origem !== dashboardOriginFilter) {
          return false;
        }

        if (dashboardOwnerFilter && lead.responsavel !== dashboardOwnerFilter) {
          return false;
        }

        return true;
      }),
    [dashboardOriginFilter, dashboardOwnerFilter, periodFilteredLeads],
  );

  const activeLeadStatusNames = useMemo(
    () => leadStatuses.filter((status) => status.ativo).map((status) => status.nome),
    [leadStatuses],
  );

  const activeLeads = useMemo(
    () =>
      filteredLeads.filter(
        (lead) => !lead.arquivado && activeLeadStatusNames.includes(lead.status ?? ''),
      ),
    [activeLeadStatusNames, filteredLeads],
  );

  const filteredContracts = useMemo(() => {
    const periodFilteredContracts = filterByPeriod(contractsVisibleToUser, (contract) => {
      return (
        parseDateValue(contract.data_inicio) ||
        parseDateValue(contract.previsao_recebimento_comissao) ||
        parseDateValue(contract.created_at)
      );
    });

    return periodFilteredContracts.filter((contract) => {
      const lead = contract.lead_id ? leadsById.get(contract.lead_id) : null;

      if (dashboardOriginFilter && (!lead || lead.origem !== dashboardOriginFilter)) {
        return false;
      }

      if (dashboardOwnerFilter && (!lead || lead.responsavel !== dashboardOwnerFilter)) {
        return false;
      }

      return true;
    });
  }, [
    contractsVisibleToUser,
    dashboardOriginFilter,
    dashboardOwnerFilter,
    leadsById,
    periodFilter,
    customStartDate,
    customEndDate,
  ]);

  const filteredContractIds = useMemo(() => new Set(filteredContracts.map((contract) => contract.id)), [
    filteredContracts,
  ]);

  const holdersVisibleWithFilters = useMemo(() => {
    return holdersVisibleToUser.filter((holder) => filteredContractIds.has(holder.contract_id));
  }, [filteredContractIds, holdersVisibleToUser]);

  const dependentsVisibleWithFilters = useMemo(() => {
    return dependentsVisibleToUser.filter((dependent) => filteredContractIds.has(dependent.contract_id));
  }, [dependentsVisibleToUser, filteredContractIds]);

  const totalLeads = activeLeads.length;
  const leadsAtivos = activeLeads.filter(
    (lead) => !['Fechado', 'Perdido'].includes(lead.status)
  ).length;

  const contratosAtivos = filteredContracts.filter((c) => c.status === 'Ativo');
  const activeContracts = useMemo(
    () => filteredContracts.filter((contract) => contract.status === 'Ativo'),
    [filteredContracts],
  );
  const comissaoTotal = contratosAtivos.reduce((sum, c) => sum + (c.comissao_prevista || 0), 0);

  const mensalidadeTotal = contratosAtivos.reduce(
    (sum, c) => sum + (c.mensalidade_total || 0),
    0
  );

  const ticketMedio =
    contratosAtivos.length > 0 ? mensalidadeTotal / contratosAtivos.length : 0;

  const addVariationToSeries = useCallback(
    (series: { label: string; value: number; date: Date }[]) =>
      series.map((point, index) => {
        const previous = series[index - 1];

        if (!previous) {
          return { ...point, variation: null };
        }

        const delta = point.value - previous.value;
        const variation = previous.value === 0 ? 100 : (delta / previous.value) * 100;

        return { ...point, variation };
      }),
    [],
  );

  const monthlyLeadSeries = useMemo(
    () =>
      addVariationToSeries(
        aggregateMonthlyTotals(filteredLeads, (lead) =>
          parseDateValue(lead.data_criacao || lead.created_at),
        ),
      ),
    [addVariationToSeries, filteredLeads],
  );

  const monthlyContractSeries = useMemo(
    () =>
      addVariationToSeries(
        aggregateMonthlyTotals(filteredContracts, (contract) =>
          parseDateValue(contract.data_inicio || contract.previsao_recebimento_comissao || contract.created_at),
        ),
      ),
    [addVariationToSeries, filteredContracts],
  );

  const monthlyCommissionSeries = useMemo(
    () =>
      addVariationToSeries(
        aggregateMonthlyTotals(
          filteredContracts,
          (contract) =>
            parseDateValue(contract.data_inicio || contract.previsao_recebimento_comissao || contract.created_at),
          (contract) => contract.comissao_prevista || 0,
        ),
      ),
    [addVariationToSeries, filteredContracts],
  );

  const selectedMonthlySeries = useMemo(() => {
    switch (selectedMetric) {
      case 'contratos':
        return monthlyContractSeries;
      case 'comissoes':
        return monthlyCommissionSeries;
      default:
        return monthlyLeadSeries;
    }
  }, [monthlyCommissionSeries, monthlyContractSeries, monthlyLeadSeries, selectedMetric]);

  const displayedMonthlySeries = useMemo(() => {
    if (selectedMonthlySeries.length === 0) return [];

    const startIndex = Math.max(selectedMonthlySeries.length - chartRangeInMonths, 0);
    const slice = selectedMonthlySeries.slice(startIndex);

    return slice.map((point, index) => {
      const previous = slice[index - 1];

      if (!previous) {
        return { ...point, variation: null };
      }

      const delta = point.value - previous.value;
      const variation = previous.value === 0 ? 100 : (delta / previous.value) * 100;

      return { ...point, variation };
    });
  }, [chartRangeInMonths, selectedMonthlySeries]);

  const conversionRate = calculateConversionRate(activeLeads, filteredContracts);

  const leadStatusData = getLeadStatusDistribution(
    activeLeads.filter((lead) => !['Fechado', 'Perdido'].includes(lead.status)),
  );
  const operadoraData = getOperadoraDistribution(filteredContracts);
  const getAdjustmentDateForDirection = useCallback(
    (monthNumber: number, direction: 'future' | 'past') => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const currentYear = today.getFullYear();
      const monthIndex = monthNumber - 1;
      let targetDate = new Date(currentYear, monthIndex, 1);
      targetDate.setHours(0, 0, 0, 0);

      if (direction === 'future' && targetDate < today) {
        targetDate = new Date(currentYear + 1, monthIndex, 1);
      }

      if (direction === 'past' && targetDate > today) {
        targetDate = new Date(currentYear - 1, monthIndex, 1);
      }

      return targetDate;
    },
    [],
  );

  const getBirthdaysWithinRange = useCallback(
    (daysAheadValue: number, direction: 'future' | 'past') => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const windowStart =
        direction === 'future'
          ? today
          : new Date(today.getTime() - daysAheadValue * 24 * 60 * 60 * 1000);
      windowStart.setHours(0, 0, 0, 0);

      const windowEnd =
        direction === 'future'
          ? new Date(today.getTime() + daysAheadValue * 24 * 60 * 60 * 1000)
          : today;
      windowEnd.setHours(23, 59, 59, 999);

      const birthdays: Array<{
        nome: string;
        data_nascimento: string;
        tipo: 'Titular' | 'Dependente';
        contract_id: string;
        contract?: Contract;
        holder?: Holder;
        isPJ: boolean;
      }> = [];

      const activeContractIds = activeContracts.map((c) => c.id);
      const contractsMap = new Map(activeContracts.map((c) => [c.id, c]));
      const holdersByContract = new Map(holdersVisibleWithFilters.map((h) => [h.contract_id, h]));

      holdersVisibleWithFilters.forEach((holder) => {
        if (!activeContractIds.includes(holder.contract_id)) return;

        const birthDate = parseDateWithoutTimezoneAsDate(holder.data_nascimento);
        if (!birthDate) return;

        const futureBirthday = new Date(today);
        futureBirthday.setFullYear(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        futureBirthday.setHours(0, 0, 0, 0);

        const previousBirthday = new Date(futureBirthday);
        if (futureBirthday > today) {
          previousBirthday.setFullYear(today.getFullYear() - 1);
        }

        if (futureBirthday < today) {
          futureBirthday.setFullYear(today.getFullYear() + 1);
        }

        const selectedBirthday = direction === 'future' ? futureBirthday : previousBirthday;

        if (selectedBirthday >= windowStart && selectedBirthday <= windowEnd) {
          birthdays.push({
            nome: holder.nome_completo,
            data_nascimento: holder.data_nascimento,
            tipo: 'Titular',
            contract_id: holder.contract_id,
            contract: contractsMap.get(holder.contract_id),
            isPJ: Boolean(holder?.cnpj),
          });
        }
      });

      dependentsVisibleWithFilters.forEach((dependent) => {
        if (!activeContractIds.includes(dependent.contract_id)) return;

        const birthDate = parseDateWithoutTimezoneAsDate(dependent.data_nascimento);
        if (!birthDate) return;

        const futureBirthday = new Date(today);
        futureBirthday.setFullYear(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        futureBirthday.setHours(0, 0, 0, 0);

        const previousBirthday = new Date(futureBirthday);
        if (futureBirthday > today) {
          previousBirthday.setFullYear(today.getFullYear() - 1);
        }

        if (futureBirthday < today) {
          futureBirthday.setFullYear(today.getFullYear() + 1);
        }

        const selectedBirthday = direction === 'future' ? futureBirthday : previousBirthday;

        if (selectedBirthday >= windowStart && selectedBirthday <= windowEnd) {
          const holder = holdersByContract.get(dependent.contract_id);
          birthdays.push({
            nome: dependent.nome_completo,
            data_nascimento: dependent.data_nascimento,
            tipo: 'Dependente',
            contract_id: dependent.contract_id,
            contract: contractsMap.get(dependent.contract_id),
            holder,
            isPJ: Boolean(holder?.cnpj),
          });
        }
      });

      return birthdays
        .map((birthday) => {
          const birthDate = parseDateWithoutTimezoneAsDate(birthday.data_nascimento);
          if (!birthDate) return null;

          const referenceBirthday = new Date(today);
          referenceBirthday.setFullYear(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
          referenceBirthday.setHours(0, 0, 0, 0);

          if (direction === 'future' && referenceBirthday < today) {
            referenceBirthday.setFullYear(today.getFullYear() + 1);
          }

          if (direction === 'past' && referenceBirthday > today) {
            referenceBirthday.setFullYear(today.getFullYear() - 1);
          }

          const diasRestantes = Math.ceil(
            (referenceBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );

          return {
            ...birthday,
            diasRestantes,
            nextBirthday: referenceBirthday,
          };
        })
        .filter((birthday): birthday is NonNullable<typeof birthday> => birthday !== null)
        .sort((a, b) =>
          direction === 'future' ? a.diasRestantes - b.diasRestantes : b.diasRestantes - a.diasRestantes,
        );
    },
    [activeContracts, dependentsVisibleWithFilters, holdersVisibleWithFilters],
  );

  const ageAdjustmentMilestones = useMemo(() => [19, 24, 29, 34, 39, 44, 49, 54, 59], []);

  const adjustmentsInRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windowStart =
      timelineDirection === 'future'
        ? today
        : new Date(today.getTime() - daysAhead * 24 * 60 * 60 * 1000);
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd =
      timelineDirection === 'future'
        ? new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000)
        : today;
    windowEnd.setHours(23, 59, 59, 999);

    type AdjustmentItem = {
      id: string;
      date: Date;
      tipo: 'idade' | 'anual';
      contract?: Contract;
      personName?: string;
      role?: string;
      age?: number;
    };

    const adjustments: AdjustmentItem[] = [];

    const contractsMap = new Map(activeContracts.map((contract) => [contract.id, contract]));

    const evaluateBirthdayAdjustment = (
      person: Holder | Dependent,
      role: 'Titular' | 'Dependente',
    ) => {
      const contract = contractsMap.get(person.contract_id);
      if (!contract) return;

      const birthDate = parseDateWithoutTimezoneAsDate(person.data_nascimento);
      if (!birthDate) return;

      const candidateDates = ageAdjustmentMilestones
        .map((age) => {
          const targetDate = new Date(birthDate);
          targetDate.setFullYear(birthDate.getFullYear() + age);
          targetDate.setHours(0, 0, 0, 0);
          return { age, date: targetDate };
        })
        .filter(({ date }) => date <= windowEnd && date >= windowStart);

      if (candidateDates.length === 0) return;

      const selected = candidateDates.reduce((acc, curr) => {
        if (timelineDirection === 'future') {
          return !acc || curr.date < acc.date ? curr : acc;
        }
        return !acc || curr.date > acc.date ? curr : acc;
      });

      adjustments.push({
        id: `${person.id}-${selected.age}`,
        date: selected.date,
        tipo: 'idade',
        contract,
        personName: 'nome_completo' in person ? person.nome_completo : undefined,
        role,
        age: selected.age,
      });
    };

    holdersVisibleWithFilters.forEach((holder) => evaluateBirthdayAdjustment(holder, 'Titular'));
    dependentsVisibleWithFilters.forEach((dependent) => evaluateBirthdayAdjustment(dependent, 'Dependente'));

    activeContracts.forEach((contract) => {
      if (!contract.mes_reajuste) return;

      const adjustmentDate = getAdjustmentDateForDirection(contract.mes_reajuste, timelineDirection);

      if (adjustmentDate >= windowStart && adjustmentDate <= windowEnd) {
        adjustments.push({
          id: `${contract.id}-${adjustmentDate.getFullYear()}`,
          date: adjustmentDate,
          tipo: 'anual',
          contract,
        });
      }
    });

    return adjustments.sort((a, b) =>
      timelineDirection === 'future' ? a.date.getTime() - b.date.getTime() : b.date.getTime() - a.date.getTime(),
    );
  }, [
    activeContracts,
    daysAhead,
    getAdjustmentDateForDirection,
    holdersVisibleWithFilters,
    dependentsVisibleWithFilters,
    timelineDirection,
    ageAdjustmentMilestones,
  ]);

  const ensureBirthdayRemindersForToday = useCallback(async () => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    const activeContractMap = new Map(activeContracts.map((contract) => [contract.id, contract]));
    if (activeContractMap.size === 0) {
      return;
    }

    const birthdaysToday: Array<{
      nome: string;
      tipo: 'Titular' | 'Dependente';
      contract_id: string;
      contract?: Contract;
      holder?: Holder;
    }> = [];

    holdersVisibleWithFilters.forEach((holder) => {
      if (!activeContractMap.has(holder.contract_id)) return;

      const { month, day } = parseDateWithoutTimezone(holder.data_nascimento);
      if (month === todayMonth && day === todayDay) {
        birthdaysToday.push({
          nome: holder.nome_completo,
          tipo: 'Titular',
          contract_id: holder.contract_id,
          contract: activeContractMap.get(holder.contract_id),
          holder,
        });
      }
    });

    dependentsVisibleWithFilters.forEach((dependent) => {
      if (!activeContractMap.has(dependent.contract_id)) return;

      const { month, day } = parseDateWithoutTimezone(dependent.data_nascimento);
      if (month === todayMonth && day === todayDay) {
        birthdaysToday.push({
          nome: dependent.nome_completo,
          tipo: 'Dependente',
          contract_id: dependent.contract_id,
          contract: activeContractMap.get(dependent.contract_id),
          holder: holdersVisibleWithFilters.find((holder) => holder.contract_id === dependent.contract_id),
        });
      }
    });

    if (birthdaysToday.length === 0) {
      return;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const { data: existingReminders, error: remindersFetchError } = await supabase
      .from('reminders')
      .select('id, contract_id, lead_id, titulo, tipo, data_lembrete')
      .eq('tipo', 'Aniversário')
      .gte('data_lembrete', startOfToday.toISOString())
      .lte('data_lembrete', endOfToday.toISOString());

    if (remindersFetchError) {
      console.error('Erro ao verificar lembretes de aniversário existentes:', remindersFetchError);
      return;
    }

    const existingKeys = new Set(
      (existingReminders || []).map((reminder) => `${reminder.contract_id ?? ''}|${reminder.titulo}`),
    );

    const reminderTime = new Date();
    reminderTime.setHours(9, 0, 0, 0);
    const reminderDateISO = reminderTime.toISOString();

    const remindersToInsert = birthdaysToday
      .filter((birthday) => !existingKeys.has(`${birthday.contract_id}|Aniversário de ${birthday.nome}`))
      .map((birthday) => ({
        contract_id: birthday.contract_id,
        lead_id: birthday.contract?.lead_id ?? null,
        tipo: 'Aniversário',
        titulo: `Aniversário de ${birthday.nome}`,
        descricao:
          birthday.tipo === 'Titular'
            ? `Enviar parabéns ao titular ${birthday.nome}.`
            : `Enviar parabéns ao dependente ${birthday.nome}${birthday.holder ? ` (titular: ${birthday.holder.nome_completo})` : ''}.`,
        data_lembrete: reminderDateISO,
        lido: false,
        prioridade: 'normal',
      }));

    if (remindersToInsert.length === 0) {
      return;
    }

    const { error: insertError } = await supabase.from('reminders').insert(remindersToInsert);
    if (insertError) {
      console.error('Erro ao criar lembretes de aniversário:', insertError);
    }
  }, [activeContracts, dependentsVisibleWithFilters, holdersVisibleWithFilters]);

  const upcomingBirthdays = useMemo(
    () => getBirthdaysWithinRange(daysAhead, timelineDirection),
    [daysAhead, getBirthdaysWithinRange, timelineDirection],
  );

  useEffect(() => {
    const todayKey = new Date().toISOString().split('T')[0];

    if (lastBirthdayReminderSync.current === todayKey) {
      return;
    }

    ensureBirthdayRemindersForToday()
      .then(() => {
        lastBirthdayReminderSync.current = todayKey;
      })
      .catch((error) => {
        console.error('Erro ao processar lembretes de aniversário:', error);
      });
  }, [ensureBirthdayRemindersForToday]);

  const donutChartData = leadStatusData.map((item) => ({
    label: item.status,
    value: item.count,
    color: statusColorMap[item.status] || '#64748b',
  }));

  const metricColorMap: Record<typeof selectedMetric, string> = useMemo(
    () => ({
      leads: '#0ea5e9',
      contratos: '#8b5cf6',
      comissoes: '#22c55e',
    }),
    [],
  );

  const formatSelectedMetricValue = useCallback(
    (value: number) => {
      if (selectedMetric === 'comissoes') {
        return value.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }

      return value.toLocaleString('pt-BR');
    },
    [selectedMetric],
  );

  const latestMonthlyPoint =
    displayedMonthlySeries.length > 0
      ? displayedMonthlySeries[displayedMonthlySeries.length - 1]
      : undefined;
  const previousMonthlyPoint =
    displayedMonthlySeries.length > 1
      ? displayedMonthlySeries[displayedMonthlySeries.length - 2]
      : undefined;

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

  if (isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

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

  const handleLeadStatusSegmentClick = (label: string) => {
    onNavigateToTab?.('leads', { leadsStatusFilter: [label] });
  };

  const handleOperadoraSegmentClick = (label: string) => {
    onNavigateToTab?.('contracts', { contractOperadoraFilter: label });
  };

  const handleNavigateToContract = (contract?: Contract | null) => {
    if (!contract) return;

    const options = contract.operadora ? { contractOperadoraFilter: contract.operadora } : undefined;
    onNavigateToTab?.('contracts', options);
  };

  const handleNavigateToLead = (leadId?: string | null) => {
    if (!leadId) return;

    onNavigateToTab?.('leads', { leadIdFilter: leadId });
  };

  const handleCreateReminderRequest = (options: ReminderRequest) => {
    if (onCreateReminder) {
      onCreateReminder(options);
      return;
    }

    onNavigateToTab?.('reminders');
  };

  return (
    <div className="space-y-6">
      {isRefreshing && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-50 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-lg ring-1 ring-slate-200">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
            <span className="text-sm font-medium text-slate-600">Atualizando dados...</span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">
            Visão geral do seu negócio em tempo real
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col items-start gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-400" />
              <select
                value={periodFilter}
                onChange={(e) => {
                  setPeriodFilter(e.target.value as 'mes-atual' | 'todo-periodo' | 'personalizado');
                  if (e.target.value !== 'personalizado') {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium focus:border-transparent focus:ring-2 focus:ring-teal-500 sm:w-auto"
              >
                <option value="mes-atual">Mês Atual</option>
                <option value="todo-periodo">Todo Período</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>
            {periodFilter === 'personalizado' && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                <input
                  type="text"
                  value={customStartDate}
                  onChange={handleStartDateChange}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-teal-500 sm:w-32 ${
                    customStartDate && !validateDate(customStartDate)
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-300'
                  }`}
                />
                <span className="text-center text-xs text-slate-500 sm:hidden">até</span>
                <span className="hidden text-sm text-slate-500 sm:inline">até</span>
                <input
                  type="text"
                  value={customEndDate}
                  onChange={handleEndDateChange}
                  placeholder="DD/MM/AAAA"
                  maxLength={10}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-teal-500 sm:w-32 ${
                    customEndDate && !validateDate(customEndDate)
                      ? 'border-red-300 bg-red-50'
                      : 'border-slate-300'
                  }`}
                />
              </div>
            )}
            <div className="flex w-full items-center gap-2 sm:w-56">
              <Target className="h-5 w-5 text-slate-400" />
              <select
                value={dashboardOriginFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setDashboardOriginFilter(value);
                  persistFilters(undefined, undefined, undefined, value, dashboardOwnerFilter);
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium focus:border-transparent focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Todas as origens</option>
                {visibleLeadOrigins.map((origin) => (
                  <option key={origin.id} value={origin.nome}>
                    {origin.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-56">
              <Users className="h-5 w-5 text-slate-400" />
              <select
                value={dashboardOwnerFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setDashboardOwnerFilter(value);
                  persistFilters(undefined, undefined, undefined, dashboardOriginFilter, value);
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium focus:border-transparent focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Todos os responsáveis</option>
                {responsavelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <Clock className="h-4 w-4 text-slate-500" />
              <span>{lastUpdated ? `Atualizado em ${formatLastUpdated()}` : 'Aguardando atualização...'}</span>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Atualizar agora</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="mt-1 h-2 w-2 rounded-full bg-red-500"></div>
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!isCustomPeriodValid && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-800">
            Por favor, preencha as datas de início e fim no formato DD/MM/AAAA para visualizar o período personalizado.
          </p>
        </div>
      )}

      <div
        className={
          isObserver
            ? 'grid grid-cols-1 gap-6'
            : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
        }
      >
        <AnimatedStatCard
          label="Leads Ativos"
          value={`${leadsAtivos} / ${totalLeads}`}
          icon={Users}
          gradient="from-blue-500 to-blue-600"
          iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
          subtitle="Em negociação / Total"
          onClick={() => onNavigateToTab?.('leads')}
        />
        {!isObserver && (
          <AnimatedStatCard
            label="Contratos Ativos"
            value={contratosAtivos.length}
            icon={FileText}
            gradient="from-teal-500 to-cyan-600"
            iconBg="bg-gradient-to-br from-teal-500 to-cyan-600"
            subtitle="Vigentes"
            onClick={() => onNavigateToTab?.('contracts')}
          />
        )}
        {!isObserver && (
          <AnimatedStatCard
            label="Comissão Prevista"
            value={comissaoTotal}
            icon={DollarSign}
            gradient="from-emerald-500 to-green-600"
            iconBg="bg-gradient-to-br from-emerald-500 to-green-600"
            prefix="R$"
            subtitle="Mensal"
            onClick={() => onNavigateToTab?.('financeiro-comissoes')}
          />
        )}
      </div>

      <div
        className={
          isObserver ? 'grid grid-cols-1 gap-6' : 'grid grid-cols-1 md:grid-cols-2 gap-6'
        }
      >
        <AnimatedStatCard
          label="Taxa de Conversão"
          value={conversionRate}
          icon={Target}
          gradient="from-violet-500 to-purple-600"
          iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
          suffix="%"
          subtitle="Leads com status Convertido"
        />
        {!isObserver && (
          <AnimatedStatCard
            label="Ticket Médio"
            value={ticketMedio}
            icon={Activity}
            gradient="from-orange-500 to-red-600"
            iconBg="bg-gradient-to-br from-orange-500 to-red-600"
            prefix="R$"
            subtitle="Por contrato"
          />
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Evolução mensal</h3>
            <p className="text-sm text-slate-500">
              Tendência por mês considerando o período selecionado e os filtros atuais.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <select
              value={periodFilter}
              onChange={(e) => {
                setPeriodFilter(e.target.value as 'mes-atual' | 'todo-periodo' | 'personalizado');
                if (e.target.value !== 'personalizado') {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:border-transparent focus:ring-2 focus:ring-teal-500"
            >
              <option value="mes-atual">Mês atual</option>
              <option value="todo-periodo">Todo período</option>
              <option value="personalizado">Personalizado</option>
            </select>

            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm">
              {(
                [
                  { key: 'leads', label: 'Leads' },
                  { key: 'contratos', label: 'Contratos' },
                  { key: 'comissoes', label: 'Comissões' },
                ] as const
              ).map((metric) => (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => setSelectedMetric(metric.key)}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                    selectedMetric === metric.key
                      ? 'bg-white text-teal-700 shadow-sm ring-1 ring-teal-100'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </div>

            <select
              value={chartRangeInMonths}
              onChange={(e) => setChartRangeInMonths(Number(e.target.value) as 6 | 12)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus:border-transparent focus:ring-2 focus:ring-teal-500"
            >
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <BadgePercent className="h-4 w-4 text-teal-600" />
                  <span>Variação mensal</span>
                </div>
                <span className="text-xs text-slate-500">
                  {previousMonthlyPoint ? `vs ${previousMonthlyPoint.label}` : 'Primeiro mês'}
                </span>
              </div>
              <p
                className={`mt-3 text-2xl font-bold ${
                  (latestMonthlyPoint?.variation || 0) > 0
                    ? 'text-emerald-600'
                    : (latestMonthlyPoint?.variation || 0) < 0
                      ? 'text-red-600'
                      : 'text-slate-700'
                }`}
              >
                {latestMonthlyPoint?.variation !== null && latestMonthlyPoint?.variation !== undefined
                  ? `${latestMonthlyPoint.variation.toFixed(1)}%`
                  : 'Sem dados'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <TrendingUp className="h-4 w-4 text-teal-600" />
                <span>{latestMonthlyPoint?.label || 'Sem dados'}</span>
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {latestMonthlyPoint ? formatSelectedMetricValue(latestMonthlyPoint.value) : 'Sem dados'}
              </p>
              <p className="mt-1 text-xs text-slate-500">Referência do mês mais recente exibido</p>
            </div>
          </div>

          <div className="lg:col-span-3">
            <LineChart
              data={displayedMonthlySeries.map((point) => ({
                label: point.label,
                value: point.value,
              }))}
              color={metricColorMap[selectedMetric]}
              height={260}
            />
          </div>
        </div>
      </div>

      <LeadFunnel leads={activeLeads} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Distribuição de Leads por Status
          </h3>
          {leadStatusData.length > 0 ? (
            <DonutChart
              data={donutChartData}
              size={240}
              strokeWidth={35}
              onSegmentClick={handleLeadStatusSegmentClick}
            />
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
            <DonutChart
              data={operadoraChartData}
              size={240}
              strokeWidth={35}
              onSegmentClick={handleOperadoraSegmentClick}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400">
              Nenhum contrato ativo
            </div>
          )}
        </div>
      </div>

      {!isObserver && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span>{timelineDirection === 'future' ? 'Próximos' : 'Últimos'}</span>
              <select
                value={daysAhead}
                onChange={(e) => setDaysAhead(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium focus:border-transparent focus:ring-2 focus:ring-teal-500"
              >
                {[15, 30, 60].map((days) => (
                  <option key={days} value={days}>
                    {days}
                  </option>
                ))}
              </select>
              <span>dias</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Exibir</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setTimelineDirection('future')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    timelineDirection === 'future'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Futuros
                </button>
                <button
                  type="button"
                  onClick={() => setTimelineDirection('past')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    timelineDirection === 'past'
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Passados
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Reajustes</h3>
                  <p className="text-xs text-slate-500">
                    {timelineDirection === 'future'
                      ? `Próximos reajustes em até ${daysAhead} dias`
                      : `Reajustes que aconteceram nos últimos ${daysAhead} dias`}
                  </p>
                </div>
                <BadgePercent className="w-5 h-5 text-teal-600" />
              </div>
              {adjustmentsInRange.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {adjustmentsInRange.map((adjustment) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diasRestantes = Math.ceil(
                      (adjustment.date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
                    );

                    const distanceLabel =
                      timelineDirection === 'future'
                        ? diasRestantes === 0
                          ? 'Hoje'
                          : `${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`
                        : `${Math.abs(diasRestantes)} ${Math.abs(diasRestantes) === 1 ? 'dia' : 'dias'} atrás`;

                    return (
                      <div
                        key={adjustment.id}
                        className="flex flex-col gap-2 p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                                  adjustment.tipo === 'idade'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}
                              >
                                {adjustment.tipo === 'idade' ? 'Reajuste por idade' : 'Reajuste anual'}
                              </span>
                              <span className="text-xs text-slate-500">{distanceLabel}</span>
                            </div>
                            {adjustment.tipo === 'idade' ? (
                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {adjustment.personName}
                                  {adjustment.age && ` • ${adjustment.age} anos`}
                                </p>
                                <p className="text-xs text-slate-600">{adjustment.role}</p>
                              </div>
                            ) : (
                              <p className="text-sm font-semibold text-slate-900">Reajuste contratual</p>
                            )}
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p className="font-semibold text-slate-900">
                              {adjustment.contract?.codigo_contrato}
                            </p>
                            <p>{adjustment.contract?.operadora}</p>
                            <p>{adjustment.date.toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-teal-100 pt-3">
                          <button
                            type="button"
                            onClick={() => handleNavigateToContract(adjustment.contract)}
                            className="inline-flex items-center rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white"
                          >
                            Ver contrato
                          </button>
                          {adjustment.contract?.lead_id && (
                            <button
                              type="button"
                              onClick={() => handleNavigateToLead(adjustment.contract?.lead_id)}
                              className="inline-flex items-center rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white"
                            >
                              Abrir lead
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleCreateReminderRequest({
                                contractId: adjustment.contract?.id,
                                leadId: adjustment.contract?.lead_id,
                                title:
                                  adjustment.tipo === 'idade'
                                    ? `Reajuste por idade - ${adjustment.personName ?? 'beneficiário'}`
                                    : `Reajuste anual - ${adjustment.contract?.operadora ?? ''}`,
                                description: `Data: ${adjustment.date.toLocaleDateString('pt-BR')}`,
                              })
                            }
                            className="inline-flex items-center rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm transition-colors hover:bg-white"
                          >
                            Criar lembrete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <BadgePercent className="w-12 h-12 mb-2" />
                  <p className="text-sm">Nenhum reajuste no período selecionado</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  {timelineDirection === 'future'
                    ? `Aniversários Próximos (até ${daysAhead} dias)`
                    : `Aniversários Recentes (últimos ${daysAhead} dias)`}
                </h3>
                <Cake className="w-5 h-5 text-pink-500" />
              </div>
              {upcomingBirthdays.length > 0 ? (
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {upcomingBirthdays.map((birthday, index) => {
                    const diasRestantes = birthday.diasRestantes;

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
                              {timelineDirection === 'future'
                                ? diasRestantes === 0
                                  ? 'Hoje!'
                                  : `${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}`
                                : `${Math.abs(diasRestantes)} ${
                                    Math.abs(diasRestantes) === 1 ? 'dia' : 'dias'
                                  } atrás`}
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
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-pink-200 pt-3">
                          {birthday.contract && (
                            <button
                              type="button"
                              onClick={() => handleNavigateToContract(birthday.contract)}
                              className="inline-flex items-center rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white"
                            >
                              Ver contrato
                            </button>
                          )}
                          {birthday.contract?.lead_id && (
                            <button
                              type="button"
                              onClick={() => handleNavigateToLead(birthday.contract?.lead_id)}
                              className="inline-flex items-center rounded-md border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white"
                            >
                              Abrir lead
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleCreateReminderRequest({
                                contractId: birthday.contract?.id,
                                leadId: birthday.contract?.lead_id,
                                title: `Aniversário de ${birthday.nome}`,
                                description: `Data: ${birthday.nextBirthday.toLocaleDateString('pt-BR')}`,
                              })
                            }
                            className="inline-flex items-center rounded-md border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700 shadow-sm transition-colors hover:bg-white"
                          >
                            Criar lembrete
                          </button>
                        </div>
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
        </>
      )}

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
