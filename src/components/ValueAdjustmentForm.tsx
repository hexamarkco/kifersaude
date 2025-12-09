import { useState } from 'react';
import { supabase, ContractValueAdjustment } from '../lib/supabase';
import { X, DollarSign } from 'lucide-react';

type ValueAdjustmentFormProps = {
  contractId: string;
  adjustment?: ContractValueAdjustment;
  responsavel: string;
  onClose: () => void;
  onSave: () => void;
};

export default function ValueAdjustmentForm({
  contractId,
  adjustment,
  responsavel,
  onClose,
  onSave
}: ValueAdjustmentFormProps) {
  const [formData, setFormData] = useState({
    tipo: adjustment?.tipo || 'acrescimo',
    valor: adjustment?.valor.toString() || '',
    motivo: adjustment?.motivo || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.motivo.trim()) {
      setError('O motivo é obrigatório');
      return;
    }

    if (!formData.valor || parseFloat(formData.valor) <= 0) {
      setError('O valor deve ser maior que zero');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dataToSave = {
        contract_id: contractId,
        tipo: formData.tipo as 'desconto' | 'acrescimo',
        valor: parseFloat(formData.valor),
        motivo: formData.motivo.trim(),
        created_by: responsavel,
      };

      if (adjustment) {
        const { error } = await supabase
          .from('contract_value_adjustments')
          .update(dataToSave)
          .eq('id', adjustment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contract_value_adjustments')
          .insert([dataToSave]);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar ajuste:', error);
      setError('Erro ao salvar ajuste. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-stretch justify-center z-[60] p-0 sm:items-center sm:p-4">
      <div className="modal-panel bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            {adjustment ? 'Editar Ajuste' : 'Adicionar Ajuste de Valor'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Tipo de Ajuste *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'acrescimo' })}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    formData.tipo === 'acrescimo'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <div className="font-semibold">Acréscimo</div>
                  <div className="text-xs mt-1">Adicionar valor</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo: 'desconto' })}
                  className={`px-4 py-3 rounded-lg border-2 transition-all ${
                    formData.tipo === 'desconto'
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <div className="font-semibold">Desconto</div>
                  <div className="text-xs mt-1">Reduzir valor</div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valor (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                placeholder="0,00"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motivo *
              </label>
              <textarea
                required
                value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                rows={3}
                placeholder="Descreva o motivo deste ajuste..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">
                Este motivo será registrado no histórico do contrato
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 mt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : adjustment ? 'Atualizar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
