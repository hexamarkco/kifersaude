import { useMemo } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';

import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import Textarea from '../../../../components/ui/Textarea';
import VariableAutocompleteTextarea from '../../../../components/ui/VariableAutocompleteTextarea';
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { WHATSAPP_MESSAGE_BREAK_DELIMITER, splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';

type WhatsAppFollowUpModalProps = {
  isOpen: boolean;
  generating: boolean;
  value: string;
  customInstructions: string;
  onClose: () => void;
  onChangeValue: (value: string) => void;
  onChangeCustomInstructions: (value: string) => void;
  onGenerate: () => void;
  onApply: () => void;
};

export default function WhatsAppFollowUpModal({
  isOpen,
  generating,
  value,
  customInstructions,
  onClose,
  onChangeValue,
  onChangeCustomInstructions,
  onGenerate,
  onApply,
}: WhatsAppFollowUpModalProps) {
  const messageSegments = useMemo(() => splitWhatsAppMessageSegments(value), [value]);

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Gerador de follow-up"
      description="Gere uma sugestão com IA, refine com instruções extras e use --- em uma linha isolada para separar mensagens no envio."
      size="xl"
      panelClassName="config-transparent-buttons max-w-6xl"
      footer={(
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
            Separador de mensagens: <code>{WHATSAPP_MESSAGE_BREAK_DELIMITER}</code> em uma linha isolada. O envio no composer respeita cada bloco como uma mensagem separada.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={generating}>
              Fechar
            </Button>
            <Button variant="secondary" onClick={onGenerate} loading={generating}>
              {!generating && <Sparkles className="h-4 w-4" />}
              <span>{value.trim() ? 'Gerar novamente' : 'Gerar agora'}</span>
            </Button>
            <Button onClick={onApply} disabled={generating || !value.trim()}>
              Aplicar ao composer
            </Button>
          </div>
        </div>
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-4">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Instruções personalizadas</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                Essas instruções valem só para esta geração. Digite <code>{'{{'}</code> para usar variáveis do prompt.
              </p>
            </div>
            <VariableAutocompleteTextarea
              value={customInstructions}
              onChange={onChangeCustomInstructions}
              suggestions={WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS}
              rows={6}
              size="compact"
              placeholder={
                'Ex.:\n' +
                '- Fale mais curto.\n' +
                '- Não insista demais.\n' +
                '- Termine com uma pergunta objetiva.'
              }
              disabled={generating}
            />
          </div>

          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Mensagem sugerida</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                  Edite livremente antes de aplicar ao composer.
                </p>
              </div>
              <div className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
                {messageSegments.length || 1} mensagem(ns)
              </div>
            </div>
            <Textarea
              value={value}
              onChange={(event) => onChangeValue(event.target.value)}
              rows={15}
              className="min-h-[320px] text-sm leading-6"
              placeholder="A sugestao de follow-up vai aparecer aqui."
              disabled={generating}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--panel-text,#1a120d)]">
              <MessageSquare className="h-4 w-4" />
              Preview do envio
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
              Cada bloco abaixo vira uma mensagem independente quando você aplicar ao composer e enviar.
            </p>

            <div className="mt-4 space-y-3">
              {messageSegments.length > 0 ? (
                messageSegments.map((segment, index) => (
                  <div
                    key={`${index}:${segment}`}
                    className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-3 py-3"
                  >
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">
                      Mensagem {index + 1}
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--panel-text,#1a120d)]">
                      {segment}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-6 text-sm text-[var(--panel-text-muted,#876f5c)]">
                  Gere ou escreva uma sugestão para visualizar como ela será enviada.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
