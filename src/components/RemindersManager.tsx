import { useEffect, useState } from 'react';
import { supabase, Reminder, Lead } from '../lib/supabase';
import { Bell, Check, Trash2, AlertCircle, Calendar, Clock, MessageCircle } from 'lucide-react';
import { formatDateTimeFullBR, isOverdue, convertLocalToUTC } from '../lib/dateUtils';
import { openWhatsAppInBackgroundTab } from '../lib/whatsappService';

export default function RemindersManager() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<'todos' | 'nao-lidos' | 'lidos'>('nao-lidos');
  const [loading, setLoading] = useState(true);
  const [reschedulingReminder, setReschedulingReminder] = useState<string | null>(null);
  const [newReminderDate, setNewReminderDate] = useState('');
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(new Map());

  useEffect(() => {
    loadReminders();

    const channel = supabase
      .channel('reminders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReminder = payload.new as Reminder;
            if (
              filter === 'todos' ||
              (filter === 'nao-lidos' && !newReminder.lido) ||
              (filter === 'lidos' && newReminder.lido)
            ) {
              setReminders((current) => {
                const filtered = [...current, newReminder];
                return filtered.sort(
                  (a, b) => new Date(a.data_lembrete).getTime() - new Date(b.data_lembrete).getTime()
                );
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedReminder = payload.new as Reminder;
            if (
              filter === 'todos' ||
              (filter === 'nao-lidos' && !updatedReminder.lido) ||
              (filter === 'lidos' && updatedReminder.lido)
            ) {
              setReminders((current) =>
                current.map((reminder) =>
                  reminder.id === updatedReminder.id ? updatedReminder : reminder
                )
              );
            } else {
              setReminders((current) =>
                current.filter((reminder) => reminder.id !== updatedReminder.id)
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setReminders((current) =>
              current.filter((reminder) => reminder.id !== (payload.old as Reminder).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const loadReminders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('reminders')
        .select('*')
        .order('data_lembrete', { ascending: true });

      if (filter === 'nao-lidos') {
        query = query.eq('lido', false);
      } else if (filter === 'lidos') {
        query = query.eq('lido', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      setReminders(data || []);

      const leadIds = [...new Set((data || []).map(r => r.lead_id).filter(Boolean))];
      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, nome_completo, telefone')
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
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ lido: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      loadReminders();
    } catch (error) {
      console.error('Erro ao atualizar lembrete:', error);
      alert('Erro ao atualizar lembrete');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja remover este lembrete?')) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadReminders();
    } catch (error) {
      console.error('Erro ao remover lembrete:', error);
      alert('Erro ao remover lembrete');
    }
  };

  const handleReschedule = async (reminder: Reminder) => {
    if (!newReminderDate) {
      alert('Por favor, selecione uma nova data e hora');
      return;
    }

    try {
      await supabase
        .from('reminders')
        .update({ lido: true })
        .eq('id', reminder.id);

      const { error: insertError } = await supabase
        .from('reminders')
        .insert([{
          titulo: reminder.titulo,
          descricao: reminder.descricao,
          tipo: reminder.tipo,
          prioridade: reminder.prioridade,
          data_lembrete: convertLocalToUTC(newReminderDate),
          lead_id: reminder.lead_id,
          contract_id: reminder.contract_id,
        }]);

      if (insertError) throw insertError;

      setReschedulingReminder(null);
      setNewReminderDate('');
      loadReminders();
    } catch (error) {
      console.error('Erro ao remarcar lembrete:', error);
      alert('Erro ao remarcar lembrete');
    }
  };

  const getPriorityColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      'baixa': 'bg-blue-100 text-blue-700',
      'normal': 'bg-slate-100 text-slate-700',
      'alta': 'bg-red-100 text-red-700',
    };
    return colors[prioridade] || 'bg-slate-100 text-slate-700';
  };

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, any> = {
      'Documentos pendentes': AlertCircle,
      'Assinatura': AlertCircle,
      'Ativação': Calendar,
      'Renovação': Calendar,
      'Retorno': Bell,
    };
    const Icon = icons[tipo] || Bell;
    return <Icon className="w-5 h-5" />;
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Lembretes e Notificações</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setFilter('nao-lidos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'nao-lidos'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Não Lidos
          </button>
          <button
            onClick={() => setFilter('todos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'todos'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('lidos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'lidos'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Lidos
          </button>
        </div>
      </div>

      {reminders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum lembrete encontrado</h3>
          <p className="text-slate-600">
            {filter === 'nao-lidos'
              ? 'Você não tem lembretes pendentes'
              : filter === 'lidos'
              ? 'Você não tem lembretes lidos'
              : 'Você não tem lembretes cadastrados'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((reminder) => {
            const overdue = isOverdue(reminder.data_lembrete);
            return (
              <div
                key={reminder.id}
                className={`bg-white rounded-xl shadow-sm border p-6 transition-all ${
                  reminder.lido
                    ? 'border-slate-200 opacity-60'
                    : overdue
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
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
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {reminder.titulo}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(reminder.prioridade)}`}>
                          {reminder.prioridade}
                        </span>
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                          {reminder.tipo}
                        </span>
                      </div>
                      {reminder.descricao && (
                        <p className="text-slate-600 mb-3">{reminder.descricao}</p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-slate-500">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                        </div>
                        {overdue && !reminder.lido && (
                          <span className="text-red-600 font-medium">Atrasado</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {reminder.lead_id && leadsMap.get(reminder.lead_id) && (
                      <button
                        onClick={() => {
                          const lead = leadsMap.get(reminder.lead_id!);
                          if (lead && lead.telefone) {
                            openWhatsAppInBackgroundTab(lead.telefone, lead.nome_completo);
                          }
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Abrir WhatsApp com o lead"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    )}
                    {!reminder.lido && (
                      <button
                        onClick={() => {
                          setReschedulingReminder(reminder.id);
                          const now = new Date();
                          now.setHours(now.getHours() + 1);
                          const year = now.getFullYear();
                          const month = String(now.getMonth() + 1).padStart(2, '0');
                          const day = String(now.getDate()).padStart(2, '0');
                          const hours = String(now.getHours()).padStart(2, '0');
                          const minutes = String(now.getMinutes()).padStart(2, '0');
                          setNewReminderDate(`${year}-${month}-${day}T${hours}:${minutes}`);
                        }}
                        className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Remarcar lembrete"
                      >
                        <Clock className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleMarkAsRead(reminder.id, reminder.lido)}
                      className={`p-2 rounded-lg transition-colors ${
                        reminder.lido
                          ? 'text-slate-600 hover:bg-slate-100'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={reminder.lido ? 'Marcar como não lido' : 'Marcar como lido'}
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(reminder.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remover lembrete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {reschedulingReminder === reminder.id && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="bg-orange-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Remarcar Lembrete</h4>
                      <div className="flex items-end space-x-3">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Nova Data e Hora
                          </label>
                          <input
                            type="datetime-local"
                            value={newReminderDate}
                            onChange={(e) => setNewReminderDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                        </div>
                        <button
                          onClick={() => handleReschedule(reminder)}
                          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => {
                            setReschedulingReminder(null);
                            setNewReminderDate('');
                          }}
                          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">
                        O lembrete atual será marcado como lido e um novo será criado com a data selecionada
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
