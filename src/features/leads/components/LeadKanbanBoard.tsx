import { Text, Heading, FieldLabel } from '../../../design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Calendar, FileText, Mail, Phone, UserCircle, Users } from "lucide-react";

import { useAuth } from "../../../contexts/AuthContext";
import { useConfig } from "../../../contexts/ConfigContext";
import { LeadFavoriteToggle } from "../../../components/LeadFavoriteStar";
import {
  ActionSurface,
  Alert,
  Button,
  EmptyState,
  Input,
  LoadingState,
  RecordActions,
  OperationalMetricChip,
  OperationalStatusDot,
  Surface,
} from "../../../design-system";
import { formatDateTimeFullBR } from "../../../lib/dateUtils";
import { toast } from "../../../lib/toast";
import type { Lead } from "../domain/types";
import {
  listLeadsByStatuses,
  subscribeToLeadChanges,
} from "../data/leadsRepository";

type LeadKanbanBoardProps = {
  onLeadClick?: (lead: Lead) => void;
  onConvertToContract?: (lead: Lead) => void;
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  leads?: Lead[];
};

export default function LeadKanbanBoard({
  onLeadClick,
  onConvertToContract,
  onStatusChange,
  leads,
}: LeadKanbanBoardProps) {
  const { leadStatuses, leadOrigins } = useConfig();
  const { isObserver } = useAuth();
  const [localLeads, setLocalLeads] = useState<Lead[]>(leads ?? []);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [wipLimits, setWipLimits] = useState<Record<string, number>>({});
  const loadLeadsRequestIdRef = useRef(0);

  const statusColumns = useMemo(
    () =>
      leadStatuses
        .filter((status) => status.ativo)
        .sort((a, b) => a.ordem - b.ordem),
    [leadStatuses],
  );
  const leadsByStatusName = useMemo(() => {
    const grouped = new Map<string, Lead[]>();

    statusColumns.forEach((status) => {
      grouped.set(status.nome, []);
    });

    localLeads.forEach((lead) => {
      if (!lead.status) {
        return;
      }

      const current = grouped.get(lead.status);
      if (current) {
        current.push(lead);
      }
    });

    return grouped;
  }, [localLeads, statusColumns]);

  const restrictedOriginIdsForObservers = useMemo(
    () =>
      leadOrigins
        .filter((origin) => origin.visivel_para_observadores === false)
        .map((origin) => origin.id),
    [leadOrigins],
  );

  const getResponsavelLabel = (lead: Lead): string =>
    lead.responsavel || "Não definido";

  const isOriginVisibleToObserver = useCallback(
    (origem: string | null | undefined) => {
      if (!origem) {
        return true;
      }
      const originObj = leadOrigins.find((origin) => origin.nome === origem);
      if (!originObj) return true;
      return !restrictedOriginIdsForObservers.includes(originObj.id);
    },
    [restrictedOriginIdsForObservers, leadOrigins],
  );

  const loadLeads = useCallback(async () => {
    const requestId = ++loadLeadsRequestIdRef.current;

    if (leads) {
      setLocalLeads(leads);
      setLoadError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (statusColumns.length === 0) {
        setLocalLeads([]);
        setLoadError(null);
        return;
      }

      const data = await listLeadsByStatuses(statusColumns.map((column) => column.nome));

      if (requestId !== loadLeadsRequestIdRef.current) {
        return;
      }

      let fetchedLeads: Lead[] = data || [];

      if (isObserver) {
        fetchedLeads = fetchedLeads.filter((lead) =>
          isOriginVisibleToObserver(lead.origem),
        );
      }

      setLocalLeads(fetchedLeads);
      setLoadError(null);
    } catch (error) {
      if (requestId !== loadLeadsRequestIdRef.current) {
        return;
      }
      console.error("Erro ao carregar leads:", error);
      setLoadError("Não foi possível carregar os leads do Kanban agora.");
    } finally {
      if (requestId === loadLeadsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [isObserver, isOriginVisibleToObserver, leads, statusColumns]);

  useEffect(() => {
    void loadLeads();

    if (leads) {
      return () => {
        loadLeadsRequestIdRef.current += 1;
      };
    }

    const unsubscribe = subscribeToLeadChanges(() => {
      void loadLeads();
    });

    return () => {
      loadLeadsRequestIdRef.current += 1;
      unsubscribe();
    };
  }, [leads, loadLeads]);

  useEffect(() => {
    if (leads) {
      setLocalLeads(leads);
      setLoadError(null);
      setLoading(false);
    }
  }, [leads]);

  useEffect(() => {
    const stored = localStorage.getItem("leads.kanban.wip.v1");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Record<string, number>;
      setWipLimits(parsed || {});
    } catch (error) {
      console.error("Erro ao carregar limites do Kanban:", error);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      localStorage.setItem("leads.kanban.wip.v1", JSON.stringify(wipLimits));
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [wipLimits]);

  const handleDrop = async (newStatusId: string) => {
    if (!draggedLead) {
      setDraggedLead(null);
      return;
    }

    const lead = draggedLead;
    const oldStatusName = lead.status;
    const newStatusObj = statusColumns.find((status) => status.id === newStatusId);
    if (!newStatusObj) {
      setDraggedLead(null);
      toast.error("Não foi possível identificar o novo status do lead.");
      return;
    }

    const newStatusName = newStatusObj.nome;

    if (oldStatusName === newStatusName) {
      setDraggedLead(null);
      return;
    }

    setDraggedLead(null);

    try {
      await onStatusChange(lead.id, newStatusName);
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const getWipLimit = (statusId: string) => wipLimits[statusId] ?? 0;

  const updateWipLimit = (statusId: string, value: number) => {
    setWipLimits((current) => ({
      ...current,
      [statusId]: Math.max(0, value),
    }));
  };

  if (loading && localLeads.length === 0) {
    return (
      <Surface className="py-12">
        <LoadingState label="Carregando Kanban" />
      </Surface>
    );
  }

  if (statusColumns.length === 0) {
    return (
      <Surface className="py-12 text-center">
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Configure os status do funil"
          description="Adicione status ativos para visualizar o Kanban e distribuir a operação por etapa."
          className="mx-auto max-w-xl"
        />
      </Surface>
    );
  }

  return (
    <Surface className="kds-kanban-board p-4 sm:p-5">
      {loadError && (
        <Alert
          tone="danger"
          title="Não foi possível atualizar o Kanban"
          action={(
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void loadLeads()}
              loading={loading}
            >
              Tentar novamente
            </Button>
          )}
          className="mb-5"
        >
          Os leads já carregados foram preservados. Tente novamente para atualizar as colunas.
        </Alert>
      )}
      <div className="kds-kanban-header mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Text className="kds-op-section-label">
            Funil visual
          </Text>
          <Heading level={3} className="kds-op-panel-title mt-2">
            Contatos por etapa
          </Heading>
          <Text className="kds-op-lead-muted mt-1 text-sm">
            Arraste os cards entre etapas para atualizar o status.
          </Text>
        </div>

        <div className="kds-kanban-summary flex flex-wrap gap-2">
          <OperationalMetricChip value={statusColumns.length} label="etapas ativas" />
          <OperationalMetricChip value={localLeads.length} label="leads visíveis" />
        </div>
      </div>

      <div className="kds-kanban-workspace">
        <div className="kds-kanban-scroll overflow-x-auto pb-4 snap-x snap-mandatory">
          <div className="kds-kanban-track">
            {statusColumns.map((column) => {
              const columnLeads = leadsByStatusName.get(column.nome) ?? [];
              const chipColor = column.cor || "var(--brand-primary)";
              const wipLimit = getWipLimit(column.id);
              const isOverLimit = wipLimit > 0 && columnLeads.length > wipLimit;

              return (
                <div
                  key={column.id}
                  className={`kds-kanban-column w-80 flex-shrink-0 snap-start rounded-2xl p-3 ${
                    isOverLimit
                      ? "border border-[var(--danger-border)] bg-[var(--danger-soft)]"
                      : "bg-[var(--bg-surface)]"
                  }`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => void handleDrop(column.id)}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <OperationalStatusDot statusColor={chipColor} />
                        <Heading level={4}
                          className="kds-kanban-column-title truncate"
                        >
                          {column.nome}
                        </Heading>
                      </div>
                      {wipLimit > 0 && (
                        <Text className={isOverLimit ? "kds-op-lead-danger mt-1 text-xs font-medium" : "kds-op-lead-muted mt-1 text-xs font-medium"}>
                          Limite WIP: {wipLimit}
                        </Text>
                      )}
                    </div>

                    <OperationalMetricChip value={columnLeads.length} active={isOverLimit} tone={isOverLimit ? "danger" : "neutral"} />
                  </div>

                  <div className="kds-kanban-wip">
                    <FieldLabel className="flex items-center justify-between gap-3 px-3 py-2 text-xs font-medium">
                      <span className="kds-op-lead-muted">
                        Limite WIP
                      </span>
                      <div className="w-20">
                        <Input
                          type="number"
                          aria-label={`Limite WIP de ${column.nome}`}
                          min={0}
                          value={wipLimit}
                          onChange={(event) =>
                            updateWipLimit(column.id, Number(event.target.value))
                          }
                          size="sm"
                          className="text-right"
                        />
                      </div>
                    </FieldLabel>
                  </div>

                  <div className="kds-kanban-column-body space-y-3 overflow-y-auto pr-1">
                    {columnLeads.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-hover)] px-4 py-8 text-center">
                        <Users className="mx-auto mb-2 h-8 w-8 opacity-70" />
                        <Text className="text-sm font-medium">Nenhum lead</Text>
                      </div>
                    ) : (
                      columnLeads.map((lead) => {
                        const responsavelLabel = getResponsavelLabel(lead);

                        return (
                          <Surface
                            key={lead.id}
                            padding="sm"
                            draggable
                            onDragStart={() => setDraggedLead(lead)}
                            className="kds-kanban-card cursor-move transition-colors"
                          >
                            <div className="kds-kanban-card-heading">
                              <LeadFavoriteToggle
                                leadId={lead.id}
                                favorito={Boolean(lead.favorito)}
                                size="sm"
                                onToggled={(next) => {
                                  loadLeadsRequestIdRef.current += 1;
                                  setLocalLeads((current) => current.map((item) => item.id === lead.id ? { ...item, favorito: next } : item));
                                }}
                              />
                              <ActionSurface variant="plain" padding="none" onClick={() => onLeadClick?.(lead)} aria-label={`Abrir detalhes de ${lead.nome_completo}`}>
                                <Heading level={5} className="kds-op-lead-title">{lead.nome_completo}</Heading>
                              </ActionSurface>
                            </div>
                            <div className="kds-op-lead-meta space-y-2">
                              {lead.telefone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{lead.telefone}</span></div>}
                              {lead.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate" title={lead.email}>{lead.email}</span></div>}
                              <div className="flex items-center gap-2"><UserCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>{responsavelLabel}</span></div>
                              {lead.proximo_retorno && <div className="kds-op-lead-accent flex items-center gap-2"><Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>{formatDateTimeFullBR(lead.proximo_retorno)}</span></div>}
                            </div>
                            <div className="kds-kanban-card-footer">
                              <div className="min-w-0">
                                <span className="block truncate">{lead.origem || 'Sem origem'}</span>
                                {lead.data_criacao && <span className="block">{new Date(lead.data_criacao).toLocaleDateString('pt-BR')}</span>}
                              </div>
                              <RecordActions label="Ações do lead" actions={[
                                { label: 'Abrir detalhes do lead', icon: ArrowRight, onClick: () => onLeadClick?.(lead) },
                                ...(onConvertToContract ? [{ label: 'Converter em contrato', icon: FileText, onClick: () => onConvertToContract(lead) }] : []),
                              ]} />
                            </div>
                          </Surface>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Surface>
  );
}
