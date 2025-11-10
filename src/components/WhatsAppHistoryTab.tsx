import { useState, useEffect } from 'react';
import { supabase, AIGeneratedMessage, WhatsAppConversation, Lead } from '../lib/supabase';
import { MessageCircle, Calendar, Search, Sparkles, CheckCircle, XCircle, Clock, Loader } from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';

export default function WhatsAppHistoryTab() {
  const [aiMessages, setAIMessages] = useState<AIGeneratedMessage[]>([]);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'ai-messages' | 'conversations'>('ai-messages');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(new Map());

  useEffect(() => {
    loadData();
  }, [activeView]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeView === 'ai-messages') {
        const { data, error } = await supabase
          .from('ai_generated_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setAIMessages(data || []);

        const leadIds = [...new Set((data || []).map(m => m.lead_id))];
        await loadLeads(leadIds);
      } else {
        const { data, error } = await supabase
          .from('whatsapp_conversations')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(200);

        if (error) throw error;
        setConversations(data || []);

        const leadIds = [...new Set((data || []).map(c => c.lead_id))];
        await loadLeads(leadIds);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLeads = async (leadIds: string[]) => {
    if (leadIds.length === 0) return;

    const { data } = await supabase
      .from('leads')
      .select('id, nome_completo, telefone')
      .in('id', leadIds);

    if (data) {
      const newMap = new Map();
      data.forEach(lead => newMap.set(lead.id, lead));
      setLeadsMap(newMap);
    }
  };

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

  const filteredConversations = conversations.filter(conv => {
    if (searchQuery) {
      const lead = leadsMap.get(conv.lead_id);
      const query = searchQuery.toLowerCase();
      return (
        conv.message_text.toLowerCase().includes(query) ||
        (lead?.nome_completo.toLowerCase().includes(query)) ||
        conv.phone_number.includes(query)
      );
    }
    return true;
  });

  const groupConversationsByPhone = () => {
    const groups = new Map<string, WhatsAppConversation[]>();
    filteredConversations.forEach(conv => {
      const existing = groups.get(conv.phone_number) || [];
      existing.push(conv);
      groups.set(conv.phone_number, existing);
    });
    return Array.from(groups.entries()).map(([phone, messages]) => ({
      phone,
      messages,
      lastMessage: messages[0],
      leadId: messages[0].lead_id,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
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
              onClick={() => setActiveView('conversations')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeView === 'conversations'
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
              placeholder={activeView === 'ai-messages' ? 'Buscar em mensagens...' : 'Buscar em conversas...'}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

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
          <div className="space-y-4">
            {groupConversationsByPhone().length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg">
                <MessageCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              groupConversationsByPhone().map((group) => {
                const lead = leadsMap.get(group.leadId);
                return (
                  <div key={group.phone} className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{lead?.nome_completo || 'Lead não encontrado'}</h3>
                        <p className="text-sm text-slate-600">{group.phone}</p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {group.messages.length} mensagens
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <p className="text-sm text-slate-700 line-clamp-2">{group.lastMessage.message_text}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        Última mensagem: {formatDateTimeFullBR(group.lastMessage.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
