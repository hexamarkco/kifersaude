import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  X,
  Info,
  Phone,
  Mail,
  Calendar,
  FileText,
  Briefcase,
  Clock,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from 'lucide-react';
import { supabase, type Lead } from '../lib/supabase';
import LeadStatusHistory from './LeadStatusHistory';
import StatusDropdown from './StatusDropdown';
import { formatDateTimeFullBR, formatDateOnly, formatDateTime } from '../lib/dateUtils';
import type {
  WhatsappChatContractSummary,
  WhatsappChatFinancialSummary,
  WhatsappChatInsight,
  WhatsappChatInsightStatus,
  WhatsappChatLeadSummary,
  WhatsappChatSlaMetrics,
  WhatsappChatSlaStatus,
} from '../types/whatsapp';
import type { LeadStatus } from '../types/config';

type ContractSummary = {
  id: string;
  codigo_contrato: string | null;
  status: string | null;
  modalidade: string | null;
  operadora: string | null;
  produto_plano: string | null;
  mensalidade_total: number | null;
  comissao_prevista: number | null;
  comissao_recebimento_adiantado: boolean | null;
  responsavel: string | null;
  previsao_recebimento_comissao: string | null;
  previsao_pagamento_bonificacao: string | null;
};

type AgendaSummaryRowDisplay = {
  id: string;
  periodLabel: string;
  nextTimeLabel: string;
  priorityLabel: string;
  statusLabel: string;
  statusClass: string;
  itemCount: number;
};

type AgendaUpcomingItem = {
  id: string;
  message: string;
  scheduleTimeLabel: string;
  statusLabel: string;
  statusClass: string;
  priorityLabel: string;
  lastError: string | null;
  disableUp: boolean;
  disableDown: boolean;
  isCancelling: boolean;
  isReordering: boolean;
};

type SlaBadgeDisplay = {
  status: WhatsappChatSlaStatus;
  text: string;
  className: string;
};

type InsightSentimentDisplay = {
  label: string;
  className: string;
};

type DrawerTab = 'lead' | 'contracts' | 'agenda' | 'insights';

type ChatLeadDetailsDrawerProps = {
  isOpen: boolean;
  leadId: string | null;
  onClose: () => void;
  leadSummary?: WhatsappChatLeadSummary | null;
  contractsSummary?: WhatsappChatContractSummary[];
  financialSummary?: WhatsappChatFinancialSummary | null;
  statusOptions?: LeadStatus[];
  onStatusChange?: (leadId: string, newStatus: string) => Promise<void>;
  updatingStatus?: boolean;
  insight?: WhatsappChatInsight | null;
  insightStatus?: WhatsappChatInsightStatus;
  insightError?: string | null;
  insightSentiment?: InsightSentimentDisplay | null;
  onRetryInsight?: () => void;
  onGenerateInsight?: () => void;
  generatingInsight?: boolean;
  slaBadge?: SlaBadgeDisplay | null;
  slaMetrics?: WhatsappChatSlaMetrics | null;
  agendaSummaryRows?: AgendaSummaryRowDisplay[];
  agendaSummaryLoading?: boolean;
  agendaUpcoming?: AgendaUpcomingItem[];
  agendaUpcomingLoading?: boolean;
  agendaError?: string | null;
  onCancelSchedule?: (scheduleId: string) => void;
  onReorderSchedule?: (scheduleId: string, direction: 'up' | 'down') => void;
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
  statusOptions,
  onStatusChange,
  updatingStatus,
  insight,
  insightStatus = 'idle',
  insightError,
  insightSentiment,
  onRetryInsight,
  onGenerateInsight,
  generatingInsight,
  slaBadge,
  slaMetrics,
  agendaSummaryRows = [],
  agendaSummaryLoading = false,
  agendaUpcoming = [],
  agendaUpcomingLoading = false,
  agendaError,
  onCancelSchedule,
  onReorderSchedule,
}: ChatLeadDetailsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<Lead | null>(null);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [financial, setFinancial] = useState<WhatsappChatFinancialSummary | null>(null);
  const [activeTab, setActiveTab] = useState<DrawerTab>('lead');

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
        comissao_recebimento_adiantado: contract.comissao_recebimento_adiantado ?? null,
        responsavel: contract.responsavel ?? null,
        previsao_recebimento_comissao: contract.previsao_recebimento_comissao ?? null,
        previsao_pagamento_bonificacao: contract.previsao_pagamento_bonificacao ?? null,
      })) ?? [],
    );
    setFinancial(financialSummary ?? null);
  }, [contractsSummary, financialSummary, isOpen, leadSummary]);

  const CONTRACT_SELECT_FIELDS =
    'id, codigo_contrato, status, modalidade, operadora, produto_plano, mensalidade_total, comissao_prevista, comissao_recebimento_adiantado, responsavel, previsao_recebimento_comissao, previsao_pagamento_bonificacao';

  const BASE_CONTRACT_FIELDS =
    'id, codigo_contrato, status, modalidade, operadora, produto_plano, mensalidade_total, comissao_prevista, comissao_recebimento_adiantado, responsavel, previsao_recebimento_comissao';

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
            comissao_recebimento_adiantado: contract.comissao_recebimento_adiantado ?? null,
          }));
        } else {
          throw contractsResponse.error;
        }
      } else {
        contractsData = ((contractsResponse.data as ContractSummary[]) ?? []).map(contract => ({
          ...contract,
          previsao_pagamento_bonificacao: contract.previsao_pagamento_bonificacao ?? null,
          comissao_recebimento_adiantado: contract.comissao_recebimento_adiantado ?? null,
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
    if (isOpen) {
      setActiveTab('lead');
    }
  }, [isOpen]);

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
  const canEditStatus = Boolean(statusOptions?.length && leadId && onStatusChange);

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

  const renderLeadTab = () => {
    const leadPhone = lead?.telefone ?? leadSummary?.telefone;
    const leadResponsavel = lead?.responsavel ?? leadSummary?.responsavel;
    const leadProximoRetorno = lead?.proximo_retorno ?? leadSummary?.proximo_retorno;
    const leadUltimoContato = lead?.ultimo_contato ?? leadSummary?.ultimo_contato;

    return (
      <div className="space-y-6">
        {canEditStatus && leadId ? (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:hidden">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status do lead</p>
              <p className="text-sm text-slate-600">Atualize o status diretamente pelo chat.</p>
          </div>
          <StatusDropdown
            currentStatus={lead?.status ?? leadSummary?.status ?? 'Sem status'}
            leadId={leadId}
            onStatusChange={onStatusChange!}
            disabled={updatingStatus}
            statusOptions={statusOptions ?? []}
          />
        </div>
      ) : null}

      <section className="space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Dados do lead</h4>
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 sm:grid-cols-2">
          {leadPhone ? (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              <span>{leadPhone}</span>
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
              <FileText className="h-4 w-4 text-slate-400" />
              <span>Contratação: {lead.tipo_contratacao}</span>
            </div>
          ) : null}
          {leadResponsavel ? (
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-slate-400" />
              <span>Responsável: {leadResponsavel}</span>
            </div>
          ) : null}
          {leadProximoRetorno ? (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>Próximo retorno: {formatDateTimeFullBR(leadProximoRetorno)}</span>
            </div>
          ) : null}
          {leadUltimoContato ? (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <span>Último contato: {formatDateTimeFullBR(leadUltimoContato)}</span>
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

        {leadId ? (
          <section>
            <LeadStatusHistory leadId={leadId} />
          </section>
        ) : null}
      </div>
    );
  };

  const renderContractsTab = () => (
    <div className="space-y-6">
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
                  {contract.comissao_recebimento_adiantado != null ? (
                    <div
                      className={`flex items-center gap-2 text-xs ${
                        contract.comissao_recebimento_adiantado ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      <Info
                        className={`h-4 w-4 ${
                          contract.comissao_recebimento_adiantado ? 'text-emerald-500' : 'text-amber-500'
                        }`}
                      />
                      {contract.comissao_recebimento_adiantado
                        ? 'Recebimento adiantado (pagamento único)'
                        : 'Recebimento parcelado (limite de 100% ao mês)'}
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
    </div>
  );

  const renderAgendaTab = () => (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Monitoramento</p>
            <h4 className="text-base font-semibold text-slate-800">Agenda & SLA</h4>
          </div>
          <Clock className="h-5 w-5 text-emerald-500" aria-hidden="true" />
        </div>
        {slaBadge ? (
          <div className="mt-4 space-y-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${slaBadge.className}`}
            >
              {slaBadge.text}
            </span>
            <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Pendências</p>
                <p className="text-base font-semibold text-slate-900">
                  {slaMetrics?.pending_inbound_count ?? 0}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Tempo de espera</p>
                <p className="text-base font-semibold text-slate-900">
                  {slaMetrics?.waiting_minutes ? `${slaMetrics.waiting_minutes} min` : 'Sem fila'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Última entrada</p>
                <p className="text-sm font-semibold text-slate-900">
                  {slaMetrics?.last_inbound_at ? formatDateTime(slaMetrics.last_inbound_at) : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Última resposta</p>
                <p className="text-sm font-semibold text-slate-900">
                  {slaMetrics?.last_outbound_at ? formatDateTime(slaMetrics.last_outbound_at) : '—'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Sem métricas de SLA disponíveis para este chat.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">Resumo por período</h4>
          {agendaSummaryLoading ? <span className="text-xs text-slate-500">Carregando…</span> : null}
        </div>
        {agendaSummaryRows.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Nenhum agendamento agrupado.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {agendaSummaryRows.map(row => (
              <li key={row.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <span>{row.periodLabel}</span>
                  <span>{row.nextTimeLabel}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5">
                    {row.priorityLabel}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${row.statusClass}`}>
                    {row.statusLabel}
                  </span>
                  <span className="text-slate-500">{row.itemCount} itens</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">Próximos agendamentos</h4>
          {agendaUpcomingLoading ? <span className="text-xs text-slate-500">Atualizando…</span> : null}
        </div>
        {agendaError ? <p className="mt-2 text-xs text-rose-500">{agendaError}</p> : null}
        {agendaUpcoming.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">Nenhum agendamento pendente.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {agendaUpcoming.map(item => (
              <li key={item.id} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-sm font-medium text-slate-800 line-clamp-2">{item.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                    {item.scheduleTimeLabel || 'Horário indefinido'}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 ${item.statusClass}`}>
                    {item.statusLabel}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                    {item.priorityLabel}
                  </span>
                </div>
                {item.lastError ? (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-rose-600">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="line-clamp-2">{item.lastError}</span>
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-l-full px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                      onClick={() => onReorderSchedule?.(item.id, 'up')}
                      disabled={item.disableUp || item.isReordering || !onReorderSchedule}
                      aria-label="Mover agendamento para cima"
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-r-full px-2 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                      onClick={() => onReorderSchedule?.(item.id, 'down')}
                      disabled={item.disableDown || item.isReordering || !onReorderSchedule}
                      aria-label="Mover agendamento para baixo"
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCancelSchedule?.(item.id)}
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={item.isCancelling || !onCancelSchedule}
                  >
                    {item.isCancelling ? 'Cancelando…' : 'Cancelar'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const renderInsightsTab = () => {
    let content: ReactNode = null;
    if (insightStatus === 'loading') {
      content = (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
          Gerando resumo e sentimento...
        </p>
      );
    } else if (insightStatus === 'error') {
      content = (
        <div className="space-y-2 text-sm">
          <p className="text-rose-600">Não foi possível carregar o insight.{insightError ? ` ${insightError}` : ''}</p>
          {onRetryInsight ? (
            <button
              type="button"
              onClick={onRetryInsight}
              className="font-semibold text-emerald-600 underline-offset-2 transition hover:text-emerald-700 hover:underline"
            >
              Tentar novamente
            </button>
          ) : null}
        </div>
      );
    } else if (insight?.summary) {
      content = <p className="text-sm text-slate-600">{insight.summary}</p>;
    } else {
      content = <p className="text-sm text-slate-500">Ainda não há insights processados para esta conversa.</p>;
    }

    const isLoading = insightStatus === 'loading';
    const shouldShowGenerateButton = !insight?.summary && Boolean(onGenerateInsight);

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold text-slate-800">Insights recentes</h4>
            {insight?.created_at ? (
              <p className="text-xs text-slate-500">
                Atualizado {formatDateTime(insight.created_at)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {shouldShowGenerateButton ? (
              <button
                type="button"
                onClick={onGenerateInsight}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={generatingInsight || isLoading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${generatingInsight ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {generatingInsight ? 'Gerando...' : 'Gerar insight'}
              </button>
            ) : null}
            {onRetryInsight ? (
              <button
                type="button"
                onClick={onRetryInsight}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isLoading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
                Atualizar
              </button>
            ) : null}
          </div>
        </div>
        {insightSentiment ? (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${insightSentiment.className}`}
          >
            Sentimento: {insightSentiment.label}
          </span>
        ) : null}
        {content}
      </div>
    );
  };

  const tabs: { id: DrawerTab; label: string }[] = [
    { id: 'lead', label: 'Dados do lead' },
    { id: 'contracts', label: 'Contratos' },
    { id: 'agenda', label: 'Agenda & SLA' },
    { id: 'insights', label: 'Insights recentes' },
  ];

  const tabContent = () => {
    switch (activeTab) {
      case 'contracts':
        return renderContractsTab();
      case 'agenda':
        return renderAgendaTab();
      case 'insights':
        return renderInsightsTab();
      case 'lead':
      default:
        return renderLeadTab();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex w-full items-stretch bg-slate-900/50">
      <button
        type="button"
        aria-label="Fechar detalhes do lead"
        className="hidden flex-1 md:block"
        onClick={onClose}
      />
      <aside
        className={`relative flex h-full w-full flex-col bg-white shadow-2xl md:max-w-3xl ${DRAWER_TRANSITION_CLASS} ${
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

        <div className="border-b border-slate-200 bg-slate-50/60 px-6">
          <nav className="flex gap-2 overflow-x-auto py-3 text-sm font-medium text-slate-500">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-3 py-1.5 transition ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-700 shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mb-4 flex items-center justify-center py-10">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
          ) : null}

          {tabContent()}
        </div>
      </aside>
    </div>
  );
}
