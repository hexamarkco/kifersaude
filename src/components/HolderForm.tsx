import { useState } from 'react';
import { supabase, ContractHolder } from '../lib/supabase';
import { Search, X, User } from 'lucide-react';
import { formatDateForInput } from '../lib/dateUtils';
import { consultarEmpresaPorCNPJ, consultarPessoaPorCPF } from '../lib/receitaService';

type HolderFormProps = {
  contractId: string;
  modalidade: string;
  holder?: ContractHolder;
  initialData?: Partial<ContractHolder>;
  bonusPorVidaDefault?: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function HolderForm({
  contractId,
  modalidade,
  holder,
  initialData,
  bonusPorVidaDefault,
  onClose,
  onSave,
}: HolderFormProps) {
  const [formData, setFormData] = useState({
    nome_completo: holder?.nome_completo || initialData?.nome_completo || '',
    cpf: holder?.cpf || initialData?.cpf || '',
    rg: holder?.rg || initialData?.rg || '',
    data_nascimento: formatDateForInput(holder?.data_nascimento || initialData?.data_nascimento) || '',
    sexo: holder?.sexo || initialData?.sexo || '',
    estado_civil: holder?.estado_civil || initialData?.estado_civil || '',
    telefone: holder?.telefone || initialData?.telefone || '',
    email: holder?.email || initialData?.email || '',
    cep: holder?.cep || initialData?.cep || '',
    endereco: holder?.endereco || initialData?.endereco || '',
    numero: holder?.numero || initialData?.numero || '',
    complemento: holder?.complemento || initialData?.complemento || '',
    bairro: holder?.bairro || initialData?.bairro || '',
    cidade: holder?.cidade || initialData?.cidade || '',
    estado: holder?.estado || initialData?.estado || '',
    cns: holder?.cns || initialData?.cns || '',
    cnpj: holder?.cnpj || initialData?.cnpj || '',
    razao_social: holder?.razao_social || initialData?.razao_social || '',
    nome_fantasia: holder?.nome_fantasia || initialData?.nome_fantasia || '',
    percentual_societario: holder?.percentual_societario?.toString() || initialData?.percentual_societario?.toString() || '',
    data_abertura_cnpj: formatDateForInput(holder?.data_abertura_cnpj || initialData?.data_abertura_cnpj) || '',
    bonus_por_vida_aplicado:
      holder?.bonus_por_vida_aplicado ?? initialData?.bonus_por_vida_aplicado ?? bonusPorVidaDefault ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [cpfLookupError, setCpfLookupError] = useState<string | null>(null);
  const [cpfLoading, setCpfLoading] = useState(false);
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);

  const isCNPJModalidade = ['MEI', 'CNPJ (PME)'].includes(modalidade);

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
        sexo: pessoa.sexo || prev.sexo,
        cep: pessoa.cep || prev.cep,
        endereco: pessoa.endereco || prev.endereco,
        numero: pessoa.numero || prev.numero,
        complemento: pessoa.complemento ?? prev.complemento,
        bairro: pessoa.bairro || prev.bairro,
        cidade: pessoa.cidade || prev.cidade,
        estado: pessoa.estado || prev.estado,
      }));
    } catch (error) {
      console.error('Erro ao consultar CPF:', error);
      setCpfLookupError(error instanceof Error ? error.message : 'Não foi possível consultar CPF');
    } finally {
      setCpfLoading(false);
    }
  };

  const handleConsultarCNPJ = async () => {
    setCnpjLookupError(null);
    setCnpjLoading(true);

    try {
      const empresa = await consultarEmpresaPorCNPJ(formData.cnpj);

      setFormData(prev => ({
        ...prev,
        razao_social: empresa.razao_social || prev.razao_social,
        nome_fantasia: empresa.nome_fantasia || prev.nome_fantasia,
        cep: empresa.cep || prev.cep,
        endereco: empresa.endereco || prev.endereco,
        numero: empresa.numero || prev.numero,
        complemento: empresa.complemento ?? prev.complemento,
        bairro: empresa.bairro || prev.bairro,
        cidade: empresa.cidade || prev.cidade,
        estado: empresa.estado || prev.estado,
      }));
    } catch (error) {
      console.error('Erro ao consultar CNPJ:', error);
      setCnpjLookupError(error instanceof Error ? error.message : 'Não foi possível consultar CNPJ');
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        contract_id: contractId,
        nome_completo: formData.nome_completo,
        cpf: formData.cpf,
        rg: formData.rg || null,
        data_nascimento: formData.data_nascimento,
        sexo: formData.sexo || null,
        estado_civil: formData.estado_civil || null,
        telefone: formData.telefone,
        email: formData.email || null,
        cep: formData.cep || null,
        endereco: formData.endereco || null,
        numero: formData.numero || null,
        complemento: formData.complemento || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        cns: formData.cns || null,
        cnpj: formData.cnpj || null,
        razao_social: formData.razao_social || null,
        nome_fantasia: formData.nome_fantasia || null,
        percentual_societario: formData.percentual_societario ? parseFloat(formData.percentual_societario) : null,
        data_abertura_cnpj: formData.data_abertura_cnpj || null,
        bonus_por_vida_aplicado: formData.bonus_por_vida_aplicado,
      };

      if (holder) {
        const { error } = await supabase
          .from('contract_holders')
          .update(dataToSave)
          .eq('id', holder.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contract_holders')
          .insert([dataToSave]);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error('Erro ao salvar titular:', error);
      alert('Erro ao salvar titular');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-stretch justify-center z-50 p-0 sm:items-center sm:p-4">
      <div className="modal-panel bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <User className="w-6 h-6 text-teal-600" />
            <h3 className="text-xl font-bold text-slate-900">
              {holder ? 'Editar Titular' : 'Dados do Titular'}
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
          <div className="mb-6">
            <h4 className="font-semibold text-slate-900 mb-4">Informações Pessoais</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
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
                  CPF *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
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
                  RG
                </label>
                <input
                  type="text"
                  value={formData.rg}
                  onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
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

              <div className="md:col-span-3">
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
                  Marque se este titular é elegível ao bônus por vida deste contrato.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sexo
                </label>
                <select
                  value={formData.sexo}
                  onChange={(e) => setFormData({ ...formData, sexo: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Selecione</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estado Civil
                </label>
                <select
                  value={formData.estado_civil}
                  onChange={(e) => setFormData({ ...formData, estado_civil: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Selecione</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Telefone *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  CNS (Cartão SUS)
                </label>
                <input
                  type="text"
                  value={formData.cns}
                  onChange={(e) => setFormData({ ...formData, cns: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="mb-6 pt-6 border-t border-slate-200">
            <h4 className="font-semibold text-slate-900 mb-4">Endereço</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  value={formData.cep}
                  onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Número
                </label>
                <input
                  type="text"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Complemento
                </label>
                <input
                  type="text"
                  value={formData.complemento}
                  onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={formData.bairro}
                  onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cidade
                </label>
                <input
                  type="text"
                  value={formData.cidade}
                  onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Estado
                </label>
                <input
                  type="text"
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  maxLength={2}
                  placeholder="UF"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {isCNPJModalidade && (
            <div className="mb-6 pt-6 border-t border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-4">Informações Empresariais</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CNPJ
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={handleConsultarCNPJ}
                      disabled={cnpjLoading}
                      className="px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                      {cnpjLoading ? 'Buscando...' : 'Buscar na Receita'}
                    </button>
                  </div>
                  {cnpjLookupError && <p className="text-xs text-red-600 mt-1">{cnpjLookupError}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Data de Abertura do CNPJ
                  </label>
                  <input
                    type="date"
                    value={formData.data_abertura_cnpj}
                    onChange={(e) => setFormData({ ...formData, data_abertura_cnpj: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Razão Social
                  </label>
                  <input
                    type="text"
                    value={formData.razao_social}
                    onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={formData.nome_fantasia}
                    onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Percentual Societário (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    max="100"
                    value={formData.percentual_societario}
                    onChange={(e) => setFormData({ ...formData, percentual_societario: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-200">
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
              {saving ? 'Salvando...' : 'Salvar Titular'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
