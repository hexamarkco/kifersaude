import { ChangeEvent, useMemo, useState } from 'react';
import {
  Contract,
  ConfigOption,
  Lead,
  LeadStatusConfig,
} from '../lib/supabase';
import StatusDropdown from './StatusDropdown';
import {
  AlertCircle,
  ClipboardList,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  StickyNote,
  UserCircle,
} from 'lucide-react';

type LeadSummary = Pick<
  Lead,
  'id' | 'nome_completo' | 'telefone' | 'status' | 'responsavel' | 'observacoes'
>;

type LeadDetailsPanelProps = {
  className?: string;
  lead: LeadSummary | null | undefined;
  statusOptions: LeadStatusConfig[];
  responsavelOptions: ConfigOption[];
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  onResponsavelChange: (leadId: string, newResponsavel: string) => Promise<void>;
  contracts?: Contract[] | undefined;
  contractsLoading?: boolean;
  contractsError?: string | null;
  onRefreshContracts?: (() => void) | undefined;
  onViewLead?: (() => void) | undefined;
  onEditLead?: (() => void) | undefined;
  disabled?: boolean;
};

const formatCurrencyBRL = (value: number | null | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  } catch (error) {
    console.error('Erro ao formatar valor monetário:', error);
    return null;
  }
};

export default function LeadDetailsPanel({
  className,
  lead,
  statusOptions,
  responsavelOptions,
  onStatusChange,
  onResponsavelChange,
  contracts,
  contractsLoading = false,
  contractsError,
  onRefreshContracts,
  onViewLead,
  onEditLead,
  disabled = false,
}: LeadDetailsPanelProps) {
  const [isUpdatingResponsavel, setIsUpdatingResponsavel] = useState(false);

  const rootClassName = useMemo(() => {
    const base = 'bg-white border border-slate-200 rounded-xl flex flex-col';
    return className ? `${base} ${className}` : base;
  }, [className]);

  if (!lead) {
    return (
      <aside className={rootClassName}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-slate-500">
          <UserCircle className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">Nenhum lead vinculado</p>
          <p className="mt-1 text-xs text-slate-500">
            Relacione um lead a esta conversa para visualizar status, responsável e contratos.
          </p>
        </div>
      </aside>
    );
  }

  const safeResponsavelValue = lead.responsavel ?? '';
  const observations = lead.observacoes?.trim() || null;

  const handleResponsavelChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    const nextResponsavel = event.target.value;
    if (!nextResponsavel || nextResponsavel === lead.responsavel) {
      return;
    }

    setIsUpdatingResponsavel(true);
    try {
      await onResponsavelChange(lead.id, nextResponsavel);
    } catch (error) {
      console.error('Erro ao atualizar responsável do lead:', error);
    } finally {
      setIsUpdatingResponsavel(false);
    }
  };

  const renderContracts = () => {
    if (contractsLoading) {
      return (
        <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-8 text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Carregando contratos...</span>
        </div>
      );
    }

    if (contractsError) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-[2px]" />
            <div className="space-y-2">
              <p>{contractsError}</p>
              {onRefreshContracts && (
                <button
                  type="button"
                  onClick={onRefreshContracts}
                  className="inline-flex items-center gap-2 rounded-md border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (!contracts || contracts.length === 0) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">Nenhum contrato registrado.</p>
          <p className="mt-1 text-xs text-slate-500">
            Converta este lead em contrato para acompanhar os detalhes por aqui.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {contracts.map((contract) => {
          const mensalidade = formatCurrencyBRL(contract.mensalidade_total);
          return (
            <div
              key={contract.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {contract.codigo_contrato || 'Contrato sem código'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {contract.operadora || 'Operadora não informada'}
                    {contract.modalidade ? ` • ${contract.modalidade}` : ''}
                  </p>
                  {contract.produto_plano && (
                    <p className="mt-1 text-xs text-slate-500">{contract.produto_plano}</p>
                  )}
                </div>
                <span className="rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700 uppercase">
                  {contract.status}
                </span>
              </div>
              {mensalidade && (
                <p className="mt-3 text-xs text-slate-500">
                  Mensalidade total: <span className="font-semibold text-slate-700">{mensalidade}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside className={rootClassName}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lead selecionado</p>
          <h3 className="mt-1 text-base font-semibold text-slate-900">
            {lead.nome_completo || 'Lead sem nome'}
          </h3>
          {lead.telefone && (
            <p className="text-xs text-slate-500">{lead.telefone}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onViewLead && (
            <button
              type="button"
              onClick={onViewLead}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              <ExternalLink className="h-4 w-4" />
              Ver completo
            </button>
          )}
          {!disabled && onEditLead && (
            <button
              type="button"
              onClick={onEditLead}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
            >
              <Edit3 className="h-4 w-4" />
              Editar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <ClipboardList className="h-4 w-4" />
            <span>Status e responsável</span>
          </div>
          <div className="space-y-3">
            {statusOptions.length > 0 ? (
              <StatusDropdown
                currentStatus={lead.status}
                leadId={lead.id}
                statusOptions={statusOptions}
                onStatusChange={onStatusChange}
                disabled={disabled}
              />
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="font-medium text-slate-700">Status:</span>{' '}
                {lead.status}
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Responsável</p>
              {responsavelOptions.length > 0 ? (
                <select
                  value={safeResponsavelValue}
                  onChange={handleResponsavelChange}
                  disabled={disabled || isUpdatingResponsavel}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:cursor-not-allowed"
                >
                  {responsavelOptions.map((option) => (
                    <option key={option.id} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {lead.responsavel || 'Responsável não informado'}
                </div>
              )}
              {isUpdatingResponsavel && (
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Atualizando responsável...
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <StickyNote className="h-4 w-4" />
            <span>Observações</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            {observations || 'Nenhuma observação registrada para este lead.'}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <FileText className="h-4 w-4" />
            <span>Contratos</span>
          </div>
          {renderContracts()}
        </section>
      </div>
    </aside>
  );
}
