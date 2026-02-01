import { useState, useMemo, useEffect } from 'react';
import { supabase, Dependent, ContractHolder } from '../lib/supabase';
import { Search, X, Users } from 'lucide-react';
import { formatDateForInput } from '../lib/dateUtils';
import { consultarPessoaPorCPF } from '../lib/receitaService';

type DependentFormProps = {
  contractId: string;
  holders: ContractHolder[];
  dependent: Dependent | null;
  selectedHolderId?: string | null;
  bonusPorVidaDefault?: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function DependentForm({
  contractId,
  holders,
  dependent,
  selectedHolderId,
  bonusPorVidaDefault,
  onClose,
  onSave,
}: DependentFormProps) {
  const holderOptions = useMemo(() => holders.map(holder => ({ value: holder.id, label: holder.nome_completo })), [holders]);
  const defaultHolderId = dependent?.holder_id || selectedHolderId || holderOptions[0]?.value || '';
  const [formData, setFormData] = useState({
    holder_id: defaultHolderId,
    nome_completo: dependent?.nome_completo || '',
    cpf: dependent?.cpf || '',
    data_nascimento: formatDateForInput(dependent?.data_nascimento) || '',
    relacao: dependent?.relacao || 'Filho(a)',
    elegibilidade: dependent?.elegibilidade || '',
    valor_individual: dependent?.valor_individual?.toString() || '',
    carencia_individual: dependent?.carencia_individual || '',
    bonus_por_vida_aplicado: dependent?.bonus_por_vida_aplicado ?? bonusPorVidaDefault ?? true,
  });
  useEffect(() => {
    setFormData((current) => ({
      ...current,
      holder_id: dependent?.holder_id || selectedHolderId || holderOptions[0]?.value || '',
      nome_completo: dependent?.nome_completo || '',
      cpf: dependent?.cpf || '',
      data_nascimento: formatDateForInput(dependent?.data_nascimento) || '',
      relacao: dependent?.relacao || 'Filho(a)',
      elegibilidade: dependent?.elegibilidade || '',
      valor_individual: dependent?.valor_individual?.toString() || '',
      carencia_individual: dependent?.carencia_individual || '',
      bonus_por_vida_aplicado: dependent?.bonus_por_vida_aplicado ?? bonusPorVidaDefault ?? true,
    }));
  }, [dependent, holderOptions, selectedHolderId, bonusPorVidaDefault]);
  const [saving, setSaving] = useState(false);
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cpfLookupError, setCpfLookupError] = useState<string | null>(null);

  const handleConsultarCPF = async () => {
    if (!formData.cpf || !formData.data_nascimento) {
      setCpfLookupError('Informe CPF e data de nascimento para buscar.');
      return;
    }

    setCpfLookupError(null);
    setCpfLoading(true);

    try {
      const pessoa = await consultarPessoaPorCPF(formData.cpf, formData.data_nascimento);

      setFormData(prev => ({
        ...prev,
        nome_completo: pessoa.nome || prev.nome_completo,
        data_nascimento: formatDateForInput(pessoa.data_nascimento) || prev.data_nascimento,
      }));
    } catch (error) {
      console.error('Erro ao consultar CPF do dependente:', error);
      setCpfLookupError(error instanceof Error ? error.message : 'Não foi possível consultar CPF');
    } finally {
      setCpfLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!formData.holder_id) {
        throw new Error('Selecione um titular para o dependente');
      }

      const dataToSave = {
        contract_id: contractId,
        holder_id: formData.holder_id,
        nome_completo: formData.nome_completo,
        cpf: formData.cpf || null,
        data_nascimento: formData.data_nascimento,
        relacao: formData.relacao,
        elegibilidade: formData.elegibilidade || null,
        valor_individual: formData.valor_individual ? parseFloat(formData.valor_individual) : null,
        carencia_individual: formData.carencia_individual || null,
        bonus_por_vida_aplicado: formData.bonus_por_vida_aplicado,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-stretch justify-center z-50 p-0 sm:items-center sm:p-4">
      <div className="modal-panel bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Titular *
              </label>
              <select
                required
                value={formData.holder_id}
                onChange={(e) => setFormData({ ...formData, holder_id: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">Selecione um titular</option>
                {holderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

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
              <div className="relative">
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleConsultarCPF}
                  disabled={cpfLoading || !formData.cpf || !formData.data_nascimento}
                  aria-label="Buscar na Receita"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-teal-600 transition-colors disabled:opacity-50"
                >
                  <Search className={`w-4 h-4 ${cpfLoading ? 'animate-pulse' : ''}`} />
                </button>
              </div>
              {cpfLookupError && <p className="text-xs text-red-600 mt-1">{cpfLookupError}</p>}
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

            <div className="md:col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.bonus_por_vida_aplicado}
                  onChange={(e) =>
                    setFormData({ ...formData, bonus_por_vida_aplicado: e.target.checked })
                  }
                  className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-2 focus:ring-teal-500"
                />
                <span className="text-sm font-medium text-slate-700">Aplicar bônus por vida</span>
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Marque se este dependente é elegível ao bônus por vida deste contrato.
              </p>
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
