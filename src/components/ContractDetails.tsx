import { useState, useEffect } from 'react';
import { supabase, Contract, ContractHolder, Dependent, Interaction, ContractValueAdjustment } from '../lib/supabase';
import { X, User, Users, Plus, Edit, Trash2, MessageCircle, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import HolderForm from './HolderForm';
import DependentForm from './DependentForm';

type ContractDetailsProps = {
  contract: Contract;
  onClose: () => void;
  onUpdate: () => void;
};

export default function ContractDetails({ contract, onClose, onUpdate }: ContractDetailsProps) {
  const [holder, setHolder] = useState<ContractHolder | null>(null);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [adjustments, setAdjustments] = useState<ContractValueAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHolderForm, setShowHolderForm] = useState(false);
  const [showDependentForm, setShowDependentForm] = useState(false);
  const [editingDependent, setEditingDependent] = useState<Dependent | null>(null);
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [interactionData, setInteractionData] = useState({
    tipo: 'Observação',
    descricao: '',
    responsavel: 'Luiza',
  });

  useEffect(() => {
    loadData();
  }, [contract.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [holderRes, dependentsRes, interactionsRes, adjustmentsRes] = await Promise.all([
        supabase.from('contract_holders').select('*').eq('contract_id', contract.id).maybeSingle(),
        supabase.from('dependents').select('*').eq('contract_id', contract.id).order('created_at'),
        supabase.from('interactions').select('*').eq('contract_id', contract.id).order('data_interacao', { ascending: false }),
        supabase.from('contract_value_adjustments').select('*').eq('contract_id', contract.id).order('created_at'),
      ]);

      setHolder(holderRes.data);
      setDependents(dependentsRes.data || []);
      setInteractions(interactionsRes.data || []);
      setAdjustments(adjustmentsRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
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

  const handleDeleteDependent = async (id: string) => {
    if (!confirm('Deseja remover este dependente?')) return;

    try {
      const { error } = await supabase.from('dependents').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Erro ao remover dependente:', error);
      alert('Erro ao remover dependente');
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('interactions')
        .insert([{
          contract_id: contract.id,
          ...interactionData,
        }]);

      if (error) throw error;

      setInteractionData({ tipo: 'Observação', descricao: '', responsavel: 'Luiza' });
      setShowInteractionForm(false);
      loadData();
    } catch (error) {
      console.error('Erro ao adicionar interação:', error);
      alert('Erro ao adicionar interação');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{contract.codigo_contrato}</h3>
            <p className="text-sm text-slate-600">{contract.operadora} - {contract.produto_plano}</p>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="font-medium text-slate-700">Status:</span>
                <span className="ml-2 text-slate-900">{contract.status}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Modalidade:</span>
                <span className="ml-2 text-slate-900">{contract.modalidade}</span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Responsável:</span>
                <span className="ml-2 text-slate-900">{contract.responsavel}</span>
              </div>
              {contract.mensalidade_total && (
                <div>
                  <span className="font-medium text-slate-700">Mensalidade:</span>
                  <span className="ml-2 text-slate-900">R$ {contract.mensalidade_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            {adjustments.length > 0 && contract.mensalidade_total && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="text-sm font-medium text-slate-700 mb-2">Ajustes de Valor:</div>
                <div className="space-y-2">
                  {adjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className={`flex items-start space-x-2 text-sm p-2 rounded ${
                        adj.tipo === 'acrescimo' ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      {adj.tipo === 'acrescimo' ? (
                        <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <span
                          className={`font-semibold ${
                            adj.tipo === 'acrescimo' ? 'text-green-700' : 'text-red-700'
                          }`}
                        >
                          {adj.tipo === 'acrescimo' ? '+' : '-'} R${' '}
                          {adj.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-slate-600 ml-2">{adj.motivo}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-medium text-slate-700">Mensalidade Final:</span>
                  <span className="font-bold text-teal-700 text-lg">
                    R$ {calculateAdjustedValue(contract.mensalidade_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {contract.comissao_multiplicador && contract.comissao_multiplicador !== 2.8 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <span className="text-sm font-medium text-slate-700">Multiplicador de Comissão:</span>
                  <span className="text-lg font-bold text-teal-700">{contract.comissao_multiplicador}x</span>
                  <span className="text-xs text-slate-500">(padrão: 2.8x)</span>
                </div>
              </div>
            )}

            {contract.comissao_prevista && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Comissão Prevista:</span>
                  <span className="font-bold text-teal-700 text-lg">
                    R$ {contract.comissao_prevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-slate-900 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Titular
              </h4>
              {holder && (
                <button
                  onClick={() => setShowHolderForm(true)}
                  className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Editar</span>
                </button>
              )}
            </div>

            {holder ? (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <h5 className="font-semibold text-slate-900 mb-3">{holder.nome_completo}</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-slate-600">
                  <div><span className="font-medium">CPF:</span> {holder.cpf}</div>
                  <div><span className="font-medium">Data Nasc.:</span> {new Date(holder.data_nascimento).toLocaleDateString('pt-BR')}</div>
                  <div><span className="font-medium">Telefone:</span> {holder.telefone}</div>
                  {holder.email && <div><span className="font-medium">E-mail:</span> {holder.email}</div>}
                  {holder.cidade && <div><span className="font-medium">Cidade:</span> {holder.cidade}/{holder.estado}</div>}
                  {holder.cnpj && <div><span className="font-medium">CNPJ:</span> {holder.cnpj}</div>}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 mb-3">Nenhum titular cadastrado</p>
                <button
                  onClick={() => setShowHolderForm(true)}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Adicionar Titular
                </button>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-slate-900 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Dependentes ({dependents.length})
              </h4>
              <button
                onClick={() => {
                  setEditingDependent(null);
                  setShowDependentForm(true);
                }}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar</span>
              </button>
            </div>

            {dependents.length > 0 ? (
              <div className="space-y-3">
                {dependents.map((dependent) => (
                  <div key={dependent.id} className="bg-white border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-semibold text-slate-900 mb-2">{dependent.nome_completo}</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-slate-600">
                          <div><span className="font-medium">Relação:</span> {dependent.relacao}</div>
                          <div><span className="font-medium">Data Nasc.:</span> {new Date(dependent.data_nascimento).toLocaleDateString('pt-BR')}</div>
                          {dependent.cpf && <div><span className="font-medium">CPF:</span> {dependent.cpf}</div>}
                          {dependent.valor_individual && (
                            <div><span className="font-medium">Valor:</span> R$ {dependent.valor_individual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => {
                            setEditingDependent(dependent);
                            setShowDependentForm(true);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteDependent(dependent.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">Nenhum dependente cadastrado</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-slate-900">Histórico de Interações</h4>
              <button
                onClick={() => setShowInteractionForm(!showInteractionForm)}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Interação</span>
              </button>
            </div>

            {showInteractionForm && (
              <form onSubmit={handleAddInteraction} className="mb-6 bg-teal-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tipo de Interação
                    </label>
                    <select
                      required
                      value={interactionData.tipo}
                      onChange={(e) => setInteractionData({ ...interactionData, tipo: e.target.value })}
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
                      value={interactionData.responsavel}
                      onChange={(e) => setInteractionData({ ...interactionData, responsavel: e.target.value })}
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
                    value={interactionData.descricao}
                    onChange={(e) => setInteractionData({ ...interactionData, descricao: e.target.value })}
                    rows={3}
                    placeholder="Descreva o que foi tratado..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowInteractionForm(false)}
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

            {interactions.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg">
                <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">Nenhuma interação registrada</p>
              </div>
            ) : (
              <div className="space-y-3">
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
                        {new Date(interaction.data_interacao).toLocaleDateString('pt-BR')} às{' '}
                        {new Date(interaction.data_interacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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

      {showHolderForm && (
        <HolderForm
          contractId={contract.id}
          modalidade={contract.modalidade}
          holder={holder || undefined}
          onClose={() => setShowHolderForm(false)}
          onSave={() => {
            setShowHolderForm(false);
            loadData();
            onUpdate();
          }}
        />
      )}

      {showDependentForm && (
        <DependentForm
          contractId={contract.id}
          dependent={editingDependent}
          onClose={() => {
            setShowDependentForm(false);
            setEditingDependent(null);
          }}
          onSave={() => {
            setShowDependentForm(false);
            setEditingDependent(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
