import { Text, Heading, FieldLabel } from '../../../design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Calendar, FileText, Plus, Users } from "lucide-react";

import { useAuth } from "../../../contexts/AuthContext";
import { useConfig } from "../../../contexts/ConfigContext";
import { LeadFavoriteToggle } from "../../../components/LeadFavoriteStar";
import {
  ActionSurface,
  Alert,
  Badge,
  Button,
  EmptyState,
  Input,
  LoadingState, Skeleton,
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
  onCreateLead?: (status: string) => void;
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  leads?: Lead[];
};

export default function LeadKanbanBoard({
  onLeadClick,
  onConvertToContract,
  onCreateLead,
  onStatusChange,
  leads,
}: LeadKanbanBoardProps) {
  const { leadStatuses, leadOrigins, getRoleModulePermission } = useConfig();
  const { isObserver, role } = useAuth();
  const canMoveLead = !isObserver && getRoleModulePermission(role, 'leads').can_edit;
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
    if (!draggedLead || !canMoveLead) {
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
        <LoadingState label="Carregando Kanban" placeholder={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} variant="card" className="h-64" />)}</div>} />
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
                  className={`kds-kanban-column flex-shrink-0 snap-start ${
                    isOverLimit
                      ? "border border-[var(--danger-border)] bg-[var(--danger-soft)]"
                      : "bg-[var(--bg-surface)]"
                  }`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => void handleDrop(column.id)}
                >
                  <div className="kds-kanban-column-heading flex items-start justify-between gap-2">
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
                            draggable={canMoveLead}
                            onDragStart={() => { if (canMoveLead) setDraggedLead(lead); }}
                            onDragEnd={() => setDraggedLead(null)}
                            className={`kds-kanban-card transition-colors${canMoveLead ? " cursor-move" : ""}`}
                          >
                            <div className="kds-kanban-card-heading">
                              <ActionSurface variant="plain" padding="none" onClick={() => onLeadClick?.(lead)} aria-label={`Abrir detalhes de ${lead.nome_completo}`}><Heading level={5} className="kds-op-lead-title">{lead.nome_completo}</Heading></ActionSurface>
                              <LeadFavoriteToggle leadId={lead.id} favorito={Boolean(lead.favorito)} size="sm" onToggled={(next) => { loadLeadsRequestIdRef.current += 1; setLocalLeads((current) => current.map((item) => item.id === lead.id ? { ...item, favorito: next } : item)); }} />
                            </div>
                            <Text className="kds-record-row-secondary">{[lead.cidade, lead.tipo_contratacao].filter(Boolean).join(' · ') || 'Perfil não informado'}</Text>
                            {lead.tags?.length ? <div className="kds-kanban-card-tags">{lead.tags.map((tag) => <Badge key={tag} tone="neutral" size="sm">{tag}</Badge>)}</div> : null}
                            <div className="kds-kanban-card-contact"><Text className="kds-record-row-name">{lead.telefone || lead.email || 'Sem contato'}</Text>{lead.responsavel && <span className="kds-record-owner" title={responsavelLabel}><span className="kds-record-row-secondary">{responsavelLabel}</span></span>}</div>
                            <div className="kds-kanban-card-footer">
                              <span className="kds-record-date">{lead.proximo_retorno ? <><Calendar aria-hidden="true" />{formatDateTimeFullBR(lead.proximo_retorno)}</> : 'Sem retorno'}</span>
                              <span className="truncate" title={lead.origem || undefined}>{lead.origem || 'Sem origem'}</span>
                              <RecordActions visibleCount={0} label="Ações do lead" actions={[{ label: 'Abrir detalhes do lead', icon: ArrowRight, onClick: () => onLeadClick?.(lead) }, ...(onConvertToContract ? [{ label: 'Converter em contrato', icon: FileText, onClick: () => onConvertToContract(lead) }] : [])]} />
                            </div>
                          </Surface>
                        );
                      })
                    )}
                  </div>
                  {onCreateLead && <Button variant="text" size="sm" onClick={() => onCreateLead(column.nome)} className="kds-kanban-add-lead"><Plus className="kds-control-icon" aria-hidden="true" />Adicionar lead</Button>}
                  <details className="kds-kanban-wip">
                    <summary>Limite WIP</summary>
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
                  </details>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Surface>
  );
}
