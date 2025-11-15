import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Info, Phone, Mail, Calendar, FileText, Briefcase } from 'lucide-react';
import { supabase, type Lead } from '../lib/supabase';
import LeadStatusHistory from './LeadStatusHistory';
import { formatDateTimeFullBR, formatDateOnly } from '../lib/dateUtils';
import type {
  WhatsappChatContractSummary,
  WhatsappChatFinancialSummary,
  WhatsappChatLeadSummary,
} from '../types/whatsapp';

type ContractSummary = {
  id: string;
  codigo_contrato: string | null;
  status: string | null;
  modalidade: string | null;
  operadora: string | null;
  produto_plano: string | null;
  mensalidade_total: number | null;
  comissao_prevista: number | null;
  responsavel: string | null;
  previsao_recebimento_comissao: string | null;
  previsao_pagamento_bonificacao: string | null;
};

type ChatLeadDetailsDrawerProps = {
  isOpen: boolean;
  leadId: string | null;
  onClose: () => void;
  leadSummary?: WhatsappChatLeadSummary | null;
  contractsSummary?: WhatsappChatContractSummary[];
  financialSummary?: WhatsappChatFinancialSummary | null;
};

const DRAWER_TRANSITION_CLASS =
  'transform transition-transform duration-200 ease-out will-change-transform';

export default function ChatLeadDetailsDrawer({
  isOpen,
  leadId,
  onClose,
  leadSummary,
  contractsSummary,
  financialSummary,
}: ChatLeadDetailsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [financial, setFinancial] = useState<WhatsappChatFinancialSummary | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setLead(null);
      setContracts([]);
      setFinancial(null);
      return;
    }

    setContracts(
      contractsSummary?.map(contract => ({
        id: contract.id,
        codigo_contrato: contract.codigo_contrato ?? null,
        status: contract.status ?? null,
        modalidade: contract.modalidade ?? null,
        operadora: contract.operadora ?? null,
        produto_plano: contract.produto_plano ?? null,
        mensalidade_total: contract.mensalidade_total ?? null,
        comissao_prevista: contract.comissao_prevista ?? null,
        responsavel: contract.responsavel ?? null,
        previsao_recebimento_comissao: contract.previsao_recebimento_comissao ?? null,
        previsao_pagamento_bonificacao: contract.previsao_pagamento_bonificacao ?? null,
      })) ?? [],
    );
    setFinancial(financialSummary ?? null);
  }, [contractsSummary, financialSummary, isOpen, leadSummary]);

  const CONTRACT_SELECT_FIELDS =
    'id, codigo_contrato, status, modalidade, operadora, produto_plano, mensalidade_total, comissao_prevista, responsavel, previsao_recebimento_comissao, previsao_pagamento_bonificacao';

  const BASE_CONTRACT_FIELDS =
    'id, codigo_contrato, status, modalidade, operadora, produto_plano, mensalidade_total, comissao_prevista, responsavel, previsao_recebimento_comissao';

  const fetchLeadDetails = useCallback(async () => {
    if (!leadId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [leadResponse, contractsResponse] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle(),
        supabase
          .from('contracts')
          .select(CONTRACT_SELECT_FIELDS)
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false }),
      ]);

      if (leadResponse.error) {
        throw leadResponse.error;
      }

      let contractsData: ContractSummary[] = [];

      if (contractsResponse.error) {
        if (contractsResponse.error.code === '42703') {
          const fallbackResponse = await supabase
            .from('contracts')
            .select(BASE_CONTRACT_FIELDS)
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false });

          if (fallbackResponse.error) {
            throw fallbackResponse.error;
          }

          const fallbackData =
            (fallbackResponse.data as Omit<ContractSummary, 'previsao_pagamento_bonificacao'>[]) ?? [];

          contractsData = fallbackData.map(contract => ({
            ...contract,
            previsao_pagamento_bonificacao: null,
          }));
        } else {
          throw contractsResponse.error;
        }
      } else {
        contractsData = ((contractsResponse.data as ContractSummary[]) ?? []).map(contract => ({
          ...contract,
          previsao_pagamento_bonificacao: contract.previsao_pagamento_bonificacao ?? null,
        }));
      }

      setLead(leadResponse.data ?? null);
      setContracts(contractsData);

      const totals = contractsData.reduce(
        (acc, contract) => {
          const mensalidade = contract.mensalidade_total ?? 0;
          const comissao = contract.comissao_prevista ?? 0;

          return {
            total_mensalidade: acc.total_mensalidade + mensalidade,
            total_comissao: acc.total_comissao + comissao,
          };
        },
        { total_mensalidade: 0, total_comissao: 0 },
      );

      if (totals) {
        setFinancial(previous => ({
          ...previous,
          total_mensalidade: totals.total_mensalidade,
          total_comissao: totals.total_comissao,
        }));
      }
    } catch (fetchError) {
      console.error('Erro ao carregar dados do lead para o chat:', fetchError);
      setError('Não foi possível carregar todas as informações do lead.');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (isOpen && leadId) {
      void fetchLeadDetails();
    }
  }, [fetchLeadDetails, isOpen, leadId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const totalMensalidade = useMemo(() => {
    if (financial?.total_mensalidade != null) {
      return financial.total_mensalidade;
    }

    return contracts.reduce((sum, contract) => sum + (contract.mensalidade_total ?? 0), 0);
  }, [contracts, financial?.total_mensalidade]);

  const totalComissao = useMemo(() => {
    if (financial?.total_comissao != null) {
      return financial.total_comissao;
    }

    return contracts.reduce((sum, contract) => sum + (contract.comissao_prevista ?? 0), 0);
  }, [contracts, financial?.total_comissao]);

  const hasContracts = contracts.length > 0;

  if (!isOpen) {
    return null;
  }

  const renderHeaderInfo = () => {
    const displayName = lead?.nome_completo ?? leadSummary?.nome_completo ?? 'Lead do CRM';
    const displayStatus = lead?.status ?? leadSummary?.status ?? null;
    const displayResponsavel = lead?.responsavel ?? leadSummary?.responsavel ?? null;
    const displayUltimoContato = lead?.ultimo_contato ?? leadSummary?.ultimo_contato ?? null;
    const displayProximoRetorno = lead?.proximo_retorno ?? leadSummary?.proximo_retorno ?? null;

    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-slate-900">{displayName}</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {displayStatus ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
              <Info className="h-3.5 w-3.5" />
              Status: {displayStatus}
            </span>
          ) : null}
          {displayResponsavel ? <span>Responsável: {displayResponsavel}</span> : null}
          {displayUltimoContato ? (
            <span>Último contato: {formatDateTimeFullBR(displayUltimoContato)}</span>
          ) : null}
          {displayProximoRetorno ? (
            <span>Próximo retorno: {formatDateTimeFullBR(displayProximoRetorno)}</span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex w-full items-stretch justify-end bg-slate-900/50">
      <button
        type="button"
        aria-label="Fechar detalhes do lead"
        className="flex-1"
        onClick={onClose}
      />
      <aside
        className={`relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl ${DRAWER_TRANSITION_CLASS} ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-lead-details-title"
        onClick={event => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div id="chat-lead-details-title" className="min-w-0 flex-1">
            {renderHeaderInfo()}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fechar histórico do lead"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
          ) : null}

          <section className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Dados do lead</h4>
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
              {(lead?.telefone ?? leadSummary?.telefone) ? (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span>{lead?.telefone ?? leadSummary?.telefone}</span>
                </div>
              ) : null}
              {lead?.email ? (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{lead.email}</span>
                </div>
              ) : null}
              {lead?.cidade || lead?.estado ? (
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-slate-400" />
                  <span>
                    {lead?.cidade}
                    {lead?.estado ? ` - ${lead.estado}` : ''}
                  </span>
                </div>
              ) : null}
              {lead?.origem ? (
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-slate-400" />
                  <span>Origem: {lead.origem}</span>
                </div>
              ) : null}
              {lead?.tipo_contratacao ? (
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-slate-400" />
                  <span>Contratação: {lead.tipo_contratacao}</span>
                </div>
              ) : null}
              {lead?.proximo_retorno ? (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span>Próximo retorno: {formatDateTimeFullBR(lead.proximo_retorno)}</span>
                </div>
              ) : null}
            </div>

            {lead?.observacoes ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-700">Observações</p>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed">{lead.observacoes}</p>
              </div>
            ) : null}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contratos vinculados</h4>
              {hasContracts ? (
                <span className="text-xs font-medium text-slate-500">{contracts.length} contrato(s)</span>
              ) : null}
            </div>
            {hasContracts ? (
              <div className="space-y-3">
                {contracts.map(contract => (
                  <div
                    key={contract.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-800">{contract.codigo_contrato || 'Contrato sem código'}</p>
                        <p className="text-xs text-slate-500">
                          {contract.operadora}
                          {contract.produto_plano ? ` • ${contract.produto_plano}` : ''}
                        </p>
                      </div>
                      {contract.status ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          {contract.status}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {contract.modalidade ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <FileText className="h-4 w-4 text-slate-400" />
                          Modalidade: {contract.modalidade}
                        </div>
                      ) : null}
                      {contract.mensalidade_total != null ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Info className="h-4 w-4 text-slate-400" />
                          Mensalidade: R$ {contract.mensalidade_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      ) : null}
                      {contract.comissao_prevista != null ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Info className="h-4 w-4 text-slate-400" />
                          Comissão prevista: R$ {contract.comissao_prevista.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      ) : null}
                      {contract.previsao_recebimento_comissao ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          Prev. recebimento: {formatDateOnly(contract.previsao_recebimento_comissao)}
                        </div>
                      ) : null}
                      {contract.previsao_pagamento_bonificacao ? (
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          Prev. bonificação: {formatDateOnly(contract.previsao_pagamento_bonificacao)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Nenhum contrato vinculado a este lead até o momento.
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Resumo financeiro</h4>
            {hasContracts ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Mensalidades</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">
                    R$ {totalMensalidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="rounded-lg border border-sky-100 bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Comissões previstas</p>
                  <p className="mt-2 text-2xl font-bold text-sky-700">
                    R$ {totalComissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                Cadastre um contrato para visualizar os indicadores financeiros relacionados ao lead.
              </div>
            )}
          </section>

          {leadId ? (
            <section>
              <LeadStatusHistory leadId={leadId} />
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
