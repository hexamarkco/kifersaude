import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import {
  Alert,
  Button,
  DialogShell,
  EmptyState,
  Field,
  Input,
  Select,
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
      description="Edite atalhos existentes ou crie novos para inserir respostas no compositor do WhatsApp."
      size="form"
      footer={(
        <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
          <Button variant="secondary" className="min-w-0 flex-1 sm:flex-none" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button className="min-w-0 flex-1 sm:flex-none" onClick={() => void handleSave()} loading={saving}>
            {!saving && 'Salvar'}
          </Button>
        </div>
      )}
    >
      <div className="min-w-0 space-y-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label="Resposta rápida"
            hint={`${draftQuickReplies.length} ${draftQuickReplies.length === 1 ? 'atalho cadastrado' : 'atalhos cadastrados'}`}
            className="min-w-0 flex-1"
          >
            <Select
              value={selectedQuickReplyId ?? ''}
              onChange={(event) => {
                setSelectedQuickReplyId(event.target.value || null);
                setValidationError(null);
              }}
              options={draftQuickReplies.map((quickReply) => {
                const shortcut = sanitizeWhatsAppQuickReplyShortcut(quickReply.shortcut || quickReply.name) || 'sem-atalho';
                return {
                  value: quickReply.id,
                  label: `${quickReply.name.trim() || 'Nova mensagem rápida'} · /${shortcut}`,
                };
              })}
              placeholder="Selecione uma resposta rápida"
              aria-label="Resposta rápida para editar"
              size="sm"
              disabled={saving || draftQuickReplies.length === 0}
            />
          </Field>
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" className="flex-1 whitespace-nowrap sm:flex-none" onClick={handleAddQuickReply} disabled={saving}>
              <Plus className="kds-control-icon" />
              Nova
            </Button>
            {selectedQuickReply ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleRemoveQuickReply(selectedQuickReply.id)}
                disabled={saving}
              >
                <Trash2 className="kds-control-icon" />
                Remover
              </Button>
            ) : null}
          </div>
        </div>

        {selectedQuickReply ? (
          <div className="min-w-0 space-y-4">
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
              description="Digite {{ para inserir informações disponíveis do contato."
              error={showSelectedValidation && !selectedQuickReply.text.trim() ? 'Escreva a mensagem que será inserida na conversa.' : undefined}
            >
              <VariableAutocompleteTextarea
                value={selectedQuickReply.text}
                onChange={(value) => handleUpdateQuickReply(selectedQuickReply.id, { text: value })}
                suggestions={AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS}
                rows={4}
                size="sm"
                disabled={saving}
                placeholder="Digite a mensagem. Para inserir variáveis, digite {{"
              />
            </Field>
          </div>
        ) : (
          <EmptyState
            title="Nenhuma mensagem rápida cadastrada"
            description="Crie um atalho para disponibilizar respostas frequentes no compositor do WhatsApp."
            action={(
              <Button variant="secondary" size="sm" onClick={handleAddQuickReply} disabled={saving}>
                <Plus className="kds-control-icon" />
                Criar mensagem rápida
              </Button>
            )}
          />
        )}
      </div>
    </DialogShell>
  );
}
