import { useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";

import { useAuth } from "../../../contexts/AuthContext";
import { useConfig } from "../../../contexts/ConfigContext";
import { Badge, Surface } from "../../../design-system";
import { supabase, Lead, fetchAllPages } from "../../../lib/supabase";
import { toast } from "../../../lib/toast";
import { KanbanColumn } from "./KanbanColumn";

type LeadKanbanBoardProps = {
  onLeadClick?: (lead: Lead) => void;
  onConvertToContract?: (lead: Lead) => void;
  leads?: Lead[];
};

export default function LeadKanbanBoard({
  onLeadClick,
  onConvertToContract,
  leads,
}: LeadKanbanBoardProps) {
  const { leadStatuses, leadOrigins } = useConfig();
  const { isObserver } = useAuth();
  const [localLeads, setLocalLeads] = useState<Lead[]>(leads ?? []);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [wipLimits, setWipLimits] = useState<Record<string, number>>({});

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
      if (lead.arquivado || !lead.status) {
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
    lead.responsavel || "Nao definido";

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
    if (leads) {
      setLocalLeads(leads);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (statusColumns.length === 0) {
        setLocalLeads([]);
        return;
      }

      const data = await fetchAllPages<Lead>((from, to) =>
        supabase
          .from("leads")
          .select('id, nome_completo, telefone, email, status, origem, responsavel, arquivado, proximo_retorno, data_criacao')
          .eq("arquivado", false)
          .in(
            "status",
            statusColumns.map((column) => column.nome),
          )
          .order("created_at", { ascending: false })
          .range(from, to) as unknown as Promise<{
          data: Lead[] | null;
          error: unknown;
        }>,
      );

      let fetchedLeads: Lead[] = data || [];

      if (isObserver) {
        fetchedLeads = fetchedLeads.filter((lead) =>
          isOriginVisibleToObserver(lead.origem),
        );
      }

      setLocalLeads(fetchedLeads);
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    } finally {
      setLoading(false);
    }
  }, [isObserver, isOriginVisibleToObserver, leads, statusColumns]);

  useEffect(() => {
    void loadLeads();

    if (leads) {
      return;
    }

    const channel = supabase
      .channel("kanban-leads-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: "arquivado=eq.false",
        },
        () => {
          void loadLeads();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leads, loadLeads]);

  useEffect(() => {
    if (leads) {
      setLocalLeads(leads);
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

    const oldStatusName = draggedLead.status;
    const newStatusObj = statusColumns.find((status) => status.id === newStatusId);
    const newStatusName = newStatusObj?.nome ?? "Desconhecido";

    if (oldStatusName === newStatusName) {
      setDraggedLead(null);
      return;
    }

    const nowIso = new Date().toISOString();
    const responsavelLabel = getResponsavelLabel(draggedLead);

    setLocalLeads((current) =>
      current.map((lead) =>
        lead.id === draggedLead.id
          ? { ...lead, status: newStatusName, ultimo_contato: nowIso }
          : lead,
      ),
    );

    try {
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          status: newStatusName,
          ultimo_contato: nowIso,
        })
        .eq("id", draggedLead.id);

      if (updateError) throw updateError;

      await supabase.from("interactions").insert([
        {
          lead_id: draggedLead.id,
          tipo: "Observacao",
          descricao: `Status alterado de "${oldStatusName}" para "${newStatusName}" (via Kanban)`,
          responsavel: responsavelLabel,
        },
      ]);

      await supabase.from("lead_status_history").insert([
        {
          lead_id: draggedLead.id,
          status_anterior: oldStatusName,
          status_novo: newStatusName,
          responsavel: responsavelLabel,
        },
      ]);
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status do lead.");
      setLocalLeads((current) =>
        current.map((lead) =>
          lead.id === draggedLead.id ? { ...lead, status: oldStatusName } : lead,
        ),
      );
    }

    setDraggedLead(null);
  };

  const getWipLimit = (statusId: string) => wipLimits[statusId] ?? 0;

  const updateWipLimit = (statusId: string, value: number) => {
    setWipLimits((current) => ({
      ...current,
      [statusId]: Math.max(0, value),
    }));
  };

  if (loading) {
    return (
      <Surface className="py-12">
        <div className="flex items-center justify-center">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
            style={{
              borderColor: "var(--panel-accent-strong)",
              borderTopColor: "transparent",
            }}
          />
        </div>
      </Surface>
    );
  }

  if (statusColumns.length === 0) {
    return (
      <Surface className="py-12 text-center">
        <Surface
          variant="muted"
          className="mx-auto flex max-w-xl flex-col items-center border-dashed px-6 py-10 text-center"
        >
          <Users className="mb-4 h-12 w-12" />
          <h3
            className="text-lg font-semibold"
            style={{ color: "var(--panel-text)" }}
          >
            Configure os status do funil
          </h3>
          <p className="mt-2 text-sm">
            Adicione status ativos para visualizar o Kanban e distribuir a
            operacao por etapa.
          </p>
        </Surface>
      </Surface>
    );
  }

  return (
    <Surface className="p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p
            className="text-[11px] font-black uppercase tracking-[0.24em]"
            style={{ color: "var(--panel-text-muted)" }}
          >
            Funil visual
          </p>
          <h3
            className="mt-2 text-xl font-semibold"
            style={{ color: "var(--panel-text)" }}
          >
            Pipeline por status
          </h3>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--panel-text-muted)" }}
          >
            Arraste cards entre colunas para atualizar o status sem sair da
            visao do funil.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral" className="gap-2">
            <span style={{ color: "var(--panel-text)" }}>
              {statusColumns.length}
            </span>
            <span>etapas ativas</span>
          </Badge>
          <Badge tone="neutral" className="gap-2">
            <span style={{ color: "var(--panel-text)" }}>
              {localLeads.length}
            </span>
            <span>leads visiveis</span>
          </Badge>
        </div>
      </div>

      <Surface variant="muted" padding="sm" className="p-3 sm:p-4">
        <div className="overflow-x-auto pb-4 snap-x snap-mandatory">
          <div className="flex min-w-max gap-4">
            {statusColumns.map((column) => {
              const columnLeads = leadsByStatusName.get(column.nome) ?? [];
              const chipColor = column.cor || "var(--panel-accent-strong)";
              const wipLimit = getWipLimit(column.id);
              const isOverLimit = wipLimit > 0 && columnLeads.length > wipLimit;

              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  leads={columnLeads}
                  wipLimit={wipLimit}
                  isOverLimit={isOverLimit}
                  chipColor={chipColor}
                  onDrop={handleDrop}
                  onDragStart={setDraggedLead}
                  onUpdateWipLimit={updateWipLimit}
                  onLeadClick={onLeadClick}
                  onConvertToContract={onConvertToContract}
                  getResponsavelLabel={getResponsavelLabel}
                />
              );
            })}
          </div>
        </div>
      </Surface>
    </Surface>
  );
}
