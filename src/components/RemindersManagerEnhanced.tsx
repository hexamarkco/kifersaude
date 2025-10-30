import { useEffect, useState } from 'react';
import { supabase, Reminder, Lead } from '../lib/supabase';
import {
  Bell, Check, Trash2, AlertCircle, Calendar, Clock, Search,
  CheckSquare, Square, Timer, ExternalLink, BarChart3,
  ChevronDown, ChevronUp, Tag, X, MessageCircle
} from 'lucide-react';
import { formatDateTimeFullBR, isOverdue } from '../lib/dateUtils';
import { openWhatsAppInBackgroundTab } from '../lib/whatsappService';
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
        () => {
          loadReminders();
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
      const updateData: any = { lido: !currentStatus };
      if (!currentStatus) {
        updateData.concluido_em = new Date().toISOString();
      } else {
        updateData.concluido_em = null;
      }

      const { error } = await supabase
        .from('reminders')
        .update(updateData)
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
      setOpenSnoozeMenu(null);
      loadReminders();
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

      const { error } = await supabase
        .from('reminders')
        .update({
          data_lembrete: new Date(customSnoozeDateTime).toISOString(),
          snooze_count: currentSnoozeCount + 1
        })
        .eq('id', customSnoozeReminder);

      if (error) throw error;
      setCustomSnoozeReminder(null);
      setCustomSnoozeDateTime('');
      setOpenSnoozeMenu(null);
      loadReminders();
    } catch (error) {
      console.error('Erro ao adiar lembrete:', error);
      alert('Erro ao adiar lembrete');
    }
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedReminders.size === 0) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          lido: true,
          concluido_em: new Date().toISOString()
        })
        .in('id', Array.from(selectedReminders));

      if (error) throw error;
      setSelectedReminders(new Set());
      loadReminders();
    } catch (error) {
      console.error('Erro ao atualizar lembretes:', error);
      alert('Erro ao atualizar lembretes');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedReminders.size === 0) return;
    if (!confirm(`Deseja remover ${selectedReminders.size} lembrete(s)?`)) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .in('id', Array.from(selectedReminders));

      if (error) throw error;
      setSelectedReminders(new Set());
      loadReminders();
    } catch (error) {
      console.error('Erro ao remover lembretes:', error);
      alert('Erro ao remover lembretes');
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!confirm('Deseja marcar todos os lembretes não lidos como lidos?')) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          lido: true,
          concluido_em: new Date().toISOString()
        })
        .eq('lido', false);

      if (error) throw error;
      loadReminders();
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

  const renderReminderCard = (reminder: Reminder) => {
    const overdue = isOverdue(reminder.data_lembrete);
    const urgency = getUrgencyLevel(reminder);
    const isSelected = selectedReminders.has(reminder.id);

    return (
      <div
        key={reminder.id}
        className={`bg-white rounded-xl shadow-sm border p-5 transition-all ${
          reminder.lido
            ? 'border-slate-200 opacity-60'
            : `${getUrgencyStyles(urgency)}`
        } ${isSelected ? 'ring-2 ring-teal-500' : ''}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            <button
              onClick={() => toggleReminderSelection(reminder.id)}
              className="mt-1 text-slate-400 hover:text-teal-600 transition-colors"
            >
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-teal-600" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>

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

              <div className="flex items-center space-x-4 text-sm text-slate-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                </div>
                {overdue && !reminder.lido && (
                  <span className="text-red-600 font-medium">Atrasado</span>
                )}
                {reminder.snooze_count && reminder.snooze_count > 0 && (
                  <span className="text-orange-600 text-xs">
                    Adiado {reminder.snooze_count}x
                  </span>
                )}
                {(reminder.lead_id || reminder.contract_id) && (
                  <ReminderContextLink
                    leadId={reminder.lead_id}
                    contractId={reminder.contract_id}
                  />
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
                    openWhatsAppInBackgroundTab(lead.telefone, lead.nome_completo, false);
                  }
                }}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Abrir WhatsApp com o lead"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
            )}
            {!reminder.lido && (
              <div className="relative">
                <button
                  onClick={() => setOpenSnoozeMenu(openSnoozeMenu === reminder.id ? null : reminder.id)}
                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                  title="Adiar"
                >
                  <Clock className="w-5 h-5" />
                </button>
                {openSnoozeMenu === reminder.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenSnoozeMenu(null)}
                    />
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-20 min-w-[180px]">
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
                          setCustomSnoozeDateTime(now.toISOString().slice(0, 16));
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors text-teal-600 font-medium"
                      >
                        Personalizado...
                      </button>
                    </div>
                  </>
                )}
              </div>
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
              title="Remover"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
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
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-lg transition-colors ${
              showStats ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Estatísticas"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setFilter('nao-lidos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'nao-lidos'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Não Lidos ({stats.unread})
          </button>
          <button
            onClick={() => setFilter('todos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'todos'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos ({stats.total})
          </button>
          <button
            onClick={() => setFilter('lidos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'lidos'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Lidos ({stats.completed})
          </button>
        </div>
      </div>

      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Total</div>
            <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Não Lidos</div>
            <div className="text-3xl font-bold text-orange-600">{stats.unread}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Atrasados</div>
            <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Hoje</div>
            <div className="text-3xl font-bold text-teal-600">{stats.today}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Concluídos</div>
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar lembretes por título, descrição ou tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">Todos os tipos</option>
            <option value="Documentos pendentes">Documentos pendentes</option>
            <option value="Assinatura">Assinatura</option>
            <option value="Ativação">Ativação</option>
            <option value="Renovação">Renovação</option>
            <option value="Retorno">Retorno</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="all">Todas prioridades</option>
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
          </select>

          <button
            onClick={() => setViewMode(viewMode === 'grouped' ? 'list' : 'grouped')}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {viewMode === 'grouped' ? 'Lista' : 'Agrupar'}
          </button>
        </div>

        {selectedReminders.size > 0 && (
          <div className="flex items-center space-x-3 pt-4 border-t border-slate-200">
            <span className="text-sm text-slate-600 font-medium">
              {selectedReminders.size} selecionado(s)
            </span>
            <button
              onClick={handleBatchMarkAsRead}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Marcar como lido
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Excluir
            </button>
            <button
              onClick={() => setSelectedReminders(new Set())}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm"
            >
              Cancelar
            </button>
            {filter === 'nao-lidos' && stats.unread > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="ml-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
              >
                Marcar todos como lido
              </button>
            )}
          </div>
        )}
      </div>

      {filteredReminders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
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
        <div className="space-y-6">
          {(['overdue', 'today', 'tomorrow', 'thisWeek', 'thisMonth', 'later'] as ReminderPeriod[]).map(period => {
            const periodReminders = groupedReminders[period];
            if (periodReminders.length === 0) return null;

            const isExpanded = expandedPeriods.has(period);

            return (
              <div key={period} className={`border rounded-xl ${getPeriodColor(period)}`}>
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
        <div className="space-y-3">
          {filteredReminders.map(renderReminderCard)}
        </div>
      )}

      {customSnoozeReminder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Adiar para data/hora personalizada</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Data e Hora
              </label>
              <input
                type="datetime-local"
                value={customSnoozeDateTime}
                onChange={(e) => setCustomSnoozeDateTime(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setCustomSnoozeReminder(null);
                  setCustomSnoozeDateTime('');
                }}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleCustomSnooze}
                disabled={!customSnoozeDateTime}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReminderContextLink({ leadId, contractId }: { leadId?: string; contractId?: string }) {
  const [contextInfo, setContextInfo] = useState<string>('');

  useEffect(() => {
    const loadContext = async () => {
      if (leadId) {
        const { data } = await supabase
          .from('leads')
          .select('nome_completo')
          .eq('id', leadId)
          .maybeSingle();

        if (data) {
          setContextInfo(`Lead: ${data.nome_completo}`);
        }
      } else if (contractId) {
        const { data } = await supabase
          .from('contracts')
          .select('codigo_contrato')
          .eq('id', contractId)
          .maybeSingle();

        if (data) {
          setContextInfo(`Contrato: ${data.codigo_contrato}`);
        }
      }
    };

    loadContext();
  }, [leadId, contractId]);

  if (!contextInfo) return null;

  return (
    <span className="flex items-center space-x-1 text-xs text-teal-600">
      <ExternalLink className="w-3 h-3" />
      <span>{contextInfo}</span>
    </span>
  );
}
