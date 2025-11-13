import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, Lead } from '../lib/supabase';
import { Plus, Search, Filter, MessageCircle, Archive, FileText, Calendar, Phone, Users, LayoutGrid, List, BookOpen, Mail, Pencil } from 'lucide-react';
import LeadForm from './LeadForm';
import LeadDetails from './LeadDetails';
import StatusDropdown from './StatusDropdown';
import ReminderSchedulerModal from './ReminderSchedulerModal';
import LeadKanban from './LeadKanban';
import Pagination from './Pagination';
import { ObserverBanner } from './ObserverRestriction';
import { useAuth } from '../contexts/AuthContext';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useConfig } from '../contexts/ConfigContext';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type LeadsManagerProps = {
  onConvertToContract?: (lead: Lead) => void;
};

export default function LeadsManager({ onConvertToContract }: LeadsManagerProps) {
  const { isObserver } = useAuth();
  const { leadStatuses, options } = useConfig();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterResponsavel, setFilterResponsavel] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [reminderLead, setReminderLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const activeLeadStatuses = useMemo(() => leadStatuses.filter(status => status.ativo), [leadStatuses]);
  const responsavelOptions = useMemo(() => (options.lead_responsavel || []).filter(option => option.ativo), [options.lead_responsavel]);

  const loadLeads = useCallback(async () => {
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
  }, []);

  const handleRealtimeLeadChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Lead>) => {
      const { eventType } = payload;
      const newLead = payload.new as Lead | null;
      const oldLead = payload.old as Lead | null;

      setLeads((current) => {
        let updatedLeads = current;

        switch (eventType) {
          case 'INSERT':
            if (!newLead || newLead.arquivado) return current;
            updatedLeads = [newLead, ...current.filter((lead) => lead.id !== newLead.id)];
            break;
          case 'UPDATE':
            if (!newLead) return current;
            if (newLead.arquivado) {
              updatedLeads = current.filter((lead) => lead.id !== newLead.id);
            } else {
              const otherLeads = current.filter((lead) => lead.id !== newLead.id);
              updatedLeads = [newLead, ...otherLeads];
            }
            break;
          case 'DELETE':
            if (!oldLead) return current;
            updatedLeads = current.filter((lead) => lead.id !== oldLead.id);
            break;
          default:
            return current;
        }

        return updatedLeads.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      if (eventType === 'DELETE' && oldLead) {
        setSelectedLead((current) => (current && current.id === oldLead.id ? null : current));
        setEditingLead((current) => (current && current.id === oldLead.id ? null : current));
        return;
      }

      if (newLead) {
        setSelectedLead((current) => (current && current.id === newLead.id ? newLead : current));
        setEditingLead((current) => (current && current.id === newLead.id ? newLead : current));
      }
    },
    []
  );

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
        },
        handleRealtimeLeadChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLeads, handleRealtimeLeadChange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterResponsavel, itemsPerPage]);

  const filteredLeads = useMemo(() => {
    let filtered = leads.filter((lead) => !lead.arquivado);

    if (isObserver) {
      filtered = filtered.filter((lead) => lead.origem !== 'Ully');
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((lead) =>
        lead.nome_completo.toLowerCase().includes(lowerSearch) ||
        lead.telefone.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(lowerSearch)
      );
    }

    if (filterStatus !== 'todos') {
      filtered = filtered.filter((lead) => lead.status === filterStatus);
    }

    if (filterResponsavel !== 'todos') {
      filtered = filtered.filter((lead) => lead.responsavel === filterResponsavel);
    }

    return filtered;
  }, [leads, searchTerm, filterStatus, filterResponsavel, isObserver]);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
    if (currentPage > total) {
      setCurrentPage(total);
    }
  }, [filteredLeads.length, itemsPerPage, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
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

  const getLeadFirstName = (fullName: string) => {
    const trimmedName = fullName.trim();
    if (!trimmedName) return '';
    const [firstName] = trimmedName.split(/\s+/);
    return firstName;
  };

  const buildWhatsAppUrl = (lead: Lead) => {
    const phoneDigits = lead.telefone.replace(/\D/g, '');
    if (!phoneDigits) return '';
    const phoneWithCountry = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;
    const message = `Olá *${getLeadFirstName(lead.nome_completo)}*, tudo bem? Sou *Luiza Kifer*, especialista em planos de saúde aqui da UnitedClass, e vi que você demonstrou interesse em um plano de saúde.`;
    return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
  };

  const handleWhatsAppContact = (lead: Lead) => {
    if (!lead.telefone) return;
    const url = buildWhatsAppUrl(lead);
    if (!url) return;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  const buildEmailUrl = (lead: Lead) => {
    if (!lead.email) return '';
    const subject = 'Contato sobre plano de saúde';
    const body = `Olá ${getLeadFirstName(lead.nome_completo)}, tudo bem?`;
    const params = new URLSearchParams({
      subject,
      body,
    });
    return `mailto:${lead.email}?${params.toString()}`;
  };

  const handleEmailContact = (lead: Lead) => {
    const url = buildEmailUrl(lead);
    if (!url) return;
    if (typeof window !== 'undefined') {
      window.location.href = url;
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

      const normalizedStatus = newStatus.trim().toLowerCase();
      if (normalizedStatus === 'proposta enviada') {
        setReminderLead({ ...lead, status: newStatus });
      } else if (normalizedStatus === 'perdido') {
        const { error: deleteRemindersError } = await supabase
          .from('reminders')
          .delete()
          .eq('lead_id', leadId);

        if (deleteRemindersError) throw deleteRemindersError;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <ObserverBanner />
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
          <a
            href="/api-docs.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
            title="Documentação da API"
          >
            <BookOpen className="w-5 h-5" />
            <span>API Docs</span>
          </a>
          <button
            onClick={() => {
              setEditingLead(null);
              setShowForm(true);
            }}
            disabled={isObserver}
            className="flex items-center justify-center space-x-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            title={isObserver ? 'Você não tem permissão para criar leads' : 'Criar novo lead'}
          >
            <Plus className="w-5 h-5" />
            <span>Novo Lead</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
              {activeLeadStatuses.map(status => (
                <option key={status.id} value={status.nome}>
                  {status.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select
              value={filterResponsavel}
              onChange={(e) => setFilterResponsavel(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none"
            >
              <option value="todos">Todos os responsáveis</option>
              {responsavelOptions.map(option => (
                <option key={option.id} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-slate-600 flex items-center justify-between sm:justify-end text-center sm:text-right">
            <span className="font-medium w-full sm:w-auto">{filteredLeads.length}</span>
            <span className="ml-0 sm:ml-1 w-full sm:w-auto">lead(s) encontrado(s)</span>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <LeadKanban
          onLeadClick={setSelectedLead}
          onConvertToContract={handleConvertToContract}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 gap-4 p-4">
          {paginatedLeads.map((lead) => (
          <div
            key={lead.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md transition-all"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-slate-900">{lead.nome_completo}</h3>
                      {!isObserver ? (
                        <StatusDropdown
                          currentStatus={lead.status}
                          leadId={lead.id}
                          onStatusChange={handleStatusChange}
                          statusOptions={activeLeadStatuses}
                        />
                      ) : (
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                          {lead.status}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm text-slate-600">
                      <div className="flex items-center gap-2 break-words">
                        {lead.telefone && (
                          <button
                            type="button"
                            onClick={() => handleWhatsAppContact(lead)}
                            className="text-teal-600 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded-full p-1"
                            title="Conversar no WhatsApp"
                            aria-label={`Conversar com ${lead.nome_completo} no WhatsApp`}
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                        )}
                        <span>{lead.telefone}</span>
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-2 truncate">
                          <button
                            type="button"
                            onClick={() => handleEmailContact(lead)}
                            className="text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-full p-1"
                            title="Enviar e-mail"
                            aria-label={`Enviar e-mail para ${lead.nome_completo}`}
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          <span className="truncate">{lead.email}</span>
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
                  <div className="text-sm text-slate-500 lg:text-right">
                    <div>
                      Responsável: <span className="font-medium text-slate-700">{lead.responsavel}</span>
                    </div>
                    <div className="mt-1">Criado: {new Date(lead.data_criacao).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedLead(lead)}
                className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                aria-label="Ver detalhes do lead"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Ver Detalhes</span>
              </button>
              {!isObserver && (
                <>
                  <button
                    onClick={() => {
                      setEditingLead(lead);
                      setShowForm(true);
                    }}
                    className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    aria-label="Editar lead"
                  >
                    <Pencil className="w-4 h-4" />
                    <span className="hidden sm:inline">Editar</span>
                  </button>
                  <button
                    onClick={() => handleConvertToContract(lead)}
                    className="hidden md:inline-flex items-center space-x-2 px-3 py-2 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Converter em Contrato</span>
                  </button>
                  <button
                    onClick={() => handleArchive(lead.id)}
                    className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors sm:ml-auto"
                    aria-label="Arquivar lead"
                  >
                    <Archive className="w-4 h-4" />
                    <span className="hidden sm:inline">Arquivar</span>
                  </button>
                </>
              )}
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

        {filteredLeads.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredLeads.length}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
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

      {reminderLead && (
        <ReminderSchedulerModal
          lead={reminderLead}
          onClose={() => setReminderLead(null)}
          onScheduled={(_details) => {
            setReminderLead(null);
            loadLeads();
          }}
          promptMessage="Deseja agendar o primeiro lembrete após a proposta enviada?"
          defaultType="Follow-up"
        />
      )}
    </div>
  );
}
