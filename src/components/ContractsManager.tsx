import { useEffect, useState } from 'react';
import { supabase, Contract, Lead } from '../lib/supabase';
import { Plus, Search, Filter, FileText, Eye, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ContractForm from './ContractForm';
import ContractDetails from './ContractDetails';
import Pagination from './Pagination';

type ContractsManagerProps = {
  leadToConvert?: Lead | null;
  onConvertComplete?: () => void;
};

type ContractHolder = {
  id: string;
  contract_id: string;
  nome_completo: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
};

export default function ContractsManager({ leadToConvert, onConvertComplete }: ContractsManagerProps) {
  const { isObserver } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [holders, setHolders] = useState<Record<string, ContractHolder>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterResponsavel, setFilterResponsavel] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    loadContracts();

    const channel = supabase
      .channel('contracts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contracts'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setContracts((current) => [payload.new as Contract, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setContracts((current) =>
              current.map((contract) =>
                contract.id === (payload.new as Contract).id ? (payload.new as Contract) : contract
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setContracts((current) =>
              current.filter((contract) => contract.id !== (payload.old as Contract).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterContracts();
    setCurrentPage(1);
  }, [contracts, searchTerm, filterStatus, filterResponsavel]);

  useEffect(() => {
    if (leadToConvert) {
      setShowForm(true);
    }
  }, [leadToConvert]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

      if (contractsError) throw contractsError;

      const { data: holdersData, error: holdersError } = await supabase
        .from('contract_holders')
        .select('id, contract_id, nome_completo, razao_social, nome_fantasia, cnpj');

      if (holdersError) throw holdersError;

      const holdersMap: Record<string, ContractHolder> = {};
      holdersData?.forEach(holder => {
        holdersMap[holder.contract_id] = holder;
      });

      setContracts(contractsData || []);
      setHolders(holdersMap);
    } catch (error) {
      console.error('Erro ao carregar contratos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterContracts = () => {
    let filtered = [...contracts];

    if (searchTerm) {
      filtered = filtered.filter(contract =>
        contract.codigo_contrato.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.operadora.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.produto_plano.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'todos') {
      filtered = filtered.filter(contract => contract.status === filterStatus);
    }

    if (filterResponsavel !== 'todos') {
      filtered = filtered.filter(contract => contract.responsavel === filterResponsavel);
    }

    setFilteredContracts(filtered);
  };

  const getContractDisplayName = (contract: Contract): string => {
    const holder = holders[contract.id];
    if (!holder) return 'Sem titular';

    if (contract.modalidade === 'MEI' || contract.modalidade === 'CNPJ') {
      return holder.nome_fantasia || holder.razao_social || holder.nome_completo;
    }

    return holder.nome_completo;
  };

  const totalPages = Math.ceil(filteredContracts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContracts = filteredContracts.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Rascunho': 'bg-gray-100 text-gray-700',
      'Em análise': 'bg-blue-100 text-blue-700',
      'Documentos pendentes': 'bg-yellow-100 text-yellow-700',
      'Proposta enviada': 'bg-purple-100 text-purple-700',
      'Aguardando assinatura': 'bg-orange-100 text-orange-700',
      'Emitido': 'bg-cyan-100 text-cyan-700',
      'Ativo': 'bg-green-100 text-green-700',
      'Suspenso': 'bg-red-100 text-red-700',
      'Cancelado': 'bg-red-100 text-red-700',
      'Encerrado': 'bg-slate-100 text-slate-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Gestão de Contratos</h2>
        {!isObserver && (
          <button
            onClick={() => {
              setEditingContract(null);
              setShowForm(true);
            }}
            className="flex items-center space-x-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Contrato</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, operadora ou plano..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none"
            >
              <option value="todos">Todos os status</option>
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
          <div className="relative">
            <select
              value={filterResponsavel}
              onChange={(e) => setFilterResponsavel(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none"
            >
              <option value="todos">Todos os responsáveis</option>
              <option value="Luiza">Luiza</option>
              <option value="Nick">Nick</option>
            </select>
          </div>
          <div className="text-sm text-slate-600 flex items-center justify-end">
            <span className="font-medium">{filteredContracts.length}</span>
            <span className="ml-1">contrato(s) encontrado(s)</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="grid grid-cols-1 gap-4 p-4">
        {paginatedContracts.map((contract) => (
          <div
            key={contract.id}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">{contract.codigo_contrato}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                    {contract.status}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                    {contract.modalidade}
                  </span>
                  {contract.comissao_multiplicador && contract.comissao_multiplicador !== 2.8 && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center space-x-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{contract.comissao_multiplicador}x</span>
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <span className="font-medium text-slate-700">{getContractDisplayName(contract)}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm text-slate-600">
                  <div>
                    <span className="font-medium">Operadora:</span> {contract.operadora}
                  </div>
                  <div>
                    <span className="font-medium">Plano:</span> {contract.produto_plano}
                  </div>
                  {contract.mensalidade_total && (
                    <div>
                      <span className="font-medium">Mensalidade:</span> R$ {contract.mensalidade_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                  {contract.comissao_prevista && (
                    <div>
                      <span className="font-medium">Comissão:</span> R$ {contract.comissao_prevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                  {contract.previsao_pagamento_bonificacao && (
                    <div>
                      <span className="font-medium">Pag. Bonificação:</span>{' '}
                      {new Date(contract.previsao_pagamento_bonificacao).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <div>Responsável: <span className="font-medium text-slate-700">{contract.responsavel}</span></div>
                <div className="mt-1">Criado: {new Date(contract.created_at).toLocaleDateString('pt-BR')}</div>
              </div>
            </div>
            <div className="flex items-center space-x-2 pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedContract(contract)}
                className="flex items-center space-x-2 px-3 py-2 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>Ver Detalhes</span>
              </button>
              {!isObserver && (
                <button
                  onClick={() => {
                    setEditingContract(contract);
                    setShowForm(true);
                  }}
                  className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  Editar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredContracts.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum contrato encontrado</h3>
          <p className="text-slate-600">Tente ajustar os filtros ou adicione um novo contrato.</p>
        </div>
      )}

      {filteredContracts.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalItems={filteredContracts.length}
          onPageChange={handlePageChange}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      )}
      </div>

      {showForm && (
        <ContractForm
          contract={editingContract}
          leadToConvert={leadToConvert}
          onClose={() => {
            setShowForm(false);
            setEditingContract(null);
            if (onConvertComplete) onConvertComplete();
          }}
          onSave={() => {
            setShowForm(false);
            setEditingContract(null);
            if (onConvertComplete) onConvertComplete();
            loadContracts();
          }}
        />
      )}

      {selectedContract && (
        <ContractDetails
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
          onUpdate={loadContracts}
        />
      )}
    </div>
  );
}
