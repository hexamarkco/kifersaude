import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, Lead } from '../lib/supabase';
import { Plus, Search, Filter, MessageCircle, Archive, FileText, Calendar, Phone, Users, LayoutGrid, List, BookOpen, Mail, Pencil, Bell, MapPin, Layers, UserCircle, AlertTriangle, X } from 'lucide-react';
import LeadForm from './LeadForm';
import LeadDetails from './LeadDetails';
import StatusDropdown from './StatusDropdown';
import ReminderSchedulerModal from './ReminderSchedulerModal';
import LeadKanban from './LeadKanban';
import Pagination from './Pagination';
import { ObserverBanner } from './ObserverRestriction';
import { useAuth } from '../contexts/AuthContext';
import { convertLocalToUTC, formatDateTimeFullBR } from '../lib/dateUtils';
import { useConfig } from '../contexts/ConfigContext';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import FilterMultiSelect from './FilterMultiSelect';
import type { WhatsappLaunchParams } from '../types/whatsapp';
import { useConfirmationModal } from '../hooks/useConfirmationModal';
import { getOverdueLeads } from '../lib/analytics';

type LeadsManagerProps = {
  onConvertToContract?: (lead: Lead) => void;
  onOpenWhatsapp?: (params: WhatsappLaunchParams) => void;
};

type StatusReminderRule = {
  hoursFromNow: number;
  title: string;
  description?: string;
  type?: string;
  priority?: 'alta' | 'normal' | 'baixa';
};

const STATUS_REMINDER_RULES: Record<string, StatusReminderRule> = {
  'contato realizado': {
    hoursFromNow: 24,
    title: 'Revisar contato e planejar próximo passo',
    description: 'Confirme interesse e avance para proposta ou requalificação.',
    type: 'Follow-up',
    priority: 'alta',
  },
  'proposta em análise': {
    hoursFromNow: 48,
    title: 'Acompanhar proposta em análise',
    description: 'Verifique dúvidas pendentes e reforçe benefícios do plano.',
    type: 'Retorno',
    priority: 'normal',
  },
};

export default function LeadsManager({ onConvertToContract, onOpenWhatsapp }: LeadsManagerProps) {
  const { isObserver } = useAuth();
  const { leadStatuses, leadOrigins, options } = useConfig();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterResponsavel, setFilterResponsavel] = useState<string[]>([]);
  const [filterOrigem, setFilterOrigem] = useState<string[]>([]);
  const [filterTipoContratacao, setFilterTipoContratacao] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterCanais, setFilterCanais] = useState<string[]>([]);
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('');
  const [filterCreatedTo, setFilterCreatedTo] = useState('');
  const [filterUltimoContatoFrom, setFilterUltimoContatoFrom] = useState('');
  const [filterUltimoContatoTo, setFilterUltimoContatoTo] = useState('');
  const [filterProximoRetornoFrom, setFilterProximoRetornoFrom] = useState('');
  const [filterProximoRetornoTo, setFilterProximoRetornoTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [reminderLead, setReminderLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkResponsavel, setBulkResponsavel] = useState('');
  const [bulkProximoRetorno, setBulkProximoRetorno] = useState('');
  const [bulkArchiveAction, setBulkArchiveAction] = useState<'none' | 'archive' | 'unarchive'>('none');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [overdueLeads, setOverdueLeads] = useState<Lead[]>([]);
  const [recentlyOverdue, setRecentlyOverdue] = useState<Lead[]>([]);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const activeLeadStatuses = useMemo(() => leadStatuses.filter(status => status.ativo), [leadStatuses]);
  const responsavelOptions = useMemo(() => (options.lead_responsavel || []).filter(option => option.ativo), [options.lead_responsavel]);
  const restrictedOriginNamesForObservers = useMemo(
    () => leadOrigins.filter((origin) => origin.visivel_para_observadores === false).map((origin) => origin.nome),
    [leadOrigins],
  );
  const isOriginVisibleToObserver = useCallback(
    (originName: string | null | undefined) => {
      if (!originName) {
        return true;
      }
      return !restrictedOriginNamesForObservers.includes(originName);
    },
    [restrictedOriginNamesForObservers],
  );
  const activeLeadOrigins = useMemo(() => leadOrigins.filter(origin => origin.ativo), [leadOrigins]);
  const visibleLeadOrigins = useMemo(
    () =>
      activeLeadOrigins.filter(
        (origin) => !isObserver || isOriginVisibleToObserver(origin.nome),
      ),
    [activeLeadOrigins, isObserver, isOriginVisibleToObserver],
  );
  const tipoContratacaoOptions = useMemo(
    () => (options.lead_tipo_contratacao || []).filter(option => option.ativo),
    [options.lead_tipo_contratacao]
  );
  const statusFilterOptions = useMemo(
    () => activeLeadStatuses.map((status) => ({ value: status.nome, label: status.nome })),
    [activeLeadStatuses]
  );
  const responsavelFilterOptions = useMemo(
    () => responsavelOptions.map((option) => ({ value: option.value, label: option.label })),
    [responsavelOptions]
  );
  const origemFilterOptions = useMemo(
    () => visibleLeadOrigins.map((origin) => ({ value: origin.nome, label: origin.nome })),
    [visibleLeadOrigins]
  );
  const tipoContratacaoFilterOptions = useMemo(
    () => tipoContratacaoOptions.map((option) => ({ value: option.value, label: option.label })),
    [tipoContratacaoOptions]
  );

  const syncOverdueLeads = useCallback(
    (allLeads: Lead[], previousOverdue: Lead[] = []) => {
      const updated = getOverdueLeads(allLeads);
      const previousIds = new Set(previousOverdue.map(lead => lead.id));
      const newOverdue = updated.filter(lead => !previousIds.has(lead.id));

      if (newOverdue.length > 0) {
        setRecentlyOverdue(newOverdue);
      }

      setOverdueLeads(updated);
    },
    []
  );

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      let fetchedLeads = data || [];
      if (isObserver) {
        fetchedLeads = fetchedLeads.filter((lead) => isOriginVisibleToObserver(lead.origem));
      }
      setLeads(fetchedLeads);
      syncOverdueLeads(fetchedLeads);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    } finally {
      setLoading(false);
    }
  }, [isObserver, isOriginVisibleToObserver, syncOverdueLeads]);

  const handleRealtimeLeadChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Lead>) => {
      const { eventType } = payload;
      const newLead = payload.new as Lead | null;
      const oldLead = payload.old as Lead | null;

      setLeads((current) => {
        let updatedLeads = current;

        switch (eventType) {
          case 'INSERT':
            if (!newLead) return current;
            if (isObserver && !isOriginVisibleToObserver(newLead.origem)) {
              return current.filter((lead) => lead.id !== newLead.id);
            }
            updatedLeads = [newLead, ...current.filter((lead) => lead.id !== newLead.id)];
            break;
          case 'UPDATE':
            if (!newLead) return current;
            {
              const otherLeads = current.filter((lead) => lead.id !== newLead.id);
              if (isObserver && !isOriginVisibleToObserver(newLead.origem)) {
                updatedLeads = otherLeads;
              } else {
                updatedLeads = [newLead, ...otherLeads];
              }
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
        if (isObserver && !isOriginVisibleToObserver(newLead.origem)) {
          setSelectedLead((current) => (current && current.id === newLead.id ? null : current));
          setEditingLead((current) => (current && current.id === newLead.id ? null : current));
        } else {
          setSelectedLead((current) => (current && current.id === newLead.id ? newLead : current));
          setEditingLead((current) => (current && current.id === newLead.id ? newLead : current));
        }
      }
    },
    [isObserver, isOriginVisibleToObserver, syncOverdueLeads]
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
  }, [
    searchTerm,
    filterStatus,
    filterResponsavel,
    filterOrigem,
    filterTipoContratacao,
    filterTags,
    filterCanais,
    filterCreatedFrom,
    filterCreatedTo,
    filterUltimoContatoFrom,
    filterUltimoContatoTo,
    filterProximoRetornoFrom,
    filterProximoRetornoTo,
    itemsPerPage,
  ]);

  useEffect(() => {
    setFilterStatus((current) => {
      const valid = current.filter((value) => activeLeadStatuses.some((status) => status.nome === value));
      return valid.length === current.length ? current : valid;
    });
  }, [activeLeadStatuses]);

  useEffect(() => {
    setFilterResponsavel((current) => {
      const valid = current.filter((value) => responsavelOptions.some((option) => option.value === value));
      return valid.length === current.length ? current : valid;
    });
  }, [responsavelOptions]);

  useEffect(() => {
    setFilterOrigem((current) => {
      const valid = current.filter((value) => visibleLeadOrigins.some((origin) => origin.nome === value));
      return valid.length === current.length ? current : valid;
    });
  }, [visibleLeadOrigins]);

  useEffect(() => {
    setFilterTipoContratacao((current) => {
      const valid = current.filter((value) => tipoContratacaoOptions.some((option) => option.value === value));
      return valid.length === current.length ? current : valid;
    });
  }, [tipoContratacaoOptions]);

  useEffect(() => {
    syncOverdueLeads(leads, overdueLeads);
  }, [leads, syncOverdueLeads]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      syncOverdueLeads(leads, overdueLeads);
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, [leads, overdueLeads, syncOverdueLeads]);

  useEffect(() => {
    if (recentlyOverdue.length === 0) return;

    const timeoutId = window.setTimeout(() => {
      setRecentlyOverdue([]);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [recentlyOverdue]);

  const filteredLeads = useMemo(() => {
    const baseList = showOverdueOnly ? overdueLeads : leads;
    let filtered = baseList.filter((lead) => (showArchived ? lead.arquivado : !lead.arquivado));

    const selectedStatusSet = new Set(filterStatus);
    const selectedResponsavelSet = new Set(filterResponsavel);
    const selectedOrigemSet = new Set(filterOrigem);
    const selectedTipoSet = new Set(filterTipoContratacao);
    const selectedTagSet = new Set(filterTags);
    const selectedCanaisSet = new Set(filterCanais);

    if (isObserver) {
      filtered = filtered.filter((lead) => isOriginVisibleToObserver(lead.origem));
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter((lead) =>
        lead.nome_completo.toLowerCase().includes(lowerSearch) ||
        lead.telefone.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(lowerSearch)
      );
    }

    if (selectedStatusSet.size > 0) {
      filtered = filtered.filter((lead) => lead.status && selectedStatusSet.has(lead.status));
    }

    if (selectedResponsavelSet.size > 0) {
      filtered = filtered.filter((lead) => lead.responsavel && selectedResponsavelSet.has(lead.responsavel));
    }

    if (selectedOrigemSet.size > 0) {
      filtered = filtered.filter((lead) => lead.origem && selectedOrigemSet.has(lead.origem));
    }

    if (selectedTipoSet.size > 0) {
      filtered = filtered.filter((lead) => lead.tipo_contratacao && selectedTipoSet.has(lead.tipo_contratacao));
    }

    filtered = filtered.filter((lead) => isWithinDateRange(lead.created_at, filterCreatedFrom, filterCreatedTo));
    filtered = filtered.filter((lead) =>
      isWithinDateRange(lead.ultimo_contato, filterUltimoContatoFrom, filterUltimoContatoTo)
    );
    filtered = filtered.filter((lead) =>
      isWithinDateRange(lead.proximo_retorno, filterProximoRetornoFrom, filterProximoRetornoTo)
    );

    if (selectedTagSet.size > 0) {
      const requiredTags = Array.from(selectedTagSet);
      filtered = filtered.filter(
        (lead) => Array.isArray(lead.tags) && requiredTags.every((tag) => lead.tags?.includes(tag))
      );
    }

    if (selectedCanaisSet.size > 0) {
      filtered = filtered.filter((lead) => lead.canal && selectedCanaisSet.has(lead.canal));
    }

    return filtered;
  }, [
    leads,
    overdueLeads,
    searchTerm,
    filterStatus,
    filterResponsavel,
    filterOrigem,
    filterTipoContratacao,
    filterTags,
    filterCanais,
    filterCreatedFrom,
    filterCreatedTo,
    filterUltimoContatoFrom,
    filterUltimoContatoTo,
    filterProximoRetornoFrom,
    filterProximoRetornoTo,
    isObserver,
    isOriginVisibleToObserver,
    showArchived,
    showOverdueOnly,
  ]);

  useEffect(() => {
    const total = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
    if (currentPage > total) {
      setCurrentPage(total);
    }
  }, [filteredLeads.length, itemsPerPage, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [showArchived]);

  useEffect(() => {
    if (showArchived && viewMode === 'kanban') {
      setViewMode('list');
    }
  }, [showArchived, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + itemsPerPage);
  const selectedLeadIdsSet = useMemo(() => new Set(selectedLeadIds), [selectedLeadIds]);
  const paginatedLeadIds = useMemo(() => paginatedLeads.map((lead) => lead.id), [paginatedLeads]);
  const areAllPageLeadsSelected = useMemo(
    () => paginatedLeadIds.length > 0 && paginatedLeadIds.every((id) => selectedLeadIdsSet.has(id)),
    [paginatedLeadIds, selectedLeadIdsSet]
  );
  const canSelectLeads = !isObserver && viewMode === 'list';

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const toggleLeadSelection = (leadId: string) => {
    if (!canSelectLeads || isBulkUpdating) return;

    setSelectedLeadIds((current) => {
      if (current.includes(leadId)) {
        return current.filter((id) => id !== leadId);
      }
      return [...current, leadId];
    });
  };

  const toggleSelectAllCurrentPage = () => {
    if (!canSelectLeads || isBulkUpdating) return;

    setSelectedLeadIds((current) => {
      const currentSet = new Set(current);
      const shouldSelectAll = !paginatedLeadIds.every((id) => currentSet.has(id));

      if (!shouldSelectAll) {
        return current.filter((id) => !paginatedLeadIds.includes(id));
      }

      const updated = new Set(current);
      paginatedLeadIds.forEach((id) => updated.add(id));
      return Array.from(updated);
    });
  };

  const clearSelection = useCallback(() => {
    setSelectedLeadIds([]);
    setBulkStatus('');
    setBulkResponsavel('');
    setBulkProximoRetorno('');
    setBulkArchiveAction('none');
  }, []);

  const handleBulkDetailsApply = async () => {
    if (selectedLeadIds.length === 0) return;

    const updates: Partial<Lead> = {};
    const proximoRetorno = bulkProximoRetorno ? convertLocalToUTC(bulkProximoRetorno) || null : undefined;

    if (bulkResponsavel) {
      updates.responsavel = bulkResponsavel;
    }
    if (proximoRetorno !== undefined) {
      updates.proximo_retorno = proximoRetorno;
    }
    if (bulkArchiveAction !== 'none') {
      updates.arquivado = bulkArchiveAction === 'archive';
    }

    if (Object.keys(updates).length === 0) return;

    setIsBulkUpdating(true);

    setLeads((current) =>
      current.map((lead) =>
        selectedLeadIds.includes(lead.id)
          ? {
              ...lead,
              ...updates,
            }
          : lead
      )
    );

    try {
      const { error } = await supabase.from('leads').update(updates).in('id', selectedLeadIds);
      if (error) throw error;
      alert('Dados aplicados com sucesso aos leads selecionados.');
    } catch (error) {
      console.error('Erro ao aplicar dados em massa:', error);
      alert('Erro ao aplicar dados aos leads selecionados. Tente novamente.');
      loadLeads();
    } finally {
      setIsBulkUpdating(false);
      clearSelection();
    }
  };

  const handleBulkStatusApply = async () => {
    if (!bulkStatus || selectedLeadIds.length === 0) return;

    setIsBulkUpdating(true);
    let hasError = false;

    for (const leadId of selectedLeadIds) {
      try {
        await handleStatusChange(leadId, bulkStatus);
      } catch (error) {
        console.error('Erro ao atualizar status do lead em massa:', error);
        hasError = true;
      }
    }

    if (hasError) {
      alert('Alguns leads não puderam ter o status atualizado. Verifique e tente novamente.');
    }

    setIsBulkUpdating(false);
    clearSelection();
  };

  const handleArchive = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: 'Arquivar lead',
      description: 'Deseja arquivar este lead? Você poderá reativá-lo depois.',
      confirmLabel: 'Arquivar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

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

  const handleUnarchive = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: 'Reativar lead',
      description: 'Deseja reativar este lead?',
      confirmLabel: 'Reativar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('leads')
        .update({ arquivado: false })
        .eq('id', id);

      if (error) throw error;
      loadLeads();
    } catch (error) {
      console.error('Erro ao reativar lead:', error);
      alert('Erro ao reativar lead');
    }
  };

  const getLeadFirstName = (fullName: string) => {
    const trimmedName = fullName.trim();
    if (!trimmedName) return '';
    const [firstName] = trimmedName.split(/\s+/);
    return firstName;
  };

  const buildWhatsappMessage = (lead: Lead) =>
    `Olá *${getLeadFirstName(lead.nome_completo)}*, tudo bem? Sou *Luiza Kifer*, especialista em planos de saúde aqui da UnitedClass, e vi que você demonstrou interesse em um plano de saúde.`;

  const buildWhatsappLaunchParams = (lead: Lead): WhatsappLaunchParams | null => {
    if (!lead.telefone) return null;

    const phoneDigits = lead.telefone.replace(/\D/g, '');
    if (!phoneDigits) return null;

    const phoneWithCountry = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;

    return {
      phone: phoneWithCountry,
      message: buildWhatsappMessage(lead),
      chatName: lead.nome_completo,
      leadId: lead.id,
    };
  };

  const registerContact = async (lead: Lead, tipo: 'WhatsApp' | 'Email') => {
    const timestamp = new Date().toISOString();

    setLeads((current) =>
      current.map((l) =>
        l.id === lead.id
          ? { ...l, ultimo_contato: timestamp }
          : l
      )
    );

    setSelectedLead((current) =>
      current && current.id === lead.id ? { ...current, ultimo_contato: timestamp } : current
    );

    try {
      await supabase
        .from('interactions')
        .insert([{ lead_id: lead.id, tipo, descricao: `Contato via ${tipo}`, responsavel: lead.responsavel }]);

      const { error: updateError } = await supabase
        .from('leads')
        .update({ ultimo_contato: timestamp })
        .eq('id', lead.id);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Erro ao registrar contato:', error);
    }
  };

  const handleWhatsAppContact = async (lead: Lead) => {
    const launchParams = buildWhatsappLaunchParams(lead);
    if (!launchParams) return;

    await registerContact(lead, 'WhatsApp');

    if (onOpenWhatsapp) {
      onOpenWhatsapp(launchParams);
      return;
    }

    if (typeof window !== 'undefined') {
      const url = `https://wa.me/${launchParams.phone}?text=${encodeURIComponent(launchParams.message ?? '')}`;
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

  const handleEmailContact = async (lead: Lead) => {
    const url = buildEmailUrl(lead);
    if (!url) return;

    await registerContact(lead, 'Email');

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
      } else {
        const reminderRule = STATUS_REMINDER_RULES[normalizedStatus];
        if (reminderRule) {
          const reminderDate = new Date();
          reminderDate.setHours(reminderDate.getHours() + reminderRule.hoursFromNow);
          reminderDate.setMinutes(0, 0, 0);

          const reminderDateISO = reminderDate.toISOString();

          const { error: insertReminderError } = await supabase.from('reminders').insert([
            {
              lead_id: leadId,
              tipo: reminderRule.type ?? 'Follow-up',
              titulo: `${reminderRule.title} - ${lead.nome_completo}`,
              descricao: reminderRule.description ?? null,
              data_lembrete: reminderDateISO,
              lido: false,
              prioridade: reminderRule.priority ?? 'normal',
            },
          ]);

          if (insertReminderError) throw insertReminderError;

          const { error: leadUpdateError } = await supabase
            .from('leads')
            .update({ proximo_retorno: reminderDateISO })
            .eq('id', leadId);

          if (leadUpdateError) throw leadUpdateError;

          setLeads((current) =>
            current.map((leadItem) =>
              leadItem.id === leadId ? { ...leadItem, proximo_retorno: reminderDateISO } : leadItem
            )
          );
        }
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

  useEffect(() => {
    if (viewMode !== 'list') {
      clearSelection();
    }
  }, [viewMode, clearSelection]);

  useEffect(() => {
    if (showArchived) {
      clearSelection();
    }
  }, [showArchived, clearSelection]);

  useEffect(() => {
    if (isObserver) {
      clearSelection();
    }
  }, [isObserver, clearSelection]);

  useEffect(() => {
    setSelectedLeadIds((current) => {
      const filteredIds = new Set(filteredLeads.map((lead) => lead.id));
      const updated = current.filter((id) => filteredIds.has(id));
      return updated.length === current.length ? current : updated;
    });
  }, [filteredLeads]);

  useEffect(() => {
    if (selectedLeadIds.length === 0) {
      setBulkStatus('');
      setBulkResponsavel('');
      setBulkProximoRetorno('');
      setBulkArchiveAction('none');
    }
  }, [selectedLeadIds.length]);

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
      {overdueLeads.length > 0 && (
        <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-orange-100 p-2 text-orange-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-orange-800">
                  {overdueLeads.length} lead{overdueLeads.length === 1 ? '' : 's'} com retorno vencido
                </p>
                <p className="text-sm text-orange-700">
                  Ordenados pelo próximo retorno. Mantenha o contato ativo para evitar perda de interesse.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowOverdueOnly((current) => !current)}
                className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-orange-700 transition-colors"
              >
                {showOverdueOnly ? 'Ver todos os leads' : 'Filtrar atrasados'}
              </button>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="rounded-lg border border-orange-300 px-3 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-100 transition-colors"
              >
                Atualizar prioridade
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overdueLeads.slice(0, 3).map((lead) => (
              <div key={lead.id} className="rounded-xl border border-orange-100 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{lead.nome_completo}</p>
                    <p className="text-xs text-slate-600">Responsável: {lead.responsavel || 'Não atribuído'}</p>
                  </div>
                  <Calendar className="h-4 w-4 text-orange-500" />
                </div>
                {lead.proximo_retorno && (
                  <p className="mt-2 text-xs font-medium text-orange-700">
                    Próximo retorno: {formatDateTimeFullBR(lead.proximo_retorno)}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedLead(lead);
                      setViewMode('list');
                    }}
                    className="flex-1 rounded-lg bg-orange-100 px-2 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-200 transition-colors"
                  >
                    Abrir lead
                  </button>
                  <button
                    onClick={() => setReminderLead(lead)}
                    className="rounded-lg bg-orange-600 px-2 py-2 text-xs font-semibold text-white hover:bg-orange-700 transition-colors"
                    type="button"
                  >
                    Agendar retorno
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <h2 className="text-2xl font-bold text-slate-900">Gestão de Leads</h2>
          {showArchived && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              Arquivados
            </span>
          )}
        </div>
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
            onClick={() => setShowArchived((current) => !current)}
            className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg transition-colors w-full sm:w-auto ${
              showArchived
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            aria-pressed={showArchived}
            type="button"
          >
            <Archive className="w-5 h-5" />
            <span>{showArchived ? 'Ver Leads Ativos' : 'Ver Leads Arquivados'}</span>
          </button>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 pl-10 pr-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end w-full lg:w-auto">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50"
            >
              <Filter className="w-4 h-4" />
              Limpar filtros
            </button>
            <div className="text-sm text-slate-600 flex items-center justify-end">
              <span className="font-medium">{filteredLeads.length}</span>
              <span className="ml-1">lead(s) encontrado(s)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <FilterMultiSelect
            icon={Filter}
            options={statusFilterOptions}
            placeholder="Todos os status"
            values={filterStatus}
            onChange={setFilterStatus}
          />
          <FilterMultiSelect
            icon={UserCircle}
            options={responsavelFilterOptions}
            placeholder="Todos os responsáveis"
            values={filterResponsavel}
            onChange={setFilterResponsavel}
          />
          <FilterMultiSelect
            icon={MapPin}
            options={origemFilterOptions}
            placeholder="Todas as origens"
            values={filterOrigem}
            onChange={setFilterOrigem}
          />
          <FilterMultiSelect
            icon={Layers}
            options={tipoContratacaoFilterOptions}
            placeholder="Todos os tipos"
            values={filterTipoContratacao}
            onChange={setFilterTipoContratacao}
          />
          <FilterMultiSelect
            icon={Tag}
            options={tagFilterOptions}
            placeholder="Todas as tags"
            values={filterTags}
            onChange={setFilterTags}
          />
          <FilterMultiSelect
            icon={Share2}
            options={canalFilterOptions}
            placeholder="Todos os canais"
            values={filterCanais}
            onChange={setFilterCanais}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Criação</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={filterCreatedFrom}
                onChange={(e) => setFilterCreatedFrom(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="De"
              />
              <input
                type="date"
                value={filterCreatedTo}
                onChange={(e) => setFilterCreatedTo(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Até"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <MessageCircle className="w-4 h-4 text-slate-500" />
              <span>Último contato</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                value={filterUltimoContatoFrom}
                onChange={(e) => setFilterUltimoContatoFrom(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="De"
              />
              <input
                type="datetime-local"
                value={filterUltimoContatoTo}
                onChange={(e) => setFilterUltimoContatoTo(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Até"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Bell className="w-4 h-4 text-slate-500" />
              <span>Próximo retorno</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="datetime-local"
                value={filterProximoRetornoFrom}
                onChange={(e) => setFilterProximoRetornoFrom(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="De"
              />
              <input
                type="datetime-local"
                value={filterProximoRetornoTo}
                onChange={(e) => setFilterProximoRetornoTo(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Até"
              />
            </div>
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
          {!isObserver && paginatedLeads.length > 0 && (
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-4 py-3 border-b border-slate-200">
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  checked={areAllPageLeadsSelected}
                  onChange={toggleSelectAllCurrentPage}
                />
                Selecionar todos desta página
              </label>

              {selectedLeadIds.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <span className="text-sm font-medium text-teal-700">
                    {selectedLeadIds.length} lead(s) selecionado(s)
                  </span>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <select
                      value={bulkStatus}
                      onChange={(event) => setBulkStatus(event.target.value)}
                      className="w-full sm:w-48 px-3 py-2 text-sm border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      disabled={isBulkUpdating}
                    >
                      <option value="" disabled>
                        Selecionar novo status
                      </option>
                      {activeLeadStatuses.map((status) => (
                        <option key={status.id} value={status.nome}>
                          {status.nome}
                        </option>
                      ))}
                    </select>
                    <select
                      value={bulkResponsavel}
                      onChange={(event) => setBulkResponsavel(event.target.value)}
                      className="w-full sm:w-48 px-3 py-2 text-sm border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      disabled={isBulkUpdating}
                    >
                      <option value="" disabled>
                        Selecionar responsável
                      </option>
                      {responsavelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="datetime-local"
                      value={bulkProximoRetorno}
                      onChange={(event) => setBulkProximoRetorno(event.target.value)}
                      className="w-full sm:w-56 px-3 py-2 text-sm border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      disabled={isBulkUpdating}
                    />
                    <select
                      value={bulkArchiveAction}
                      onChange={(event) =>
                        setBulkArchiveAction(event.target.value as typeof bulkArchiveAction)
                      }
                      className="w-full sm:w-48 px-3 py-2 text-sm border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      disabled={isBulkUpdating}
                    >
                      <option value="none">Ação de arquivamento (opcional)</option>
                      <option value="archive">Arquivar selecionados</option>
                      <option value="unarchive">Reativar selecionados</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleBulkStatusApply}
                        disabled={!bulkStatus || isBulkUpdating}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isBulkUpdating ? 'Atualizando...' : 'Aplicar Status'}
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkDetailsApply}
                        disabled={
                          isBulkUpdating ||
                          (!bulkResponsavel && !bulkProximoRetorno && bulkArchiveAction === 'none')
                        }
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {isBulkUpdating ? 'Aplicando...' : 'Aplicar dados'}
                      </button>
                      <button
                        type="button"
                        onClick={clearSelection}
                        disabled={isBulkUpdating}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
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
                      {canSelectLeads && (
                        <input
                          type="checkbox"
                          checked={selectedLeadIdsSet.has(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          aria-label={`Selecionar lead ${lead.nome_completo}`}
                        />
                      )}
                      <h3 className="text-lg font-semibold text-slate-900">{lead.nome_completo}</h3>
                      {!isObserver ? (
                        <StatusDropdown
                          currentStatus={lead.status}
                          leadId={lead.id}
                          onStatusChange={handleStatusChange}
                          disabled={isBulkUpdating}
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
                    onClick={() => setReminderLead(lead)}
                    className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
                    aria-label="Agendar lembrete"
                    type="button"
                  >
                    <Bell className="w-4 h-4" />
                    <span className="hidden sm:inline">Agendar Lembrete</span>
                  </button>
                  {!showArchived ? (
                    <button
                      onClick={() => handleArchive(lead.id)}
                      className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors sm:ml-auto"
                      aria-label="Arquivar lead"
                    >
                      <Archive className="w-4 h-4" />
                      <span className="hidden sm:inline">Arquivar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnarchive(lead.id)}
                      className="flex items-center justify-center space-x-0 sm:space-x-2 px-3 py-2 text-sm bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors sm:ml-auto"
                      aria-label="Reativar lead"
                    >
                      <Users className="w-4 h-4" />
                      <span className="hidden sm:inline">Reativar</span>
                    </button>
                  )}
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

      {recentlyOverdue.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 space-y-3">
          {recentlyOverdue.map((lead) => (
            <div key={lead.id} className="w-80 rounded-2xl border border-orange-200 bg-white p-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="text-sm font-semibold">Lead em atraso</span>
                </div>
                <button
                  onClick={() => setRecentlyOverdue((current) => current.filter((item) => item.id !== lead.id))}
                  className="rounded-full p-1 text-slate-500 hover:bg-slate-100"
                  aria-label="Fechar alerta de lead atrasado"
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-900">{lead.nome_completo}</p>
              {lead.responsavel && (
                <p className="text-xs text-slate-600">Responsável: {lead.responsavel}</p>
              )}
              {lead.proximo_retorno && (
                <p className="mt-2 text-xs text-orange-700">Retorno vencido: {formatDateTimeFullBR(lead.proximo_retorno)}</p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedLead(lead);
                    setViewMode('list');
                  }}
                  className="flex-1 rounded-lg bg-orange-100 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-200 transition-colors"
                >
                  Abrir lead
                </button>
                <button
                  onClick={() => setReminderLead(lead)}
                  className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700 transition-colors"
                  type="button"
                >
                  Agendar
                </button>
              </div>
            </div>
          ))}
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
      {ConfirmationDialog}
    </div>
  );
}
