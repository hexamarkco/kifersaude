import { useState } from 'react';
import { supabase, Dependent } from '../lib/supabase';
import { X, Users } from 'lucide-react';
import { formatDateForInput } from '../lib/dateUtils';

type DependentFormProps = {
  contractId: string;
  dependent: Dependent | null;
  onClose: () => void;
  onSave: () => void;
};

export default function DependentForm({ contractId, dependent, onClose, onSave }: DependentFormProps) {
  const [formData, setFormData] = useState({
    nome_completo: dependent?.nome_completo || '',
    cpf: dependent?.cpf || '',
    data_nascimento: formatDateForInput(dependent?.data_nascimento) || '',
    relacao: dependent?.relacao || 'Filho(a)',
    elegibilidade: dependent?.elegibilidade || '',
    valor_individual: dependent?.valor_individual?.toString() || '',
    carencia_individual: dependent?.carencia_individual || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        contract_id: contractId,
        nome_completo: formData.nome_completo,
        cpf: formData.cpf || null,
        data_nascimento: formData.data_nascimento,
        relacao: formData.relacao,
        elegibilidade: formData.elegibilidade || null,
        valor_individual: formData.valor_individual ? parseFloat(formData.valor_individual) : null,
        carencia_individual: formData.carencia_individual || null,
      };

      if (dependent) {
        const { error } = await supabase
          .from('dependents')
          .update(dataToSave)
          .eq('id', dependent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('dependents')
          .insert([dataToSave]);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar dependente:', error);
      alert('Erro ao salvar dependente');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-teal-600" />
            <h3 className="text-xl font-bold text-slate-900">
              {dependent ? 'Editar Dependente' : 'Novo Dependente'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                CPF
              </label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data de Nascimento *
              </label>
              <input
                type="date"
                required
                value={formData.data_nascimento}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Relação com Titular *
              </label>
              <select
                required
                value={formData.relacao}
                onChange={(e) => setFormData({ ...formData, relacao: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="Cônjuge">Cônjuge</option>
                <option value="Filho(a)">Filho(a)</option>
                <option value="Enteado(a)">Enteado(a)</option>
                <option value="Pai/Mãe">Pai/Mãe</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Valor Individual (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.valor_individual}
                onChange={(e) => setFormData({ ...formData, valor_individual: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Carência Individual
              </label>
              <select
                value={formData.carencia_individual}
                onChange={(e) => setFormData({ ...formData, carencia_individual: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Mesma do titular</option>
                <option value="padrão">Padrão</option>
                <option value="reduzida">Reduzida</option>
                <option value="portabilidade">Portabilidade</option>
                <option value="zero">Zero</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Elegibilidade
              </label>
              <input
                type="text"
                value={formData.elegibilidade}
                onChange={(e) => setFormData({ ...formData, elegibilidade: e.target.value })}
                placeholder="Ex: Filho menor de 21 anos"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-slate-200">
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
              {saving ? 'Salvando...' : 'Salvar Dependente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
