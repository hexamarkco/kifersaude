import { useState, useEffect } from 'react';
import { supabase, Contract, Lead, ContractValueAdjustment } from '../lib/supabase';
import { X, User, Plus, Trash2, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import HolderForm from './HolderForm';
import ValueAdjustmentForm from './ValueAdjustmentForm';

type ContractFormProps = {
  contract: Contract | null;
  leadToConvert?: Lead | null;
  onClose: () => void;
  onSave: () => void;
};

export default function ContractForm({ contract, leadToConvert, onClose, onSave }: ContractFormProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [formData, setFormData] = useState({
    codigo_contrato: contract?.codigo_contrato || '',
    lead_id: contract?.lead_id || leadToConvert?.id || '',
    status: contract?.status || 'Rascunho',
    modalidade: contract?.modalidade || leadToConvert?.tipo_contratacao || 'PF',
    operadora: contract?.operadora || leadToConvert?.operadora_atual || '',
    produto_plano: contract?.produto_plano || '',
    abrangencia: contract?.abrangencia || 'Nacional',
    acomodacao: contract?.acomodacao || 'Enfermaria',
    data_inicio: contract?.data_inicio || '',
    data_renovacao: contract?.data_renovacao ? contract.data_renovacao.substring(0, 7) : '',
    carencia: contract?.carencia || 'padrão',
    mensalidade_total: contract?.mensalidade_total?.toString() || '',
    comissao_prevista: contract?.comissao_prevista?.toString() || '',
    comissao_multiplicador: contract?.comissao_multiplicador?.toString() || '2.8',
    previsao_recebimento_comissao: contract?.previsao_recebimento_comissao || '',
    bonus_por_vida_valor: contract?.bonus_por_vida_valor?.toString() || '',
    bonus_por_vida_aplicado: contract?.bonus_por_vida_aplicado || false,
    responsavel: contract?.responsavel || leadToConvert?.responsavel || 'Luiza',
    observacoes_internas: contract?.observacoes_internas || '',
  });
  const [saving, setSaving] = useState(false);
  const [showHolderForm, setShowHolderForm] = useState(false);
  const [contractId, setContractId] = useState<string | null>(contract?.id || null);
  const [adjustments, setAdjustments] = useState<ContractValueAdjustment[]>([]);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<ContractValueAdjustment | null>(null);

  useEffect(() => {
    loadLeads();
    if (contract?.id) {
      loadAdjustments(contract.id);
    }
  }, []);

  useEffect(() => {
    if (formData.mensalidade_total && formData.comissao_multiplicador) {
      const mensalidade = parseFloat(formData.mensalidade_total);
      const multiplicador = parseFloat(formData.comissao_multiplicador);

      if (!isNaN(mensalidade) && !isNaN(multiplicador)) {
        const adjustedValue = calculateAdjustedValue(mensalidade);
        const comissao = adjustedValue * multiplicador;
        setFormData(prev => ({ ...prev, comissao_prevista: comissao.toFixed(2) }));
      }
    }
  }, [formData.mensalidade_total, formData.comissao_multiplicador, adjustments]);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false)
        .in('status', ['Cotando', 'Proposta enviada', 'Fechado'])
        .order('nome_completo');

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    }
  };

  const loadAdjustments = async (contractId: string) => {
    try {
      const { data, error } = await supabase
        .from('contract_value_adjustments')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at');

      if (error) throw error;
      setAdjustments(data || []);
    } catch (error) {
      console.error('Erro ao carregar ajustes:', error);
    }
  };

  const calculateAdjustedValue = (baseValue: number): number => {
    let total = baseValue;
    adjustments.forEach(adj => {
      if (adj.tipo === 'acrescimo') {
        total += adj.valor;
      } else {
        total -= adj.valor;
      }
    });
    return total;
  };

  const handleDeleteAdjustment = async (id: string) => {
    if (!confirm('Deseja remover este ajuste?')) return;

    try {
      const { error } = await supabase
        .from('contract_value_adjustments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (contract?.id) {
        await loadAdjustments(contract.id);
      }
    } catch (error) {
      console.error('Erro ao remover ajuste:', error);
      alert('Erro ao remover ajuste');
    }
  };

  const generateContractCode = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `KS${year}${month}${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const codigo = formData.codigo_contrato || generateContractCode();

      const dataToSave = {
        codigo_contrato: codigo,
        lead_id: formData.lead_id || null,
        status: formData.status,
        modalidade: formData.modalidade,
        operadora: formData.operadora,
        produto_plano: formData.produto_plano,
        abrangencia: formData.abrangencia || null,
        acomodacao: formData.acomodacao || null,
        data_inicio: formData.data_inicio || null,
        data_renovacao: formData.data_renovacao ? `${formData.data_renovacao}-01` : null,
        carencia: formData.carencia || null,
        mensalidade_total: formData.mensalidade_total ? parseFloat(formData.mensalidade_total) : null,
        comissao_prevista: formData.comissao_prevista ? parseFloat(formData.comissao_prevista) : null,
        comissao_multiplicador: formData.comissao_multiplicador ? parseFloat(formData.comissao_multiplicador) : 2.8,
        previsao_recebimento_comissao: formData.previsao_recebimento_comissao || null,
        bonus_por_vida_valor: formData.bonus_por_vida_valor ? parseFloat(formData.bonus_por_vida_valor) : null,
        bonus_por_vida_aplicado: formData.bonus_por_vida_aplicado,
        responsavel: formData.responsavel,
        observacoes_internas: formData.observacoes_internas || null,
      };

      if (contract) {
        const { error } = await supabase
          .from('contracts')
          .update(dataToSave)
          .eq('id', contract.id);

        if (error) throw error;
        onSave();
      } else {
        const { data, error } = await supabase
          .from('contracts')
          .insert([dataToSave])
          .select()
          .single();

        if (error) throw error;

        if (leadToConvert) {
          await supabase
            .from('leads')
            .update({ status: 'Fechado' })
            .eq('id', leadToConvert.id);
        }

        setContractId(data.id);
        setShowHolderForm(true);
      }
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      alert('Erro ao salvar contrato');
    } finally {
      setSaving(false);
    }
  };

  if (showHolderForm && contractId) {
    return (
      <HolderForm
        contractId={contractId}
        modalidade={formData.modalidade}
        onClose={onClose}
        onSave={onSave}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {contract ? 'Editar Contrato' : leadToConvert ? 'Converter Lead em Contrato' : 'Novo Contrato'}
            </h3>
            {leadToConvert && (
              <p className="text-sm text-slate-600 mt-1">
                Lead: {leadToConvert.nome_completo} - {leadToConvert.telefone}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6 bg-teal-50 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Informações do Contrato
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Código do Contrato
                </label>
                <input
                  type="text"
                  value={formData.codigo_contrato}
                  onChange={(e) => setFormData({ ...formData, codigo_contrato: e.target.value })}
                  placeholder="Será gerado automaticamente"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lead Vinculado
                </label>
                <select
                  value={formData.lead_id}
                  onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Nenhum</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>{lead.nome_completo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="Rascunho">Rascunho</option>
                  <option value="Em análise">Em análise</option>
                  <option value="Documentos pendentes">Documentos pendentes</option>
                  <option value="Proposta enviada">Proposta enviada</option>
                  <option value="Aguardando assinatura">Aguardando assinatura</option>
                  <option value="Emitido">Emitido</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Suspenso">Suspenso</option>
                  <option value="Cancelado">Cancelado</option>
                  <option value="Encerrado">Encerrado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Modalidade *
                </label>
                <select
                  required
                  value={formData.modalidade}
                  onChange={(e) => setFormData({ ...formData, modalidade: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="PF">PF</option>
                  <option value="MEI">MEI</option>
                  <option value="CNPJ (PME)">CNPJ (PME)</option>
                  <option value="Adesão">Adesão</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Operadora *
                </label>
                <input
                  type="text"
                  required
                  value={formData.operadora}
                  onChange={(e) => setFormData({ ...formData, operadora: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Produto/Plano *
                </label>
                <input
                  type="text"
                  required
                  value={formData.produto_plano}
                  onChange={(e) => setFormData({ ...formData, produto_plano: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Abrangência
                </label>
                <select
                  value={formData.abrangencia}
                  onChange={(e) => setFormData({ ...formData, abrangencia: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="Nacional">Nacional</option>
                  <option value="Regional">Regional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Acomodação
                </label>
                <select
                  value={formData.acomodacao}
                  onChange={(e) => setFormData({ ...formData, acomodacao: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="Enfermaria">Enfermaria</option>
                  <option value="Apartamento">Apartamento</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data de Renovação
                </label>
                <input
                  type="month"
                  value={formData.data_renovacao}
                  onChange={(e) => setFormData({ ...formData, data_renovacao: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="MM/AAAA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carência
                </label>
                <select
                  value={formData.carencia}
                  onChange={(e) => setFormData({ ...formData, carencia: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="padrão">Padrão</option>
                  <option value="reduzida">Reduzida</option>
                  <option value="portabilidade">Portabilidade</option>
                  <option value="zero">Zero</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mensalidade Base (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.mensalidade_total}
                  onChange={(e) => setFormData({ ...formData, mensalidade_total: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {contract?.id && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Ajustes de Valor
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAdjustment(null);
                        setShowAdjustmentForm(true);
                      }}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Ajuste</span>
                    </button>
                  </div>

                  {adjustments.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {adjustments.map((adj) => (
                        <div
                          key={adj.id}
                          className={`flex items-start justify-between p-3 rounded-lg border ${
                            adj.tipo === 'acrescimo'
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start space-x-2 flex-1">
                            {adj.tipo === 'acrescimo' ? (
                              <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-600 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`font-semibold ${
                                    adj.tipo === 'acrescimo' ? 'text-green-700' : 'text-red-700'
                                  }`}
                                >
                                  {adj.tipo === 'acrescimo' ? '+' : '-'} R${' '}
                                  {adj.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 mt-1">{adj.motivo}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {adj.created_by} - {new Date(adj.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdjustment(adj.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic mb-3">Nenhum ajuste aplicado</p>
                  )}

                  {formData.mensalidade_total && (
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">Mensalidade Final:</span>
                        <span className="font-bold text-teal-700 text-lg">
                          R${' '}
                          {calculateAdjustedValue(
                            parseFloat(formData.mensalidade_total)
                          ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Multiplicador de Comissão
                </label>
                <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-4 border border-teal-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-600">Valor do multiplicador:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-teal-700">
                        {formData.comissao_multiplicador}x
                      </span>
                      {parseFloat(formData.comissao_multiplicador) !== 2.8 && (
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={formData.comissao_multiplicador}
                    onChange={(e) =>
                      setFormData({ ...formData, comissao_multiplicador: e.target.value })
                    }
                    className="w-full h-2 bg-teal-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                    <span>0x</span>
                    <span className="text-teal-600 font-medium">2.8x (padrão)</span>
                    <span>10x</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Comissão Prevista (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.comissao_prevista}
                  onChange={(e) => setFormData({ ...formData, comissao_prevista: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Calculada automaticamente com base no multiplicador
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Previsão Recebimento Comissão
                </label>
                <input
                  type="date"
                  value={formData.previsao_recebimento_comissao}
                  onChange={(e) => setFormData({ ...formData, previsao_recebimento_comissao: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.bonus_por_vida_aplicado}
                    onChange={(e) => setFormData({ ...formData, bonus_por_vida_aplicado: e.target.checked })}
                    className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Aplicar Bônus por Vida</span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Valor recorrente adicional além da comissão
                </p>
              </div>

              {formData.bonus_por_vida_aplicado && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Valor do Bônus por Vida (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.bonus_por_vida_valor}
                    onChange={(e) => setFormData({ ...formData, bonus_por_vida_valor: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Valor mensal recorrente adicional
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Responsável *
                </label>
                <select
                  required
                  value={formData.responsavel}
                  onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="Luiza">Luiza</option>
                  <option value="Nick">Nick</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observações Internas
                </label>
                <textarea
                  value={formData.observacoes_internas}
                  onChange={(e) => setFormData({ ...formData, observacoes_internas: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

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
              {saving ? 'Salvando...' : contract ? 'Salvar' : 'Continuar para Titular'}
            </button>
          </div>
        </form>
      </div>

      {showAdjustmentForm && contract?.id && (
        <ValueAdjustmentForm
          contractId={contract.id}
          adjustment={editingAdjustment || undefined}
          responsavel={formData.responsavel}
          onClose={() => {
            setShowAdjustmentForm(false);
            setEditingAdjustment(null);
          }}
          onSave={async () => {
            setShowAdjustmentForm(false);
            setEditingAdjustment(null);
            if (contract?.id) {
              await loadAdjustments(contract.id);
            }
          }}
        />
      )}
    </div>
  );
}
