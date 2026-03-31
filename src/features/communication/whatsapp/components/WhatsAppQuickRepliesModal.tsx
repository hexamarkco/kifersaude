import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';

import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import ModalShell from '../../../../components/ui/ModalShell';
import VariableAutocompleteTextarea from '../../../../components/ui/VariableAutocompleteTextarea';
import { AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { sanitizeWhatsAppQuickReplyShortcut, type WhatsAppQuickReply } from '../../../../lib/whatsAppQuickReplies';

type WhatsAppQuickRepliesModalProps = {
  isOpen: boolean;
  quickReplies: WhatsAppQuickReply[];
  saving: boolean;
  onClose: () => void;
  onSave: (quickReplies: WhatsAppQuickReply[]) => Promise<void> | void;
};

const createDraftQuickReply = (): WhatsAppQuickReply => ({
  id: `quick-reply-draft-${Date.now()}-${Math.round(Math.random() * 10000)}`,
  name: '',
  shortcut: '',
  text: '',
  created_at: null,
  updated_at: null,
});

const summarizePreview = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Mensagem vazia';
  }

  return normalized.length <= 90 ? normalized : `${normalized.slice(0, 87).trimEnd()}...`;
};

export default function WhatsAppQuickRepliesModal({
  isOpen,
  quickReplies,
  saving,
  onClose,
  onSave,
}: WhatsAppQuickRepliesModalProps) {
  const [draftQuickReplies, setDraftQuickReplies] = useState<WhatsAppQuickReply[]>([]);
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const nextDrafts = quickReplies.length > 0
      ? quickReplies.map((quickReply) => ({ ...quickReply }))
      : [createDraftQuickReply()];

    setDraftQuickReplies(nextDrafts);
    setSelectedQuickReplyId(nextDrafts[0]?.id ?? null);
    setValidationError(null);
  }, [isOpen, quickReplies]);

  const selectedQuickReply = useMemo(
    () => draftQuickReplies.find((quickReply) => quickReply.id === selectedQuickReplyId) ?? null,
    [draftQuickReplies, selectedQuickReplyId],
  );

  const handleAddQuickReply = () => {
    const nextQuickReply = createDraftQuickReply();
    setDraftQuickReplies((current) => [...current, nextQuickReply]);
    setSelectedQuickReplyId(nextQuickReply.id);
    setValidationError(null);
  };

  const handleUpdateQuickReply = (quickReplyId: string, patch: Partial<WhatsAppQuickReply>) => {
    setDraftQuickReplies((current) => current.map((quickReply) => (
      quickReply.id === quickReplyId
        ? {
            ...quickReply,
            ...patch,
          }
        : quickReply
    )));
    setValidationError(null);
  };

  const handleRemoveQuickReply = (quickReplyId: string) => {
    setDraftQuickReplies((current) => {
      const nextQuickReplies = current.filter((quickReply) => quickReply.id !== quickReplyId);

      setSelectedQuickReplyId((currentSelectedId) => {
        if (currentSelectedId !== quickReplyId) {
          return currentSelectedId;
        }

        return nextQuickReplies[0]?.id ?? null;
      });

      return nextQuickReplies;
    });
    setValidationError(null);
  };

  const handleSave = async () => {
    const populatedQuickReplies = draftQuickReplies.filter((quickReply) => (
      quickReply.name.trim() || quickReply.shortcut.trim() || quickReply.text.trim()
    ));

    const invalidQuickReply = populatedQuickReplies.find((quickReply) => !quickReply.name.trim() || !quickReply.text.trim());
    if (invalidQuickReply) {
      setValidationError('Preencha nome e mensagem em todas as mensagens rapidas antes de salvar.');
      setSelectedQuickReplyId(invalidQuickReply.id);
      return;
    }

    setValidationError(null);
    await onSave(populatedQuickReplies);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Mensagens rapidas"
      description="Cadastre atalhos independentes do inbox. Use {{ para inserir variaveis dinamicas na mensagem."
      size="xl"
      panelClassName="config-transparent-buttons max-w-6xl"
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <div className="text-xs text-[var(--panel-text-muted,#876f5c)]">
            Digite <code>&#123;&#123;</code> no corpo da mensagem para abrir as variaveis disponiveis.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} loading={saving}>
              {!saving && 'Salvar mensagens rapidas'}
            </Button>
          </div>
        </div>
      )}
    >
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Atalhos</h3>
              <p className="text-xs text-[var(--panel-text-muted,#876f5c)]">
                {draftQuickReplies.length} cadastrada(s)
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleAddQuickReply}>
              <Plus className="h-3.5 w-3.5" />
              Nova
            </Button>
          </div>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {draftQuickReplies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-3 py-4 text-sm text-[var(--panel-text-muted,#876f5c)]">
                Nenhuma mensagem rapida cadastrada.
              </div>
            ) : draftQuickReplies.map((quickReply) => {
              const isSelected = quickReply.id === selectedQuickReplyId;
              const shortcutPreview = sanitizeWhatsAppQuickReplyShortcut(quickReply.shortcut || quickReply.name) || 'sem-atalho';

              return (
                <button
                  key={quickReply.id}
                  type="button"
                  onClick={() => setSelectedQuickReplyId(quickReply.id)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${isSelected ? 'border-[var(--panel-accent-strong,#c07a2a)] bg-[var(--panel-surface,#fffdfa)] shadow-sm' : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] hover:border-[var(--panel-accent-soft,#f4e2cc)]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--panel-text,#1a120d)]">
                      {quickReply.name.trim() || 'Nova mensagem rapida'}
                    </span>
                    <code className="shrink-0 rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-2 py-0.5 text-[11px] font-semibold text-[var(--panel-accent-ink,#8b4d12)]">
                      /{shortcutPreview}
                    </code>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                    {summarizePreview(quickReply.text)}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 sm:p-5">
          {selectedQuickReply ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--panel-text,#1a120d)]">
                    <MessageCircle className="h-4 w-4" />
                    Editor da mensagem rapida
                  </h3>
                  <p className="mt-1 text-xs text-[var(--panel-text-muted,#876f5c)]">
                    O atalho e a mensagem ficam disponiveis imediatamente no composer do inbox.
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleRemoveQuickReply(selectedQuickReply.id)}
                  disabled={draftQuickReplies.length === 0}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remover
                </Button>
              </div>

              {validationError ? (
                <div className="rounded-xl border border-[var(--panel-accent-red-border,#ef4444)] bg-[var(--panel-accent-red-soft,#fef2f2)] px-3 py-2 text-sm text-[var(--panel-accent-red-ink,#991b1b)]">
                  {validationError}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                    Nome interno
                  </label>
                  <Input
                    value={selectedQuickReply.name}
                    onChange={(event) => handleUpdateQuickReply(selectedQuickReply.id, { name: event.target.value })}
                    placeholder="Ex.: Contato inicial"
                    size="compact"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                    Atalho
                  </label>
                  <Input
                    value={selectedQuickReply.shortcut}
                    onChange={(event) => handleUpdateQuickReply(selectedQuickReply.id, { shortcut: sanitizeWhatsAppQuickReplyShortcut(event.target.value) })}
                    placeholder="contato-inicial"
                    size="compact"
                    leftIcon={undefined}
                    rightSlot={<span className="text-[11px] font-semibold">/{sanitizeWhatsAppQuickReplyShortcut(selectedQuickReply.shortcut || selectedQuickReply.name) || 'atalho'}</span>}
                  />
                  <p className="mt-1 text-[11px] text-[var(--panel-text-muted,#876f5c)]">
                    Use letras, numeros e hifens. Se ficar vazio, o sistema gera a partir do nome.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--panel-text-muted,#876f5c)]">
                  Mensagem
                </label>
                <VariableAutocompleteTextarea
                  value={selectedQuickReply.text}
                  onChange={(value) => handleUpdateQuickReply(selectedQuickReply.id, { text: value })}
                  suggestions={AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS}
                  rows={10}
                  size="compact"
                  placeholder="Digite a mensagem. Para inserir variaveis, digite {{"
                />
              </div>
            </>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-6 text-center text-sm text-[var(--panel-text-muted,#876f5c)]">
              Selecione ou crie uma mensagem rapida para editar.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
