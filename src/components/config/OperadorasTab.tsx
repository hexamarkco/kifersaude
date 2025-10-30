import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, CheckCircle, AlertCircle, Save, X } from 'lucide-react';
import { Operadora } from '../../lib/supabase';
import { configService } from '../../lib/configService';

export default function OperadorasTab() {
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    comissao_padrao: 8.0,
    prazo_recebimento_dias: 30,
    bonus_por_vida: false,
    bonus_padrao: 0,
    observacoes: '',
    ativo: true,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadOperadoras();
  }, []);

  const loadOperadoras = async () => {
    setLoading(true);
    const data = await configService.getOperadoras();
    setOperadoras(data);
    setLoading(false);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      comissao_padrao: 8.0,
      prazo_recebimento_dias: 30,
      bonus_por_vida: false,
      bonus_padrao: 0,
      observacoes: '',
      ativo: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (operadora: Operadora) => {
    setFormData({
      nome: operadora.nome,
      comissao_padrao: operadora.comissao_padrao,
      prazo_recebimento_dias: operadora.prazo_recebimento_dias,
      bonus_por_vida: operadora.bonus_por_vida,
      bonus_padrao: operadora.bonus_padrao,
      observacoes: operadora.observacoes || '',
      ativo: operadora.ativo,
    });
    setEditingId(operadora.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      const { error } = await configService.updateOperadora(editingId, formData);
      if (error) {
        showMessage('error', 'Erro ao atualizar operadora');
      } else {
        showMessage('success', 'Operadora atualizada com sucesso');
        resetForm();
        loadOperadoras();
      }
    } else {
      const { error } = await configService.createOperadora(formData);
      if (error) {
        showMessage('error', 'Erro ao criar operadora');
      } else {
        showMessage('success', 'Operadora criada com sucesso');
        resetForm();
        loadOperadoras();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta operadora?')) return;

    const { error } = await configService.deleteOperadora(id);
    if (error) {
      showMessage('error', 'Erro ao excluir operadora');
    } else {
      showMessage('success', 'Operadora excluída com sucesso');
      loadOperadoras();
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
        <p className="text-slate-600 mt-4">Carregando operadoras...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg border flex items-center space-x-3 ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6 text-teal-600" />
            <h3 className="text-xl font-semibold text-slate-900">Operadoras de Saúde</h3>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showForm ? 'Cancelar' : 'Nova Operadora'}</span>
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-slate-50 rounded-lg p-6 mb-6">
            <h4 className="text-lg font-semibold text-slate-900 mb-4">
              {editingId ? 'Editar Operadora' : 'Nova Operadora'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome da Operadora *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Ex: Unimed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Comissão Padrão (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="500"
                  value={formData.comissao_padrao}
                  onChange={(e) => setFormData({ ...formData, comissao_padrao: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Pode exceder 100% para contratos PJ
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prazo de Recebimento (dias)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.prazo_recebimento_dias}
                  onChange={(e) => setFormData({ ...formData, prazo_recebimento_dias: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.bonus_por_vida}
                    onChange={(e) => setFormData({ ...formData, bonus_por_vida: e.target.checked })}
                    className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Oferece Bônus por Vida</span>
                </label>
              </div>

              {formData.bonus_por_vida && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Bônus Padrão (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.bonus_padrao}
                    onChange={(e) => setFormData({ ...formData, bonus_padrao: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Valor em reais"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Valor recorrente adicional por contrato
                  </p>
                </div>
              )}

              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.ativo}
                    onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                    className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Ativo</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Observações sobre a operadora..."
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{editingId ? 'Atualizar' : 'Criar'}</span>
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {operadoras.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">Nenhuma operadora cadastrada</p>
            </div>
          ) : (
            operadoras.map((operadora) => (
              <div
                key={operadora.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-slate-900">{operadora.nome}</h4>
                    {!operadora.ativo && (
                      <span className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded">
                        Inativo
                      </span>
                    )}
                    {operadora.bonus_por_vida && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded">
                        Bônus por Vida
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-slate-600">
                    <span>Comissão: {operadora.comissao_padrao}%</span>
                    <span>Prazo: {operadora.prazo_recebimento_dias} dias</span>
                    {operadora.bonus_por_vida && operadora.bonus_padrao > 0 && (
                      <span className="text-green-700 font-medium">
                        Bônus: R$ {operadora.bonus_padrao.toFixed(2)}
                      </span>
                    )}
                  </div>
                  {operadora.observacoes && (
                    <p className="text-sm text-slate-500 mt-1">{operadora.observacoes}</p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleEdit(operadora)}
                    className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(operadora.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
