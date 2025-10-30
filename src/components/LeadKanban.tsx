import { useState, useEffect } from 'react';
import { supabase, Lead } from '../lib/supabase';
import { Users, Phone, Mail, Calendar } from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';

type LeadKanbanProps = {
  onLeadClick?: (lead: Lead) => void;
  onConvertToContract?: (lead: Lead) => void;
};

const STATUS_COLUMNS = [
  { id: 'Novo', label: 'Novo', color: 'bg-blue-500' },
  { id: 'Contato iniciado', label: 'Contato Iniciado', color: 'bg-yellow-500' },
  { id: 'Em atendimento', label: 'Em Atendimento', color: 'bg-cyan-500' },
  { id: 'Cotando', label: 'Cotando', color: 'bg-orange-500' },
  { id: 'Proposta enviada', label: 'Proposta Enviada', color: 'bg-teal-500' },
  { id: 'Fechado', label: 'Fechado', color: 'bg-green-500' },
];

export default function LeadKanban({ onLeadClick, onConvertToContract }: LeadKanbanProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  useEffect(() => {
    loadLeads();

    const channel = supabase
      .channel('kanban-leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: 'arquivado=eq.false'
        },
        () => {
          loadLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false)
        .in('status', STATUS_COLUMNS.map(c => c.id))
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (newStatus: string) => {
    if (!draggedLead || draggedLead.status === newStatus) {
      setDraggedLead(null);
      return;
    }

    const oldStatus = draggedLead.status;

    setLeads((current) =>
      current.map((l) =>
        l.id === draggedLead.id
          ? { ...l, status: newStatus, ultimo_contato: new Date().toISOString() }
          : l
      )
    );

    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          status: newStatus,
          ultimo_contato: new Date().toISOString(),
        })
        .eq('id', draggedLead.id);

      if (updateError) throw updateError;

      await supabase
        .from('interactions')
        .insert([{
          lead_id: draggedLead.id,
          tipo: 'Observação',
          descricao: `Status alterado de "${oldStatus}" para "${newStatus}" (via Kanban)`,
          responsavel: draggedLead.responsavel,
        }]);

      await supabase
        .from('lead_status_history')
        .insert([{
          lead_id: draggedLead.id,
          status_anterior: oldStatus,
          status_novo: newStatus,
          responsavel: draggedLead.responsavel,
        }]);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do lead');
      setLeads((current) =>
        current.map((l) =>
          l.id === draggedLead.id ? { ...l, status: oldStatus } : l
        )
      );
    }

    setDraggedLead(null);
  };

  const getLeadsByStatus = (status: string) => {
    return leads.filter((lead) => lead.status === status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex space-x-4 min-w-max">
        {STATUS_COLUMNS.map((column) => {
          const columnLeads = getLeadsByStatus(column.id);

          return (
            <div
              key={column.id}
              className="flex-shrink-0 w-80 bg-slate-50 rounded-xl p-4"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                  <h3 className="font-semibold text-slate-900">{column.label}</h3>
                </div>
                <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2 py-1 rounded-full">
                  {columnLeads.length}
                </span>
              </div>

              <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                {columnLeads.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum lead</p>
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead)}
                      onClick={() => onLeadClick && onLeadClick(lead)}
                      className="bg-white rounded-lg p-4 border border-slate-200 hover:shadow-md transition-all cursor-move"
                    >
                      <h4 className="font-semibold text-slate-900 mb-2 truncate">
                        {lead.nome_completo}
                      </h4>

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
                            <span className="truncate text-xs">
                              {formatDateTimeFullBR(lead.proximo_retorno)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded font-medium">
                          {lead.origem}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {lead.responsavel}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
