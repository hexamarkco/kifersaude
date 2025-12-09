import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Crown, Shield, User as UserIcon, X, ChevronDown, ChevronUp } from 'lucide-react';

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
  created_at: string;
  created_by: string;
  admin_add_member_mode: boolean;
};

type GroupInfoPanelProps = {
  groupId: string;
  onClose: () => void;
};

export function GroupInfoPanel({ groupId, onClose }: GroupInfoPanelProps) {
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEvents, setShowEvents] = useState(false);

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  const loadGroupData = async () => {
    try {
      setLoading(true);

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

      if (groupResult.data) setGroupInfo(groupResult.data);
      if (participantsResult.data) setParticipants(participantsResult.data);
      if (eventsResult.data) setEvents(eventsResult.data);
    } catch (error) {
      console.error('Erro ao carregar dados do grupo:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: string) => {
    switch (rank) {
      case 'creator':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <UserIcon className="w-4 h-4 text-slate-400" />;
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  if (loading) {
    return (
      <div className="absolute right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!groupInfo) {
    return (
      <div className="absolute right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-lg flex items-center justify-center">
        <p className="text-slate-500">Grupo não encontrado</p>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-white border-l border-slate-200 shadow-lg flex flex-col">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Informações do Grupo</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-100 rounded transition-colors"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col items-center mb-4">
            {groupInfo.chat_pic ? (
              <img
                src={groupInfo.chat_pic}
                alt={groupInfo.name}
                className="w-20 h-20 rounded-full mb-3"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mb-3">
                <Users className="w-10 h-10 text-teal-600" />
              </div>
            )}
            <h2 className="font-semibold text-lg text-center">{groupInfo.name}</h2>
            <p className="text-sm text-slate-500 mt-1">
              Criado em {formatDate(groupInfo.created_at)}
            </p>
          </div>
        </div>

        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participantes ({participants.length})
            </h3>
          </div>
          <div className="space-y-2">
            {participants.map((participant) => (
              <div
                key={participant.phone}
                className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 transition-colors"
              >
                {getRankIcon(participant.rank)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {formatPhone(participant.phone)}
                  </p>
                  <p className="text-xs text-slate-500">{getRankLabel(participant.rank)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={() => setShowEvents(!showEvents)}
            className="w-full flex items-center justify-between p-2 hover:bg-slate-50 rounded transition-colors"
          >
            <h3 className="font-semibold text-slate-900">Histórico de Eventos</h3>
            {showEvents ? (
              <ChevronUp className="w-5 h-5 text-slate-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-600" />
            )}
          </button>

          {showEvents && (
            <div className="mt-3 space-y-3">
              {events.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Nenhum evento registrado
                </p>
              ) : (
                events.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 bg-slate-50 rounded border border-slate-200"
                  >
                    <p className="text-sm font-medium text-slate-900 mb-1">
                      {getEventLabel(event.event_type)}
                    </p>

                    {event.event_type === 'name_changed' && (
                      <p className="text-xs text-slate-600">
                        "{event.old_value}" → "{event.new_value}"
                      </p>
                    )}

                    {event.participants && event.participants.length > 0 && (
                      <p className="text-xs text-slate-600">
                        {event.participants.map(formatPhone).join(', ')}
                      </p>
                    )}

                    <p className="text-xs text-slate-500 mt-1">
                      {formatDate(event.occurred_at)}
                    </p>
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
