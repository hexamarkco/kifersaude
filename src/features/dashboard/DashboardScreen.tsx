import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSearchParams } from "react-router-dom";
import { supabase, Lead, Contract, fetchAllPages } from "../../lib/supabase";
import {
  getDateKey,
  parseDateWithoutTimezone,
  parseDateWithoutTimezoneAsDate,
  SAO_PAULO_TIMEZONE,
} from "../../lib/dateUtils";
import { useAuth } from "../../contexts/AuthContext";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import LeadFunnel from "../../components/LeadFunnel";
import ContractDetails from "../../components/ContractDetails";
import LeadDetails from "../../components/LeadDetails";
import LeadForm from "../../components/LeadForm";
import { toast } from "../../lib/toast";
import Button from "../../components/ui/Button";
import {
  calculateConversionRate,
  getLeadStatusDistribution,
  getOperadoraDistribution,
} from "../../lib/analytics";
import { useConfig } from "../../contexts/ConfigContext";
import { mapLeadRelations } from "../../lib/leadRelations";
import { usePanelMotion } from "../../hooks/usePanelMotion";
import { DashboardPageSkeleton } from "../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from "../../components/ui/panelLoading";
import { DashboardAlerts } from "./components/DashboardAlerts";
import { DashboardDistributionSection } from "./components/DashboardDistributionSection";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardHeroCard } from "./components/DashboardHeroCard";
import { DashboardSummaryCards } from "./components/DashboardSummaryCards";
import { DashboardTrendSection } from "./components/DashboardTrendSection";
import {
  CALENDAR_LEGEND_STYLES,
  DASHBOARD_INSET_STYLE,
  DASHBOARD_MUTED_INSET_STYLE,
  DASHBOARD_PILL_STYLE,
  DASHBOARD_SECTION_STYLE,
  mapOperadoraChartData,
} from "./shared/dashboardConstants";
import {
  aggregateDashboardMonthlyTotals,
  formatDashboardLastUpdated,
  formatDashboardDateInput,
  parseDashboardDateString,
  parseDashboardDateValue,
  validateDashboardDate,
} from "./shared/dashboardUtils";
import type {
  DashboardProps,
  Dependent,
  Holder,
  ReminderRequest,
} from "./shared/dashboardTypes";

export default function DashboardScreen({
  onNavigateToTab,
  onCreateReminder,
}: DashboardProps) {
  const { isObserver } = useAuth();
  const {
    leadStatuses,
    leadOrigins,
    options,
    loading: configLoading,
  } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [hiddenLeadIdsForObserver, setHiddenLeadIdsForObserver] = useState<
    Set<string>
  >(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<
    "leads" | "contratos" | "comissoes"
  >("leads");
  const [chartRangeInMonths, setChartRangeInMonths] = useState<6 | 12>(6);
  const dashboardRootRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedSectionsRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const lastBirthdayReminderSync = useRef<string | null>(null);
  const lastAdjustmentReminderSync = useRef<string | null>(null);
  const {
    motionEnabled,
    sectionDuration,
    sectionStagger,
    revealDistance,
    ease,
  } = usePanelMotion();
  const [periodFilter, setPeriodFilter] = useState<
    "mes-atual" | "todo-periodo" | "personalizado"
  >(() => {
    const urlValue = searchParams.get("periodFilter");
    const validValues = ["mes-atual", "todo-periodo", "personalizado"];

    if (urlValue && validValues.includes(urlValue)) {
      return urlValue as "mes-atual" | "todo-periodo" | "personalizado";
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dashboardPeriodFilter");
      if (stored && validValues.includes(stored)) {
        return stored as "mes-atual" | "todo-periodo" | "personalizado";
      }
    }

    return "mes-atual";
  });
  const [customStartDate, setCustomStartDate] = useState(() => {
    const urlValue = searchParams.get("customStartDate");

    if (urlValue && validateDashboardDate(urlValue)) {
      return urlValue;
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dashboardCustomStartDate");
      if (stored && validateDashboardDate(stored)) {
        return stored;
      }
    }

    return "";
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const urlValue = searchParams.get("customEndDate");

    if (urlValue && validateDashboardDate(urlValue)) {
      return urlValue;
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dashboardCustomEndDate");
      if (stored && validateDashboardDate(stored)) {
        return stored;
      }
    }

    return "";
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [calendarView, setCalendarView] = useState<"day" | "week" | "month">(
    "month",
  );
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(
    () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    },
  );
  const [selectedContract, setSelectedContract] = useState<Contract | null>(
    null,
  );
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [dashboardOriginFilter, setDashboardOriginFilter] = useState(
    () => searchParams.get("dashboardOrigin") || "",
  );
  const [dashboardOwnerFilter, setDashboardOwnerFilter] = useState(
    () => searchParams.get("dashboardOwner") || "",
  );
  const deferredPeriodFilter = useDeferredValue(periodFilter);
  const deferredCustomStartDate = useDeferredValue(customStartDate);
  const deferredCustomEndDate = useDeferredValue(customEndDate);
  const deferredDashboardOriginFilter = useDeferredValue(dashboardOriginFilter);
  const deferredDashboardOwnerFilter = useDeferredValue(dashboardOwnerFilter);
  const loadingUi = useAdaptiveLoading(loading);
  const statusColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    leadStatuses.forEach((status) => {
      map[status.nome] = status.cor || "#64748b";
    });
    return map;
  }, [leadStatuses]);

  const resolvePeriodFilter = useCallback(() => {
    const urlValue = searchParams.get("periodFilter");
    const validValues = ["mes-atual", "todo-periodo", "personalizado"];

    if (urlValue && validValues.includes(urlValue)) {
      return urlValue as "mes-atual" | "todo-periodo" | "personalizado";
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dashboardPeriodFilter");
      if (stored && validValues.includes(stored)) {
        return stored as "mes-atual" | "todo-periodo" | "personalizado";
      }
    }

    return "mes-atual";
  }, [searchParams]);

  const resolveCustomDate = useCallback(
    (key: "customStartDate" | "customEndDate") => {
      const urlValue = searchParams.get(key);

      if (urlValue && validateDashboardDate(urlValue)) {
        return urlValue;
      }

      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(
          `dashboard${key.charAt(0).toUpperCase() + key.slice(1)}`,
        );
        if (stored && validateDashboardDate(stored)) {
          return stored;
        }
      }

      return "";
    },
    [searchParams],
  );

  const persistFilters = useCallback(
    (
      nextPeriod: "mes-atual" | "todo-periodo" | "personalizado" = periodFilter,
      nextStart: string = customStartDate,
      nextEnd: string = customEndDate,
      nextOrigin: string = dashboardOriginFilter,
      nextOwner: string = dashboardOwnerFilter,
    ) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("dashboardPeriodFilter", nextPeriod);
        localStorage.setItem("dashboardCustomStartDate", nextStart);
        localStorage.setItem("dashboardCustomEndDate", nextEnd);
      }

      const params = new URLSearchParams(searchParams);
      params.set("periodFilter", nextPeriod);

      if (
        nextPeriod === "personalizado" &&
        nextStart &&
        nextEnd &&
        validateDashboardDate(nextStart) &&
        validateDashboardDate(nextEnd)
      ) {
        params.set("customStartDate", nextStart);
        params.set("customEndDate", nextEnd);
      } else {
        params.delete("customStartDate");
        params.delete("customEndDate");
      }

      if (nextOrigin) {
        params.set("dashboardOrigin", nextOrigin);
      } else {
        params.delete("dashboardOrigin");
      }

      if (nextOwner) {
        params.set("dashboardOwner", nextOwner);
      } else {
        params.delete("dashboardOwner");
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
    () =>
      leadOrigins
        .filter((origin) => origin.visivel_para_observadores === false)
        .map((origin) => origin.nome),
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
    [
      leadOrigins,
      leadStatuses,
      options.lead_responsavel,
      options.lead_tipo_contratacao,
    ],
  );

  const selectedLeadWithRelations = useMemo(
    () => mapLeadWithRelations(selectedLead) ?? selectedLead,
    [mapLeadWithRelations, selectedLead],
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
  }, [
    contracts,
    hiddenLeadIdsForObserver,
    isObserver,
    visibleLeadIdsForObserver,
  ]);

  const activeContractsForReminders = useMemo(
    () =>
      contractsVisibleToUser.filter((contract) => contract.status === "Ativo"),
    [contractsVisibleToUser],
  );

  const leadsById = useMemo(
    () => new Map(leads.map((lead) => [lead.id, lead])),
    [leads],
  );

  const visibleContractIds = useMemo(
    () => new Set(contractsVisibleToUser.map((contract) => contract.id)),
    [contractsVisibleToUser],
  );

  const holdersVisibleToUser = useMemo(() => {
    if (!isObserver) {
      return holders;
    }

    return holders.filter((holder) =>
      visibleContractIds.has(holder.contract_id),
    );
  }, [holders, isObserver, visibleContractIds]);

  const dependentsVisibleToUser = useMemo(() => {
    if (!isObserver) {
      return dependents;
    }

    return dependents.filter((dependent) =>
      visibleContractIds.has(dependent.contract_id),
    );
  }, [dependents, isObserver, visibleContractIds]);

  const sortByCreatedAtDesc = <T extends { created_at?: string | null }>(
    items: T[],
  ) => {
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
    }

    setLoading(true);
    setError(null);
    try {
      const [leadsData, contractsData, holdersData, dependentsData] =
        await Promise.all([
          fetchAllPages<Lead>(async (from, to) => {
            const response = await supabase
              .from("leads")
              .select("*")
              .order("created_at", { ascending: false })
              .range(from, to);
            return { data: response.data, error: response.error };
          }),
          fetchAllPages<Contract>(async (from, to) => {
            const response = await supabase
              .from("contracts")
              .select("*")
              .order("created_at", { ascending: false })
              .range(from, to);
            return { data: response.data, error: response.error };
          }),
          fetchAllPages<Holder>(async (from, to) => {
            const response = await supabase
              .from("contract_holders")
              .select("*")
              .range(from, to);
            return { data: response.data, error: response.error };
          }),
          fetchAllPages<Dependent>(async (from, to) => {
            const response = await supabase
              .from("dependents")
              .select("*")
              .range(from, to);
            return { data: response.data, error: response.error };
          }),
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
          areSetsEqual(currentHidden, hiddenLeadIds)
            ? currentHidden
            : hiddenLeadIds,
        );
        setLeads(mappedLeads.filter((lead) => !hiddenLeadIds.has(lead.id)));
      } else {
        setHiddenLeadIdsForObserver((currentHidden) =>
          currentHidden.size === 0 ? currentHidden : new Set(),
        );
        setLeads(mappedLeads);
      }

      setContracts(contractsData || []);
      setHolders(holdersData || []);
      setDependents(dependentsData || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      setError(`Não foi possível carregar os dados. ${message}`);
    } finally {
      setLoading(false);

      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        setIsInitialLoad(false);
      }
    }
  }, [
    areSetsEqual,
    configLoading,
    isObserver,
    isOriginVisibleToObserver,
    mapLeadWithRelations,
  ]);

  useEffect(() => {
    if (configLoading) {
      return;
    }

    loadData();

    const leadsChannel = supabase
      .channel("dashboard-leads-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
        },
        (payload: RealtimePostgresChangesPayload<Lead>) => {
          const { eventType } = payload;
          const newLead = mapLeadWithRelations(payload.new as Lead | null);
          const oldLead = payload.old as Lead | null;

          setLeads((currentLeads) => {
            let updatedLeads = currentLeads;

            switch (eventType) {
              case "INSERT":
                if (!newLead) return currentLeads;
                if (isObserver && !isOriginVisibleToObserver(newLead.origem)) {
                  return currentLeads.filter((lead) => lead.id !== newLead.id);
                }
                updatedLeads = [
                  newLead,
                  ...currentLeads.filter((lead) => lead.id !== newLead.id),
                ];
                break;
              case "UPDATE":
                if (!newLead) return currentLeads;
                updatedLeads = currentLeads.filter(
                  (lead) => lead.id !== newLead.id,
                );
                if (
                  !(isObserver && !isOriginVisibleToObserver(newLead.origem))
                ) {
                  updatedLeads = [...updatedLeads, newLead];
                }
                break;
              case "DELETE":
                if (!oldLead) return currentLeads;
                updatedLeads = currentLeads.filter(
                  (lead) => lead.id !== oldLead.id,
                );
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
              case "INSERT":
              case "UPDATE":
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
              case "DELETE":
                if (oldLead && updatedHidden.delete(oldLead.id)) {
                  hasChanged = true;
                }
                break;
              default:
                return currentHidden;
            }

            return hasChanged ? updatedHidden : currentHidden;
          });
        },
      )
      .subscribe();

    const contractsChannel = supabase
      .channel("dashboard-contracts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contracts",
        },
        (
          payload: RealtimePostgresChangesPayload<
            Contract & { holders?: Holder[]; dependents?: Dependent[] }
          >,
        ) => {
          const { eventType } = payload;
          const newContract = payload.new as
            | (Contract & {
                holders?: Holder[];
                dependents?: Dependent[];
              })
            | null;
          const oldContract = payload.old as
            | (Contract & {
                holders?: Holder[];
                dependents?: Dependent[];
              })
            | null;
          const contractId = newContract?.id || oldContract?.id;
          const newContractVisible = isContractVisibleToObserver(newContract);

          setContracts((currentContracts) => {
            let updatedContracts = currentContracts;

            switch (eventType) {
              case "INSERT":
                if (!newContract) return currentContracts;
                if (!newContractVisible) {
                  return currentContracts.filter(
                    (contract) => contract.id !== newContract.id,
                  );
                }
                updatedContracts = [
                  newContract,
                  ...currentContracts.filter(
                    (contract) => contract.id !== newContract.id,
                  ),
                ];
                break;
              case "UPDATE":
                if (!newContract) return currentContracts;
                updatedContracts = currentContracts.filter(
                  (contract) => contract.id !== newContract.id,
                );

                if (!newContractVisible) {
                  return sortByCreatedAtDesc(updatedContracts);
                }

                updatedContracts = [...updatedContracts, newContract];
                break;
              case "DELETE":
                if (!oldContract) return currentContracts;
                updatedContracts = currentContracts.filter(
                  (contract) => contract.id !== oldContract.id,
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
              !!newContract &&
              Object.prototype.hasOwnProperty.call(newContract, "holders");

            if (isObserver && newContract && !newContractVisible) {
              return currentHolders.filter(
                (holder) => holder.contract_id !== contractId,
              );
            }

            switch (eventType) {
              case "DELETE":
                return currentHolders.filter(
                  (holder) => holder.contract_id !== contractId,
                );
              case "INSERT":
              case "UPDATE": {
                if (!hasHolderPayload) {
                  return currentHolders;
                }

                const incomingHolders = newContract?.holders ?? [];
                const filteredHolders = currentHolders.filter(
                  (holder) => holder.contract_id !== contractId,
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
              !!newContract &&
              Object.prototype.hasOwnProperty.call(newContract, "dependents");

            if (isObserver && newContract && !newContractVisible) {
              return currentDependents.filter(
                (dependent) => dependent.contract_id !== contractId,
              );
            }

            switch (eventType) {
              case "DELETE":
                return currentDependents.filter(
                  (dependent) => dependent.contract_id !== contractId,
                );
              case "INSERT":
              case "UPDATE": {
                if (!hasDependentPayload) {
                  return currentDependents;
                }

                const incomingDependents = newContract?.dependents ?? [];
                const filteredDependents = currentDependents.filter(
                  (dependent) => dependent.contract_id !== contractId,
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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(contractsChannel);
    };
  }, [
    configLoading,
    isContractVisibleToObserver,
    isObserver,
    isOriginVisibleToObserver,
    loadData,
    mapLeadWithRelations,
  ]);

  useEffect(() => {
    if (!selectedContract) return;
    const refreshed = contracts.find(
      (contract) => contract.id === selectedContract.id,
    );
    if (refreshed) {
      setSelectedContract(refreshed);
    }
  }, [contracts, selectedContract]);

  useEffect(() => {
    if (!selectedLead) return;
    const refreshed = leads.find((lead) => lead.id === selectedLead.id);
    if (refreshed) {
      setSelectedLead(refreshed);
    }
  }, [leads, selectedLead]);

  useEffect(() => {
    const storedPeriod = resolvePeriodFilter();
    const storedStart = resolveCustomDate("customStartDate");
    const storedEnd = resolveCustomDate("customEndDate");
    const availableOrigins = leadOrigins
      .filter(
        (origin) =>
          origin.ativo &&
          (!isObserver || isOriginVisibleToObserver(origin.nome)),
      )
      .map((origin) => origin.nome);
    const availableOwners = (options.lead_responsavel || [])
      .filter((option) => option.ativo)
      .map((option) => option.value);

    const resolvedOrigin =
      searchParams.get("dashboardOrigin") &&
      availableOrigins.includes(searchParams.get("dashboardOrigin") || "")
        ? (searchParams.get("dashboardOrigin") as string)
        : "";

    const resolvedOwner =
      searchParams.get("dashboardOwner") &&
      availableOwners.includes(searchParams.get("dashboardOwner") || "")
        ? (searchParams.get("dashboardOwner") as string)
        : "";

    setPeriodFilter((current) =>
      current === storedPeriod ? current : storedPeriod,
    );
    setCustomStartDate((current) =>
      current === storedStart ? current : storedStart,
    );
    setCustomEndDate((current) =>
      current === storedEnd ? current : storedEnd,
    );
    setDashboardOriginFilter((current) =>
      current === resolvedOrigin ? current : resolvedOrigin,
    );
    setDashboardOwnerFilter((current) =>
      current === resolvedOwner ? current : resolvedOwner,
    );
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

  useEffect(() => {
    if (isInitialLoad || loading || hasAnimatedSectionsRef.current) {
      return;
    }

    const root = dashboardRootRef.current;
    if (!root) {
      return;
    }

    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-panel-animate]"),
    );
    if (sections.length === 0) {
      return;
    }

    if (!motionEnabled) {
      gsap.set(sections, {
        autoAlpha: 1,
        y: 0,
        clearProps: "transform,opacity,willChange",
      });
      hasAnimatedSectionsRef.current = true;
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        sections,
        {
          autoAlpha: 0,
          y: revealDistance,
          willChange: "transform,opacity",
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: sectionDuration,
          ease,
          stagger: sectionStagger,
          clearProps: "transform,opacity,willChange",
          overwrite: "auto",
          force3D: true,
        },
      );
    }, root);

    hasAnimatedSectionsRef.current = true;

    return () => {
      context.revert();
    };
  }, [
    ease,
    isInitialLoad,
    loading,
    motionEnabled,
    revealDistance,
    sectionDuration,
    sectionStagger,
  ]);

  const getStartOfMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };

  const lastUpdatedLabel = lastUpdated
    ? `Atualizado em ${formatDashboardLastUpdated(lastUpdated)}`
    : "";

  const isCustomPeriodValid =
    periodFilter !== "personalizado" ||
    (customStartDate.length === 10 &&
      customEndDate.length === 10 &&
      validateDashboardDate(customStartDate) &&
      validateDashboardDate(customEndDate));
  const isEffectiveCustomPeriodValid =
    deferredPeriodFilter !== "personalizado" ||
    (deferredCustomStartDate.length === 10 &&
      deferredCustomEndDate.length === 10 &&
      validateDashboardDate(deferredCustomStartDate) &&
      validateDashboardDate(deferredCustomEndDate));

  const filterByPeriod = useCallback(<T,>(items: T[], getDate: (item: T) => Date | null): T[] => {
    if (deferredPeriodFilter === "todo-periodo") return items;

    if (deferredPeriodFilter === "personalizado") {
      if (!isEffectiveCustomPeriodValid) return items;

      const startDate = parseDashboardDateString(deferredCustomStartDate);
      startDate.setHours(0, 0, 0, 0);

      const endDate = parseDashboardDateString(deferredCustomEndDate);
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
  }, [deferredCustomEndDate, deferredCustomStartDate, deferredPeriodFilter, isEffectiveCustomPeriodValid]);

  const periodFilteredLeads = useMemo(
    () =>
      filterByPeriod(leads, (lead) => {
        const dateValue = lead.data_criacao || lead.created_at;
        return parseDashboardDateValue(dateValue);
      }),
    [filterByPeriod, leads],
  );

  const visibleLeadOrigins = useMemo(
    () =>
      leadOrigins.filter(
        (origin) =>
          origin.ativo &&
          (!isObserver || isOriginVisibleToObserver(origin.nome)),
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
        if (
          deferredDashboardOriginFilter &&
          lead.origem !== deferredDashboardOriginFilter
        ) {
          return false;
        }

        if (
          deferredDashboardOwnerFilter &&
          lead.responsavel !== deferredDashboardOwnerFilter
        ) {
          return false;
        }

        return true;
      }),
    [
      deferredDashboardOriginFilter,
      deferredDashboardOwnerFilter,
      periodFilteredLeads,
    ],
  );

  const activeLeadStatusNameSet = useMemo(
    () =>
      new Set(
        leadStatuses
          .filter((status) => status.ativo)
          .map((status) => status.nome),
      ),
    [leadStatuses],
  );

  const activeLeads = useMemo(
    () =>
      filteredLeads.filter(
        (lead) =>
          !lead.arquivado && activeLeadStatusNameSet.has(lead.status ?? ""),
      ),
    [activeLeadStatusNameSet, filteredLeads],
  );

  const dashboardScopedContracts = useMemo(
    () =>
      contractsVisibleToUser.filter((contract) => {
        const lead = contract.lead_id ? leadsById.get(contract.lead_id) : null;

        if (
          deferredDashboardOriginFilter &&
          (!lead || lead.origem !== deferredDashboardOriginFilter)
        ) {
          return false;
        }

        if (
          deferredDashboardOwnerFilter &&
          (!lead || lead.responsavel !== deferredDashboardOwnerFilter)
        ) {
          return false;
        }

        return true;
      }),
    [
      contractsVisibleToUser,
      deferredDashboardOriginFilter,
      deferredDashboardOwnerFilter,
      leadsById,
    ],
  );

  const filteredContracts = useMemo(() => {
    return filterByPeriod(dashboardScopedContracts, (contract) => {
      return (
        parseDashboardDateValue(contract.data_inicio) ||
        parseDashboardDateValue(contract.previsao_recebimento_comissao) ||
        parseDashboardDateValue(contract.created_at)
      );
    });
  }, [dashboardScopedContracts, filterByPeriod]);

  const calendarScopedContractIds = useMemo(
    () => new Set(dashboardScopedContracts.map((contract) => contract.id)),
    [dashboardScopedContracts],
  );

  const calendarHolders = useMemo(
    () =>
      holdersVisibleToUser.filter((holder) =>
        calendarScopedContractIds.has(holder.contract_id),
      ),
    [calendarScopedContractIds, holdersVisibleToUser],
  );

  const calendarDependents = useMemo(
    () =>
      dependentsVisibleToUser.filter((dependent) =>
        calendarScopedContractIds.has(dependent.contract_id),
      ),
    [calendarScopedContractIds, dependentsVisibleToUser],
  );

  const holderByContractId = useMemo(
    () =>
      new Map(calendarHolders.map((holder) => [holder.contract_id, holder])),
    [calendarHolders],
  );

  const totalLeads = activeLeads.length;
  const leadsAtivos = activeLeads.filter(
    (lead) => !["Fechado", "Perdido"].includes(lead.status ?? ""),
  ).length;

  const contratosAtivos = filteredContracts.filter((c) => c.status === "Ativo");
  const calendarActiveContracts = useMemo(
    () =>
      dashboardScopedContracts.filter(
        (contract) => contract.status === "Ativo",
      ),
    [dashboardScopedContracts],
  );
  const comissaoTotal = contratosAtivos.reduce(
    (sum, c) => sum + (c.comissao_prevista || 0),
    0,
  );

  const mensalidadeTotal = contratosAtivos.reduce(
    (sum, c) => sum + (c.mensalidade_total || 0),
    0,
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
        const variation =
          previous.value === 0 ? 100 : (delta / previous.value) * 100;

        return { ...point, variation };
      }),
    [],
  );

  const monthlyLeadSeries = useMemo(
    () =>
      addVariationToSeries(
        aggregateDashboardMonthlyTotals(filteredLeads, (lead) =>
          parseDashboardDateValue(lead.data_criacao || lead.created_at),
        ),
      ),
    [addVariationToSeries, filteredLeads],
  );

  const monthlyContractSeries = useMemo(
    () =>
      addVariationToSeries(
        aggregateDashboardMonthlyTotals(filteredContracts, (contract) =>
          parseDashboardDateValue(
            contract.data_inicio ||
              contract.previsao_recebimento_comissao ||
              contract.created_at,
          ),
        ),
      ),
    [addVariationToSeries, filteredContracts],
  );

  const monthlyCommissionSeries = useMemo(
    () =>
      addVariationToSeries(
        aggregateDashboardMonthlyTotals(
          filteredContracts,
          (contract) =>
            parseDashboardDateValue(
              contract.data_inicio ||
                contract.previsao_recebimento_comissao ||
                contract.created_at,
            ),
          (contract) => contract.comissao_prevista || 0,
        ),
      ),
    [addVariationToSeries, filteredContracts],
  );

  const selectedMonthlySeries = useMemo(() => {
    switch (selectedMetric) {
      case "contratos":
        return monthlyContractSeries;
      case "comissoes":
        return monthlyCommissionSeries;
      default:
        return monthlyLeadSeries;
    }
  }, [
    monthlyCommissionSeries,
    monthlyContractSeries,
    monthlyLeadSeries,
    selectedMetric,
  ]);

  const displayedMonthlySeries = useMemo(() => {
    if (selectedMonthlySeries.length === 0) return [];

    const startIndex = Math.max(
      selectedMonthlySeries.length - chartRangeInMonths,
      0,
    );
    const slice = selectedMonthlySeries.slice(startIndex);

    return slice.map((point, index) => {
      const previous = slice[index - 1];

      if (!previous) {
        return { ...point, variation: null };
      }

      const delta = point.value - previous.value;
      const variation =
        previous.value === 0 ? 100 : (delta / previous.value) * 100;

      return { ...point, variation };
    });
  }, [chartRangeInMonths, selectedMonthlySeries]);

  const conversionRate = calculateConversionRate(
    activeLeads,
    filteredContracts,
  );

  const leadStatusData = getLeadStatusDistribution(
    activeLeads.filter(
      (lead) => !["Fechado", "Perdido"].includes(lead.status ?? ""),
    ),
  );
  const operadoraData = getOperadoraDistribution(filteredContracts);
  const getContractStartDate = useCallback((contract?: Contract | null) => {
    if (!contract) return null;

    if (contract.data_inicio) {
      const parsed = parseDateWithoutTimezoneAsDate(contract.data_inicio);
      if (parsed) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }

    if (contract.created_at) {
      const parsed = new Date(contract.created_at);
      if (!isNaN(parsed.getTime())) {
        parsed.setHours(0, 0, 0, 0);
        return parsed;
      }
    }

    return null;
  }, []);

  const getAdjustmentDateForDirection = useCallback(
    (
      monthNumber: number,
      direction: "future" | "past",
      contract?: Contract | null,
    ) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const currentYear = today.getFullYear();
      const monthIndex = monthNumber - 1;
      let targetDate = new Date(currentYear, monthIndex, 1);
      targetDate.setHours(0, 0, 0, 0);

      if (direction === "future" && targetDate < today) {
        targetDate = new Date(currentYear + 1, monthIndex, 1);
      }

      if (direction === "past" && targetDate > today) {
        targetDate = new Date(currentYear - 1, monthIndex, 1);
      }

      const contractStartDate = getContractStartDate(contract);
      if (contractStartDate) {
        if (direction === "future") {
          while (targetDate <= contractStartDate) {
            targetDate = new Date(targetDate.getFullYear() + 1, monthIndex, 1);
          }
        } else if (targetDate <= contractStartDate) {
          return null;
        }
      }

      return targetDate;
    },
    [getContractStartDate],
  );

  const buildBirthdayEventsInRange = useCallback(
    (rangeStart: Date, rangeEnd: Date) => {
      const birthdays: Array<{
        nome: string;
        data_nascimento: string;
        tipo: "Titular" | "Dependente";
        contract_id: string;
        contract?: Contract;
        holder?: Holder;
        isPJ: boolean;
        nextBirthday: Date;
      }> = [];

      const activeContractIds = new Set(
        calendarActiveContracts.map((c) => c.id),
      );
      const contractsMap = new Map(
        calendarActiveContracts.map((c) => [c.id, c]),
      );
      const holdersByContract = new Map(
        calendarHolders.map((h) => [h.contract_id, h]),
      );
      const startYear = rangeStart.getFullYear();
      const endYear = rangeEnd.getFullYear();

      calendarHolders.forEach((holder) => {
        if (!activeContractIds.has(holder.contract_id)) return;

        const birthDate = parseDateWithoutTimezoneAsDate(
          holder.data_nascimento,
        );
        if (!birthDate) return;

        for (let year = startYear; year <= endYear; year += 1) {
          const birthdayDate = new Date(
            year,
            birthDate.getMonth(),
            birthDate.getDate(),
          );
          birthdayDate.setHours(0, 0, 0, 0);

          if (birthdayDate < rangeStart || birthdayDate > rangeEnd) continue;

          birthdays.push({
            nome: holder.nome_completo,
            data_nascimento: holder.data_nascimento,
            tipo: "Titular",
            contract_id: holder.contract_id,
            contract: contractsMap.get(holder.contract_id),
            isPJ: Boolean(holder?.cnpj),
            nextBirthday: birthdayDate,
          });
        }
      });

      calendarDependents.forEach((dependent) => {
        if (!activeContractIds.has(dependent.contract_id)) return;

        const birthDate = parseDateWithoutTimezoneAsDate(
          dependent.data_nascimento,
        );
        if (!birthDate) return;

        for (let year = startYear; year <= endYear; year += 1) {
          const birthdayDate = new Date(
            year,
            birthDate.getMonth(),
            birthDate.getDate(),
          );
          birthdayDate.setHours(0, 0, 0, 0);

          if (birthdayDate < rangeStart || birthdayDate > rangeEnd) continue;

          const holder = holdersByContract.get(dependent.contract_id);

          birthdays.push({
            nome: dependent.nome_completo,
            data_nascimento: dependent.data_nascimento,
            tipo: "Dependente",
            contract_id: dependent.contract_id,
            contract: contractsMap.get(dependent.contract_id),
            holder,
            isPJ: Boolean(holder?.cnpj),
            nextBirthday: birthdayDate,
          });
        }
      });

      return birthdays.sort(
        (a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime(),
      );
    },
    [calendarActiveContracts, calendarDependents, calendarHolders],
  );

  const ageAdjustmentMilestones = useMemo(
    () => [19, 24, 29, 34, 39, 44, 49, 54, 59],
    [],
  );
  const ageBands = useMemo(
    () => [
      { min: 0, max: 18 },
      { min: 19, max: 23 },
      { min: 24, max: 28 },
      { min: 29, max: 33 },
      { min: 34, max: 38 },
      { min: 39, max: 43 },
      { min: 44, max: 48 },
      { min: 49, max: 53 },
      { min: 54, max: 58 },
      { min: 59, max: null },
    ],
    [],
  );

  type AdjustmentItem = {
    id: string;
    date: Date;
    tipo: "idade" | "anual";
    contract?: Contract;
    personName?: string;
    role?: string;
    age?: number;
  };

  const buildAdjustmentEventsInRange = useCallback(
    (rangeStart: Date, rangeEnd: Date) => {
      const adjustments: AdjustmentItem[] = [];
      const contractsMap = new Map(
        calendarActiveContracts.map((contract) => [contract.id, contract]),
      );
      const startYear = rangeStart.getFullYear();
      const endYear = rangeEnd.getFullYear();

      const evaluateBirthdayAdjustment = (
        person: Holder | Dependent,
        role: "Titular" | "Dependente",
      ) => {
        const contract = contractsMap.get(person.contract_id);
        if (!contract) return;

        const contractStartDate = getContractStartDate(contract);

        const birthDate = parseDateWithoutTimezoneAsDate(
          person.data_nascimento,
        );
        if (!birthDate) return;

        ageAdjustmentMilestones.forEach((age) => {
          const targetDate = new Date(birthDate);
          targetDate.setFullYear(birthDate.getFullYear() + age);
          targetDate.setHours(0, 0, 0, 0);

          if (targetDate < rangeStart || targetDate > rangeEnd) return;
          if (contractStartDate && targetDate <= contractStartDate) return;

          adjustments.push({
            id: `${person.id}-${age}`,
            date: targetDate,
            tipo: "idade",
            contract,
            personName:
              "nome_completo" in person ? person.nome_completo : undefined,
            role,
            age,
          });
        });
      };

      calendarHolders.forEach((holder) =>
        evaluateBirthdayAdjustment(holder, "Titular"),
      );
      calendarDependents.forEach((dependent) =>
        evaluateBirthdayAdjustment(dependent, "Dependente"),
      );

      calendarActiveContracts.forEach((contract) => {
        if (!contract.mes_reajuste) return;

        const contractStartDate = getContractStartDate(contract);
        const monthIndex = contract.mes_reajuste - 1;

        for (let year = startYear; year <= endYear; year += 1) {
          const adjustmentDate = new Date(year, monthIndex, 1);
          adjustmentDate.setHours(0, 0, 0, 0);

          if (adjustmentDate < rangeStart || adjustmentDate > rangeEnd)
            continue;
          if (contractStartDate && adjustmentDate <= contractStartDate)
            continue;

          adjustments.push({
            id: `${contract.id}-${year}`,
            date: adjustmentDate,
            tipo: "anual",
            contract,
          });
        }
      });

      return adjustments.sort((a, b) => a.date.getTime() - b.date.getTime());
    },
    [
      calendarActiveContracts,
      ageAdjustmentMilestones,
      calendarDependents,
      getContractStartDate,
      calendarHolders,
    ],
  );

  const ensureBirthdayRemindersForToday =
    useCallback(async (): Promise<boolean> => {
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();

      const activeContractMap = new Map(
        activeContractsForReminders.map((contract) => [contract.id, contract]),
      );
      if (activeContractMap.size === 0) {
        return false;
      }

      const birthdaysToday: Array<{
        nome: string;
        tipo: "Titular" | "Dependente";
        contract_id: string;
        contract?: Contract;
        holder?: Holder;
      }> = [];

      holdersVisibleToUser.forEach((holder) => {
        if (!activeContractMap.has(holder.contract_id)) return;

        const { month, day } = parseDateWithoutTimezone(holder.data_nascimento);
        if (month === todayMonth && day === todayDay) {
          birthdaysToday.push({
            nome: holder.nome_completo,
            tipo: "Titular",
            contract_id: holder.contract_id,
            contract: activeContractMap.get(holder.contract_id),
            holder,
          });
        }
      });

      dependentsVisibleToUser.forEach((dependent) => {
        if (!activeContractMap.has(dependent.contract_id)) return;

        const { month, day } = parseDateWithoutTimezone(
          dependent.data_nascimento,
        );
        if (month === todayMonth && day === todayDay) {
          birthdaysToday.push({
            nome: dependent.nome_completo,
            tipo: "Dependente",
            contract_id: dependent.contract_id,
            contract: activeContractMap.get(dependent.contract_id),
            holder: holdersVisibleToUser.find(
              (holder) => holder.contract_id === dependent.contract_id,
            ),
          });
        }
      });

      if (birthdaysToday.length === 0) {
        return true;
      }

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      const { data: existingReminders, error: remindersFetchError } =
        await supabase
          .from("reminders")
          .select("id, contract_id, lead_id, titulo, tipo, data_lembrete")
          .eq("tipo", "Aniversário")
          .gte("data_lembrete", startOfToday.toISOString())
          .lte("data_lembrete", endOfToday.toISOString());

      if (remindersFetchError) {
        console.error(
          "Erro ao verificar lembretes de aniversário existentes:",
          remindersFetchError,
        );
        return false;
      }

      const existingKeys = new Set(
        (existingReminders || []).map(
          (reminder) => `${reminder.contract_id ?? ""}|${reminder.titulo}`,
        ),
      );

      const reminderTime = new Date();
      reminderTime.setHours(9, 0, 0, 0);
      const reminderDateISO = reminderTime.toISOString();

      const remindersToInsert = birthdaysToday
        .filter(
          (birthday) =>
            !existingKeys.has(
              `${birthday.contract_id}|Aniversário de ${birthday.nome}`,
            ),
        )
        .map((birthday) => ({
          contract_id: birthday.contract_id,
          lead_id: birthday.contract?.lead_id ?? null,
          tipo: "Aniversário",
          titulo: `Aniversário de ${birthday.nome}`,
          descricao:
            birthday.tipo === "Titular"
              ? `Enviar parabéns ao titular ${birthday.nome}.`
              : `Enviar parabéns ao dependente ${birthday.nome}${birthday.holder ? ` (titular: ${birthday.holder.nome_completo})` : ""}.`,
          data_lembrete: reminderDateISO,
          lido: false,
          prioridade: "normal",
        }));

      if (remindersToInsert.length === 0) {
        return true;
      }

      const { error: insertError } = await supabase
        .from("reminders")
        .upsert(remindersToInsert, {
          onConflict: "contract_id",
          ignoreDuplicates: true,
        });
      if (insertError) {
        console.error("Erro ao criar lembretes de aniversário:", insertError);
        return false;
      }

      return true;
    }, [
      activeContractsForReminders,
      dependentsVisibleToUser,
      holdersVisibleToUser,
    ]);

  const ensureAdjustmentReminders = useCallback(async (): Promise<boolean> => {
    if (activeContractsForReminders.length === 0) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const remindersToSchedule = activeContractsForReminders
      .filter((contract) => contract.mes_reajuste)
      .map((contract) => {
        const adjustmentDate = getAdjustmentDateForDirection(
          contract.mes_reajuste!,
          "future",
          contract,
        );
        if (!adjustmentDate) return null;

        const reminderDate = new Date(adjustmentDate);
        reminderDate.setDate(reminderDate.getDate() - 60);
        reminderDate.setHours(9, 0, 0, 0);

        if (reminderDate < today) return null;

        const month = String(adjustmentDate.getMonth() + 1).padStart(2, "0");
        const year = adjustmentDate.getFullYear();

        return {
          contract,
          adjustmentDate,
          reminderDate,
          titulo: `Reajuste anual ${month}/${year} - ${contract.codigo_contrato}`,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (remindersToSchedule.length === 0) return true;

    const contractIds = Array.from(
      new Set(remindersToSchedule.map((item) => item.contract.id)),
    );

    const { data: existingReminders, error: fetchError } = await supabase
      .from("reminders")
      .select("id, contract_id, data_lembrete, tipo")
      .eq("tipo", "Reajuste")
      .in("contract_id", contractIds);

    if (fetchError) {
      console.error(
        "Erro ao verificar lembretes de reajuste existentes:",
        fetchError,
      );
      return false;
    }

    const existingKeys = new Set(
      (existingReminders || []).map((reminder) => reminder.contract_id ?? ""),
    );

    const remindersToInsert = remindersToSchedule
      .filter((item) => !existingKeys.has(item.contract.id))
      .map((item) => ({
        contract_id: item.contract.id,
        lead_id: item.contract.lead_id ?? null,
        tipo: "Reajuste",
        titulo: item.titulo,
        descricao: `Reajuste anual previsto para ${item.adjustmentDate.toLocaleDateString("pt-BR")}.`,
        data_lembrete: item.reminderDate.toISOString(),
        lido: false,
        prioridade: "normal",
      }));

    if (remindersToInsert.length === 0) return true;

    const { error: insertError } = await supabase
      .from("reminders")
      .upsert(remindersToInsert, { onConflict: "contract_id", ignoreDuplicates: true });
    if (insertError) {
      console.error("Erro ao criar lembretes de reajuste:", insertError);
      return false;
    }

    return true;
  }, [activeContractsForReminders, getAdjustmentDateForDirection]);

  type BirthdayEvent = {
    nome: string;
    data_nascimento: string;
    tipo: "Titular" | "Dependente";
    contract_id: string;
    contract?: Contract;
    holder?: Holder;
    isPJ: boolean;
    nextBirthday: Date;
  };

  const calendarMonthRange = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const monthStart = new Date(year, month, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(year, month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    return { monthStart, monthEnd };
  }, [calendarMonth]);

  const calendarMonthAdjustments = useMemo(
    () =>
      buildAdjustmentEventsInRange(
        calendarMonthRange.monthStart,
        calendarMonthRange.monthEnd,
      ),
    [buildAdjustmentEventsInRange, calendarMonthRange],
  );

  const calendarMonthBirthdays = useMemo<BirthdayEvent[]>(
    () =>
      buildBirthdayEventsInRange(
        calendarMonthRange.monthStart,
        calendarMonthRange.monthEnd,
      ),
    [buildBirthdayEventsInRange, calendarMonthRange],
  );

  type CalendarEvent =
    | {
        id: string;
        date: Date;
        kind: "adjustment";
        adjustment: AdjustmentItem;
      }
    | {
        id: string;
        date: Date;
        kind: "birthday";
        birthday: BirthdayEvent;
      };

  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];

    calendarMonthAdjustments.forEach((adjustment) => {
      events.push({
        id: `adjustment-${adjustment.id}`,
        date: adjustment.date,
        kind: "adjustment",
        adjustment,
      });
    });

    calendarMonthBirthdays.forEach((birthday, index) => {
      events.push({
        id: `birthday-${birthday.contract_id}-${birthday.nome}-${index}`,
        date: birthday.nextBirthday,
        kind: "birthday",
        birthday,
      });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [calendarMonthAdjustments, calendarMonthBirthdays]);

  const calendarEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    calendarEvents.forEach((event) => {
      const dateKey = getDateKey(event.date, SAO_PAULO_TIMEZONE);
      const list = map.get(dateKey) ?? [];
      list.push(event);
      map.set(dateKey, list);
    });

    return map;
  }, [calendarEvents]);

  const selectedCalendarKey = selectedCalendarDate
    ? getDateKey(selectedCalendarDate, SAO_PAULO_TIMEZONE)
    : null;
  const calendarMonthLabel = useMemo(
    () =>
      calendarMonth.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [calendarMonth],
  );
  const selectedBaseDate = useMemo(() => {
    const date = selectedCalendarDate
      ? new Date(selectedCalendarDate)
      : new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, [selectedCalendarDate]);

  const calendarViewRange = useMemo(() => {
    if (calendarView === "month") {
      return {
        start: calendarMonthRange.monthStart,
        end: calendarMonthRange.monthEnd,
      };
    }

    if (calendarView === "week") {
      const start = new Date(selectedBaseDate);
      start.setDate(selectedBaseDate.getDate() - selectedBaseDate.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    const start = new Date(selectedBaseDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedBaseDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, [calendarMonthRange, calendarView, selectedBaseDate]);

  const calendarViewEvents = useMemo(() => {
    if (calendarView === "month") {
      return calendarEvents;
    }

    const events: CalendarEvent[] = [];

    buildAdjustmentEventsInRange(
      calendarViewRange.start,
      calendarViewRange.end,
    ).forEach((adjustment) => {
      events.push({
        id: `adjustment-${adjustment.id}`,
        date: adjustment.date,
        kind: "adjustment",
        adjustment,
      });
    });

    buildBirthdayEventsInRange(
      calendarViewRange.start,
      calendarViewRange.end,
    ).forEach((birthday, index) => {
      events.push({
        id: `birthday-${birthday.contract_id}-${birthday.nome}-${index}`,
        date: birthday.nextBirthday,
        kind: "birthday",
        birthday,
      });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [
    buildAdjustmentEventsInRange,
    buildBirthdayEventsInRange,
    calendarEvents,
    calendarView,
    calendarViewRange,
  ]);

  const calendarViewLabel = useMemo(() => {
    if (calendarView === "month") {
      return calendarMonthLabel;
    }

    if (calendarView === "week") {
      const startLabel = calendarViewRange.start.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
      const endLabel = calendarViewRange.end.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
      return `Semana de ${startLabel} a ${endLabel}`;
    }

    if (!selectedCalendarDate) {
      return "Selecione um dia";
    }

    return selectedBaseDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }, [
    calendarMonthLabel,
    calendarView,
    calendarViewRange,
    selectedBaseDate,
    selectedCalendarDate,
  ]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const todayKey = getDateKey(new Date(), SAO_PAULO_TIMEZONE);
    const cells: JSX.Element[] = [];

    for (let i = 0; i < firstDay; i += 1) {
      cells.push(<div key={`empty-${i}`} className="aspect-square" />);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      const dateKey = getDateKey(date, SAO_PAULO_TIMEZONE);
      const dayEvents = calendarEventsByDate.get(dateKey) ?? [];
      const isToday = dateKey === todayKey;
      const isSelected = selectedCalendarKey === dateKey;
      const kinds = Array.from(new Set(dayEvents.map((event) => event.kind)));

      cells.push(
        <button
          key={day}
          type="button"
          onClick={() => setSelectedCalendarDate(date)}
          className="group relative aspect-square rounded-2xl border p-2 transition-all duration-200 hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus,#c86f1d)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panel-bg,#f8f5ef)]"
          style={
            isSelected
              ? {
                  borderColor: "var(--panel-accent-border,#d5a25c)",
                  background:
                    "linear-gradient(180deg, var(--panel-accent-soft,#f6e4c7) 0%, color-mix(in srgb, var(--panel-accent-soft,#f6e4c7) 70%, var(--panel-surface,#fffdfa)) 100%)",
                  color: "var(--panel-accent-ink-strong,#4a2411)",
                  boxShadow: "0 18px 30px -26px rgba(184, 92, 31, 0.55)",
                }
              : isToday
                ? {
                    borderColor: "var(--panel-border-strong,#9d7f5a)",
                    background:
                      "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 88%, transparent) 0%, var(--panel-surface,#fffdfa) 100%)",
                    color: "var(--panel-text,#1c1917)",
                  }
                : dayEvents.length > 0
                  ? {
                      borderColor: "var(--panel-border-subtle,#e4d5c0)",
                      background:
                        "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 56%, transparent) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 96%, transparent) 100%)",
                      color: "var(--panel-text-soft,#5b4635)",
                    }
                  : {
                      borderColor: "var(--panel-border-subtle,#e4d5c0)",
                      background:
                        "color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, transparent)",
                      color: "var(--panel-text-soft,#5b4635)",
                    }
          }
        >
          <div className="text-sm font-medium">{day}</div>
          {kinds.length > 0 && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
              {kinds.map((kind) => (
                <span
                  key={kind}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{
                    backgroundColor: isSelected
                      ? "var(--panel-accent-ink-strong,#4a2411)"
                      : kind === "adjustment"
                        ? "var(--panel-accent-strong,#b85c1f)"
                        : "var(--panel-border-strong,#9d7f5a)",
                  }}
                />
              ))}
            </div>
          )}
        </button>,
      );
    }

    return { weekDays, cells };
  }, [calendarMonth, calendarEventsByDate, selectedCalendarKey]);

  const calendarMonthEventCount = useMemo(
    () => calendarEvents.length,
    [calendarEvents],
  );

  useEffect(() => {
    const todayKey = new Date().toISOString().split("T")[0];

    if (lastBirthdayReminderSync.current === todayKey) {
      return;
    }

    ensureBirthdayRemindersForToday()
      .then((didRun) => {
        if (didRun) {
          lastBirthdayReminderSync.current = todayKey;
        }
      })
      .catch((error) => {
        console.error("Erro ao processar lembretes de aniversário:", error);
      });
  }, [ensureBirthdayRemindersForToday]);

  useEffect(() => {
    const todayKey = new Date().toISOString().split("T")[0];

    if (lastAdjustmentReminderSync.current === todayKey) {
      return;
    }

    ensureAdjustmentReminders()
      .then((didRun) => {
        if (didRun) {
          lastAdjustmentReminderSync.current = todayKey;
        }
      })
      .catch((error) => {
        console.error("Erro ao processar lembretes de reajuste:", error);
      });
  }, [ensureAdjustmentReminders]);

  const donutChartData = useMemo(
    () =>
      leadStatusData.map((item) => ({
        label: item.status,
        value: item.count,
        color: statusColorMap[item.status] || "#64748b",
      })),
    [leadStatusData, statusColorMap],
  );

  const latestMonthlyPoint =
    displayedMonthlySeries.length > 0
      ? displayedMonthlySeries[displayedMonthlySeries.length - 1]
      : undefined;
  const previousMonthlyPoint =
    displayedMonthlySeries.length > 1
      ? displayedMonthlySeries[displayedMonthlySeries.length - 2]
      : undefined;
  const highestMonthlyPoint = useMemo(() => {
    if (displayedMonthlySeries.length === 0) {
      return undefined;
    }

    return displayedMonthlySeries.reduce((highest, point) =>
      point.value > highest.value ? point : highest,
    );
  }, [displayedMonthlySeries]);
  const averageMonthlyValue = useMemo(() => {
    if (displayedMonthlySeries.length === 0) {
      return 0;
    }

    const total = displayedMonthlySeries.reduce(
      (sum, point) => sum + point.value,
      0,
    );
    return total / displayedMonthlySeries.length;
  }, [displayedMonthlySeries]);
  const operadoraChartData = useMemo(
    () => mapOperadoraChartData(operadoraData),
    [operadoraData],
  );

  const hasDashboardSnapshot =
    leads.length > 0 ||
    contracts.length > 0 ||
    holders.length > 0 ||
    dependents.length > 0;

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDashboardDateInput(e.target.value);
    setCustomStartDate(formatted);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatDashboardDateInput(e.target.value);
    setCustomEndDate(formatted);
  };

  const handleDashboardPeriodFilterChange = (
    nextPeriod: "mes-atual" | "todo-periodo" | "personalizado",
  ) => {
    setPeriodFilter(nextPeriod);

    if (nextPeriod !== "personalizado") {
      setCustomStartDate("");
      setCustomEndDate("");
    }
  };

  const isCustomStartInvalid = Boolean(
    customStartDate && !validateDashboardDate(customStartDate),
  );
  const isCustomEndInvalid = Boolean(
    customEndDate && !validateDashboardDate(customEndDate),
  );

  const handleLeadStatusSegmentClick = (label: string) => {
    onNavigateToTab?.("leads", { leadsStatusFilter: [label] });
  };

  const handleOperadoraSegmentClick = (label: string) => {
    onNavigateToTab?.("contracts", { contractOperadoraFilter: label });
  };

  const handleNavigateToContract = (contract?: Contract | null) => {
    if (!contract) return;
    setSelectedContract(contract);
  };

  const handleNavigateToLead = (leadId?: string | null) => {
    if (!leadId) return;
    const lead = leads.find((item) => item.id === leadId) || null;
    setSelectedLead(lead);
  };

  const handleCreateReminderRequest = async (options: ReminderRequest) => {
    if (onCreateReminder) {
      onCreateReminder(options);
      return;
    }

    const title = options.title?.trim() || "Lembrete";
    const normalizedTitle = title.toLowerCase();
    const tipo = normalizedTitle.startsWith("aniversário")
      ? "Aniversário"
      : normalizedTitle.startsWith("reajuste")
        ? "Reajuste"
        : "Outro";

    const reminderDate = new Date();
    reminderDate.setSeconds(0, 0);

    const { error } = await supabase.from("reminders").insert([
      {
        contract_id: options.contractId ?? null,
        lead_id: options.leadId ?? null,
        tipo,
        titulo: title,
        descricao: options.description ?? null,
        data_lembrete: reminderDate.toISOString(),
        lido: false,
        prioridade: "normal",
      },
    ]);

    if (error) {
      console.error("Erro ao criar lembrete:", error);
      toast.error("Erro ao criar lembrete.");
      return;
    }
    onNavigateToTab?.("agenda");
    toast.success("Lembrete criado com sucesso.");
  };

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasDashboardSnapshot}
      skeleton={<DashboardPageSkeleton />}
      stageLabel="Carregando dashboard..."
      overlayLabel="Atualizando dashboard..."
      stageClassName="panel-dashboard-immersive"
    >
      <div
        ref={dashboardRootRef}
        className="panel-dashboard-immersive panel-page-shell space-y-6"
      >
        <DashboardHeader
          periodFilter={periodFilter}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          dashboardOriginFilter={dashboardOriginFilter}
          dashboardOwnerFilter={dashboardOwnerFilter}
          visibleLeadOrigins={visibleLeadOrigins}
          responsavelOptions={responsavelOptions}
          lastUpdatedLabel={lastUpdatedLabel}
          loading={loading}
          onPeriodFilterChange={handleDashboardPeriodFilterChange}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          onOriginFilterChange={setDashboardOriginFilter}
          onOwnerFilterChange={setDashboardOwnerFilter}
          onRefresh={loadData}
          isCustomStartInvalid={isCustomStartInvalid}
          isCustomEndInvalid={isCustomEndInvalid}
        />

        <DashboardAlerts
          error={error}
          loading={loading}
          isCustomPeriodValid={isCustomPeriodValid}
          onRetry={loadData}
        />
        <DashboardSummaryCards
          isObserver={isObserver}
          leadsAtivos={leadsAtivos}
          totalLeads={totalLeads}
          contratosAtivosCount={contratosAtivos.length}
          comissaoTotal={comissaoTotal}
          conversionRate={conversionRate}
          ticketMedio={ticketMedio}
          onOpenLeads={() => onNavigateToTab?.("leads")}
          onOpenContracts={() => onNavigateToTab?.("contracts")}
          onOpenCommissions={() => onNavigateToTab?.("financeiro-comissoes")}
        />
        <DashboardTrendSection
          periodFilter={periodFilter}
          selectedMetric={selectedMetric}
          chartRangeInMonths={chartRangeInMonths}
          displayedMonthlySeries={displayedMonthlySeries}
          latestMonthlyPoint={latestMonthlyPoint}
          previousMonthlyPoint={previousMonthlyPoint}
          highestMonthlyPoint={highestMonthlyPoint}
          averageMonthlyValue={averageMonthlyValue}
          onPeriodFilterChange={handleDashboardPeriodFilterChange}
          onSelectedMetricChange={setSelectedMetric}
          onChartRangeChange={setChartRangeInMonths}
        />

        <div data-panel-animate>
          <LeadFunnel leads={activeLeads} />
        </div>
        <DashboardDistributionSection
          leadStatusData={leadStatusData}
          donutChartData={donutChartData}
          operadoraChartData={operadoraChartData}
          onLeadStatusSegmentClick={handleLeadStatusSegmentClick}
          onOperadoraSegmentClick={handleOperadoraSegmentClick}
        />

        {!isObserver && (
          <>
            <div
              className="panel-glass-panel rounded-[2rem] border p-6 sm:p-7"
              style={DASHBOARD_SECTION_STYLE}
              data-panel-animate
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <div
                    className="flex items-center gap-2"
                    style={{ color: "var(--panel-text,#1c1917)" }}
                  >
                    <Calendar
                      className="h-5 w-5 flex-shrink-0"
                      style={{ color: "var(--panel-accent-strong,#b85c1f)" }}
                    />
                    <h3
                      className="text-xl font-semibold"
                      style={{ color: "var(--panel-text,#1c1917)" }}
                    >
                      Calendário de eventos
                    </h3>
                  </div>
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--panel-text-muted,#876f5c)" }}
                  >
                    Reajustes e aniversários agrupados pelo período selecionado.
                  </p>
                </div>
                <div
                  className="flex flex-wrap items-center gap-3 text-xs"
                  style={{ color: "var(--panel-text-muted,#876f5c)" }}
                >
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold"
                    style={{
                      ...DASHBOARD_PILL_STYLE,
                      color: "var(--panel-text-soft,#5b4635)",
                    }}
                  >
                    <span style={{ color: "var(--panel-text,#1c1917)" }}>
                      {calendarMonthEventCount}
                    </span>
                    <span>eventos no mês</span>
                  </span>
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold"
                    style={{
                      borderColor: CALENDAR_LEGEND_STYLES.adjustment.border,
                      background: CALENDAR_LEGEND_STYLES.adjustment.background,
                      color: CALENDAR_LEGEND_STYLES.adjustment.text,
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: CALENDAR_LEGEND_STYLES.adjustment.dot,
                      }}
                    />{" "}
                    Reajustes
                  </span>
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold"
                    style={{
                      borderColor: CALENDAR_LEGEND_STYLES.birthday.border,
                      background: CALENDAR_LEGEND_STYLES.birthday.background,
                      color: CALENDAR_LEGEND_STYLES.birthday.text,
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: CALENDAR_LEGEND_STYLES.birthday.dot,
                      }}
                    />{" "}
                    Aniversarios
                  </span>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-stretch">
                <div
                  className="rounded-[1.75rem] border p-4 sm:p-5"
                  style={DASHBOARD_INSET_STYLE}
                >
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth() - 1,
                            1,
                          ),
                        )
                      }
                      variant="icon"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Mês anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h4
                      className="text-sm font-semibold capitalize"
                      style={{ color: "var(--panel-text,#1c1917)" }}
                    >
                      {calendarMonthLabel}
                    </h4>
                    <Button
                      type="button"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth() + 1,
                            1,
                          ),
                        )
                      }
                      variant="icon"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Próximo mês"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <div
                    className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                    style={{ color: "var(--panel-text-muted,#876f5c)" }}
                  >
                    <span>
                      Navegue os meses para consultar reajustes e aniversários.
                    </span>
                    <div
                      className="inline-flex items-center gap-1 rounded-[1rem] border p-1"
                      style={DASHBOARD_PILL_STYLE}
                    >
                      <Button
                        type="button"
                        onClick={() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          setCalendarView("day");
                          setCalendarMonth(
                            new Date(today.getFullYear(), today.getMonth(), 1),
                          );
                          setSelectedCalendarDate(today);
                        }}
                        variant={
                          calendarView === "day" ? "primary" : "secondary"
                        }
                        size="sm"
                        className="h-7 rounded-md px-3 text-[11px]"
                      >
                        Hoje
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          if (!selectedCalendarDate) {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            setSelectedCalendarDate(today);
                          }
                          setCalendarView("week");
                        }}
                        variant={
                          calendarView === "week" ? "primary" : "secondary"
                        }
                        size="sm"
                        className="h-7 rounded-md px-3 text-[11px]"
                      >
                        Semana
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setCalendarView("month")}
                        variant={
                          calendarView === "month" ? "primary" : "secondary"
                        }
                        size="sm"
                        className="h-7 rounded-md px-3 text-[11px]"
                      >
                        Mês
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.weekDays.map((day) => (
                      <div
                        key={day}
                        className="py-1 text-center text-xs font-semibold uppercase tracking-[0.12em]"
                        style={{ color: "var(--panel-text-muted,#876f5c)" }}
                      >
                        {day}
                      </div>
                    ))}
                    {calendarDays.cells}
                  </div>
                </div>

                <div
                  className="flex flex-col rounded-[1.75rem] border p-4 sm:p-5"
                  style={DASHBOARD_MUTED_INSET_STYLE}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div
                        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: "var(--panel-text-muted,#876f5c)" }}
                      >
                        Período selecionado
                      </div>
                      <h4
                        className="mt-1 text-sm font-semibold"
                        style={{ color: "var(--panel-text,#1c1917)" }}
                      >
                        {calendarViewLabel}
                      </h4>
                    </div>
                    <span
                      className="text-xs"
                      style={{ color: "var(--panel-text-muted,#876f5c)" }}
                    >
                      {calendarViewEvents.length} evento
                      {calendarViewEvents.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {calendarViewEvents.length === 0 ? (
                    <div
                      className="flex flex-1 items-center justify-center rounded-[1.4rem] border border-dashed px-4 py-10 text-sm"
                      style={{
                        borderColor: "var(--panel-border-subtle,#e4d5c0)",
                        color: "var(--panel-text-muted,#876f5c)",
                      }}
                    >
                      Nenhum evento no período selecionado.
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                      {calendarViewEvents.map((event) => {
                        if (event.kind === "adjustment") {
                          const adjustment = event.adjustment;
                          const holder = adjustment.contract
                            ? (holderByContractId.get(adjustment.contract.id) ??
                              null)
                            : null;
                          const holderName = holder
                            ? holder.nome_fantasia ||
                              holder.razao_social ||
                              holder.nome_completo
                            : null;
                          const ageBandIndex = adjustment.age
                            ? ageBands.findIndex(
                                (band) =>
                                  adjustment.age! >= band.min &&
                                  (band.max === null ||
                                    adjustment.age! <= band.max),
                              )
                            : -1;
                          const currentAgeBand =
                            ageBandIndex >= 0 ? ageBands[ageBandIndex] : null;
                          const previousAgeBand =
                            ageBandIndex > 0
                              ? ageBands[ageBandIndex - 1]
                              : null;
                          const formatBandLabel = (band: {
                            min: number;
                            max: number | null;
                          }) =>
                            band.max === null
                              ? `${band.min}+`
                              : `${band.min}-${band.max}`;
                          return (
                            <div
                              key={event.id}
                              className="rounded-[1.4rem] border p-4"
                              style={{
                                borderColor:
                                  CALENDAR_LEGEND_STYLES.adjustment.border,
                                background:
                                  "linear-gradient(180deg, color-mix(in srgb, var(--panel-accent-soft,#f6e4c7) 50%, var(--panel-surface,#fffdfa)) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 96%, transparent) 100%)",
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div
                                    className="text-xs font-semibold uppercase tracking-[0.16em]"
                                    style={{
                                      color: "var(--panel-accent-ink,#6f3f16)",
                                    }}
                                  >
                                    Reajuste
                                  </div>
                                  {adjustment.tipo === "idade" ? (
                                    <div>
                                      <p
                                        className="text-sm font-semibold"
                                        style={{
                                          color: "var(--panel-text,#1c1917)",
                                        }}
                                      >
                                        {adjustment.personName}
                                        {adjustment.age &&
                                          ` • ${adjustment.age} anos`}
                                      </p>
                                      <p
                                        className="text-xs"
                                        style={{
                                          color:
                                            "var(--panel-text-muted,#876f5c)",
                                        }}
                                      >
                                        {adjustment.role}
                                      </p>
                                      {currentAgeBand && previousAgeBand && (
                                        <p
                                          className="text-xs"
                                          style={{
                                            color:
                                              "var(--panel-text-muted,#876f5c)",
                                          }}
                                        >
                                          Faixa:{" "}
                                          {formatBandLabel(previousAgeBand)}{" "}
                                          {"->"}{" "}
                                          {formatBandLabel(currentAgeBand)}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <p
                                      className="text-sm font-semibold"
                                      style={{
                                        color: "var(--panel-text,#1c1917)",
                                      }}
                                    >
                                      Reajuste contratual
                                    </p>
                                  )}
                                  {(adjustment.contract || holderName) && (
                                    <div
                                      className="text-xs"
                                      style={{
                                        color:
                                          "var(--panel-text-muted,#876f5c)",
                                      }}
                                    >
                                      {holderName && (
                                        <p>Titular: {holderName}</p>
                                      )}
                                      {adjustment.contract?.modalidade && (
                                        <p>
                                          Modalidade:{" "}
                                          {adjustment.contract.modalidade}
                                        </p>
                                      )}
                                      {adjustment.contract?.responsavel && (
                                        <p>
                                          Responsável:{" "}
                                          {adjustment.contract.responsavel}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div
                                  className="text-right text-xs"
                                  style={{
                                    color: "var(--panel-text-muted,#876f5c)",
                                  }}
                                >
                                  <p
                                    className="font-semibold"
                                    style={{
                                      color: "var(--panel-text,#1c1917)",
                                    }}
                                  >
                                    {adjustment.contract?.codigo_contrato}
                                  </p>
                                  <p>{adjustment.contract?.operadora}</p>
                                </div>
                              </div>
                              <div
                                className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"
                                style={{
                                  borderColor:
                                    "var(--panel-border-subtle,#e4d5c0)",
                                }}
                              >
                                <Button
                                  type="button"
                                  onClick={() =>
                                    handleNavigateToContract(
                                      adjustment.contract,
                                    )
                                  }
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 rounded-md px-3 text-xs"
                                >
                                  Ver contrato
                                </Button>
                                {adjustment.contract?.lead_id && (
                                  <Button
                                    type="button"
                                    onClick={() =>
                                      handleNavigateToLead(
                                        adjustment.contract?.lead_id,
                                      )
                                    }
                                    variant="secondary"
                                    size="sm"
                                    className="h-8 rounded-md px-3 text-xs"
                                  >
                                    Abrir lead
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  onClick={() =>
                                    handleCreateReminderRequest({
                                      contractId: adjustment.contract?.id,
                                      leadId: adjustment.contract?.lead_id,
                                      title:
                                        adjustment.tipo === "idade"
                                          ? `Reajuste por idade - ${adjustment.personName ?? "beneficiário"}`
                                          : `Reajuste anual - ${adjustment.contract?.operadora ?? ""}`,
                                      description: `Data: ${adjustment.date.toLocaleDateString("pt-BR")}`,
                                    })
                                  }
                                  variant="soft"
                                  size="sm"
                                  className="h-8 rounded-md px-3 text-xs"
                                >
                                  Criar lembrete
                                </Button>
                              </div>
                            </div>
                          );
                        }

                        const birthday = event.birthday;

                        return (
                          <div
                            key={event.id}
                            className="rounded-[1.4rem] border p-4"
                            style={{
                              borderColor:
                                CALENDAR_LEGEND_STYLES.birthday.border,
                              background:
                                "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 64%, transparent) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 96%, transparent) 100%)",
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div
                                  className="text-xs font-semibold uppercase tracking-[0.16em]"
                                  style={{
                                    color: "var(--panel-text-soft,#5b4635)",
                                  }}
                                >
                                  Aniversário
                                </div>
                                <p
                                  className="mt-1 text-sm font-semibold"
                                  style={{ color: "var(--panel-text,#1c1917)" }}
                                >
                                  {birthday.nome}
                                </p>
                                <p
                                  className="mt-0.5 text-xs"
                                  style={{
                                    color: "var(--panel-text-muted,#876f5c)",
                                  }}
                                >
                                  {birthday.tipo}
                                  {birthday.tipo === "Dependente" &&
                                    birthday.holder && (
                                      <span
                                        style={{
                                          color:
                                            "var(--panel-text-muted,#876f5c)",
                                        }}
                                      >
                                        {" "}
                                        • Titular:{" "}
                                        {birthday.holder.nome_completo}
                                      </span>
                                    )}
                                </p>
                                {birthday.isPJ &&
                                  birthday.holder &&
                                  (birthday.holder.razao_social ||
                                    birthday.holder.nome_fantasia) && (
                                    <p
                                      className="mt-1 text-xs font-medium"
                                      style={{
                                        color:
                                          "var(--panel-accent-strong,#b85c1f)",
                                      }}
                                    >
                                      {birthday.holder.razao_social ||
                                        birthday.holder.nome_fantasia}
                                    </p>
                                  )}
                              </div>
                              <div
                                className="text-right text-xs"
                                style={{
                                  color: "var(--panel-text-muted,#876f5c)",
                                }}
                              >
                                <p
                                  className="font-semibold"
                                  style={{ color: "var(--panel-text,#1c1917)" }}
                                >
                                  {birthday.nextBirthday.toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </p>
                              </div>
                            </div>
                            {birthday.contract && (
                              <div
                                className="mt-2 border-t pt-2"
                                style={{
                                  borderColor:
                                    "var(--panel-border-subtle,#e4d5c0)",
                                }}
                              >
                                <p
                                  className="text-xs"
                                  style={{
                                    color: "var(--panel-text-muted,#876f5c)",
                                  }}
                                >
                                  <span className="font-medium">Contrato:</span>{" "}
                                  {birthday.contract.codigo_contrato}
                                </p>
                                <p
                                  className="text-xs"
                                  style={{
                                    color: "var(--panel-text-muted,#876f5c)",
                                  }}
                                >
                                  <span className="font-medium">
                                    Operadora:
                                  </span>{" "}
                                  {birthday.contract.operadora}
                                </p>
                              </div>
                            )}
                            <div
                              className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"
                              style={{
                                borderColor:
                                  "var(--panel-border-subtle,#e4d5c0)",
                              }}
                            >
                              {birthday.contract && (
                                <Button
                                  type="button"
                                  onClick={() =>
                                    handleNavigateToContract(birthday.contract)
                                  }
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 rounded-md px-3 text-xs"
                                >
                                  Ver contrato
                                </Button>
                              )}
                              {birthday.contract?.lead_id && (
                                <Button
                                  type="button"
                                  onClick={() =>
                                    handleNavigateToLead(
                                      birthday.contract?.lead_id,
                                    )
                                  }
                                  variant="secondary"
                                  size="sm"
                                  className="h-8 rounded-md px-3 text-xs"
                                >
                                  Abrir lead
                                </Button>
                              )}
                              <Button
                                type="button"
                                onClick={() =>
                                  handleCreateReminderRequest({
                                    contractId: birthday.contract?.id,
                                    leadId: birthday.contract?.lead_id,
                                    title: `Aniversário de ${birthday.nome}`,
                                    description: `Data: ${birthday.nextBirthday.toLocaleDateString("pt-BR")}`,
                                  })
                                }
                                variant="warning"
                                size="sm"
                                className="h-8 rounded-md px-3 text-xs"
                              >
                                Criar lembrete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        <DashboardHeroCard />

        {selectedContract && (
          <ContractDetails
            contract={selectedContract}
            onClose={() => setSelectedContract(null)}
            onUpdate={loadData}
          />
        )}

        {selectedLeadWithRelations && (
          <LeadDetails
            lead={selectedLeadWithRelations}
            onClose={() => setSelectedLead(null)}
            onUpdate={loadData}
            onEdit={(lead) => {
              setEditingLead(lead);
              setShowLeadForm(true);
            }}
          />
        )}

        {showLeadForm && (
          <LeadForm
            lead={editingLead}
            onClose={() => {
              setShowLeadForm(false);
              setEditingLead(null);
            }}
            onSave={(_lead) => {
              setShowLeadForm(false);
              setEditingLead(null);
              loadData();
            }}
          />
        )}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
