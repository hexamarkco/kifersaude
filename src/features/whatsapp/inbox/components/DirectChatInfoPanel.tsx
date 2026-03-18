import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Mail, MapPin, Phone, Save, Trash2, UserPlus, X } from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Field from '../../../../components/ui/Field';
import Input from '../../../../components/ui/Input';
import Textarea from '../../../../components/ui/Textarea';
import { WhatsAppChatAvatar } from '../../shared/components/WhatsAppChatAvatar';

type DirectChatInfoContact = {
  id: string;
  name: string;
  saved: boolean;
  pushname?: string;
};

type DirectChatInfoLead = {
  id: string;
  name: string;
  phone: string;
  status?: string | null;
  responsavel?: string | null;
  email?: string | null;
  cidade?: string | null;
  observacoes?: string | null;
};

type DirectChatInfoPanelProps = {
  displayName: string;
  phoneFormatted: string;
  photoSources: string[];
  contact: DirectChatInfoContact | null;
  lead: DirectChatInfoLead | null;
  isLoadingLead: boolean;
  isSavingContact: boolean;
  isDeletingContact: boolean;
  isSavingLead: boolean;
  isDeletingLead: boolean;
  onClose: () => void;
  onOpenLead?: () => void;
  onSaveContact: (payload: { name: string }) => Promise<void>;
  onDeleteContact: () => Promise<void>;
  onSaveLead: (payload: { name: string; email: string; cidade: string; observacoes: string }) => Promise<void>;
  onDeleteLead: () => Promise<void>;
};

const panelShellClass =
  'absolute inset-y-0 right-0 z-30 flex h-full w-full max-w-full flex-col border-l border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] shadow-[var(--panel-glass-shadow-lite,0_16px_32px_-26px_rgba(42,24,12,0.18))] sm:w-[380px]';

export function DirectChatInfoPanel({
  displayName,
  phoneFormatted,
  photoSources,
  contact,
  lead,
  isLoadingLead,
  isSavingContact,
  isDeletingContact,
  isSavingLead,
  isDeletingLead,
  onClose,
  onOpenLead,
  onSaveContact,
  onDeleteContact,
  onSaveLead,
  onDeleteLead,
}: DirectChatInfoPanelProps) {
  const [contactName, setContactName] = useState('');
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    cidade: '',
    observacoes: '',
  });

  useEffect(() => {
    setContactName((contact?.name || displayName || phoneFormatted || '').trim());
  }, [contact?.id, contact?.name, displayName, phoneFormatted]);

  useEffect(() => {
    if (!lead) {
      setLeadForm({
        name: '',
        email: '',
        cidade: '',
        observacoes: '',
      });
      return;
    }

    setLeadForm({
      name: lead.name || '',
      email: lead.email || '',
      cidade: lead.cidade || '',
      observacoes: lead.observacoes || '',
    });
  }, [lead?.id, lead?.name, lead?.email, lead?.cidade, lead?.observacoes]);

  const contactStatusLabel = contact?.saved ? 'Contato salvo' : 'Numero avulso';
  const hasLead = Boolean(lead);
  const helperPushname = useMemo(() => {
    const trimmedPushname = (contact?.pushname || '').trim();
    const trimmedName = (contact?.name || '').trim();
    if (!trimmedPushname || trimmedPushname === trimmedName) return '';
    return trimmedPushname;
  }, [contact?.name, contact?.pushname]);

  return (
    <div className={panelShellClass}>
      <div className="flex items-center justify-between border-b border-[var(--panel-border-subtle,#e7dac8)] px-4 py-3">
        <div>
          <h3 className="comm-title font-semibold">Informacoes</h3>
          <p className="comm-muted text-xs">Contato, lead e acoes rapidas</p>
        </div>
        <button onClick={onClose} className="comm-icon-button rounded p-1" aria-label="Fechar painel de informacoes">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="border-b border-[var(--panel-border-subtle,#e7dac8)] bg-[linear-gradient(135deg,rgba(200,111,29,0.14),rgba(94,52,24,0.05))] px-4 py-5">
        <div className="flex items-start gap-3">
          <WhatsAppChatAvatar
            kind="direct"
            alt={displayName || phoneFormatted}
            photoSources={photoSources}
            shellClassName="h-14 w-14 flex-shrink-0"
            loading="eager"
            decoding="async"
          />
          <div className="min-w-0 flex-1">
            <p className="comm-title truncate text-base font-semibold">{displayName || phoneFormatted || 'Contato'}</p>
            <p className="comm-text mt-1 text-sm">{phoneFormatted || 'Telefone indisponivel'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className={`comm-badge ${contact?.saved ? 'comm-badge-success' : 'comm-badge-neutral'}`}>
                {contactStatusLabel}
              </span>
              {hasLead && <span className="comm-badge comm-badge-warning">Lead vinculado</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section className="comm-card space-y-4 p-4">
          <div>
            <p className="comm-title text-sm font-semibold">Dados do contato</p>
            <p className="comm-muted mt-1 text-xs">
              Edite o nome de exibicao ou salve este numero na agenda do WhatsApp.
            </p>
          </div>

          <Field label="Nome do contato" htmlFor="chat-info-contact-name" required>
            <Input
              id="chat-info-contact-name"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Como esse contato deve aparecer"
            />
          </Field>

          <Field label="Telefone" htmlFor="chat-info-contact-phone">
            <Input
              id="chat-info-contact-phone"
              value={phoneFormatted}
              readOnly
              leftIcon={Phone}
              className="cursor-default"
            />
          </Field>

          {helperPushname && (
            <Field label="Pushname do WhatsApp" htmlFor="chat-info-contact-pushname">
              <Input
                id="chat-info-contact-pushname"
                value={helperPushname}
                readOnly
                className="cursor-default"
              />
            </Field>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant={contact?.saved ? 'secondary' : 'warning'}
              className="flex-1"
              loading={isSavingContact}
              disabled={!contactName.trim() || isDeletingContact}
              onClick={() => void onSaveContact({ name: contactName.trim() })}
            >
              {contact?.saved ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {contact?.saved ? 'Salvar contato' : 'Adicionar como contato'}
            </Button>
            {contact?.saved && (
              <Button
                variant="danger"
                className="flex-1"
                loading={isDeletingContact}
                disabled={isSavingContact}
                onClick={() => void onDeleteContact()}
              >
                <Trash2 className="h-4 w-4" />
                Excluir contato
              </Button>
            )}
          </div>
        </section>

        <section className="comm-card space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="comm-title text-sm font-semibold">Dados do lead</p>
              <p className="comm-muted mt-1 text-xs">
                {lead ? 'Ajuste os dados principais sem sair da conversa.' : 'Nenhum lead vinculado a este numero.'}
              </p>
            </div>
            {lead?.status && <span className="comm-badge comm-badge-neutral text-[11px]">{lead.status}</span>}
          </div>

          {isLoadingLead ? (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-4 text-sm text-[var(--panel-text,#1a120d)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando dados do lead...
            </div>
          ) : lead ? (
            <>
              <Field label="Nome do lead" htmlFor="chat-info-lead-name" required>
                <Input
                  id="chat-info-lead-name"
                  value={leadForm.name}
                  onChange={(event) => setLeadForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nome completo do lead"
                />
              </Field>

              <Field label="Telefone do lead" htmlFor="chat-info-lead-phone">
                <Input
                  id="chat-info-lead-phone"
                  value={phoneFormatted}
                  readOnly
                  leftIcon={Phone}
                  className="cursor-default"
                />
              </Field>

              <Field label="E-mail" htmlFor="chat-info-lead-email">
                <Input
                  id="chat-info-lead-email"
                  type="email"
                  value={leadForm.email}
                  onChange={(event) => setLeadForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="email@exemplo.com"
                  leftIcon={Mail}
                />
              </Field>

              <Field label="Cidade" htmlFor="chat-info-lead-city">
                <Input
                  id="chat-info-lead-city"
                  value={leadForm.cidade}
                  onChange={(event) => setLeadForm((current) => ({ ...current, cidade: event.target.value }))}
                  placeholder="Cidade do lead"
                  leftIcon={MapPin}
                />
              </Field>

              <Field label="Observacoes" htmlFor="chat-info-lead-notes">
                <Textarea
                  id="chat-info-lead-notes"
                  value={leadForm.observacoes}
                  onChange={(event) => setLeadForm((current) => ({ ...current, observacoes: event.target.value }))}
                  placeholder="Anote contexto, preferencia ou proximo passo"
                  size="compact"
                />
              </Field>

              {lead.responsavel && (
                <div className="rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-2 text-xs text-[var(--panel-text,#1a120d)]">
                  Responsavel atual: <span className="font-semibold">{lead.responsavel}</span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="warning"
                    className="flex-1"
                    loading={isSavingLead}
                    disabled={!leadForm.name.trim() || isDeletingLead}
                    onClick={() => void onSaveLead({
                      name: leadForm.name.trim(),
                      email: leadForm.email.trim(),
                      cidade: leadForm.cidade.trim(),
                      observacoes: leadForm.observacoes.trim(),
                    })}
                  >
                    <Save className="h-4 w-4" />
                    Salvar lead
                  </Button>
                  {onOpenLead && (
                    <Button variant="secondary" className="flex-1" onClick={onOpenLead} disabled={isSavingLead || isDeletingLead}>
                      <ExternalLink className="h-4 w-4" />
                      Abrir lead
                    </Button>
                  )}
                </div>
                <Button
                  variant="danger"
                  loading={isDeletingLead}
                  disabled={isSavingLead}
                  onClick={() => void onDeleteLead()}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir lead
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-4 text-sm text-[var(--panel-text-soft,#6f5b4b)]">
              Assim que esse numero estiver vinculado a um lead, os dados aparecem aqui para edicao rapida.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
