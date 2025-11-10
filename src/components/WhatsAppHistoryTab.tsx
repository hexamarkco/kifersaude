import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, AIGeneratedMessage, WhatsAppConversation, Lead } from '../lib/supabase';
import {
  MessageCircle,
  Calendar,
  Search,
  Sparkles,
  CheckCircle,
  XCircle,
  Clock,
  Loader,
  Phone,
  RefreshCcw,
  Maximize2,
  FileText,
} from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import StatusDropdown from './StatusDropdown';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { cancelFollowUps, createAutomaticFollowUps } from '../lib/followUpService';

const sanitizePhoneDigits = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\D/g, '');
};

const buildPhoneLookupKeys = (value?: string | null): string[] => {
  const digits = sanitizePhoneDigits(value);
  if (!digits) return [];

  const keys = new Set<string>();
  keys.add(digits);

  if (digits.startsWith('55') && digits.length > 2) {
    keys.add(digits.slice(2));
    keys.add(`+${digits}`);
  } else if (digits.length === 11) {
    keys.add(`55${digits}`);
    keys.add(`+55${digits}`);
  }

  return Array.from(keys);
};

const isGroupWhatsAppJid = (phone?: string | null): boolean => {
  if (!phone) return false;
  return phone.toLowerCase().includes('@g.us');
};

type LeadPreview = Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'status' | 'responsavel'>;

const formatPhoneForDisplay = (phone: string): string => {
  if (!phone) return '';
  const withoutSuffix = phone.includes('@') ? phone.split('@')[0] : phone;
  return withoutSuffix;
};

export default function WhatsAppHistoryTab() {
  const [aiMessages, setAIMessages] = useState<AIGeneratedMessage[]>([]);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'chat' | 'ai-messages'>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { leadStatuses } = useConfig();
  const { isObserver } = useAuth();
  const activeLeadStatuses = useMemo(
    () => leadStatuses.filter((status) => status.ativo),
    [leadStatuses]
  );

  const [leadsMap, setLeadsMap] = useState<Map<string, LeadPreview>>(new Map());
  const [leadsByPhoneMap, setLeadsByPhoneMap] = useState<Map<string, LeadPreview>>(new Map());
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const loadedPhoneLeadsRef = useRef<Set<string>>(new Set());
  const [fullscreenMedia, setFullscreenMedia] = useState<
    | {
        url: string;
        type: 'image' | 'video' | 'gif';
        caption?: string | null;
        mimeType?: string | null;
        thumbnailUrl?: string | null;
      }
    | null
  >(null);

  const upsertLeadsIntoMaps = useCallback((leads: LeadPreview[]) => {
    if (!leads || leads.length === 0) return;

    setLeadsMap((prev) => {
      const next = new Map(prev);
      leads.forEach((lead) => {
        next.set(lead.id, lead);
      });
      return next;
    });

    setLeadsByPhoneMap((prev) => {
      const next = new Map(prev);
      leads.forEach((lead) => {
        if (lead.telefone) {
          const trimmed = lead.telefone.trim();
          if (trimmed) {
            next.set(trimmed, lead);
          }

          buildPhoneLookupKeys(trimmed).forEach((key) => {
            next.set(key, lead);
          });
        }
      });
      return next;
    });
  }, []);

  const loadLeads = useCallback(async (leadIds: string[]) => {
    if (leadIds.length === 0) return;

    const { data } = await supabase
      .from('leads')
      .select('id, nome_completo, telefone, status, responsavel')
      .in('id', leadIds);

    if (data) {
      upsertLeadsIntoMaps(data as LeadPreview[]);
    }
  }, [upsertLeadsIntoMaps]);

  const loadLeadsByPhones = useCallback(async (phones: string[]) => {
    if (phones.length === 0) return;

    const sanitized = phones
      .map((phone) => sanitizePhoneDigits(phone))
      .filter((value) => Boolean(value));

    const toFetch = sanitized.filter((digits) => !loadedPhoneLeadsRef.current.has(digits));
    if (toFetch.length === 0) return;

    const variants = Array.from(
      new Set(
        toFetch.flatMap((digits) => {
          const keys = new Set<string>([digits]);

          if (digits.startsWith('55') && digits.length > 2) {
            keys.add(digits.slice(2));
            keys.add(`+${digits}`);
          } else if (digits.length === 11) {
            keys.add(`55${digits}`);
            keys.add(`+55${digits}`);
          }

          return Array.from(keys);
        })
      )
    );

    if (variants.length === 0) return;

    const { data, error } = await supabase
      .from('leads')
      .select('id, nome_completo, telefone, status, responsavel')
      .in('telefone', variants);

    if (error) {
      console.error('Erro ao carregar leads por telefone:', error);
      return;
    }

    toFetch.forEach((digits) => loadedPhoneLeadsRef.current.add(digits));

    if (data) {
      upsertLeadsIntoMaps(data as LeadPreview[]);
    }
  }, [upsertLeadsIntoMaps]);

  const loadAIMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_generated_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setAIMessages(data || []);

      const leadIds = [...new Set((data || []).map(m => m.lead_id))];
      await loadLeads(leadIds);
    } catch (error) {
      console.error('Erro ao carregar mensagens IA:', error);
    } finally {
      setLoading(false);
    }
  }, [loadLeads]);

  const loadConversations = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) throw error;
      setConversations(data || []);

      const leadIds = [...new Set((data || []).map(c => c.lead_id).filter(Boolean) as string[])];
      await loadLeads(leadIds);
      const phoneNumbers = [...new Set((data || []).map((c) => c.phone_number).filter(Boolean))];
      await loadLeadsByPhones(phoneNumbers);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
      setIsRefreshing(false);
    }
  }, [loadLeads, loadLeadsByPhones]);

  useEffect(() => {
    if (activeView === 'ai-messages') {
      loadAIMessages();
    } else {
      loadConversations();
    }
  }, [activeView, loadAIMessages, loadConversations]);

  const closeFullscreen = useCallback(() => setFullscreenMedia(null), []);

  useEffect(() => {
    if (!fullscreenMedia) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [fullscreenMedia, closeFullscreen]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'draft':
        return <Clock className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Rascunho',
      approved: 'Aprovada',
      sent: 'Enviada',
      failed: 'Falhou',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-orange-100 text-orange-700',
      approved: 'bg-blue-100 text-blue-700',
      sent: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const filteredAIMessages = aiMessages.filter(msg => {
    if (statusFilter !== 'all' && msg.status !== statusFilter) return false;
    if (searchQuery) {
      const lead = leadsMap.get(msg.lead_id);
      const query = searchQuery.toLowerCase();
      return (
        msg.message_generated.toLowerCase().includes(query) ||
        (lead?.nome_completo.toLowerCase().includes(query)) ||
        (lead?.telefone.includes(query))
      );
    }
    return true;
  });

  const chatGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        phone: string;
        messages: WhatsAppConversation[];
        leadId?: string | null;
        lastMessage?: WhatsAppConversation;
        displayName?: string | null;
        photoUrl?: string | null;
        isGroup: boolean;
      }
    >();

    conversations.forEach((conv) => {
      const normalizedChatName = conv.chat_name?.trim() || null;
      const normalizedSenderName = conv.sender_name?.trim() || null;
      const isGroupChat = isGroupWhatsAppJid(conv.phone_number);
      const existing = groups.get(conv.phone_number);

      if (!existing) {
        groups.set(conv.phone_number, {
          phone: conv.phone_number,
          messages: [conv],
          leadId: conv.lead_id,
          lastMessage: conv,
          displayName: isGroupChat
            ? normalizedChatName || normalizedSenderName || null
            : normalizedSenderName || normalizedChatName || null,
          photoUrl: conv.sender_photo || null,
          isGroup: isGroupChat,
        });
      } else {
        existing.messages.push(conv);
        if (!existing.leadId && conv.lead_id) {
          existing.leadId = conv.lead_id;
        }
        if (!existing.photoUrl && conv.sender_photo) {
          existing.photoUrl = conv.sender_photo;
        }
        if (!existing.isGroup && isGroupChat) {
          existing.isGroup = true;
        }

        if (isGroupChat) {
          if (normalizedChatName && normalizedChatName !== existing.displayName) {
            existing.displayName = normalizedChatName;
          } else if (!existing.displayName && normalizedSenderName) {
            existing.displayName = normalizedSenderName;
          }
        } else if (!existing.displayName && (normalizedSenderName || normalizedChatName)) {
          existing.displayName = normalizedSenderName || normalizedChatName;
        }

        if (
          !existing.lastMessage ||
          new Date(conv.timestamp).getTime() > new Date(existing.lastMessage.timestamp).getTime()
        ) {
          existing.lastMessage = conv;
        }
      }
    });

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        messages: group.messages.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
      }))
      .sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
        const bTime = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
        return bTime - aTime;
      });
  }, [conversations]);

  const filteredChats = useMemo(() => {
    if (!searchQuery) return chatGroups;
    const query = searchQuery.toLowerCase();
    const numericQuery = searchQuery.replace(/\D/g, '');
    return chatGroups.filter((chat) => {
      const lead = chat.isGroup
        ? undefined
        : (chat.leadId ? leadsMap.get(chat.leadId) : undefined) ??
          leadsByPhoneMap.get(sanitizePhoneDigits(chat.phone)) ??
          leadsByPhoneMap.get(chat.phone.trim());
      const sanitizedPhone = sanitizePhoneDigits(chat.phone);
      return (
        chat.phone.toLowerCase().includes(query) ||
        (numericQuery ? sanitizedPhone.includes(numericQuery) : false) ||
        chat.messages.some(message => (message.message_text || '').toLowerCase().includes(query)) ||
        (chat.displayName?.toLowerCase().includes(query) ?? false) ||
        (lead?.nome_completo?.toLowerCase().includes(query) ?? false) ||
        (lead?.telefone?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [chatGroups, leadsByPhoneMap, leadsMap, searchQuery]);

  useEffect(() => {
    if (filteredChats.length === 0) {
      setSelectedPhone(null);
      return;
    }

    const exists = filteredChats.some(chat => chat.phone === selectedPhone);
    if (!exists) {
      setSelectedPhone(filteredChats[0].phone);
    }
  }, [filteredChats, selectedPhone]);

  const selectedChat = useMemo(() => {
    if (!selectedPhone) return undefined;
    return chatGroups.find(group => group.phone === selectedPhone);
  }, [chatGroups, selectedPhone]);

  const selectedChatMessages = useMemo(() => {
    return selectedChat?.messages ?? ([] as WhatsAppConversation[]);
  }, [selectedChat]);

  const selectedChatLead = useMemo(() => {
    if (!selectedChat || selectedChat.isGroup) return undefined;
    return (
      (selectedChat.leadId ? leadsMap.get(selectedChat.leadId) : undefined) ??
      leadsByPhoneMap.get(sanitizePhoneDigits(selectedChat.phone)) ??
      leadsByPhoneMap.get(selectedChat.phone.trim())
    );
  }, [leadsByPhoneMap, leadsMap, selectedChat]);

  const handleLeadStatusChange = useCallback(
    async (leadId: string, newStatus: string) => {
      const lead = leadsMap.get(leadId);
      if (!lead) return;

      const oldStatus = lead.status;
      const optimisticLead = { ...lead, status: newStatus };
      upsertLeadsIntoMaps([optimisticLead]);

      try {
        const now = new Date().toISOString();

        const { error: updateError } = await supabase
          .from('leads')
          .update({ status: newStatus, ultimo_contato: now })
          .eq('id', leadId);

        if (updateError) throw updateError;

        await supabase.from('interactions').insert([
          {
            lead_id: leadId,
            tipo: 'Observação',
            descricao: `Status alterado de "${oldStatus}" para "${newStatus}"`,
            responsavel: lead.responsavel,
          },
        ]);

        await supabase.from('lead_status_history').insert([
          {
            lead_id: leadId,
            status_anterior: oldStatus,
            status_novo: newStatus,
            responsavel: lead.responsavel,
          },
        ]);

        if (['Fechado', 'Perdido'].includes(newStatus)) {
          await cancelFollowUps(leadId);
        } else {
          await createAutomaticFollowUps(leadId, newStatus, lead.responsavel);
        }
      } catch (error) {
        console.error('Erro ao atualizar status do lead:', error);
        alert('Erro ao atualizar status do lead');
        upsertLeadsIntoMaps([{ ...lead, status: oldStatus }]);
        throw error;
      }
    },
    [createAutomaticFollowUps, cancelFollowUps, leadsMap, upsertLeadsIntoMaps]
  );

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateLabel = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (isSameDay(date, today)) {
      return 'Hoje';
    }
    if (isSameDay(date, yesterday)) {
      return 'Ontem';
    }
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds?: number | null) => {
    if (typeof seconds !== 'number' || Number.isNaN(seconds)) {
      return null;
    }

    const totalSeconds = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    return `0:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDisplayTextForMessage = (message: WhatsAppConversation) => {
    const caption = message.media_caption?.trim();
    const text = message.message_text?.trim();

    if (caption && caption !== text) {
      return caption;
    }

    return text || '';
  };

  const renderMediaContent = (message: WhatsAppConversation) => {
    if (!message.media_url) {
      return null;
    }

    const mediaType = message.media_type?.toLowerCase();
    const accentColor = message.message_type === 'sent' ? 'text-teal-100' : 'text-slate-500';
    const fallbackText = message.media_caption || message.message_text || 'Mídia recebida';

    switch (mediaType) {
      case 'image':
      case 'sticker':
        return (
          <img
            src={message.media_url}
            alt={fallbackText}
            className="w-full max-h-64 rounded-lg object-cover"
            loading="lazy"
          />
        );
      case 'video':
        return (
          <video
            key={`${message.id}-video`}
            controls
            poster={message.media_thumbnail_url || undefined}
            className="w-full max-h-72 rounded-lg"
          >
            <source src={message.media_url} type={message.media_mime_type || undefined} />
            Seu navegador não suporta a reprodução de vídeos.
          </video>
        );
      case 'audio': {
        const duration = formatDuration(message.media_duration_seconds);
        return (
          <div className="space-y-1">
            <audio
              key={`${message.id}-audio`}
              controls
              src={message.media_url}
              className="w-full"
            >
              <source src={message.media_url} type={message.media_mime_type || undefined} />
              Seu navegador não suporta a reprodução de áudio.
            </audio>
            {duration && <span className={`text-[11px] ${accentColor}`}>Duração: {duration}</span>}
          </div>
        );
      }
      case 'document':
        return (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm font-medium underline ${
              message.message_type === 'sent' ? 'text-white' : 'text-teal-600'
            }`}
          >
            Abrir documento
          </a>
        );
      default:
        return (
          <a
            href={message.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-sm font-medium underline ${
              message.message_type === 'sent' ? 'text-white' : 'text-teal-600'
            }`}
          >
            Abrir mídia
          </a>
        );
    }
  };

  const groupedSelectedMessages = useMemo(() => {
    const groups: { date: string; messages: WhatsAppConversation[] }[] = [];
    let currentDate: string | null = null;

    selectedChatMessages.forEach((message) => {
      const dateLabel = formatDateLabel(message.timestamp);
      if (dateLabel !== currentDate) {
        currentDate = dateLabel;
        groups.push({ date: dateLabel, messages: [] });
      }
      groups[groups.length - 1].messages.push(message);
    });

    return groups;
  }, [selectedChatMessages]);

  const handleRefreshChats = async () => {
    setIsRefreshing(true);
    await loadConversations(false);
  };

  const selectedChatUnreadCount = useMemo(() => {
    if (!selectedChat) return 0;
    return selectedChat.messages.filter(
      (message) => message.message_type === 'received' && !message.read_status
    ).length;
  }, [selectedChat]);

  useEffect(() => {
    if (!selectedPhone || selectedChatUnreadCount === 0) return;

    const markAsRead = async () => {
      try {
        await supabase
          .from('whatsapp_conversations')
          .update({ read_status: true })
          .eq('phone_number', selectedPhone)
          .eq('message_type', 'received')
          .eq('read_status', false);

        setConversations((prev) =>
          prev.map((message) =>
            message.phone_number === selectedPhone && message.message_type === 'received'
              ? { ...message, read_status: true }
              : message
          )
        );
      } catch (error) {
        console.error('Erro ao marcar mensagens como lidas:', error);
      }
    };

    void markAsRead();
  }, [selectedPhone, selectedChatUnreadCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <MessageCircle className="w-6 h-6 text-teal-600" />
            <h2 className="text-2xl font-bold text-slate-900">Histórico WhatsApp</h2>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setActiveView('ai-messages')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'ai-messages'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4" />
                <span>Mensagens IA</span>
              </div>
            </button>
            <button
              onClick={() => setActiveView('chat')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'chat'
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                <MessageCircle className="w-4 h-4" />
                <span>Conversas</span>
              </div>
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeView === 'ai-messages' ? 'Buscar em mensagens...' : 'Buscar por nome, telefone ou mensagem...'}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {activeView === 'chat' && (
            <button
              onClick={handleRefreshChats}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium transition-colors ${
                isRefreshing ? 'bg-teal-50 text-teal-700' : 'hover:bg-slate-100 text-slate-700'
              }`}
              disabled={isRefreshing}
            >
              <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>
          )}

          {activeView === 'ai-messages' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="all">Todos os status</option>
              <option value="draft">Rascunho</option>
              <option value="approved">Aprovada</option>
              <option value="sent">Enviada</option>
              <option value="failed">Falhou</option>
            </select>
          )}
        </div>

        {activeView === 'ai-messages' ? (
          <div className="space-y-4">
            {filteredAIMessages.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <Sparkles className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">Nenhuma mensagem gerada por IA encontrada</p>
              </div>
            ) : (
              filteredAIMessages.map((msg) => {
                const lead = leadsMap.get(msg.lead_id);
                return (
                  <div key={msg.id} className="bg-gradient-to-r from-purple-50 to-white border border-purple-200 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(msg.status)}
                        <div>
                          <h3 className="font-semibold text-slate-900">{lead?.nome_completo || 'Lead não encontrado'}</h3>
                          <p className="text-sm text-slate-600">{lead?.telefone}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(msg.status)}`}>
                        {getStatusLabel(msg.status)}
                      </span>
                    </div>

                    <div className="bg-white rounded-lg p-4 mb-3 border border-slate-200">
                      <p className="text-slate-900 whitespace-pre-wrap">
                        {msg.message_edited || msg.message_generated}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDateTimeFullBR(msg.created_at)}</span>
                        </span>
                        <span>Tom: {msg.tone}</span>
                        <span>{msg.tokens_used} tokens</span>
                        {msg.cost_estimate > 0 && <span>~${msg.cost_estimate.toFixed(4)}</span>}
                      </div>
                      {msg.generated_by && <span>Por: {msg.generated_by}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden h-[600px] flex flex-col">
              <div className="px-4 py-3 bg-white border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-700">Conversas</h3>
                <p className="text-xs text-slate-500">Contatos com mensagens registradas</p>
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredChats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center px-6 text-slate-500">
                    <MessageCircle className="w-10 h-10 mb-3" />
                    <p className="font-medium">Nenhuma conversa encontrada</p>
                    <p className="text-sm">Aguarde o recebimento de novas mensagens via webhook.</p>
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const lead = chat.isGroup
                      ? undefined
                      : (chat.leadId ? leadsMap.get(chat.leadId) : undefined) ??
                        leadsByPhoneMap.get(sanitizePhoneDigits(chat.phone)) ??
                        leadsByPhoneMap.get(chat.phone.trim());
                    const lastMessage = chat.lastMessage;
                    const isActive = chat.phone === selectedPhone;
                    const displayName = chat.isGroup
                      ? chat.displayName || formatPhoneForDisplay(chat.phone)
                      : lead?.nome_completo || chat.displayName || formatPhoneForDisplay(chat.phone);

                    return (
                      <button
                        key={chat.phone}
                        onClick={() => setSelectedPhone(chat.phone)}
                        className={`w-full text-left px-4 py-3 border-b border-slate-200 hover:bg-teal-50 transition-colors ${
                          isActive ? 'bg-teal-50' : 'bg-transparent'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center overflow-hidden">
                            {chat.photoUrl ? (
                              <img
                                src={chat.photoUrl}
                                alt={displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Phone className="w-5 h-5 text-teal-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-slate-900 truncate">
                                {displayName}
                              </h4>
                              {lastMessage && (
                                <span className="text-xs text-slate-500">
                                  {formatTime(lastMessage.timestamp)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {lastMessage?.message_text || 'Sem mensagens registradas'}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl h-[600px] flex flex-col">
              {!selectedPhone ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <MessageCircle className="w-12 h-12 mb-4" />
                  <p className="font-medium">Selecione uma conversa</p>
                  <p className="text-sm">Escolha um contato para visualizar o histórico.</p>
                </div>
              ) : (
                <>
                  <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-600 to-teal-500 text-white">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-11 h-11 rounded-full bg-teal-500 flex items-center justify-center overflow-hidden border border-teal-300/40">
                          {selectedChat?.photoUrl ? (
                            <img
                              src={selectedChat.photoUrl}
                              alt={selectedChatLead?.nome_completo || selectedChat?.displayName || selectedPhone || 'Contato'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Phone className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">
                            {selectedChat?.isGroup
                              ? selectedChat?.displayName || selectedPhone
                              : selectedChatLead?.nome_completo || selectedChat?.displayName || selectedPhone}
                          </h3>
                          <p className="text-xs text-teal-100">{selectedPhone ? formatPhoneForDisplay(selectedPhone) : ''}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2 text-xs text-teal-100">
                        {selectedChatLead?.telefone &&
                          sanitizePhoneDigits(selectedChatLead.telefone) !==
                            sanitizePhoneDigits(selectedPhone ?? '') && (
                            <span>Lead: {selectedChatLead.telefone}</span>
                          )}
                        {selectedChatLead && activeLeadStatuses.length > 0 && (
                          <StatusDropdown
                            currentStatus={selectedChatLead.status}
                            leadId={selectedChatLead.id}
                            statusOptions={activeLeadStatuses}
                            onStatusChange={handleLeadStatusChange}
                            disabled={isObserver}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white px-6 py-4 space-y-6">
                    {groupedSelectedMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                        <MessageCircle className="w-12 h-12 mb-4" />
                        <p className="font-medium">Nenhuma mensagem registrada</p>
                        <p className="text-sm">
                          As mensagens serão exibidas aqui assim que forem recebidas pelo webhook.
                        </p>
                      </div>
                    ) : (
                      groupedSelectedMessages.map((group) => (
                        <div key={group.date}>
                          <div className="flex justify-center mb-4">
                            <span className="text-xs bg-white text-slate-500 px-3 py-1 rounded-full shadow border border-slate-200">
                              {group.date}
                            </span>
                          </div>

                          <div className="space-y-3">
                            {group.messages.map((message) => {
                              const displayText = getDisplayTextForMessage(message);
                              const showEmptyFallback = !displayText && !message.media_url;
                              const bubbleText = displayText || (showEmptyFallback ? 'Mensagem sem conteúdo' : '');
                              const timestampColor =
                                message.message_type === 'sent' ? 'text-teal-100' : 'text-slate-500';
                              const mediaContent = renderMediaContent(message);

                              return (
                                <div
                                  key={message.id}
                                  className={`flex ${
                                    message.message_type === 'sent' ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm flex flex-col space-y-2 ${
                                      message.message_type === 'sent'
                                        ? 'bg-teal-500 text-white rounded-br-sm'
                                        : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm'
                                    }`}
                                  >
                                    {bubbleText && (
                                      <p className="text-sm whitespace-pre-wrap break-words">{bubbleText}</p>
                                    )}
                                    {mediaContent}
                                    <div
                                      className={`flex items-center justify-end space-x-2 text-[11px] ${timestampColor}`}
                                    >
                                      {message.media_view_once && (
                                        <span className="uppercase tracking-wide font-semibold">Visualização única</span>
                                      )}
                                      <span>{formatTime(message.timestamp)}</span>
                                      {message.read_status && message.message_type === 'sent' && (
                                        <span className="font-semibold">Lida</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      {fullscreenMedia && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm px-4 py-6"
          onClick={closeFullscreen}
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative bg-black/60 rounded-lg p-4 shadow-xl border border-white/10">
              <button
                type="button"
                onClick={closeFullscreen}
                className="absolute top-3 right-3 text-slate-100 hover:text-white"
                aria-label="Fechar visualização em tela cheia"
              >
                <XCircle className="w-7 h-7" />
              </button>
              {fullscreenMedia.type === 'image' && (
                <img
                  src={fullscreenMedia.url}
                  alt={fullscreenMedia.caption ?? 'Mídia em tela cheia'}
                  className="max-h-[80vh] w-full object-contain rounded-md"
                />
              )}
              {fullscreenMedia.type === 'video' && (
                <video
                  className="w-full max-h-[80vh] rounded-md"
                  controls
                  autoPlay
                  poster={fullscreenMedia.thumbnailUrl ?? undefined}
                >
                  <source src={fullscreenMedia.url} type={fullscreenMedia.mimeType ?? undefined} />
                  Seu navegador não suporta a reprodução de vídeos.
                </video>
              )}
              {fullscreenMedia.type === 'gif' && (
                <video
                  className="w-full max-h-[80vh] rounded-md"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source src={fullscreenMedia.url} type={fullscreenMedia.mimeType ?? undefined} />
                  Seu navegador não suporta a reprodução deste GIF.
                </video>
              )}
              {fullscreenMedia.caption && (
                <p className="mt-4 text-sm text-slate-100 text-center whitespace-pre-wrap break-words">
                  {fullscreenMedia.caption}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
