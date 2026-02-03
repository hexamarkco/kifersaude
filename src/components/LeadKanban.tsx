import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, Lead, fetchAllPages } from '../lib/supabase';
import { Users, Phone, Mail, Calendar } from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';

type LeadKanbanProps = {
  onLeadClick?: (lead: Lead) => void;
  onConvertToContract?: (lead: Lead) => void;
  leads?: Lead[];
};

export default function LeadKanban({ onLeadClick, onConvertToContract, leads }: LeadKanbanProps) {
  const { leadStatuses, leadOrigins } = useConfig();
  const { isObserver } = useAuth();
  const [localLeads, setLocalLeads] = useState<Lead[]>(leads ?? []);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [wipLimits, setWipLimits] = useState<Record<string, number>>({});

  const statusColumns = useMemo(
    () => leadStatuses.filter((status) => status.ativo).sort((a, b) => a.ordem - b.ordem),
    [leadStatuses],
  );

  const restrictedOriginIdsForObservers = useMemo(
    () =>
      leadOrigins
        .filter((origin) => origin.visivel_para_observadores === false)
        .map((origin) => origin.id),
    [leadOrigins],
  );

  const getResponsavelLabel = (lead: Lead): string => {
    return lead.responsavel || 'Não definido';
  };

  const isOriginVisibleToObserver = useCallback(
    (origem: string | null | undefined) => {
      if (!origem) {
        return true;
      }
      const originObj = leadOrigins.find(o => o.nome === origem);
      if (!originObj) return true;
      return !restrictedOriginIdsForObservers.includes(originObj.id);
    },
    [restrictedOriginIdsForObservers, leadOrigins],
  );

  const loadLeads = useCallback(async () => {
    if (leads) {
      setLocalLeads(leads);
      return;
    }
    setLoading(true);
    try {
      if (statusColumns.length === 0) {
        setLocalLeads([]);
        setLoading(false);
        return;
      }

      const data = await fetchAllPages<Lead>((from, to) =>
        (supabase
          .from('leads')
          .select('*')
          .eq('arquivado', false)
          .in(
            'status',
            statusColumns.map((column) => column.nome),
          )
          .order('created_at', { ascending: false })
          .range(from, to) as unknown as Promise<{ data: Lead[] | null; error: unknown }>),
      );

      let fetchedLeads: Lead[] = (data as Lead[]) || [];

      if (isObserver) {
        fetchedLeads = fetchedLeads.filter((lead) =>
          isOriginVisibleToObserver(lead.origem),
        );
      }

      setLocalLeads(fetchedLeads);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  }, [isObserver, isOriginVisibleToObserver, leads, statusColumns]);

  useEffect(() => {
    loadLeads();

    if (leads) {
      return;
    }

    const channel = supabase
      .channel('kanban-leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: 'arquivado=eq.false',
        },
        () => {
          loadLeads();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLeads]);

  useEffect(() => {
    if (leads) {
      setLocalLeads(leads);
      setLoading(false);
    }
  }, [leads]);

  useEffect(() => {
    const stored = localStorage.getItem('leads.kanban.wip.v1');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Record<string, number>;
      setWipLimits(parsed || {});
    } catch (error) {
      console.error('Erro ao carregar limites do Kanban:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('leads.kanban.wip.v1', JSON.stringify(wipLimits));
  }, [wipLimits]);

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = async (newStatusId: string) => {
    if (!draggedLead) {
      setDraggedLead(null);
      return;
    }

    const oldStatusName = draggedLead.status;
    const newStatusObj = statusColumns.find((s) => s.id === newStatusId);
    const newStatusName = newStatusObj?.nome ?? 'Desconhecido';

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
        .from('leads')
        .update({
          status: newStatusName,
          ultimo_contato: nowIso,
        })
        .eq('id', draggedLead.id);

      if (updateError) throw updateError;

      await supabase.from('interactions').insert([
        {
          lead_id: draggedLead.id,
          tipo: 'Observação',
          descricao: `Status alterado de "${oldStatusName}" para "${newStatusName}" (via Kanban)`,
          responsavel: responsavelLabel,
        },
      ]);

      await supabase.from('lead_status_history').insert([
        {
          lead_id: draggedLead.id,
          status_anterior: oldStatusName,
          status_novo: newStatusName,
          responsavel: responsavelLabel,
        },
      ]);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do lead');
      setLocalLeads((current) =>
        current.map((lead) =>
          lead.id === draggedLead.id
            ? { ...lead, status: oldStatusName }
            : lead,
        ),
      );
    }

    setDraggedLead(null);
  };

  const getLeadsByStatus = (statusId: string) => {
    const statusObj = statusColumns.find((s) => s.id === statusId);
    const statusName = statusObj?.nome;
    return localLeads.filter(
      (lead) => lead.status === statusName && !lead.arquivado,
    );
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  if (statusColumns.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
        Configure os status do funil para visualizar o Kanban.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4 snap-x snap-mandatory">
      <div className="flex space-x-4 min-w-max">
        {statusColumns.map((column) => {
          const columnLeads = getLeadsByStatus(column.id);
          const chipColor = column.cor || '#2563eb';
          const wipLimit = getWipLimit(column.id);
          const isOverLimit = wipLimit > 0 && columnLeads.length > wipLimit;
          return (
            <div
              key={column.id}
              className={`flex-shrink-0 w-80 bg-slate-50 rounded-xl p-4 snap-start ${
                isOverLimit ? 'ring-2 ring-red-300' : ''
              }`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: chipColor }}
                  ></div>
                  <h3 className="font-semibold text-slate-900">{column.nome}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {wipLimit > 0 && (
                    <span
                      className={`text-[11px] font-semibold ${
                        isOverLimit ? 'text-red-600' : 'text-slate-500'
                      }`}
                    >
                      Limite {wipLimit}
                    </span>
                  )}
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      isOverLimit ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {columnLeads.length}
                  </span>
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                <span>Limite WIP</span>
                <input
                  type="number"
                  min={0}
                  value={wipLimit}
                  onChange={(event) => updateWipLimit(column.id, Number(event.target.value))}
                  className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 focus:border-teal-400 focus:ring-1 focus:ring-teal-400"
                />
              </div>

              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {columnLeads.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum lead</p>
                  </div>
                ) : (
                  columnLeads.map((lead) => {
                    const responsavelLabel = getResponsavelLabel(lead);

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead)}
                        onClick={() => onLeadClick && onLeadClick(lead)}
                        className="bg-white rounded-lg p-4 border border-slate-200 hover:shadow-md transition-all cursor-move"
                      >
                        <div className="mb-2">
                          <h4 className="font-semibold text-slate-900 truncate">
                            {lead.nome_completo}
                          </h4>
                        </div>

                        <div className="space-y-1.5 text-sm text-slate-600 mb-3">
                          <div className="flex items-center space-x-2">
                            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{lead.telefone}</span>
                          </div>
                          {lead.email && (
                            <div className="flex items-center space-x-2">
                              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{lead.email}</span>
                            </div>
                          )}
                          {lead.proximo_retorno && (
                            <div className="flex items-center space-x-2 text-orange-600">
                              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>{formatDateTimeFullBR(lead.proximo_retorno)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            Responsável:{' '}
                            <strong className="text-slate-700">
                              {responsavelLabel}
                            </strong>
                          </span>
                          <span>
                            {lead.data_criacao
                              ? new Date(lead.data_criacao).toLocaleDateString('pt-BR')
                              : ''}
                          </span>
                        </div>

                        {onConvertToContract && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onConvertToContract(lead);
                            }}
                            className="mt-3 w-full text-xs font-semibold text-teal-600 border border-teal-200 rounded-lg py-1.5 hover:bg-teal-50 transition-colors"
                          >
                            Converter em contrato
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
