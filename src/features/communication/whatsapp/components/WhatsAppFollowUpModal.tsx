import { useMemo, useRef, useState, useEffect } from 'react';
import { MessageSquare, Mic, MicOff, Sparkles } from 'lucide-react';

import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import Textarea from '../../../../components/ui/Textarea';
import VariableAutocompleteTextarea from '../../../../components/ui/VariableAutocompleteTextarea';
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { WHATSAPP_MESSAGE_BREAK_DELIMITER, splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { commWhatsAppService, type CommWhatsAppFollowUpIntensity } from '../../../../lib/commWhatsAppService';

type SpeechRecognitionType = {
  new (): {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: unknown) => void) | null;
    onerror: ((event: unknown) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  };
};

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionType;
    webkitSpeechRecognition: SpeechRecognitionType;
  }
}

const FOLLOW_UP_INTENSITY_OPTIONS: Array<{
  value: CommWhatsAppFollowUpIntensity;
  label: string;
  description: string;
}> = [
  {
    value: 'leve',
    label: 'Leve',
    description: 'Toque humano, curto e sem pressão.',
  },
  {
    value: 'moderada',
    label: 'Moderada',
    description: 'Objetiva, com próximo passo claro.',
  },
  {
    value: 'direta',
    label: 'Direta',
    description: 'Mais assertiva e focada em decisão.',
  },
  {
    value: 'ultima_tentativa',
    label: 'Última tentativa',
    description: 'Encerramento cordial, sem insistência futura.',
  },
];

type WhatsAppFollowUpModalProps = {
  isOpen: boolean;
  generating: boolean;
  submitting: boolean;
  value: string;
  customInstructions: string;
  intensity: CommWhatsAppFollowUpIntensity;
  onClose: () => void;
  onChangeValue: (value: string) => void;
  onChangeCustomInstructions: (value: string) => void;
  onChangeIntensity: (value: CommWhatsAppFollowUpIntensity) => void;
  onGenerate: () => void;
  onSend: () => void;
};

export default function WhatsAppFollowUpModal({
  isOpen,
  generating,
  submitting,
  value,
  customInstructions,
  intensity,
  onClose,
  onChangeValue,
  onChangeCustomInstructions,
  onChangeIntensity,
  onGenerate,
  onSend,
}: WhatsAppFollowUpModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const recognitionRef = useRef<unknown>(null);
  const messageSegments = useMemo(() => splitWhatsAppMessageSegments(value), [value]);

  useEffect(() => {
    if (typeof window === 'undefined' || (!window.SpeechRecognition && !window.webkitSpeechRecognition)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window.SpeechRecognition || window.webkitSpeechRecognition) as any;
    const recognitionInstance = new SpeechRecognitionClass();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'pt-BR';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognitionInstance.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setCurrentTranscript(interimTranscript + finalTranscript);
    };
    recognitionInstance.onerror = () => {
      setIsRecording(false);
      setCurrentTranscript("");
    };
    recognitionInstance.onend = () => {
      setIsRecording(false);
    };
    recognitionRef.current = recognitionInstance;
  }, []);

  const handleToggleRecording = async () => {
    if (isRecording) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = recognitionRef.current as any;
      rec?.stop();
      const transcript = currentTranscript.trim();
      setCurrentTranscript("");
      setIsRecording(false);
      
      if (transcript) {
        setIsCorrecting(true);
        try {
          const corrected = await commWhatsAppService.rewriteMessage({
            message: transcript,
            tone: 'grammar',
          });
          onChangeCustomInstructions(customInstructions + (customInstructions ? ' ' : '') + corrected.text);
        } catch {
          onChangeCustomInstructions(customInstructions + (customInstructions ? ' ' : '') + transcript);
        } finally {
          setIsCorrecting(false);
        }
      }
    } else {
      setCurrentTranscript("");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any)?.start();
      setIsRecording(true);
    }
  };

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
            Separador de mensagens: <code>{WHATSAPP_MESSAGE_BREAK_DELIMITER}</code> em uma linha isolada. O envio respeita cada bloco como uma mensagem separada.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={generating || submitting}>
              Fechar
            </Button>
            <Button variant="secondary" onClick={onGenerate} loading={generating} disabled={submitting}>
              {!generating && <Sparkles className="h-4 w-4" />}
              <span>{value.trim() ? 'Gerar novamente' : 'Gerar agora'}</span>
            </Button>
            <Button onClick={onSend} loading={submitting} disabled={generating || submitting || !value.trim()}>
              Enviar mensagens
            </Button>
          </div>
        </div>
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Intensidade</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                Controle o nível de pressão comercial e o tipo de chamada para ação da sugestão.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {FOLLOW_UP_INTENSITY_OPTIONS.map((option) => {
                const selected = option.value === intensity;

                return (
                  <label
                    key={option.value}
                    className={[
                      'cursor-pointer rounded-xl border p-3 transition',
                      selected
                        ? 'border-[var(--panel-accent,#c8792b)] bg-[var(--panel-surface,#fffdfa)] shadow-sm'
                        : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] hover:bg-[var(--panel-surface,#fffdfa)]',
                      generating || submitting ? 'cursor-not-allowed opacity-70' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <span className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="follow-up-intensity"
                        value={option.value}
                        checked={selected}
                        onChange={() => onChangeIntensity(option.value)}
                        disabled={generating || submitting}
                        className="mt-0.5 h-4 w-4 accent-[var(--panel-accent,#c8792b)]"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-[var(--panel-text,#1a120d)]">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                          {option.description}
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

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
              disabled={generating || submitting}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant={isRecording ? 'primary' : 'secondary'}
                size="sm"
                onClick={handleToggleRecording}
                loading={isCorrecting}
                disabled={generating || submitting}
                className={isRecording ? 'animate-pulse' : ''}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span>{isCorrecting ? 'Corrigindo...' : isRecording ? 'Parar' : 'Gravar áudio'}</span>
              </Button>
              {isRecording && currentTranscript && (
                <div className="mt-2 text-xs text-[var(--panel-text-muted,#876f5c)] italic">
                  "...{currentTranscript}"
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Mensagem sugerida</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                  Edite livremente antes de enviar.
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
              disabled={generating || submitting}
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
              Cada bloco abaixo vira uma mensagem independente quando você enviar.
            </p>

            <div className="mt-4 space-y-3">
              {messageSegments.length > 0 ? (
                messageSegments.map((segment, index) => (
                  <div
                    key={`${index}:${segment}`}
                    className="rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] shadow-sm"
                  >
                    <div className="rounded-t-xl border-b border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
                        Mensagem {index + 1}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--panel-text,#1a120d)]">
                        {segment}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border-2 border-dashed border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-4 py-8 text-center">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 text-[var(--panel-text-muted,#876f5c)]" />
                  <p className="text-sm text-[var(--panel-text-muted,#876f5c)]">
                    Gere ou escreva uma sugestão para visualizar como ela será enviada.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
