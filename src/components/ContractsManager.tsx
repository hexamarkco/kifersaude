import { useEffect, useMemo, useState } from 'react';
import { supabase, Contract, Lead } from '../lib/supabase';
import { Plus, Search, Filter, FileText, Eye, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import ContractForm from './ContractForm';
import ContractDetails from './ContractDetails';
import Pagination from './Pagination';

type ContractsManagerProps = {
  leadToConvert?: Lead | null;
  onConvertComplete?: () => void;
  initialOperadoraFilter?: string;
};

type ContractHolder = {
  id: string;
  contract_id: string;
  nome_completo: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
};

export default function ContractsManager({
  leadToConvert,
  onConvertComplete,
  initialOperadoraFilter,
}: ContractsManagerProps) {
  const { isObserver } = useAuth();
  const { options } = useConfig();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [holders, setHolders] = useState<Record<string, ContractHolder>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterResponsavel, setFilterResponsavel] = useState('todos');
  const [dateProximityFilter, setDateProximityFilter] = useState<'todos' | 'proximos-30'>('todos');
  const [showForm, setShowForm] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const operadoraOptions = useMemo(
    () => Array.from(new Set(contracts.map((contract) => contract.operadora).filter(Boolean))).sort(),
    [contracts],
  );

  const responsavelOptions = useMemo(
    () => (options.lead_responsavel || []).filter(option => option.ativo),
    [options.lead_responsavel]
  );

  const responsavelFilterOptions = useMemo(() => {
    const optionMap = new Map<string, string>();

    responsavelOptions.forEach(option => {
      optionMap.set(option.value, option.label);
    });

    contracts.forEach(contract => {
      if (contract.responsavel && !optionMap.has(contract.responsavel)) {
        optionMap.set(contract.responsavel, contract.responsavel);
      }
    });

    return Array.from(optionMap.entries()).map(([value, label]) => ({ value, label }));
  }, [contracts, responsavelOptions]);

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
  }, [contracts, searchTerm, filterStatus, filterResponsavel, dateProximityFilter]);

  useEffect(() => {
    if (leadToConvert) {
      setShowForm(true);
    }
  }, [leadToConvert]);

  useEffect(() => {
    if (initialOperadoraFilter) {
      setFilterOperadora(initialOperadoraFilter);
    } else if (initialOperadoraFilter === undefined) {
      setFilterOperadora('todas');
    }
  }, [initialOperadoraFilter]);

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

    if (dateProximityFilter === 'proximos-30') {
      filtered = filtered.filter(hasUpcomingImportantDate);
    }

    setFilteredContracts(filtered);
  };

  const parseDate = (date?: string | null) => {
    if (!date) return null;
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const daysUntil = (date?: string | null) => {
    const parsed = parseDate(date);
    if (!parsed) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    const diff = parsed.getTime() - today.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24));
  };

  const hasUpcomingImportantDate = (contract: Contract) => {
    const dates = [contract.data_renovacao, contract.previsao_recebimento_comissao, contract.previsao_pagamento_bonificacao];
    return dates.some(date => {
      const remaining = daysUntil(date);
      return remaining !== null && remaining >= 0 && remaining <= 30;
    });
  };

  const getBadgeTone = (days: number) => {
    if (days < 0) return 'bg-slate-100 text-slate-600';
    if (days <= 7) return 'bg-red-100 text-red-700';
    if (days <= 15) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const buildDateBadge = (label: string, date?: string | null) => {
    const remaining = daysUntil(date);
    if (remaining === null) return null;

    const formattedDate = parseDate(date)?.toLocaleDateString('pt-BR');
    const labelText = remaining === 0
      ? `${label} hoje (${formattedDate})`
      : remaining > 0
        ? `${label} em ${remaining} dia${remaining === 1 ? '' : 's'} (${formattedDate})`
        : `${label} há ${Math.abs(remaining)} dia${Math.abs(remaining) === 1 ? '' : 's'} (${formattedDate})`;

    return (
      <span key={`${label}-${date}`} className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center ${getBadgeTone(remaining)}`}>
        {labelText}
      </span>
    );
  };

  const renderDateBadges = (contract: Contract) => {
    const badges = [
      buildDateBadge('Renova', contract.data_renovacao),
      buildDateBadge('Recebe comissão', contract.previsao_recebimento_comissao),
      buildDateBadge('Paga bônus', contract.previsao_pagamento_bonificacao),
    ].filter(Boolean);

    if (badges.length === 0) return null;

    return <div className="flex flex-wrap gap-2">{badges}</div>;
  };

  const formatDate = (date?: string | null) => {
    const parsed = parseDate(date);
    return parsed ? parsed.toLocaleDateString('pt-BR') : null;
  };

  const getContractDisplayName = (contract: Contract): string => {
    const holder = holders[contract.id];
    if (!holder) return 'Sem titular';

    if (contract.modalidade === 'MEI' || contract.modalidade === 'CNPJ') {
      return holder.nome_fantasia || holder.razao_social || holder.nome_completo;
    }

    return holder.nome_completo;
  };

  const getBonusValue = (contract: Contract) => {
    if (!contract.bonus_por_vida_valor) return null;

    const vidas = contract.vidas || 1;
    return contract.bonus_por_vida_aplicado
      ? contract.bonus_por_vida_valor * vidas
      : contract.bonus_por_vida_valor;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Gestão de Contratos</h2>
        {!isObserver && (
          <button
            onClick={() => {
              setEditingContract(null);
              setShowForm(true);
            }}
            className="flex items-center justify-center space-x-2 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Contrato</span>
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
              {responsavelFilterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select
              value={dateProximityFilter}
              onChange={(e) => setDateProximityFilter(e.target.value as 'todos' | 'proximos-30')}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none"
            >
              <option value="todos">Todas as datas</option>
              <option value="proximos-30">Próximos 30 dias</option>
            </select>
          </div>
          <div className="relative">
            <select
              value={filterOperadora}
              onChange={(e) => setFilterOperadora(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none"
            >
              <option value="todas">Todas as operadoras</option>
              {operadoraOptions.map((operadora) => (
                <option key={operadora} value={operadora}>
                  {operadora}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-slate-600 flex items-center justify-between sm:justify-end text-center sm:text-right">
            <span className="font-medium w-full sm:w-auto">{filteredContracts.length}</span>
            <span className="ml-0 sm:ml-1 w-full sm:w-auto">contrato(s) encontrado(s)</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 gap-4 p-4">
          {paginatedContracts.map((contract) => {
            const bonusValue = getBonusValue(contract);

            return (
              <div
                key={contract.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 hover:shadow-md transition-all"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
                  <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2 mb-2">
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
                  {renderDateBadges(contract)}
                </div>
                <div className="mb-3">
                  <span className="font-medium text-slate-700">{getContractDisplayName(contract)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 text-sm text-slate-600">
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
                          {contract.comissao_recebimento_adiantado === false ? (
                            <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              Parcelada
                            </span>
                          ) : contract.comissao_recebimento_adiantado ? (
                            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Adiantada
                            </span>
                          ) : null}
                        </div>
                      )}
                  {bonusValue !== null && (
                    <div>
                      <span className="font-medium">Bonificação:</span> R$ {bonusValue.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2
                      })}
                    </div>
                  )}
                  {contract.data_renovacao && (
                    <div>
                      <span className="font-medium">Renovação:</span> {formatDate(contract.data_renovacao)}
                    </div>
                  )}
                  {contract.previsao_recebimento_comissao && (
                    <div>
                      <span className="font-medium">Prev. comissão:</span> {formatDate(contract.previsao_recebimento_comissao)}
                    </div>
                  )}
                  {contract.previsao_pagamento_bonificacao && (
                    <div>
                      <span className="font-medium">Prev. bonificação:</span> {formatDate(contract.previsao_pagamento_bonificacao)}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm text-slate-500 lg:text-right">
                    <div>
                      Responsável: <span className="font-medium text-slate-700">{contract.responsavel}</span>
                    </div>
                    <div className="mt-1">Criado: {new Date(contract.created_at).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
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
            );
          })}
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
