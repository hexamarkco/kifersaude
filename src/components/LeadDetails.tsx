import { useState, useEffect } from 'react';
import { supabase, Lead, Interaction } from '../lib/supabase';
import { X, MessageCircle, Plus } from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import LeadStatusHistoryComponent from './LeadStatusHistory';
import NextStepSuggestion from './NextStepSuggestion';

type LeadDetailsProps = {
  lead: Lead;
  onClose: () => void;
  onUpdate: () => void;
};

export default function LeadDetails({ lead, onClose, onUpdate }: LeadDetailsProps) {
  const { isObserver } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'Observação',
    descricao: '',
    responsavel: 'Luiza',
  });

  useEffect(() => {
    loadInteractions();
  }, [lead.id]);

  const loadInteractions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('lead_id', lead.id)
        .order('data_interacao', { ascending: false });

      if (error) throw error;
      setInteractions(data || []);
    } catch (error) {
      console.error('Erro ao carregar interações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('interactions')
        .insert([{
          lead_id: lead.id,
          ...formData,
        }]);

      if (error) throw error;

      await supabase
        .from('leads')
        .update({ ultimo_contato: new Date().toISOString() })
        .eq('id', lead.id);

      setFormData({ tipo: 'Observação', descricao: '', responsavel: 'Luiza' });
      setShowForm(false);
      loadInteractions();
      onUpdate();
    } catch (error) {
      console.error('Erro ao adicionar interação:', error);
      alert('Erro ao adicionar interação');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{lead.nome_completo}</h3>
            <p className="text-sm text-slate-600">Histórico de Interações</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="font-medium text-slate-700">Telefone:</span>
                <span className="ml-2 text-slate-900">{lead.telefone}</span>
              </div>
              {lead.email && (
                <div>
                  <span className="font-medium text-slate-700">E-mail:</span>
                  <span className="ml-2 text-slate-900">{lead.email}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-slate-700">Status:</span>
                <span className="ml-2 text-slate-900">{lead.status}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Responsável:</span>
                <span className="ml-2 text-slate-900">{lead.responsavel}</span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <NextStepSuggestion leadStatus={lead.status} lastContact={lead.ultimo_contato} />
          </div>

          <div className="mb-6">
            <LeadStatusHistoryComponent leadId={lead.id} />
          </div>

          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-slate-900">Interações</h4>
            <div className="flex items-center space-x-2">
              {!isObserver && (
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="flex items-center space-x-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Interação</span>
                </button>
              )}
            </div>
          </div>

          {showForm && (
            <form onSubmit={handleAddInteraction} className="mb-6 bg-teal-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Interação
                  </label>
                  <select
                    required
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="Ligação">Ligação</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Reunião">Reunião</option>
                    <option value="Observação">Observação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Responsável
                  </label>
                  <select
                    required
                    value={formData.responsavel}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="Luiza">Luiza</option>
                    <option value="Nick">Nick</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descrição
                </label>
                <textarea
                  required
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                  placeholder="Descreva o que foi tratado nesta interação..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-slate-700 hover:bg-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-500 border-t-transparent"></div>
            </div>
          ) : interactions.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">Nenhuma interação registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {interactions.map((interaction) => (
                <div key={interaction.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        {interaction.tipo}
                      </span>
                      <span className="text-sm text-slate-600">{interaction.responsavel}</span>
                    </div>
                    <span className="text-sm text-slate-500">
                      {formatDateTimeFullBR(interaction.data_interacao)}
                    </span>
                  </div>
                  <p className="text-slate-700">{interaction.descricao}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
