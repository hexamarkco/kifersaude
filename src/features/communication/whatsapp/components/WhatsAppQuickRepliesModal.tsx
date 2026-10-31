import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';

import {
  ActionSurface,
  Alert,
  Button,
  DialogShell,
  Field,
  Heading,
  Input,
  Surface,
  Text,
  VariableAutocompleteTextarea,
} from '../../../../design-system';
import { AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { sanitizeWhatsAppQuickReplyShortcut, type WhatsAppQuickReply } from '../domain/quickReplies';

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
  const showSelectedValidation = Boolean(validationError && selectedQuickReply);

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
    if (saving) {
      return;
    }

    const populatedQuickReplies = draftQuickReplies.filter((quickReply) => (
      quickReply.name.trim() || quickReply.shortcut.trim() || quickReply.text.trim()
    ));

    const invalidQuickReply = populatedQuickReplies.find((quickReply) => !quickReply.name.trim() || !quickReply.text.trim());
    if (invalidQuickReply) {
      setValidationError('Preencha nome e mensagem em todas as mensagens rápidas antes de salvar.');
      setSelectedQuickReplyId(invalidQuickReply.id);
      return;
    }

    setValidationError(null);
    await onSave(populatedQuickReplies);
  };

  return (
      <DialogShell
        isOpen={isOpen}
        onClose={onClose}
        closeOnOverlay={!saving}
        closeOnEscape={!saving}
        showCloseButton={!saving}
        initialFocus="first-content"
        title="Mensagens rápidas"
        description="Crie atalhos para mensagens que você usa com frequência. Digite {{ para escolher informações como o nome do contato."
        size="lg"
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
            <div className="text-xs text-[var(--text-muted)]">
              Use <code>{'{{'}</code> para inserir dados do contato na mensagem.
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={() => void handleSave()} loading={saving}>
                {!saving && 'Salvar mensagens rápidas'}
              </Button>
            </div>
          </div>
      )}
      >
      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(13rem,15rem)_minmax(0,1fr)]">
        <Surface variant="muted" padding="sm" className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Heading level={3} className="text-sm font-semibold text-[var(--text-primary)]">Atalhos</Heading>
              <Text className="text-xs text-[var(--text-muted)]">
                {draftQuickReplies.length} {draftQuickReplies.length === 1 ? 'atalho' : 'atalhos'}
              </Text>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" onClick={handleAddQuickReply} disabled={saving}>
              <Plus className="kds-control-icon" />
              Nova
            </Button>
          </div>

          <div className="max-h-[min(52vh,28rem)] space-y-2 overflow-y-auto pr-1" aria-label="Mensagens rápidas cadastradas">
            {draftQuickReplies.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-4 text-sm text-[var(--text-muted)]">
                Nenhuma mensagem rápida. Use Nova para criar um atalho.
              </div>
            ) : draftQuickReplies.map((quickReply) => {
              const isSelected = quickReply.id === selectedQuickReplyId;
              const shortcutPreview = sanitizeWhatsAppQuickReplyShortcut(quickReply.shortcut || quickReply.name) || 'sem-atalho';

              return (
                <ActionSurface variant="plain" padding="none"
                  key={quickReply.id}
                  type="button"
                  onClick={() => {
                    setSelectedQuickReplyId(quickReply.id);
                    setValidationError(null);
                  }}
                  disabled={saving}
                  aria-pressed={isSelected}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${isSelected ? 'border-[var(--brand-primary)] bg-[var(--bg-surface)]' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--brand-primary-soft)]'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="break-words text-sm font-semibold text-[var(--text-primary)]">
                      {quickReply.name.trim() || 'Nova mensagem rápida'}
                    </span>
                    <code className="max-w-[44%] shrink-0 truncate rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-gold-hover)]">
                      /{shortcutPreview}
                    </code>
                  </div>
                  <Text className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                    {summarizePreview(quickReply.text)}
                  </Text>
                </ActionSurface>
              );
            })}
          </div>
        </Surface>

        <Surface padding="md" className="min-w-0 space-y-4">
          {selectedQuickReply ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Heading level={3} className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <MessageCircle className="h-4 w-4" />
                    Editor da mensagem rápida
                  </Heading>
                  <Text className="mt-1 text-xs text-[var(--text-muted)]">
                    O atalho e a mensagem ficam disponíveis imediatamente ao escrever uma resposta no WhatsApp.
                  </Text>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleRemoveQuickReply(selectedQuickReply.id)}
                  disabled={saving || draftQuickReplies.length === 0}
                >
                  <Trash2 className="kds-control-icon" />
                  Remover
                </Button>
              </div>

              {validationError ? (
                <Alert tone="danger">
                  Revise os campos indicados antes de salvar.
                </Alert>
              ) : null}

              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <Field
                  label="Atalho"
                  description="Opcional. Se ficar vazio, o sistema cria o atalho a partir do título."
                >
                  <Input
                    value={selectedQuickReply.shortcut}
                    onChange={(event) => handleUpdateQuickReply(selectedQuickReply.id, { shortcut: sanitizeWhatsAppQuickReplyShortcut(event.target.value) })}
                    placeholder="contato-inicial"
                    size="sm"
                    disabled={saving}
                  />
                </Field>
                <Field
                  label="Título"
                  required
                  error={showSelectedValidation && !selectedQuickReply.name.trim() ? 'Informe um título para identificar o atalho.' : undefined}
                >
                  <Input
                    value={selectedQuickReply.name}
                    onChange={(event) => handleUpdateQuickReply(selectedQuickReply.id, { name: event.target.value })}
                    placeholder="Ex.: Contato inicial"
                    size="sm"
                    disabled={saving}
                  />
                </Field>
              </div>

              <Field
                label="Mensagem"
                required
                error={showSelectedValidation && !selectedQuickReply.text.trim() ? 'Escreva a mensagem que será inserida na conversa.' : undefined}
              >
                <VariableAutocompleteTextarea
                  value={selectedQuickReply.text}
                  onChange={(value) => handleUpdateQuickReply(selectedQuickReply.id, { text: value })}
                  suggestions={AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS}
                  rows={8}
                  size="sm"
                  disabled={saving}
                  placeholder="Digite a mensagem. Para inserir variáveis, digite {{"
                />
              </Field>
            </>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 text-center text-sm text-[var(--text-muted)]">
              Selecione ou crie uma mensagem rápida para editar.
            </div>
          )}
        </Surface>
      </div>
    </DialogShell>
  );
}
