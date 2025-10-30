import { useEffect, useState } from 'react';
import { supabase, Lead } from '../lib/supabase';
import { Plus, Search, Filter, MessageCircle, Archive, FileText, Calendar, Phone, Users, LayoutGrid, List } from 'lucide-react';
import LeadForm from './LeadForm';
import LeadDetails from './LeadDetails';
import StatusDropdown from './StatusDropdown';
import FollowUpScheduler from './FollowUpScheduler';
import LeadKanban from './LeadKanban';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { createAutomaticFollowUps, cancelFollowUps } from '../lib/followUpService';
import { openWhatsAppInBackgroundTab } from '../lib/whatsappService';

type LeadsManagerProps = {
  onConvertToContract?: (lead: Lead) => void;
};

export default function LeadsManager({ onConvertToContract }: LeadsManagerProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterResponsavel, setFilterResponsavel] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  useEffect(() => {
    loadLeads();

    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: 'arquivado=eq.false'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as Lead;
            setLeads((current) => {
              const exists = current.some(l => l.id === newLead.id);
              if (exists) return current;
              return [newLead, ...current];
            });
          } else if (payload.eventType === 'UPDATE') {
            setLeads((current) =>
              current.map((lead) =>
                lead.id === (payload.new as Lead).id ? (payload.new as Lead) : lead
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setLeads((current) =>
              current.filter((lead) => lead.id !== (payload.old as Lead).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, filterStatus, filterResponsavel]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.telefone.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'todos') {
      filtered = filtered.filter(lead => lead.status === filterStatus);
    }

    if (filterResponsavel !== 'todos') {
      filtered = filtered.filter(lead => lead.responsavel === filterResponsavel);
    }

    setFilteredLeads(filtered);
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Deseja arquivar este lead?')) return;

    try {
      const { error } = await supabase
        .from('leads')
        .update({ arquivado: true })
        .eq('id', id);

      if (error) throw error;
      loadLeads();
    } catch (error) {
      console.error('Erro ao arquivar lead:', error);
      alert('Erro ao arquivar lead');
    }
  };

  const handleConvertToContract = (lead: Lead) => {
    if (onConvertToContract) {
      onConvertToContract(lead);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const oldStatus = lead.status;

    setLeads((current) =>
      current.map((l) =>
        l.id === leadId
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
        .eq('id', leadId);

      if (updateError) throw updateError;

      await supabase
        .from('interactions')
        .insert([{
          lead_id: leadId,
          tipo: 'Observação',
          descricao: `Status alterado de "${oldStatus}" para "${newStatus}"`,
          responsavel: lead.responsavel,
        }]);

      await supabase
        .from('lead_status_history')
        .insert([{
          lead_id: leadId,
          status_anterior: oldStatus,
          status_novo: newStatus,
          responsavel: lead.responsavel,
        }]);

      if (['Fechado', 'Perdido'].includes(newStatus)) {
        await cancelFollowUps(leadId);
      } else {
        await createAutomaticFollowUps(leadId, newStatus, lead.responsavel);
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status do lead');
      setLeads((current) =>
        current.map((l) =>
          l.id === leadId ? { ...l, status: oldStatus } : l
        )
      );
      throw error;
    }
  };

  const handleProposalSent = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      setFollowUpLead(lead);
    }
  };

  const handleWhatsAppClick = (telefone: string, nome: string) => {
    openWhatsAppInBackgroundTab(telefone, nome);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Gestão de Leads</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-1 w-full sm:w-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center justify-center space-x-2 flex-1 sm:flex-initial px-3 py-2 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="text-sm font-medium">Lista</span>
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center justify-center space-x-2 flex-1 sm:flex-initial px-3 py-2 rounded-md transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-sm font-medium">Kanban</span>
            </button>
          </div>
          <button
            onClick={() => {
              setEditingLead(null);
              setShowForm(true);
            }}
            className="flex items-center justify-center space-x-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Lead</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none"
            >
              <option value="todos">Todos os status</option>
              <option value="Novo">Novo</option>
              <option value="Em contato">Em contato</option>
              <option value="Cotando">Cotando</option>
              <option value="Proposta enviada">Proposta enviada</option>
              <option value="Fechado">Fechado</option>
              <option value="Perdido">Perdido</option>
            </select>
          </div>
          <div className="relative">
            <select
              value={filterResponsavel}
              onChange={(e) => setFilterResponsavel(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none"
            >
              <option value="todos">Todos os responsáveis</option>
              <option value="Luiza">Luiza</option>
              <option value="Nick">Nick</option>
            </select>
          </div>
          <div className="text-sm text-slate-600 flex items-center justify-end">
            <span className="font-medium">{filteredLeads.length}</span>
            <span className="ml-1">lead(s) encontrado(s)</span>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <LeadKanban
          onLeadClick={setSelectedLead}
          onConvertToContract={handleConvertToContract}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredLeads.map((lead) => (
          <div
            key={lead.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-start space-x-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{lead.nome_completo}</h3>
                      <StatusDropdown
                        currentStatus={lead.status}
                        leadId={lead.id}
                        onStatusChange={handleStatusChange}
                        onProposalSent={handleProposalSent}
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-600">
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4" />
                        <span>{lead.telefone}</span>
                      </div>
                      {lead.email && (
                        <div className="truncate">
                          <span>{lead.email}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Origem:</span> {lead.origem}
                      </div>
                      <div>
                        <span className="font-medium">Tipo:</span> {lead.tipo_contratacao}
                      </div>
                    </div>
                    {lead.cidade && (
                      <div className="mt-2 text-sm text-slate-600">
                        <span className="font-medium">Cidade:</span> {lead.cidade}
                      </div>
                    )}
                    {lead.proximo_retorno && (
                      <div className="mt-2 flex items-center space-x-2 text-sm">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span className="text-orange-600 font-medium">
                          Retorno: {formatDateTimeFullBR(lead.proximo_retorno)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right text-sm text-slate-500">
                    <div>Responsável: <span className="font-medium text-slate-700">{lead.responsavel}</span></div>
                    <div className="mt-1">Criado: {new Date(lead.data_criacao).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedLead(lead)}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Ver Detalhes</span>
                <span className="sm:hidden">Detalhes</span>
              </button>
              <button
                onClick={() => {
                  setEditingLead(lead);
                  setShowForm(true);
                }}
                className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                Editar
              </button>
              <button
                onClick={() => handleWhatsAppClick(lead.telefone, lead.nome_completo)}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
              <button
                onClick={() => handleConvertToContract(lead)}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden md:inline">Converter em Contrato</span>
                <span className="md:hidden">Contrato</span>
              </button>
              <button
                onClick={() => handleArchive(lead.id)}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors sm:ml-auto"
              >
                <Archive className="w-4 h-4" />
                <span className="hidden sm:inline">Arquivar</span>
              </button>
            </div>
          </div>
        ))}

        {filteredLeads.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum lead encontrado</h3>
            <p className="text-slate-600">Tente ajustar os filtros ou adicione um novo lead.</p>
          </div>
        )}
        </div>
      )}

      {showForm && (
        <LeadForm
          lead={editingLead}
          onClose={() => {
            setShowForm(false);
            setEditingLead(null);
          }}
          onSave={() => {
            setShowForm(false);
            setEditingLead(null);
            loadLeads();
          }}
        />
      )}

      {selectedLead && (
        <LeadDetails
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={loadLeads}
        />
      )}

      {followUpLead && (
        <FollowUpScheduler
          lead={followUpLead}
          onClose={() => setFollowUpLead(null)}
          onScheduled={() => {
            setFollowUpLead(null);
            loadLeads();
          }}
        />
      )}
    </div>
  );
}
