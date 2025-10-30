import { useState, useEffect } from 'react';
import { supabase, FollowUpCustomRule, Lead } from '../lib/supabase';
import { Plus, Trash2, Clock, AlertCircle, X, Edit2, Save } from 'lucide-react';

type CustomFollowUpManagerProps = {
  lead: Lead;
  onClose: () => void;
};

const STATUS_OPTIONS = ['Novo', 'Em contato', 'Cotando', 'Proposta enviada', 'Fechado', 'Perdido'];
const PRIORITY_OPTIONS: Array<'baixa' | 'media' | 'alta'> = ['baixa', 'media', 'alta'];

export default function CustomFollowUpManager({ lead, onClose }: CustomFollowUpManagerProps) {
  const [rules, setRules] = useState<FollowUpCustomRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({
    status: lead.status,
    days_after: 1,
    title: '',
    description: '',
    priority: 'media' as 'baixa' | 'media' | 'alta',
  });

  useEffect(() => {
    loadRules();
  }, [lead.id]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('follow_up_custom_rules')
        .select('*')
        .eq('lead_id', lead.id)
        .order('days_after', { ascending: true });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Erro ao carregar regras personalizadas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRule.title.trim()) {
      alert('Por favor, preencha o título do lembrete');
      return;
    }

    try {
      const { error } = await supabase
        .from('follow_up_custom_rules')
        .insert([{
          lead_id: lead.id,
          status: newRule.status,
          days_after: newRule.days_after,
          title: newRule.title,
          description: newRule.description,
          priority: newRule.priority,
          active: true,
        }]);

      if (error) throw error;

      setNewRule({
        status: lead.status,
        days_after: 1,
        title: '',
        description: '',
        priority: 'media',
      });

      loadRules();
    } catch (error) {
      console.error('Erro ao adicionar regra:', error);
      alert('Erro ao adicionar regra personalizada');
    }
  };

  const handleUpdateRule = async (ruleId: string, updates: Partial<FollowUpCustomRule>) => {
    try {
      const { error } = await supabase
        .from('follow_up_custom_rules')
        .update(updates)
        .eq('id', ruleId);

      if (error) throw error;
      loadRules();
      setEditingRule(null);
    } catch (error) {
      console.error('Erro ao atualizar regra:', error);
      alert('Erro ao atualizar regra');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Deseja remover esta regra personalizada?')) return;

    try {
      const { error } = await supabase
        .from('follow_up_custom_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      loadRules();
    } catch (error) {
      console.error('Erro ao remover regra:', error);
      alert('Erro ao remover regra');
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      baixa: 'bg-blue-100 text-blue-700',
      media: 'bg-yellow-100 text-yellow-700',
      alta: 'bg-red-100 text-red-700',
    };
    return colors[priority] || 'bg-slate-100 text-slate-700';
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Lembretes Personalizados</h3>
            <p className="text-teal-100 text-sm mt-1">{lead.nome_completo}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-teal-500 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Como funciona?</h4>
                <p className="text-sm text-blue-700">
                  Regras personalizadas substituem as regras padrão do sistema para este lead.
                  Configure lembretes específicos com intervalos customizados para um acompanhamento mais eficiente.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">Adicionar Nova Regra</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={newRule.status}
                  onChange={(e) => setNewRule({ ...newRule, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dias após mudança</label>
                <input
                  type="number"
                  min="0"
                  value={newRule.days_after}
                  onChange={(e) => setNewRule({ ...newRule, days_after: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
                <input
                  type="text"
                  value={newRule.title}
                  onChange={(e) => setNewRule({ ...newRule, title: e.target.value })}
                  placeholder="Ex: Follow-up urgente com cliente"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
                <textarea
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="Detalhes do que deve ser feito neste follow-up..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                <select
                  value={newRule.priority}
                  onChange={(e) => setNewRule({ ...newRule, priority: e.target.value as 'baixa' | 'media' | 'alta' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {PRIORITY_OPTIONS.map(priority => (
                    <option key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddRule}
                  className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Regra</span>
                </button>
              </div>
            </div>
          </div>

          {rules.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
              <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Nenhuma regra personalizada</p>
              <p className="text-slate-500 text-sm mt-1">
                Este lead está usando as regras padrão do sistema
              </p>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">
                Regras Ativas ({rules.filter(r => r.active).length})
              </h4>
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`border rounded-lg p-4 transition-all ${
                      rule.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-300 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                            {rule.status}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(rule.priority)}`}>
                            {rule.priority}
                          </span>
                          <span className="text-sm text-slate-500 flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{rule.days_after} {rule.days_after === 1 ? 'dia' : 'dias'}</span>
                          </span>
                        </div>
                        <h5 className="font-semibold text-slate-900 mb-1">{rule.title}</h5>
                        {rule.description && (
                          <p className="text-sm text-slate-600">{rule.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleUpdateRule(rule.id, { active: !rule.active })}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            rule.active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {rule.active ? 'Ativa' : 'Inativa'}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remover regra"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
