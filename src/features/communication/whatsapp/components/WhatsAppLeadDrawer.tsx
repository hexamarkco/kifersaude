import { createPortal } from 'react-dom';
import { Info, Link2, Loader2, Sparkles, Unlink, X } from 'lucide-react';
import type { ChangeEvent } from 'react';

import LeadDetailsPanel from '../../../../components/LeadDetailsPanel';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import type {
  CommWhatsAppLeadContractSummary,
  CommWhatsAppLeadPanel,
  CommWhatsAppLeadSearchResult,
} from '../../../../lib/commWhatsAppService';
import type { ConfigOption, Contract, LeadStatusConfig } from '../../../../lib/supabase';

type WhatsAppLeadDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  chatDisplayName: string;
  linkedLead: CommWhatsAppLeadPanel | null;
  autoLinked: boolean;
  loading: boolean;
  contracts: CommWhatsAppLeadContractSummary[];
  contractsLoading: boolean;
  contractsError: string | null;
  statusOptions: LeadStatusConfig[];
  responsavelOptions: ConfigOption[];
  onStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  onResponsavelChange: (leadId: string, responsavelValue: string) => Promise<void>;
  onRefreshContracts: () => void;
  onViewLead: (() => void) | undefined;
  onUnlinkLead: (() => void) | undefined;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: CommWhatsAppLeadSearchResult[];
  suggestedLead: CommWhatsAppLeadSearchResult | null;
  searchLoading: boolean;
  onLinkLead: (leadId: string) => void;
  linkLoadingLeadId: string | null;
};

export default function WhatsAppLeadDrawer({
  isOpen,
  onClose,
  chatDisplayName,
  linkedLead,
  autoLinked,
  loading,
  contracts,
  contractsLoading,
  contractsError,
  statusOptions,
  responsavelOptions,
  onStatusChange,
  onResponsavelChange,
  onRefreshContracts,
  onViewLead,
  onUnlinkLead,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  suggestedLead,
  searchLoading,
  onLinkLead,
  linkLoadingLeadId,
}: WhatsAppLeadDrawerProps) {
  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const isDarkThemeActive = document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  return createPortal(
    <div className={`modal-theme-host painel-theme kifer-ds ${isDarkThemeActive ? 'theme-dark' : 'theme-light'}`}>
      <div className="fixed inset-0 z-[95] bg-stone-950/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-[100] flex w-full max-w-[440px] flex-col border-l border-[var(--panel-border-subtle,#d7c7b2)] bg-[var(--panel-surface,#fffdfa)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-border-subtle,#e7dac8)] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-text-muted,#8a735f)]">CRM do chat</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--panel-text,#1c1917)]">{chatDisplayName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--panel-text-muted,#8a735f)] transition-colors hover:bg-[var(--panel-surface-soft,#f4ede3)] hover:text-[var(--panel-text,#1c1917)]"
            aria-label="Fechar painel do lead"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-[var(--panel-text-muted,#6b7280)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando dados do CRM...
            </div>
          ) : linkedLead ? (
            <div className="space-y-4">
              <div className="flex items-center justify-end gap-2">
                {autoLinked && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--panel-accent-border,#d2ab85)] bg-[color:var(--panel-accent-soft,#f4e2cc)]/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Vinculado automaticamente
                  </span>
                )}
                {onUnlinkLead && (
                  <Button variant="secondary" size="sm" onClick={onUnlinkLead}>
                    <Unlink className="h-4 w-4" />
                    Desvincular
                  </Button>
                )}
              </div>

              <LeadDetailsPanel
                className="whatsapp-lead-drawer-panel min-h-[520px] rounded-2xl border-[var(--panel-border-subtle,#e7dac8)] bg-transparent shadow-none"
                lead={{ ...linkedLead, observacoes: linkedLead.observacoes ?? undefined }}
                statusOptions={statusOptions}
                responsavelOptions={responsavelOptions}
                onStatusChange={onStatusChange}
                onResponsavelChange={onResponsavelChange}
                contracts={contracts as unknown as Contract[]}
                contractsLoading={contractsLoading}
                contractsError={contractsError}
                onRefreshContracts={onRefreshContracts}
                onViewLead={onViewLead}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f7efe3)] px-4 py-4 text-sm text-[var(--panel-text-soft,#5b4635)]">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 text-[var(--panel-accent-strong,#c86f1d)]" />
                  <div>
                    <p className="font-semibold text-[var(--panel-text,#1c1917)]">Nenhum lead vinculado</p>
                    <p className="mt-1 leading-6 text-[var(--panel-text-muted,#876f5c)]">
                      Procure um lead existente do CRM para ligar esta conversa e editar status sem sair do inbox.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  value={searchQuery}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onSearchQueryChange(event.target.value)}
                  placeholder="Buscar lead por nome ou telefone"
                />

                {suggestedLead && (
                  <div className="rounded-2xl border border-[var(--panel-accent-border,#d2ab85)] bg-[color:var(--panel-accent-soft,#f4e2cc)]/45 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-accent-ink,#8b4d12)]">
                          Sugestao para esta conversa
                        </p>
                        <p className="mt-2 truncate text-sm font-semibold text-[var(--panel-text,#1c1917)]">
                          {suggestedLead.nome_completo || 'Lead sem nome'}
                        </p>
                        <p className="truncate text-xs text-[var(--panel-text-muted,#8a735f)]">{suggestedLead.telefone}</p>
                        <p className="mt-1 truncate text-xs text-[var(--panel-text-muted,#8a735f)]">
                          {suggestedLead.status_nome || 'Sem status'}
                          {suggestedLead.responsavel_label ? ` • ${suggestedLead.responsavel_label}` : ''}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onLinkLead(suggestedLead.id)}
                        loading={linkLoadingLeadId === suggestedLead.id}
                      >
                        {linkLoadingLeadId !== suggestedLead.id && <Link2 className="h-4 w-4" />}
                        Vincular
                      </Button>
                    </div>
                  </div>
                )}

                {searchLoading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] px-4 py-6 text-sm text-[var(--panel-text-muted,#6b7280)]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando leads...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[var(--panel-border-subtle,#e7dac8)] px-4 py-6 text-center text-sm text-[var(--panel-text-muted,#6b7280)]">
                    Nenhum lead encontrado para esta busca.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults
                      .filter((lead) => lead.id !== suggestedLead?.id)
                      .map((lead) => (
                      <div
                        key={lead.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--panel-text,#1c1917)]">{lead.nome_completo || 'Lead sem nome'}</p>
                          <p className="truncate text-xs text-[var(--panel-text-muted,#8a735f)]">{lead.telefone}</p>
                          <p className="mt-1 truncate text-xs text-[var(--panel-text-muted,#8a735f)]">
                            {lead.status_nome || 'Sem status'}
                            {lead.responsavel_label ? ` • ${lead.responsavel_label}` : ''}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onLinkLead(lead.id)}
                          loading={linkLoadingLeadId === lead.id}
                        >
                          {linkLoadingLeadId !== lead.id && <Link2 className="h-4 w-4" />}
                          Vincular
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
