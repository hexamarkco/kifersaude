import { Text, Heading } from '../design-system';
import { useEffect, useMemo, useState } from 'react';
import type { Contract } from '../features/contracts';
import type { ConfigOption } from '../features/config';
import type { Lead, LeadStatusConfig } from '../features/leads';
import StatusDropdown from './StatusDropdown';
import { LeadFavoriteToggle } from './LeadFavoriteStar';
import {
  Avatar,
  Button,
  FilterSelect,
  IconButton,
} from '../design-system';
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

type LeadSummary = Pick<Lead, 'id' | 'nome_completo' | 'telefone' | 'observacoes' | 'favorito'> & {
  status_nome?: string | null;
  status_value?: string | null;
  responsavel_label?: string | null;
  responsavel_value?: string | null;
};

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
  const [favorito, setFavorito] = useState(Boolean(lead?.favorito));

  useEffect(() => {
    setFavorito(Boolean(lead?.favorito));
  }, [lead?.id, lead?.favorito]);

  const rootClassName = useMemo(() => {
    const base = 'flex flex-col overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)]';
    return className ? `${base} ${className}` : base;
  }, [className]);

  if (!lead) {
    return (
      <aside className={rootClassName}>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-[var(--text-muted)]">
          <UserCircle className="mb-3 h-10 w-10 text-[var(--text-subtle)]" />
          <Text className="text-sm font-semibold text-[var(--text-primary)]">Nenhum lead vinculado</Text>
          <Text className="mt-1 text-xs text-[var(--text-muted)]">
            Relacione um lead a esta conversa para visualizar status, responsável e contratos.
          </Text>
        </div>
      </aside>
    );
  }

  const safeResponsavelValue = lead.responsavel_value ?? '';
  const observations = lead.observacoes?.trim() || null;

  const handleResponsavelChange = async (nextResponsavel: string) => {
    if (!nextResponsavel || nextResponsavel === lead.responsavel_value) {
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
        <div className="flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] py-8 text-[var(--text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Carregando contratos...</span>
        </div>
      );
    }

    if (contractsError) {
      return (
        <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 text-sm text-[var(--warning-text)]">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-[2px]" />
            <div className="space-y-2">
              <Text>{contractsError}</Text>
              {onRefreshContracts && (
                <Button variant="ghost"
                  type="button"
                  onClick={onRefreshContracts}
                  className="inline-flex items-center border font-semibold transition-colors"
                >
                  Tentar novamente
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (!contracts || contracts.length === 0) {
      return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--text-secondary)]">
          <Text className="font-medium text-[var(--text-primary)]">Nenhum contrato registrado.</Text>
          <Text className="mt-1 text-xs text-[var(--text-muted)]">
            Converta este lead em contrato para acompanhar os detalhes por aqui.
          </Text>
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
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Text className="text-sm font-semibold text-[var(--text-primary)]">
                    {contract.codigo_contrato || 'Contrato sem código'}
                  </Text>
                  <Text className="text-xs text-[var(--text-muted)]">
                    {contract.operadora || 'Operadora não informada'}
                    {contract.modalidade ? ` • ${contract.modalidade}` : ''}
                  </Text>
                  {contract.produto_plano && (
                    <Text className="mt-1 text-xs text-[var(--text-muted)]">{contract.produto_plano}</Text>
                  )}
                </div>
                <span className="rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success-text)] uppercase">
                  {contract.status}
                </span>
              </div>
              {mensalidade && (
                <Text className="mt-3 text-xs text-[var(--text-muted)]">
                  Mensalidade total:{' '}
                  <span className="font-semibold text-[var(--text-primary)]">{mensalidade}</span>
                </Text>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <aside className={rootClassName}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={lead.nome_completo || lead.telefone || 'Lead'} size="lg" className="shrink-0" />
          <div className="min-w-0">
            <Text className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Lead vinculado
            </Text>
            <Heading level={3} className="mt-0.5 flex min-w-0 items-center gap-1.5 text-base font-semibold text-[var(--text-primary)]">
              <LeadFavoriteToggle leadId={lead.id} favorito={favorito} size="sm" onToggled={setFavorito} />
              <span className="truncate">{lead.nome_completo || 'Lead sem nome'}</span>
            </Heading>
            {lead.telefone && (
              <Text className="truncate text-xs text-[var(--text-muted)]">{lead.telefone}</Text>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onViewLead && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onViewLead}
            >
              <ExternalLink className="kds-control-icon" />
              Ver completo
            </Button>
          )}
          {!disabled && onEditLead && (
            <IconButton
              variant="secondary"
              size="sm"
              onClick={onEditLead}
              aria-label="Editar lead"
              title="Editar lead"
            >
              <Edit3 className="kds-control-icon" aria-hidden="true" />
            </IconButton>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <ClipboardList className="h-4 w-4" />
            <Heading level={4}>Status e responsável</Heading>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <Text className="text-xs font-medium text-[var(--text-muted)]">Status</Text>
              <div className="mt-1 flex min-h-[var(--control-height-md)] items-center">
                {statusOptions.length > 0 ? (
                  <StatusDropdown
                    currentStatus={lead.status_value ?? ''}
                    leadId={lead.id}
                    statusOptions={statusOptions}
                    onStatusChange={onStatusChange}
                    disabled={disabled}
                  />
                ) : (
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                    {lead.status_nome ?? 'Status não informado'}
                  </div>
                )}
              </div>
            </div>
            <div>
              <Text className="text-xs font-medium text-[var(--text-muted)]">Responsável</Text>
              {responsavelOptions.length > 0 ? (
                <div className="mt-1">
                  <FilterSelect
                    icon={UserCircle}
                    value={safeResponsavelValue}
                    onChange={handleResponsavelChange}
                    disabled={disabled || isUpdatingResponsavel}
                    placeholder="Responsável"
                    includePlaceholderOption={false}
                    options={responsavelOptions.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                  />
                </div>
              ) : (
                <div className="mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                  {lead.responsavel_label || 'Responsável não informado'}
                </div>
              )}
              {isUpdatingResponsavel && (
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Atualizando responsável...
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <StickyNote className="h-4 w-4" />
            <Heading level={4}>Observações</Heading>
          </div>
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-4 text-sm text-[var(--text-secondary)]">
            {observations || 'Nenhuma observação registrada para este lead.'}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <FileText className="h-4 w-4" />
            <Heading level={4}>Contratos</Heading>
          </div>
          {renderContracts()}
        </section>
      </div>
    </aside>
  );
}
