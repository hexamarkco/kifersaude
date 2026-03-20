import { useCallback, useEffect, useRef, useState } from 'react';
import { Crown, ChevronDown, ChevronUp, Shield, User as UserIcon, Users, X } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { formatPhoneDisplay } from '../../../../lib/phoneFormatting';
import { getWhatsAppGroups, type WhapiGroup } from '../../../../lib/whatsappApiService';

type GroupParticipant = {
  phone: string;
  rank: 'creator' | 'admin' | 'member';
  joined_at: string;
  updated_at: string;
};

type GroupEvent = {
  id: string;
  event_type: string;
  participants: string[] | null;
  old_value: string | null;
  new_value: string | null;
  triggered_by: string | null;
  occurred_at: string;
};

type GroupInfo = {
  id: string;
  name: string;
  chat_pic: string | null;
  chat_pic_full: string | null;
  created_at: string | null;
  created_by: string | null;
  admin_add_member_mode: boolean | null;
};

type GroupInfoPanelProps = {
  groupId: string;
  onClose: () => void;
};

const panelShellClass =
  'absolute right-0 top-0 flex h-full w-80 flex-col border-l border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] shadow-[var(--panel-glass-shadow-lite,0_16px_32px_-26px_rgba(42,24,12,0.18))]';

export function GroupInfoPanel({ groupId, onClose }: GroupInfoPanelProps) {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState(false);
  const requestIdRef = useRef(0);

  const loadLocalGroupSnapshot = useCallback(async () => {
    const [groupResult, participantsResult, eventsResult] = await Promise.all([
      supabase.from('whatsapp_groups').select('*').eq('id', groupId).maybeSingle(),
      supabase
        .from('whatsapp_group_participants')
        .select('*')
        .eq('group_id', groupId)
        .order('rank', { ascending: true })
        .order('joined_at', { ascending: true }),
      supabase
        .from('whatsapp_group_events')
        .select('*')
        .eq('group_id', groupId)
        .order('occurred_at', { ascending: false })
        .limit(20),
    ]);

    return { groupResult, participantsResult, eventsResult };
  }, [groupId]);

  const buildFallbackGroupInfo = useCallback(async (): Promise<GroupInfo | null> => {
    try {
      await supabase.functions.invoke('whatsapp-sync', {
        body: { chatId: groupId, count: 50 },
      });
    } catch (syncError) {
      console.warn('Nao foi possivel sincronizar o grupo sob demanda:', syncError);
    }

    const refreshedSnapshot = await loadLocalGroupSnapshot();
    if (refreshedSnapshot.groupResult.data) {
      return refreshedSnapshot.groupResult.data as GroupInfo;
    }

    const { data: chatSnapshot } = await supabase
      .from('whatsapp_chats')
      .select('id, name')
      .eq('id', groupId)
      .maybeSingle();

    const fallbackChatName = typeof chatSnapshot?.name === 'string' && chatSnapshot.name.trim()
      ? chatSnapshot.name.trim()
      : null;

    let offset = 0;
    const pageSize = 100;
    for (let page = 0; page < 20; page += 1) {
      const response = await getWhatsAppGroups(pageSize, offset, true);
      const matchedGroup = response.groups.find((group: WhapiGroup) => group.id === groupId);
      if (matchedGroup) {
        return {
          id: matchedGroup.id,
          name: matchedGroup.name?.trim() || fallbackChatName || groupId,
          chat_pic: typeof matchedGroup.chat_pic === 'string' && matchedGroup.chat_pic.trim() ? matchedGroup.chat_pic.trim() : null,
          chat_pic_full:
            typeof matchedGroup.chat_pic_full === 'string' && matchedGroup.chat_pic_full.trim()
              ? matchedGroup.chat_pic_full.trim()
              : null,
          created_at: null,
          created_by: null,
          admin_add_member_mode: null,
        };
      }

      if ((response.groups || []).length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    if (fallbackChatName) {
      return {
        id: groupId,
        name: fallbackChatName,
        chat_pic: null,
        chat_pic_full: null,
        created_at: null,
        created_by: null,
        admin_add_member_mode: null,
      };
    }

    return null;
  }, [groupId, loadLocalGroupSnapshot]);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    let cancelled = false;

    const loadGroupData = async () => {
      try {
        setLoading(true);
        setError(null);
        setGroupInfo(null);
        setParticipants([]);
        setEvents([]);

        const { groupResult, participantsResult, eventsResult } = await loadLocalGroupSnapshot();

        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }

        if (groupResult.error) {
          throw new Error(`Nao foi possivel carregar os dados do grupo: ${groupResult.error.message}`);
        }

        if (!groupResult.data) {
          const fallbackGroupInfo = await buildFallbackGroupInfo();

          if (!fallbackGroupInfo) {
            setError('Grupo nao encontrado.');
            return;
          }

          setGroupInfo(fallbackGroupInfo);
          setError('Dados completos do grupo ainda nao foram sincronizados.');
          return;
        }

        setGroupInfo(groupResult.data);

        const partialErrors: string[] = [];

        if (participantsResult.error) {
          partialErrors.push('participantes');
        } else {
          setParticipants(participantsResult.data ?? []);
        }

        if (eventsResult.error) {
          partialErrors.push('eventos');
        } else {
          setEvents(eventsResult.data ?? []);
        }

        if (partialErrors.length > 0) {
          setError(`Nao foi possivel carregar ${partialErrors.join(' e ')} do grupo.`);
        }
      } catch (error) {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }

        console.error('Erro ao carregar dados do grupo:', error);
        setError(error instanceof Error ? error.message : 'Nao foi possivel carregar os dados do grupo.');
      } finally {
        if (!cancelled && requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    void loadGroupData();

    return () => {
      cancelled = true;
    };
  }, [buildFallbackGroupInfo, groupId, loadLocalGroupSnapshot]);

  const getRankIcon = (rank: string) => {
    switch (rank) {
      case 'creator':
        return <Crown className="comm-accent-text h-4 w-4" />;
      case 'admin':
        return <Shield className="comm-text h-4 w-4" />;
      default:
        return <UserIcon className="comm-subtle h-4 w-4" />;
    }
  };

  const getRankLabel = (rank: string) => {
    const labels: Record<string, string> = {
      creator: 'Criador',
      admin: 'Administrador',
      member: 'Membro',
    };
    return labels[rank] || rank;
  };

  const getEventLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      created: 'Grupo criado',
      participant_added: 'Membro adicionado',
      participant_removed: 'Membro removido',
      participant_promoted: 'Promovido a admin',
      participant_demoted: 'Admin removido',
      join_request: 'Pedido para entrar',
      name_changed: 'Nome alterado',
      picture_changed: 'Foto alterada',
    };
    return labels[eventType] || eventType;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) {
      return 'data indisponivel';
    }

    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPhone = (phone: string) => formatPhoneDisplay(phone);

  if (loading) {
    return (
      <div className={`${panelShellClass} items-center justify-center`}>
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--panel-focus,#c86f1d)]"></div>
      </div>
    );
  }

  if (!groupInfo) {
    return (
      <div className={`${panelShellClass} items-center justify-center`}>
        <p className="comm-muted text-center">{error || 'Grupo não encontrado'}</p>
      </div>
    );
  }

  return (
    <div className={panelShellClass}>
      <div className="flex items-center justify-between border-b border-[var(--panel-border-subtle,#e7dac8)] p-4">
        <h3 className="comm-title font-semibold">Informações do Grupo</h3>
        <button onClick={onClose} className="comm-icon-button rounded p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-[var(--panel-border-subtle,#e7dac8)] p-4">
          <div className="mb-4 flex flex-col items-center">
            {groupInfo.chat_pic ? (
              <img src={groupInfo.chat_pic} alt={groupInfo.name} className="mb-3 h-20 w-20 rounded-full" />
            ) : (
              <div className="comm-icon-chip comm-icon-chip-brand mb-3 flex h-20 w-20 items-center justify-center rounded-full">
                <Users className="h-10 w-10" />
              </div>
            )}
            <h2 className="comm-title text-center text-lg font-semibold">{groupInfo.name}</h2>
            <p className="comm-muted mt-1 text-sm">Criado em {formatDate(groupInfo.created_at)}</p>
          </div>

          {error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {error}
            </div>
          )}
        </div>

        <div className="border-b border-[var(--panel-border-subtle,#e7dac8)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="comm-title flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" />
              Participantes ({participants.length})
            </h3>
          </div>
          <div className="space-y-2">
            {participants.map((participant) => (
              <div key={participant.phone} className="comm-list-item flex items-center gap-3 rounded p-2">
                {getRankIcon(participant.rank)}
                <div className="min-w-0 flex-1">
                  <p className="comm-title truncate text-sm font-medium">{formatPhone(participant.phone)}</p>
                  <p className="comm-muted text-xs">{getRankLabel(participant.rank)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={() => setShowEvents((current) => !current)}
            className="comm-list-item flex w-full items-center justify-between rounded p-2"
          >
            <h3 className="comm-title font-semibold">Histórico de Eventos</h3>
            {showEvents ? <ChevronUp className="comm-muted h-5 w-5" /> : <ChevronDown className="comm-muted h-5 w-5" />}
          </button>

          {showEvents && (
            <div className="mt-3 space-y-3">
              {events.length === 0 ? (
                <p className="comm-muted py-4 text-center text-sm">Nenhum evento registrado</p>
              ) : (
                events.map((event) => (
                  <div key={event.id} className="comm-card p-3">
                    <p className="comm-title mb-1 text-sm font-medium">{getEventLabel(event.event_type)}</p>

                    {event.event_type === 'name_changed' && (
                      <p className="comm-text text-xs">
                        "{event.old_value}" {'->'} "{event.new_value}"
                      </p>
                    )}

                    {event.participants && event.participants.length > 0 && (
                      <p className="comm-text text-xs">{event.participants.map(formatPhone).join(', ')}</p>
                    )}

                    <p className="comm-muted mt-1 text-xs">{formatDate(event.occurred_at)}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
