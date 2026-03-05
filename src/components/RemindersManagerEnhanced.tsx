import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { supabase, Reminder, Lead, Contract } from '../lib/supabase';
import {
  Bell, Check, Trash2, AlertCircle, Calendar, Clock, Search,
  CheckSquare, Square, Timer, ExternalLink, BarChart3,
  ChevronDown, ChevronUp, Tag, X, MessageCircle, Loader2, MessageSquare,
  RefreshCw, Sparkles, Copy, CalendarPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateTimeForInput, formatDateTimeFullBR, isOverdue } from '../lib/dateUtils';
import {
  groupRemindersByPeriod,
  getPeriodLabel,
  getPeriodColor,
  calculateSnoozeTime,
  getUrgencyLevel,
  getUrgencyStyles,
  formatEstimatedTime,
  ReminderPeriod
} from '../lib/reminderUtils';
import RemindersCalendar from './RemindersCalendar';
import ReminderSchedulerModal from './ReminderSchedulerModal';
import LeadForm from './LeadForm';
import FilterSingleSelect from './FilterSingleSelect';
import { useConfirmationModal } from '../hooks/useConfirmationModal';
import { getWhatsAppMessageHistory, normalizeChatId, type WhapiMessage } from '../lib/whatsappApiService';
import { usePanelMotion } from '../hooks/usePanelMotion';
import { useAdaptiveLoading } from '../hooks/useAdaptiveLoading';
import Button from './ui/Button';
import DateTimePicker from './ui/DateTimePicker';
import Input from './ui/Input';
import ModalShell from './ui/ModalShell';
import { RemindersPageSkeleton } from './ui/panelSkeletons';
import { PanelAdaptiveLoadingFrame } from './ui/panelLoading';

const getWhatsappLink = (phone: string | null | undefined) => {
  if (!phone) return null;

  const normalized = phone.replace(/\D/g, '');
  return normalized ? `https://wa.me/55${normalized}` : null;
};

const normalizeLeadPhone = (phone: string | null | undefined) => phone?.replace(/\D/g, '') ?? '';

const formatHistoryTimestamp = (timestamp: number) => {
  const parsedTimestamp = String(timestamp).length <= 10 ? timestamp * 1000 : timestamp;
  const date = new Date(parsedTimestamp);

  if (Number.isNaN(date.getTime())) {
    return 'Data indisponível';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatInteractionDate = formatDateTimeFullBR;

export default function RemindersManagerEnhanced() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<'todos' | 'nao-lidos' | 'lidos'>('nao-lidos');
  const [loading, setLoading] = useState(true);
  const [selectedReminders, setSelectedReminders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [showStats, setShowStats] = useState(false);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<ReminderPeriod>>(
    new Set(['overdue', 'today', 'tomorrow'])
  );
  const [openSnoozeMenu, setOpenSnoozeMenu] = useState<string | null>(null);
  const [customSnoozeReminder, setCustomSnoozeReminder] = useState<string | null>(null);
  const [customSnoozeDateTime, setCustomSnoozeDateTime] = useState('');
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(new Map());
  const [showCalendar, setShowCalendar] = useState(false);
  const [contractsMap, setContractsMap] = useState<Map<string, Contract>>(new Map());
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [reminderPendingDeletion, setReminderPendingDeletion] = useState<Reminder | null>(null);
  const [isDeletingReminder, setIsDeletingReminder] = useState(false);
  type ManualReminderPrompt = {
    lead: Lead;
    promptMessage: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultType?: 'Retorno' | 'Follow-up' | 'Outro';
    defaultPriority?: 'normal' | 'alta' | 'baixa';
  };

  const [manualReminderQueue, setManualReminderQueue] = useState<ManualReminderPrompt[]>([]);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const pendingRefreshIdsRef = useRef<Set<string>>(new Set());
  const snoozeMenuRef = useRef<HTMLDivElement | null>(null);
  const [historyModalData, setHistoryModalData] = useState<{
    phone: string;
    leadName?: string;
    leadId?: string;
  } | null>(null);
  const [historyMessages, setHistoryMessages] = useState<{
    id: string;
    body: string;
    timestamp: number;
    fromMe: boolean;
  }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const [generatedFollowUp, setGeneratedFollowUp] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpCopied, setFollowUpCopied] = useState(false);
  const [followUpApproved, setFollowUpApproved] = useState(false);
  const [followUpBlocks, setFollowUpBlocks] = useState<string[]>([]);
  const [markingLostLeadId, setMarkingLostLeadId] = useState<string | null>(null);
  const [quickSchedulingAction, setQuickSchedulingAction] = useState<{
    reminderId: string;
    daysAhead: 1 | 2;
  } | null>(null);
  const remindersRootRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedSectionsRef = useRef(false);
  const { motionEnabled, sectionDuration, sectionStagger, revealDistance, ease } = usePanelMotion();
  const loadingUi = useAdaptiveLoading(loading);

  const getLeadIdForReminder = (reminder?: Reminder | null) => {
    if (!reminder) return null;
    if (reminder.lead_id) return reminder.lead_id;

    if (reminder.contract_id) {
      const contract = contractsMap.get(reminder.contract_id);
      if (contract?.lead_id) return contract.lead_id;
    }

    return null;
  };

  const closeHistoryModal = () => {
    setHistoryModalData(null);
    setHistoryMessages([]);
    setHistoryError(null);
    setHistoryLoading(false);
    setGeneratedFollowUp(null);
    setFollowUpError(null);
    setFollowUpCopied(false);
    setGeneratingFollowUp(false);
    setFollowUpApproved(false);
    setFollowUpBlocks([]);
  };

  const fetchHistoryMessages = async (phone: string) => {
    setHistoryLoading(true);
    setHistoryError(null);

    const normalizedPhone = phone.replace(/\D/g, '');
    const chatId = normalizeChatId(normalizedPhone);

    try {
      const response = await getWhatsAppMessageHistory({
        chatId,
        count: 100,
        sort: 'asc',
      });

      const normalizedMessages = response.messages.map((message: WhapiMessage) => ({
        id: message.id,
        body: message.text?.body || '[Mídia]',
        timestamp: message.timestamp * 1000,
        fromMe: message.from_me,
      }));

      setHistoryMessages(normalizedMessages);
    } catch (error) {
      console.error('Erro ao buscar histórico de mensagens do lead:', error);
      setHistoryMessages([]);
      setHistoryError('Não foi possível carregar o histórico de mensagens.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = (leadName?: string, phone?: string | null, leadId?: string | null) => {
    const normalizedPhone = normalizeLeadPhone(phone);
    setHistoryModalData({
      phone: normalizedPhone,
      leadName,
      leadId: leadId ?? undefined,
    });
    setHistoryMessages([]);

    if (!normalizedPhone) {
      setHistoryError('Telefone do lead não disponível para buscar o histórico.');
      return;
    }

    setGeneratedFollowUp(null);
    setFollowUpError(null);
    setFollowUpCopied(false);
    setGeneratingFollowUp(false);

    void fetchHistoryMessages(normalizedPhone);
  };

  const buildConversationHistory = () => {
    if (historyMessages.length === 0) {
      return 'Nenhuma mensagem encontrada no histórico recente.';
    }

    const participantName = historyModalData?.leadName ?? 'Lead';

    return historyMessages
      .map(message => {
        const sender = message.fromMe ? 'Você' : participantName;
        return `- [${formatHistoryTimestamp(message.timestamp)}] ${sender}: ${message.body}`;
      })
      .join('\n');
  };

  const buildLeadContext = () => {
    if (!historyModalData?.leadId) return '';

    const leadData = leadsMap.get(historyModalData.leadId);

    if (!leadData) return '';

    return [
      `Telefone: ${leadData.telefone ?? 'Indisponível'}`,
      leadData.email ? `E-mail: ${leadData.email}` : null,
      `Status: ${leadData.status ?? 'Sem status'}`,
      leadData.responsavel ? `Responsável: ${leadData.responsavel}` : null,
      leadData.ultimo_contato
        ? `Último contato: ${formatInteractionDate(leadData.ultimo_contato)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleGenerateFollowUp = async () => {
    if (!historyModalData) return;

    setGeneratingFollowUp(true);
    setFollowUpError(null);
    setGeneratedFollowUp(null);
    setFollowUpCopied(false);
    setFollowUpApproved(false);
    setFollowUpBlocks([]);

    try {
      const conversationHistory = buildConversationHistory();
      const leadContext = buildLeadContext();

      const { data, error } = await supabase.functions.invoke<{ followUp?: string }>('generate-follow-up', {
        body: {
          leadName: historyModalData.leadName ?? 'Lead',
          conversationHistory,
          leadContext,
        },
      });

      if (error) throw error;

      if (!data?.followUp) {
        throw new Error('Resposta vazia do gerador de follow-up.');
      }

      setGeneratedFollowUp(data.followUp.trim());
    } catch (error) {
      console.error('Erro ao gerar follow-up:', error);
      setFollowUpError('Não foi possível gerar o follow-up automaticamente. Tente novamente em instantes.');
    } finally {
      setGeneratingFollowUp(false);
    }
  };

  const splitFollowUpIntoBlocks = (text: string) => {
    const normalized = text.trim().replace(/\r\n/g, '\n');
    const paragraphBlocks = normalized
      .split(/\n\s*\n/)
      .map(block => block.trim())
      .filter(Boolean);

    if (paragraphBlocks.length > 0) return paragraphBlocks;

    return normalized
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  };

  const handleApproveFollowUp = () => {
    if (!generatedFollowUp) return;

    const blocks = splitFollowUpIntoBlocks(generatedFollowUp);
    setFollowUpBlocks(blocks);
    setFollowUpApproved(true);
  };

  const handleUpdateBlock = (index: number, value: string) => {
    setFollowUpBlocks(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleCopyFollowUp = async () => {
    if (!generatedFollowUp) return;

    try {
      await navigator.clipboard.writeText(generatedFollowUp);
      setFollowUpCopied(true);
      setTimeout(() => setFollowUpCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar follow-up:', error);
    }
  };

  useEffect(() => {
    loadReminders({ showLoading: true });

    const channel = supabase
      .channel('reminders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders'
        },
        payload => {
          const newReminder = payload.new as Reminder | null;
          const oldReminder = payload.old as Reminder | null;
          const affectedId = newReminder?.id ?? oldReminder?.id;

          if (affectedId && pendingRefreshIdsRef.current.has(affectedId)) {
            pendingRefreshIdsRef.current.delete(affectedId);
            return;
          }

          loadReminders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadReminders = async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? false;

    if (showLoading) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .order('data_lembrete', { ascending: true });

      if (error) throw error;
      setReminders(data || []);

      const contractIds = [...new Set((data || []).map(r => r.contract_id).filter(Boolean))];
      let fetchedContracts = [] as Contract[];

      if (contractIds.length > 0) {
        const { data: contractsData } = await supabase
          .from('contracts')
          .select('*')
          .in('id', contractIds);

        if (contractsData) {
          fetchedContracts = contractsData as Contract[];
          const newContractsMap = new Map();
          contractsData.forEach(contract => newContractsMap.set(contract.id, contract));
          setContractsMap(newContractsMap);
        }
      }

      const contractLeadIds = [
        ...new Set(
          fetchedContracts
            .map(contract => contract.lead_id)
            .filter(Boolean) as string[]
        ),
      ];

      const leadIds = [
        ...new Set([
          ...(data || []).map(r => r.lead_id).filter(Boolean),
          ...contractLeadIds,
        ]),
      ];

      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('*')
          .in('id', leadIds);

        if (leadsData) {
          const newLeadsMap = new Map();
          leadsData.forEach(lead => newLeadsMap.set(lead.id, lead));
          setLeadsMap(newLeadsMap);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchLeadInfo = async (leadId: string) => {
    if (!leadId) {
      return null;
    }

    const cachedLead = leadsMap.get(leadId);
    if (cachedLead) {
      return cachedLead;
    }

    setLoadingLeadId(leadId);

    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const leadData = data as Lead;

      setLeadsMap(current => {
        const next = new Map(current);
        next.set(leadData.id, leadData);
        return next;
      });

      return leadData;
    } catch (error) {
      console.error('Erro ao carregar dados do lead:', error);
      return null;
    } finally {
      setLoadingLeadId(null);
    }
  };

  const handleOpenLead = async (leadId: string) => {
    if (!leadId) {
      return;
    }

    const leadData = await fetchLeadInfo(leadId);

    if (!leadData) {
      alert('Não foi possível localizar os dados deste lead.');
      return;
    }

    setEditingLead(leadData);
  };

  const handleLeadSaved = (_lead?: Lead, _context?: { created: boolean }) => {
    setEditingLead(null);
    loadReminders();
  };

  const updateLeadNextReturnDate = async (
    leadId: string,
    nextReturnDate: string | null,
    options?: { onlyIfMatches?: string }
  ) => {
    try {
      let query = supabase
        .from('leads')
        .update({ proximo_retorno: nextReturnDate })
        .eq('id', leadId);

      if (options?.onlyIfMatches) {
        query = query.eq('proximo_retorno', options.onlyIfMatches);
      }

      const { error } = await query;

      if (error) throw error;

      setLeadsMap(prev => {
        const next = new Map(prev);
        const existing = next.get(leadId);
        if (existing) {
          next.set(leadId, { ...existing, proximo_retorno: nextReturnDate });
        }
        return next;
      });
    } catch (error) {
      console.error('Erro ao sincronizar próximo retorno do lead:', error);
    }
  };

  const handleMarkLeadAsLost = async (reminder: Reminder) => {
    const leadId = getLeadIdForReminder(reminder);

    if (!leadId) {
      alert('Não foi possível identificar o lead deste lembrete.');
      return;
    }

    const leadInfo = leadsMap.get(leadId) ?? await fetchLeadInfo(leadId);
    const leadName = leadInfo?.nome_completo ?? 'este lead';
    const previousStatus = leadInfo?.status ?? 'Sem status';

    const confirmed = await requestConfirmation({
      title: 'Marcar lead como perdido',
      description: `Deseja marcar ${leadName} como perdido e remover os follow-ups pendentes?`,
      confirmLabel: 'Marcar como perdido',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    setMarkingLostLeadId(leadId);

    try {
      const nowISO = new Date().toISOString();

      const { error: updateLeadError } = await supabase
        .from('leads')
        .update({
          status: 'Perdido',
          proximo_retorno: null,
          ultimo_contato: nowISO,
        })
        .eq('id', leadId);

      if (updateLeadError) throw updateLeadError;

      if (leadInfo) {
        const interactionPayload = {
          lead_id: leadId,
          tipo: 'Observação',
          descricao: `Status alterado de "${previousStatus}" para "Perdido"`,
          responsavel: leadInfo.responsavel,
        };

        const statusHistoryPayload = {
          lead_id: leadId,
          status_anterior: previousStatus,
          status_novo: 'Perdido',
          responsavel: leadInfo.responsavel,
        };

        await supabase.from('interactions').insert([interactionPayload]);
        await supabase.from('lead_status_history').insert([statusHistoryPayload]);
      }

      const { error: deleteRemindersError } = await supabase
        .from('reminders')
        .delete()
        .eq('lead_id', leadId);

      if (deleteRemindersError) throw deleteRemindersError;

      setLeadsMap(prev => {
        const next = new Map(prev);
        const existing = next.get(leadId);

        if (existing) {
          next.set(leadId, {
            ...existing,
            status: 'Perdido',
            proximo_retorno: null,
            ultimo_contato: nowISO,
          });
        }

        return next;
      });

      setSelectedReminders(prev => {
        const next = new Set(prev);
        reminders.forEach(item => {
          if (getLeadIdForReminder(item) === leadId) {
            next.delete(item.id);
          }
        });
        return next;
      });

      setReminders(current => current.filter(item => getLeadIdForReminder(item) !== leadId));
    } catch (error) {
      console.error('Erro ao marcar lead como perdido:', error);
      alert('Não foi possível marcar o lead como perdido.');
    } finally {
      setMarkingLostLeadId(null);
    }
  };

  const handleMarkAsRead = async (
    id: string,
    currentStatus: boolean,
    options?: { queueNextReminderPrompt?: boolean }
  ): Promise<boolean> => {
    try {
      pendingRefreshIdsRef.current.add(id);
      const queueNextReminderPrompt = options?.queueNextReminderPrompt ?? true;
      
      const reminder = reminders.find(r => r.id === id);
      const leadId = getLeadIdForReminder(reminder);
      const completionDate = !currentStatus ? new Date().toISOString() : null;
      const updateData: Pick<Reminder, 'lido' | 'concluido_em'> = {
        lido: !currentStatus,
        concluido_em: completionDate ?? undefined,
      };

      const { error } = await supabase
        .from('reminders')
        .update(updateData)
        .eq('id', id);

      if (error) {
        pendingRefreshIdsRef.current.delete(id);
        throw error;
      }

      if (completionDate && leadId && reminder) {
        await updateLeadNextReturnDate(leadId, null, {
          onlyIfMatches: reminder.data_lembrete,
        });

        if (queueNextReminderPrompt) {
          let leadInfo = leadsMap.get(leadId);

          if (!leadInfo) {
            const { data: leadData } = await supabase
              .from('leads')
              .select('id, nome_completo, telefone, proximo_retorno')
              .eq('id', leadId)
              .maybeSingle();

            if (leadData) {
              leadInfo = leadData as Lead;
              setLeadsMap(prev => {
                const next = new Map(prev);
                next.set(leadInfo!.id, leadInfo!);
                return next;
              });
            }
          }

          if (leadInfo) {
            setManualReminderQueue(prev => [
              ...prev,
              {
                lead: leadInfo,
                promptMessage: 'Deseja marcar um próximo lembrete para este lead?',
                defaultTitle: reminder.titulo,
                defaultDescription: reminder.descricao ?? undefined,
                defaultType: 'Follow-up',
                defaultPriority: (['normal', 'alta', 'baixa'] as const).includes(reminder.prioridade as any)
                  ? (reminder.prioridade as 'normal' | 'alta' | 'baixa')
                  : 'normal',
              },
            ]);
          }
        }
      }
      setReminders(currentReminders =>
        currentReminders.map(reminderItem =>
          reminderItem.id === id
            ? {
                ...reminderItem,
                lido: !currentStatus,
                concluido_em: completionDate ?? undefined,
              }
            : reminderItem
        )
      );
      setSelectedReminders(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      pendingRefreshIdsRef.current.add(id);
      return true;
    } catch (error) {
      console.error('Erro ao atualizar lembrete:', error);
      alert('Erro ao atualizar lembrete');
      return false;
    }
  };

  const handleQuickSchedule = async (reminder: Reminder, daysAhead: 1 | 2) => {
    if (reminder.lido) return;

    const leadId = getLeadIdForReminder(reminder);
    if (!leadId) {
      alert('Não foi possível identificar o lead deste lembrete.');
      return;
    }

    const sourceDate = new Date(reminder.data_lembrete);
    const nextReminderDate = new Date();

    if (!Number.isNaN(sourceDate.getTime())) {
      nextReminderDate.setHours(sourceDate.getHours(), sourceDate.getMinutes(), 0, 0);
    }

    nextReminderDate.setDate(nextReminderDate.getDate() + daysAhead);
    const nextReminderDateISO = nextReminderDate.toISOString();

    setQuickSchedulingAction({ reminderId: reminder.id, daysAhead });

    try {
      const markedAsRead = await handleMarkAsRead(reminder.id, reminder.lido, {
        queueNextReminderPrompt: false,
      });

      if (!markedAsRead) {
        return;
      }

      const payload = {
        lead_id: leadId,
        contract_id: reminder.contract_id ?? undefined,
        tipo: reminder.tipo,
        titulo: reminder.titulo,
        descricao: reminder.descricao ?? null,
        data_lembrete: nextReminderDateISO,
        lido: false,
        prioridade: reminder.prioridade,
      };

      const { data: createdReminder, error: insertError } = await supabase
        .from('reminders')
        .insert([payload])
        .select('*')
        .maybeSingle();

      if (insertError) throw insertError;

      await updateLeadNextReturnDate(leadId, nextReminderDateISO);

      if (createdReminder) {
        const nextReminder = createdReminder as Reminder;
        setReminders(current =>
          [...current, nextReminder].sort(
            (a, b) => new Date(a.data_lembrete).getTime() - new Date(b.data_lembrete).getTime()
          )
        );
      }
    } catch (error) {
      console.error('Erro ao agendar lembrete rápido:', error);
      alert('Não foi possível criar o novo lembrete rápido.');
    } finally {
      setQuickSchedulingAction(null);
    }
  };

  const handleDelete = (id: string) => {
    const reminder = reminders.find(item => item.id === id);
    if (reminder) {
      setReminderPendingDeletion(reminder);
    }
  };

  const confirmDeleteReminder = async () => {
    if (!reminderPendingDeletion) return;

    const reminderToDelete = reminderPendingDeletion;

    setIsDeletingReminder(true);
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderToDelete.id);

      if (error) throw error;
      setReminders(currentReminders => currentReminders.filter(reminder => reminder.id !== reminderToDelete.id));
      setSelectedReminders(prev => {
        if (!prev.has(reminderToDelete.id)) return prev;
        const next = new Set(prev);
        next.delete(reminderToDelete.id);
        return next;
      });
      pendingRefreshIdsRef.current.add(reminderToDelete.id);

      if (reminderToDelete.lead_id) {
        await updateLeadNextReturnDate(reminderToDelete.lead_id, null, {
          onlyIfMatches: reminderToDelete.data_lembrete,
        });
      }
    } catch (error) {
      console.error('Erro ao remover lembrete:', error);
      alert('Erro ao remover lembrete');
    } finally {
      setIsDeletingReminder(false);
      setReminderPendingDeletion(null);
    }
  };

  const handleSnooze = async (reminder: Reminder, option: 'minutes-15' | 'minutes-30' | 'hour-1' | 'tomorrow' | 'next-week') => {
    try {
      const newDate = calculateSnoozeTime(option);
      const currentSnoozeCount = reminder.snooze_count || 0;

      const { error } = await supabase
        .from('reminders')
        .update({
          data_lembrete: newDate,
          snooze_count: currentSnoozeCount + 1
        })
        .eq('id', reminder.id);

      if (error) throw error;
      if (reminder.lead_id) {
        await updateLeadNextReturnDate(reminder.lead_id, newDate);
      }
      setOpenSnoozeMenu(null);
      setReminders(current =>
        current.map(item =>
          item.id === reminder.id
            ? {
                ...item,
                data_lembrete: newDate,
                snooze_count: currentSnoozeCount + 1,
              }
            : item
        )
      );
    } catch (error) {
      console.error('Erro ao adiar lembrete:', error);
      alert('Erro ao adiar lembrete');
    }
  };

  const handleCustomSnooze = async () => {
    if (!customSnoozeReminder || !customSnoozeDateTime) return;

    try {
      const reminder = reminders.find(r => r.id === customSnoozeReminder);
      if (!reminder) return;

      const currentSnoozeCount = reminder.snooze_count || 0;

      const newDate = new Date(customSnoozeDateTime).toISOString();

      const { error } = await supabase
        .from('reminders')
        .update({
          data_lembrete: newDate,
          snooze_count: currentSnoozeCount + 1
        })
        .eq('id', customSnoozeReminder);

      if (error) throw error;
      if (reminder.lead_id) {
        await updateLeadNextReturnDate(reminder.lead_id, newDate);
      }
      setCustomSnoozeReminder(null);
      setCustomSnoozeDateTime('');
      setOpenSnoozeMenu(null);
      setReminders(current =>
        current.map(item =>
          item.id === reminder.id
            ? {
                ...item,
                data_lembrete: newDate,
                snooze_count: currentSnoozeCount + 1,
              }
            : item
        )
      );
    } catch (error) {
      console.error('Erro ao adiar lembrete:', error);
      alert('Erro ao adiar lembrete');
    }
  };

  const handleRescheduleReminder = async (reminderId: string, newDate: Date) => {
    try {
      const reminder = reminders.find(r => r.id === reminderId);
      if (!reminder) return;

      const reminderDateTime = new Date(reminder.data_lembrete);
      const newDateTime = new Date(newDate);
      newDateTime.setHours(reminderDateTime.getHours(), reminderDateTime.getMinutes(), 0, 0);

      const newDateISO = newDateTime.toISOString();

      const { error } = await supabase
        .from('reminders')
        .update({
          data_lembrete: newDateISO
        })
        .eq('id', reminderId);

      if (error) throw error;

      if (reminder.lead_id) {
        await updateLeadNextReturnDate(reminder.lead_id, newDateISO);
      }
      setReminders(current =>
        current.map(item =>
          item.id === reminderId
            ? {
                ...item,
                data_lembrete: newDateISO,
              }
            : item
        )
      );
    } catch (error) {
      console.error('Erro ao reagendar lembrete:', error);
      alert('Erro ao reagendar lembrete');
    }
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedReminders.size === 0) return;

    try {
      const remindersToUpdate = reminders.filter(
        reminder => selectedReminders.has(reminder.id) && !reminder.lido
      );
      const completionDate = new Date().toISOString();

      const { error } = await supabase
        .from('reminders')
        .update({
          lido: true,
          concluido_em: completionDate
        })
        .in('id', Array.from(selectedReminders));

      if (error) throw error;

      const leadUpdates = remindersToUpdate
        .map(reminder => ({ reminder, leadId: getLeadIdForReminder(reminder) }))
        .filter(({ leadId }) => Boolean(leadId))
        .map(({ reminder, leadId }) =>
          updateLeadNextReturnDate(leadId!, null, {
            onlyIfMatches: reminder.data_lembrete,
          })
        );

      await Promise.all(leadUpdates);

      const reminderLeadPairs = remindersToUpdate
        .map(reminder => ({ reminder, leadId: getLeadIdForReminder(reminder) }))
        .filter(({ leadId }) => Boolean(leadId));

      const missingLeadIds = Array.from(
        new Set(reminderLeadPairs.map(({ leadId }) => leadId).filter(leadId => leadId && !leadsMap.has(leadId)))
      ) as string[];

      let fetchedLeads = [] as Lead[];

      if (missingLeadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, nome_completo, telefone, proximo_retorno')
          .in('id', missingLeadIds);

        if (leadsData) {
          fetchedLeads = leadsData as Lead[];
          setLeadsMap(prev => {
            const next = new Map(prev);
            fetchedLeads.forEach(lead => next.set(lead.id, lead));
            return next;
          });
        }
      }

      const fallbackLeadsMap = fetchedLeads.reduce((acc, lead) => {
        acc.set(lead.id, lead);
        return acc;
      }, new Map<string, Lead>());

      const manualPrompts = reminderLeadPairs
        .map(({ reminder, leadId }) => {
          if (!leadId) return null;
          const leadInfo = leadsMap.get(leadId) ?? fallbackLeadsMap.get(leadId);

          if (!leadInfo) return null;

          return {
            lead: leadInfo,
            promptMessage: 'Deseja marcar um próximo lembrete para este lead?',
            defaultTitle: reminder.titulo,
            defaultDescription: reminder.descricao ?? undefined,
            defaultType: 'Follow-up',
            defaultPriority: (['normal', 'alta', 'baixa'] as const).includes(reminder.prioridade as any)
              ? (reminder.prioridade as 'normal' | 'alta' | 'baixa')
              : 'normal',
          } as ManualReminderPrompt;
        })
        .filter((prompt): prompt is ManualReminderPrompt => Boolean(prompt));

      if (manualPrompts.length > 0) {
        setManualReminderQueue(prev => [...prev, ...manualPrompts]);
      }

      setSelectedReminders(new Set());
      setReminders(current =>
        current.map(item =>
          selectedReminders.has(item.id)
            ? {
                ...item,
                lido: true,
                concluido_em: completionDate,
              }
            : item
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar lembretes:', error);
      alert('Erro ao atualizar lembretes');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedReminders.size === 0) return;
    const confirmed = await requestConfirmation({
      title: 'Excluir lembretes selecionados',
      description: `Deseja remover ${selectedReminders.size} lembrete(s)? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir lembretes',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const reminderIds = Array.from(selectedReminders);
      const remindersToDelete = reminders.filter(reminder => reminderIds.includes(reminder.id));

      const { error } = await supabase
        .from('reminders')
        .delete()
        .in('id', reminderIds);

      if (error) throw error;
      setSelectedReminders(new Set());
      const leadUpdates = remindersToDelete
        .filter(reminder => reminder.lead_id)
        .map(reminder =>
          updateLeadNextReturnDate(reminder.lead_id!, null, { onlyIfMatches: reminder.data_lembrete })
        );
      await Promise.all(leadUpdates);
      setReminders(current => current.filter(reminder => !reminderIds.includes(reminder.id)));
    } catch (error) {
      console.error('Erro ao remover lembretes:', error);
      alert('Erro ao remover lembretes');
    }
  };

  const handleMarkAllAsRead = async () => {
    const confirmed = await requestConfirmation({
      title: 'Marcar lembretes como lidos',
      description: 'Deseja marcar todos os lembretes não lidos como lidos?',
      confirmLabel: 'Marcar como lidos',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          lido: true,
          concluido_em: new Date().toISOString()
        })
        .eq('lido', false);

      if (error) throw error;
      const completionDate = new Date().toISOString();
      setReminders(current =>
        current.map(item =>
          item.lido
            ? item
            : {
                ...item,
                lido: true,
                concluido_em: completionDate,
              }
        )
      );
    } catch (error) {
      console.error('Erro ao atualizar lembretes:', error);
      alert('Erro ao atualizar lembretes');
    }
  };

  const toggleReminderSelection = (id: string) => {
    const newSelection = new Set(selectedReminders);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedReminders(newSelection);
  };

  const togglePeriod = (period: ReminderPeriod) => {
    const newExpanded = new Set(expandedPeriods);
    if (newExpanded.has(period)) {
      newExpanded.delete(period);
    } else {
      newExpanded.add(period);
    }
    setExpandedPeriods(newExpanded);
  };

  const filteredReminders = reminders.filter(reminder => {
    if (filter === 'nao-lidos' && reminder.lido) {
      return false;
    }
    if (filter === 'lidos' && !reminder.lido) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        reminder.titulo.toLowerCase().includes(query) ||
        (reminder.descricao && reminder.descricao.toLowerCase().includes(query)) ||
        reminder.tipo.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    if (typeFilter !== 'all' && reminder.tipo !== typeFilter) {
      return false;
    }

    if (priorityFilter !== 'all' && reminder.prioridade !== priorityFilter) {
      return false;
    }

    return true;
  });

  const groupedReminders = groupRemindersByPeriod(filteredReminders);

  const stats = {
    total: reminders.length,
    unread: reminders.filter(r => !r.lido).length,
    overdue: reminders.filter(r => isOverdue(r.data_lembrete) && !r.lido).length,
    today: groupedReminders.today.length,
    completed: reminders.filter(r => r.lido).length
  };

  useEffect(() => {
    if (loading || hasAnimatedSectionsRef.current) {
      return;
    }

    const root = remindersRootRef.current;
    if (!root) {
      return;
    }

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-panel-animate]'));
    if (sections.length === 0) {
      return;
    }

    if (!motionEnabled) {
      gsap.set(sections, {
        autoAlpha: 1,
        y: 0,
        clearProps: 'transform,opacity,willChange',
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
          willChange: 'transform,opacity',
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: sectionDuration,
          ease,
          stagger: sectionStagger,
          clearProps: 'transform,opacity,willChange',
          overwrite: 'auto',
          force3D: true,
        },
      );
    }, root);

    hasAnimatedSectionsRef.current = true;

    return () => {
      context.revert();
    };
  }, [ease, loading, motionEnabled, revealDistance, sectionDuration, sectionStagger]);

  useEffect(() => {
    if (!openSnoozeMenu) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (snoozeMenuRef.current && !snoozeMenuRef.current.contains(target)) {
        setOpenSnoozeMenu(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [openSnoozeMenu]);

  const getPriorityColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      'baixa': 'bg-blue-100 text-blue-700',
      'normal': 'bg-slate-100 text-slate-700',
      'alta': 'bg-red-100 text-red-700',
    };
    return colors[prioridade] || 'bg-slate-100 text-slate-700';
  };

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, LucideIcon> = {
      'Documentos pendentes': AlertCircle,
      'Assinatura': AlertCircle,
      'Ativação': Calendar,
      'Renovação': Calendar,
      'Retorno': Bell,
    };
    const Icon = icons[tipo] || Bell;
    return <Icon className="w-5 h-5" />;
  };

  const renderReminderCard = (reminder: Reminder) => {
    const overdue = isOverdue(reminder.data_lembrete);
    const urgency = getUrgencyLevel(reminder);
    const isSelected = selectedReminders.has(reminder.id);
    const contract = reminder.contract_id ? contractsMap.get(reminder.contract_id) : undefined;
    const leadInfo = reminder.lead_id
      ? leadsMap.get(reminder.lead_id)
      : contract?.lead_id
        ? leadsMap.get(contract.lead_id)
        : undefined;
    const whatsappLink = getWhatsappLink(leadInfo?.telefone);
    const leadIdForReminder = getLeadIdForReminder(reminder);

    return (
      <div
        key={reminder.id}
        className={`panel-glass-lite panel-interactive-glass rounded-xl border bg-white p-5 shadow-sm transition-all ${
          reminder.lido
            ? 'border-slate-200 opacity-60'
            : `${getUrgencyStyles(urgency)}`
        } ${isSelected ? 'ring-2 ring-teal-500' : ''}`}
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start space-x-4 xl:flex-1">
            <Button
              onClick={() => toggleReminderSelection(reminder.id)}
              variant="icon"
              size="icon"
              className="mt-1 h-8 w-8 text-slate-400 hover:text-teal-600"
            >
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-teal-600" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </Button>

            <div className={`p-3 rounded-lg ${
              reminder.lido
                ? 'bg-slate-100 text-slate-500'
                : overdue
                ? 'bg-red-100 text-red-600'
                : 'bg-teal-100 text-teal-600'
            }`}>
              {getTipoIcon(reminder.tipo)}
            </div>

            <div className="flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {reminder.titulo}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(reminder.prioridade)}`}>
                  {reminder.prioridade}
                </span>
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                  {reminder.tipo}
                </span>
                {reminder.tempo_estimado_minutos && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center space-x-1">
                    <Timer className="w-3 h-3" />
                    <span>{formatEstimatedTime(reminder.tempo_estimado_minutos)}</span>
                  </span>
                )}
              </div>

              {reminder.descricao && (
                <p className="text-slate-600 mb-3 text-sm">{reminder.descricao}</p>
              )}

              {reminder.tags && reminder.tags.length > 0 && (
                <div className="flex items-center space-x-2 mb-3">
                  {reminder.tags.map((tag, index) => (
                    <span key={index} className="flex items-center space-x-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                      <Tag className="w-3 h-3" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                </div>
                {overdue && !reminder.lido && (
                  <span className="text-red-600 font-medium">Atrasado </span>
                )}
                {typeof reminder.snooze_count === 'number' && reminder.snooze_count > 0 && (
                  <span className="text-orange-600 text-xs">
                    Adiado {reminder.snooze_count}x
                  </span>
                )}
                {(reminder.lead_id || reminder.contract_id) && (
                  <ReminderContextLink
                    leadId={reminder.lead_id ?? contract?.lead_id}
                    contractId={reminder.contract_id}
                    leadName={leadInfo?.nome_completo}
                    onLeadClick={handleOpenLead}
                    isLoading={loadingLeadId === reminder.lead_id}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:ml-4 xl:w-auto">
            <Button
              onClick={() => openHistoryModal(leadInfo?.nome_completo, leadInfo?.telefone, reminder.lead_id ?? contract?.lead_id ?? null)}
              disabled={!leadInfo?.telefone}
              variant="icon"
              size="icon"
              className={`h-9 w-9 ${
                leadInfo?.telefone
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-400 cursor-not-allowed'
              }`}
              title={leadInfo?.telefone ? 'Ver histórico de mensagens' : 'Telefone não disponível'}
            >
              <MessageSquare className="w-5 h-5" />
            </Button>
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Abrir conversa no WhatsApp"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            )}
            {leadIdForReminder && (
              <Button
                onClick={() => leadIdForReminder && handleMarkLeadAsLost(reminder)}
                variant="icon"
                size="icon"
                className="h-9 w-9 text-red-700 hover:bg-red-50"
                title="Marcar lead como perdido e limpar follow-ups"
                disabled={markingLostLeadId === leadIdForReminder}
                loading={markingLostLeadId === leadIdForReminder}
              >
                {markingLostLeadId !== leadIdForReminder && <X className="w-5 h-5" />}
              </Button>
            )}
            {!reminder.lido && (
              <div
                className="relative"
                ref={openSnoozeMenu === reminder.id ? snoozeMenuRef : null}
              >
                <Button
                  onClick={() => setOpenSnoozeMenu(openSnoozeMenu === reminder.id ? null : reminder.id)}
                  variant="icon"
                  size="icon"
                  className="h-9 w-9 text-orange-600 hover:bg-orange-50"
                  title="Adiar"
                >
                  <Clock className="w-5 h-5" />
                </Button>
                {openSnoozeMenu === reminder.id && (
                  <div className="panel-glass-panel absolute right-0 top-full z-20 mt-2 min-w-[180px] rounded-lg border border-slate-200 bg-white py-2 shadow-lg">
                    <button
                      onClick={() => handleSnooze(reminder, 'minutes-15')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                    >
                      15 minutos
                    </button>
                    <button
                      onClick={() => handleSnooze(reminder, 'minutes-30')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                    >
                      30 minutos
                    </button>
                    <button
                      onClick={() => handleSnooze(reminder, 'hour-1')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                    >
                      1 hora
                    </button>
                    <button
                      onClick={() => handleSnooze(reminder, 'tomorrow')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                    >
                      Amanhã às 9h
                    </button>
                    <button
                      onClick={() => handleSnooze(reminder, 'next-week')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                    >
                      Próxima semana
                    </button>
                    <div className="border-t border-slate-200 my-2"></div>
                    <button
                      onClick={() => {
                        setCustomSnoozeReminder(reminder.id);
                        setOpenSnoozeMenu(null);
                        const now = new Date();
                        now.setMinutes(now.getMinutes() + 30);
                        setCustomSnoozeDateTime(formatDateTimeForInput(now.toISOString()));
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors text-teal-600 font-medium"
                    >
                      Personalizado...
                    </button>
                  </div>
                )}
              </div>
            )}
            {!reminder.lido && (
              <>
                <Button
                  onClick={() => handleQuickSchedule(reminder, 1)}
                  disabled={quickSchedulingAction?.reminderId === reminder.id}
                  variant="icon"
                  size="icon"
                  className="h-9 w-9 text-teal-600 hover:bg-teal-50"
                  title="Agendar para 1 dia e marcar atual como lido"
                >
                  {quickSchedulingAction?.reminderId === reminder.id && quickSchedulingAction.daysAhead === 1 ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="relative inline-flex">
                      <CalendarPlus className="w-5 h-5" />
                      <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold leading-none text-teal-700 ring-1 ring-teal-200">
                        1
                      </span>
                    </span>
                  )}
                </Button>
                <Button
                  onClick={() => handleQuickSchedule(reminder, 2)}
                  disabled={quickSchedulingAction?.reminderId === reminder.id}
                  variant="icon"
                  size="icon"
                  className="h-9 w-9 text-teal-600 hover:bg-teal-50"
                  title="Agendar para 2 dias e marcar atual como lido"
                >
                  {quickSchedulingAction?.reminderId === reminder.id && quickSchedulingAction.daysAhead === 2 ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span className="relative inline-flex">
                      <CalendarPlus className="w-5 h-5" />
                      <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold leading-none text-teal-700 ring-1 ring-teal-200">
                        2
                      </span>
                    </span>
                  )}
                </Button>
              </>
            )}
            <Button
              onClick={() => handleMarkAsRead(reminder.id, reminder.lido)}
              variant="icon"
              size="icon"
              className={`h-9 w-9 ${
                reminder.lido
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-green-600 hover:bg-green-50'
              }`}
              title={reminder.lido ? 'Marcar como não lido' : 'Marcar como lido'}
            >
              <Check className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => handleDelete(reminder.id)}
              variant="icon"
              size="icon"
              className="h-9 w-9 text-red-600 hover:bg-red-50"
              title="Remover"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const hasRemindersSnapshot = reminders.length > 0;

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasRemindersSnapshot}
      skeleton={<RemindersPageSkeleton />}
      stageLabel="Carregando lembretes..."
      overlayLabel="Atualizando lembretes..."
      stageClassName="panel-dashboard-immersive"
    >
    <div ref={remindersRootRef} className="panel-dashboard-immersive">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-panel-animate>
        <h2 className="text-2xl font-bold text-slate-900">Lembretes e Notificações</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setShowCalendar(true)}
            variant="secondary"
            size="icon"
            title="Ver Calendário"
          >
            <Calendar className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => setShowStats(!showStats)}
            variant={showStats ? 'primary' : 'secondary'}
            size="icon"
            title="Estatísticas"
          >
            <BarChart3 className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => setFilter('nao-lidos')}
            variant={filter === 'nao-lidos' ? 'primary' : 'secondary'}
            size="md"
          >
            Não Lidos ({stats.unread})
          </Button>
          <Button
            onClick={() => setFilter('todos')}
            variant={filter === 'todos' ? 'primary' : 'secondary'}
            size="md"
          >
            Todos ({stats.total})
          </Button>
          <Button
            onClick={() => setFilter('lidos')}
            variant={filter === 'lidos' ? 'primary' : 'secondary'}
            size="md"
          >
            Lidos ({stats.completed})
          </Button>
        </div>
      </div>

      {showStats && (
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5" data-panel-animate>
          <div className="panel-glass-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-600 mb-1">Total</div>
            <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="panel-glass-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-600 mb-1">Não Lidos</div>
            <div className="text-3xl font-bold text-orange-600">{stats.unread}</div>
          </div>
          <div className="panel-glass-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-600 mb-1">Atrasados</div>
            <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
          </div>
          <div className="panel-glass-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-600 mb-1">Hoje</div>
            <div className="text-3xl font-bold text-teal-600">{stats.today}</div>
          </div>
          <div className="panel-glass-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-600 mb-1">Concluídos</div>
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          </div>
        </div>
      )}

      <div className="panel-glass-panel mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-panel-animate>
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:space-x-4 sm:gap-0">
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Buscar lembretes por título, descrição ou tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={Search}
              className="pr-10"
            />
            {searchQuery && (
              <Button
                onClick={() => setSearchQuery('')}
                variant="icon"
                size="icon"
                className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>

          <div className="w-full sm:w-52">
            <FilterSingleSelect
              icon={Tag}
              value={typeFilter}
              onChange={(value) => setTypeFilter(value)}
              placeholder="Todos os tipos"
              includePlaceholderOption={false}
              options={[
                { value: 'all', label: 'Todos os tipos' },
                { value: 'Documentos pendentes', label: 'Documentos pendentes' },
                { value: 'Assinatura', label: 'Assinatura' },
                { value: 'Ativação', label: 'Ativação' },
                { value: 'Renovação', label: 'Renovação' },
                { value: 'Retorno', label: 'Retorno' },
              ]}
            />
          </div>

          <div className="w-full sm:w-44">
            <FilterSingleSelect
              icon={AlertCircle}
              value={priorityFilter}
              onChange={(value) => setPriorityFilter(value)}
              placeholder="Todas prioridades"
              includePlaceholderOption={false}
              options={[
                { value: 'all', label: 'Todas prioridades' },
                { value: 'baixa', label: 'Baixa' },
                { value: 'normal', label: 'Normal' },
                { value: 'alta', label: 'Alta' },
              ]}
            />
          </div>

          <Button
            onClick={() => setViewMode(viewMode === 'grouped' ? 'list' : 'grouped')}
            variant="secondary"
            size="md"
          >
            {viewMode === 'grouped' ? 'Lista' : 'Agrupar'}
          </Button>
        </div>

        {selectedReminders.size > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-sm text-slate-600 font-medium">
              {selectedReminders.size} selecionado(s)
            </span>
            <Button
              onClick={handleBatchMarkAsRead}
              variant="primary"
              size="md"
              className="bg-green-600 hover:bg-green-700"
            >
              Marcar como lido
            </Button>
            <Button
              onClick={handleBatchDelete}
              variant="danger"
              size="md"
            >
              Excluir
            </Button>
            <Button
              onClick={() => setSelectedReminders(new Set())}
              variant="secondary"
              size="md"
            >
              Cancelar
            </Button>
            {filter === 'nao-lidos' && stats.unread > 0 && (
              <Button
                onClick={handleMarkAllAsRead}
                variant="primary"
                size="md"
                className="sm:ml-auto"
              >
                Marcar todos como lido
              </Button>
            )}
          </div>
        )}
      </div>

      {filteredReminders.length === 0 ? (
        <div className="panel-glass-panel rounded-xl border border-slate-200 bg-white py-12 text-center shadow-sm" data-panel-animate>
          <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum lembrete encontrado</h3>
          <p className="text-slate-600">
            {searchQuery || typeFilter !== 'all' || priorityFilter !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : filter === 'nao-lidos'
              ? 'Você não tem lembretes pendentes'
              : filter === 'lidos'
              ? 'Você não tem lembretes lidos'
              : 'Você não tem lembretes cadastrados'}
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-6" data-panel-animate>
          {(['overdue', 'today', 'tomorrow', 'thisWeek', 'thisMonth', 'later'] as ReminderPeriod[]).map(period => {
            const periodReminders = groupedReminders[period];
            if (periodReminders.length === 0) return null;

            const isExpanded = expandedPeriods.has(period);

            return (
              <div key={period} className={`panel-interactive-glass border rounded-xl ${getPeriodColor(period)}`}>
                <button
                  onClick={() => togglePeriod(period)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/50 transition-colors rounded-xl"
                >
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {getPeriodLabel(period)}
                    </h3>
                    <span className="px-3 py-1 bg-white rounded-full text-sm font-medium text-slate-700">
                      {periodReminders.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {periodReminders.map(renderReminderCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3" data-panel-animate>
          {filteredReminders.map(renderReminderCard)}
        </div>
      )}

      {historyModalData && (
        <ModalShell
          isOpen
          onClose={closeHistoryModal}
          title="Historico de mensagens"
          description={`${historyModalData.leadName ?? 'Lead sem nome'} · ${historyModalData.phone || 'Telefone indisponivel'}`}
          size="xl"
          panelClassName="max-w-4xl"
          bodyClassName="p-0"
        >
            <div className="flex items-center justify-end border-b border-slate-200 px-5 py-3">
              <Button
                onClick={() => historyModalData.phone && fetchHistoryMessages(historyModalData.phone)}
                disabled={!historyModalData.phone || historyLoading}
                variant="secondary"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>

            <div className="modal-panel-content flex-1 min-h-0 overflow-y-auto bg-slate-50 p-5 space-y-3">
              {historyLoading ? (
                <div className="flex h-full items-center justify-center text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                  <span className="ml-2 text-sm">Carregando histórico...</span>
                </div>
              ) : historyError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {historyError}
                </div>
              ) : historyMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                  <MessageSquare className="h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">Nenhuma mensagem encontrada.</p>
                  <p className="text-xs">As últimas 50 mensagens enviadas e recebidas aparecerão aqui.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {historyMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl border px-4 py-3 shadow-sm ${
                            message.fromMe
                              ? 'bg-teal-50 border-teal-100 text-slate-800'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                          <p className="mt-2 text-[11px] text-slate-500 text-right">
                            {message.fromMe ? 'Você · ' : ''}
                            {formatHistoryTimestamp(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-slate-900">
                          <Sparkles className="h-5 w-5 text-teal-600" />
                          <span className="font-semibold">Gerar follow-up com IA</span>
                        </div>
                        <p className="text-sm text-slate-600">
                          Use o histórico acima para criar uma resposta rápida de retorno.
                        </p>
                      </div>
                      <Button
                        onClick={handleGenerateFollowUp}
                        disabled={generatingFollowUp}
                        loading={generatingFollowUp}
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto"
                      >
                        {!generatingFollowUp && <Sparkles className="h-4 w-4" />}
                        <span>{generatingFollowUp ? 'Gerando...' : 'Gerar follow-up'}</span>
                      </Button>
                    </div>

                    {followUpError && (
                      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{followUpError}</p>
                    )}

                    {generatedFollowUp && (
                      <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="text-sm font-semibold text-slate-900">Sugestão pronta para envio</span>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={handleGenerateFollowUp}
                              variant="secondary"
                              size="sm"
                              className="h-7 rounded-md px-3 text-xs"
                            >
                              <RefreshCw className="h-4 w-4" />
                              <span>Gerar outro</span>
                            </Button>
                            <Button
                              onClick={handleCopyFollowUp}
                              variant="secondary"
                              size="sm"
                              className="h-7 rounded-md px-3 text-xs"
                            >
                              {followUpCopied ? (
                                <>
                                  <Check className="h-4 w-4 text-teal-600" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={handleApproveFollowUp}
                              variant="primary"
                              size="sm"
                              className="h-7 rounded-md px-3 text-xs"
                            >
                              <Check className="h-4 w-4" />
                              <span>Aprovar e dividir em blocos</span>
                            </Button>
                          </div>
                        </div>

                        <p className="whitespace-pre-wrap text-sm text-slate-800">{generatedFollowUp}</p>

                        {followUpApproved && followUpBlocks.length > 0 && (
                          <div className="space-y-3 rounded-lg border border-teal-100 bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">Enviar em blocos sequenciais</p>
                                <p className="text-xs text-slate-600">Revise os textos abaixo e envie no WhatsApp seguindo a ordem.</p>
                              </div>
                              {!historyModalData?.phone && (
                                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">Telefone indisponível</span>
                              )}
                            </div>

                            <div className="space-y-2">
                              {followUpBlocks.map((block, index) => {
                                const whatsappBase = historyModalData?.phone ? getWhatsappLink(historyModalData.phone) : null;
                                const whatsappLink = whatsappBase
                                  ? `${whatsappBase}?text=${encodeURIComponent(block)}`
                                  : null;

                                return (
                                  <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-xs font-semibold text-slate-800">Mensagem {index + 1}</span>
                                      {whatsappLink ? (
                                        <a
                                          href={whatsappLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                                        >
                                          <MessageCircle className="h-4 w-4" />
                                          <span>Enviar no WhatsApp</span>
                                        </a>
                                      ) : (
                                        <span className="text-[11px] text-slate-500">Telefone não disponível</span>
                                      )}
                                    </div>

                                    <textarea
                                      value={block}
                                      onChange={(event) => handleUpdateBlock(index, event.target.value)}
                                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                                      rows={3}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
              Mensagens exibidas conforme retorno da integração externa.
            </div>
        </ModalShell>
      )}

      {reminderPendingDeletion && (
        <ModalShell
          isOpen
          onClose={() => setReminderPendingDeletion(null)}
          title="Remover lembrete"
          size="sm"
          panelClassName="max-w-md"
          footer={
            <div className="flex justify-end space-x-3">
              <Button
                onClick={() => setReminderPendingDeletion(null)}
                disabled={isDeletingReminder}
                variant="secondary"
                size="md"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmDeleteReminder}
                disabled={isDeletingReminder}
                variant="danger"
                size="md"
                loading={isDeletingReminder}
              >
                Remover
              </Button>
            </div>
          }
        >
            <div className="flex items-start space-x-3">
              <div className="p-3 rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600 mt-1">
                  Tem certeza que deseja remover o lembrete
                  <span className="font-semibold text-slate-900"> "{reminderPendingDeletion.titulo}"</span>?
                  Esta ação não pode ser desfeita.
                </p>
                {reminderPendingDeletion.descricao && (
                  <p className="mt-2 text-xs text-slate-500 break-words">
                    {reminderPendingDeletion.descricao}
                  </p>
                )}
              </div>
            </div>
        </ModalShell>
      )}

      {customSnoozeReminder && (
        <ModalShell
          isOpen
          onClose={() => {
            setCustomSnoozeReminder(null);
            setCustomSnoozeDateTime('');
          }}
          title="Adiar para data/hora personalizada"
          size="sm"
          panelClassName="max-w-md"
          footer={
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setCustomSnoozeReminder(null);
                  setCustomSnoozeDateTime('');
                }}
              >
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleCustomSnooze} disabled={!customSnoozeDateTime}>
                Adiar
              </Button>
            </div>
          }
        >
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Data e Hora</label>
            <DateTimePicker
              type="datetime-local"
              value={customSnoozeDateTime}
              onChange={setCustomSnoozeDateTime}
              min={formatDateTimeForInput(new Date().toISOString())}
              placeholder="Selecionar data e hora"
            />
          </div>
        </ModalShell>
      )}

      {showCalendar && (
        <RemindersCalendar
          reminders={reminders}
          onClose={() => setShowCalendar(false)}
          onRescheduleReminder={handleRescheduleReminder}
        />
      )}

      {manualReminderQueue[0] && (
        <ReminderSchedulerModal
          lead={manualReminderQueue[0].lead}
          onClose={() => setManualReminderQueue(prev => prev.slice(1))}
          onScheduled={({ reminderDate }) => {
            const { lead } = manualReminderQueue[0];
            setLeadsMap(prev => {
              const next = new Map(prev);
              next.set(lead.id, { ...lead, proximo_retorno: reminderDate });
              return next;
            });
          }}
          promptMessage={manualReminderQueue[0].promptMessage}
          defaultTitle={manualReminderQueue[0].defaultTitle}
          defaultDescription={manualReminderQueue[0].defaultDescription}
          defaultType={manualReminderQueue[0].defaultType}
          defaultPriority={manualReminderQueue[0].defaultPriority}
        />
      )}

      {loadingLeadId && (
        <ModalShell
          isOpen
          onClose={() => undefined}
          title="Carregando lead"
          description="Aguarde enquanto buscamos os dados mais recentes."
          size="sm"
          panelClassName="max-w-sm"
          closeOnOverlay={false}
          closeOnEscape={false}
          showCloseButton={false}
          bodyClassName="flex min-h-[180px] items-center justify-center"
        >
          <div className="panel-glass-strong flex items-center space-x-2 rounded-lg border border-slate-200 px-4 py-3 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            <span className="text-sm font-medium text-slate-700">Carregando lead...</span>
          </div>
        </ModalShell>
      )}

      {editingLead && (
        <LeadForm
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSave={handleLeadSaved}
        />
      )}
      {ConfirmationDialog}
    </div>
    </PanelAdaptiveLoadingFrame>
  );
}

type ReminderContextLinkProps = {
  leadId?: string;
  contractId?: string;
  leadName?: string;
  onLeadClick?: (leadId: string) => void;
  isLoading?: boolean;
};

type ContextInfo =
  | { type: 'lead'; label: string }
  | { type: 'contract'; label: string };

function ReminderContextLink({
  leadId,
  contractId,
  leadName,
  onLeadClick,
  isLoading,
}: ReminderContextLinkProps) {
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);

  useEffect(() => {
    const loadContext = async () => {
      if (leadId) {
        if (leadName) {
          setContextInfo({ type: 'lead', label: leadName });
          return;
        }

        const { data } = await supabase
          .from('leads')
          .select('nome_completo')
          .eq('id', leadId)
          .maybeSingle();

        if (data) {
          setContextInfo({ type: 'lead', label: data.nome_completo });
        }
      } else if (contractId) {
        const { data } = await supabase
          .from('contracts')
          .select('codigo_contrato')
          .eq('id', contractId)
          .maybeSingle();

        if (data) {
          setContextInfo({ type: 'contract', label: data.codigo_contrato });
        }
      } else {
        setContextInfo(null);
      }
    };

    loadContext();
  }, [leadId, contractId, leadName]);

  if (!contextInfo) return null;

  const baseClassName = 'flex items-center space-x-1 text-xs text-teal-600';

  if (contextInfo.type === 'lead' && leadId) {
    if (isLoading) {
      return (
        <span className={baseClassName}>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Carregando lead...</span>
        </span>
      );
    }

    if (onLeadClick) {
      return (
        <Button
          onClick={() => onLeadClick(leadId)}
          variant="ghost"
          size="sm"
          className="h-auto px-0 text-xs text-teal-600 hover:bg-transparent hover:text-teal-700"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Lead: {contextInfo.label}</span>
        </Button>
      );
    }

    return (
      <span className={baseClassName}>
        <ExternalLink className="w-3 h-3" />
        <span>Lead: {contextInfo.label}</span>
      </span>
    );
  }

  return (
    <span className={baseClassName}>
      <ExternalLink className="w-3 h-3" />
      <span>Contrato: {contextInfo.label}</span>
    </span>
  );
}
