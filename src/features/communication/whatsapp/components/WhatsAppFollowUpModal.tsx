import { useMemo, useRef, useState, useEffect } from 'react';
import { CalendarPlus, Check, Clock3, MessageSquare, Mic, MicOff, Sparkles } from 'lucide-react';

import { Button, Textarea } from '../../../../design-system';
import VariableAutocompleteTextarea from '../../../../components/ui/VariableAutocompleteTextarea';
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { WHATSAPP_MESSAGE_BREAK_DELIMITER, splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { commWhatsAppService, type CommWhatsAppFollowUpNextAction, type CommWhatsAppFollowUpTone, type CommWhatsAppFollowUpVariation, type CommWhatsAppRewriteTone } from '../../../../lib/commWhatsAppService';
import { toast } from '../../../../lib/toast';
import { followUpSalesTechniqueOptions } from './followUpSalesTechniques';
import { CONVERSATION_SITUATION_PRESETS } from './followUpSituationPresets';
import WhatsAppDialog from './WhatsAppDialog';

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


const followUpToneOptions: Array<{
  value: CommWhatsAppFollowUpTone;
  label: string;
  description: string;
}> = [
  {
    value: 'consultivo',
    label: 'Consultivo',
    description: 'Orienta com contexto, escuta ativa e próximo passo claro.',
  },
  {
    value: 'amigavel',
    label: 'Amigável',
    description: 'Soa leve, acolhedor e próximo sem perder objetividade.',
  },
  {
    value: 'direto',
    label: 'Direto',
    description: 'Vai ao ponto com chamada objetiva e pouco texto.',
  },
  {
    value: 'reativacao',
    label: 'Reativação',
    description: 'Retoma contato parado com naturalidade e baixa pressão.',
  },
  {
    value: 'premium',
    label: 'Premium',
    description: 'Comunica cuidado, exclusividade e atenção personalizada.',
  },
];

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionType;
    webkitSpeechRecognition: SpeechRecognitionType;
  }
}

type WhatsAppFollowUpModalProps = {
  isOpen: boolean;
  generating: boolean;
  submitting: boolean;
  chatId?: string | null;
  value: string;
  customInstructions: string;
  tone: CommWhatsAppFollowUpTone;
  variations?: CommWhatsAppFollowUpVariation[];
  selectedSalesTechniques: string[];
  selectedSituationPresetIds: string[];
  aiContextRationale?: string | null;
  nextAction?: CommWhatsAppFollowUpNextAction | null;
  schedulingNextAction?: boolean;
  onClose: () => void;
  onChangeValue: (value: string) => void;
  onChangeCustomInstructions: (value: string) => void;
  onChangeTone: (value: CommWhatsAppFollowUpTone) => void;
  onToggleSituationPreset: (presetId: string) => void;
  onToggleSalesTechnique: (techniqueId: string) => void;
  onGenerate: (options?: { variantCount?: number; customInstructions?: string }) => void;
  onScheduleNextAction: () => void;
  onSend: () => void;
};

const formatNextActionDate = (value?: string | null) => {
  if (!value) return 'Sem data sugerida';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data sugerida inválida';
  return date.toLocaleString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type SimpleRefinementAction = {
  id: CommWhatsAppRewriteTone;
  label: string;
  description: string;
};

const SIMPLE_REFINEMENT_ACTIONS: SimpleRefinementAction[] = [
  { id: 'shorter', label: 'Encurtar', description: 'Reescrever a sugestão de forma mais curta e objetiva.' },
  { id: 'friendly', label: 'Mais amigável', description: 'Deixar a mensagem mais leve, humana e acolhedora.' },
  { id: 'assertive', label: 'Mais direta', description: 'Tornar o próximo passo mais claro sem soar agressivo.' },
  { id: 'professional', label: 'Mais profissional', description: 'Ajustar o texto para um tom mais consultivo e profissional.' },
];

type FollowUpRefinementAction = {
  id: string;
  label: string;
  description: string;
  instruction: string;
};

const FOLLOW_UP_CONTEXT_REFINEMENT_ACTIONS: FollowUpRefinementAction[] = [
  {
    id: 'add-context',
    label: 'Usar contexto do chat',
    description: 'Refinar considerando o histórico e o momento atual da conversa.',
    instruction: 'Refine a mensagem usando o contexto completo do chat. Preserve apenas fatos confirmados no histórico e deixe o próximo passo mais coerente com a conversa.',
  },
  {
    id: 'reduce-pressure',
    label: 'Menos pressão',
    description: 'Diminuir insistência e cobrança no follow-up.',
    instruction: 'Refine a mensagem para reduzir pressão e cobrança. Mantenha cordialidade, naturalidade e uma pergunta simples para facilitar resposta.',
  },
  {
    id: 'clear-next-step',
    label: 'Próximo passo claro',
    description: 'Reforçar uma ação objetiva para avançar a conversa.',
    instruction: 'Refine a mensagem para terminar com um próximo passo claro, simples e fácil de responder, sem inventar combinados ou dados.',
  },
];

export default function WhatsAppFollowUpModal({
  isOpen,
  generating,
  submitting,
  chatId,
  value,
  customInstructions,
  tone,
  variations = [],
  selectedSalesTechniques,
  selectedSituationPresetIds,
  aiContextRationale,
  nextAction,
  schedulingNextAction = false,
  onClose,
  onChangeValue,
  onChangeCustomInstructions,
  onChangeTone,
  onToggleSituationPreset,
  onToggleSalesTechnique,
  onGenerate,
  onScheduleNextAction,
  onSend,
}: WhatsAppFollowUpModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [refiningActionId, setRefiningActionId] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [localCustomInstructions, setLocalCustomInstructions] = useState(customInstructions);
  const recognitionRef = useRef<unknown>(null);
  const wasOpenRef = useRef(false);
  const messageSegments = useMemo(() => splitWhatsAppMessageSegments(value), [value]);
  const hasVariations = variations.length > 0;
  const selectedToneOption = followUpToneOptions.find((option) => option.value === tone) ?? followUpToneOptions[0];

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setLocalCustomInstructions(customInstructions);
    }
    wasOpenRef.current = isOpen;
  }, [customInstructions, isOpen]);

  useEffect(() => {
    if (!isOpen || localCustomInstructions === customInstructions) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onChangeCustomInstructions(localCustomInstructions);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [customInstructions, isOpen, localCustomInstructions, onChangeCustomInstructions]);

  const commitCustomInstructions = (nextValue = localCustomInstructions) => {
    if (nextValue !== customInstructions) {
      onChangeCustomInstructions(nextValue);
    }
  };

  const handleGenerateClick = (options: { variantCount?: number } = {}) => {
    commitCustomInstructions();
    onGenerate({ ...options, customInstructions: localCustomInstructions });
  };

  const handleClose = () => {
    commitCustomInstructions();
    onClose();
  };

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

  const handleSimpleRefinement = async (tone: CommWhatsAppRewriteTone) => {
    const currentMessage = value.trim();
    if (!currentMessage || refiningActionId) {
      return;
    }

    setRefiningActionId(tone);
    try {
      const result = await commWhatsAppService.rewriteMessage({
        message: currentMessage,
        tone,
      });
      onChangeValue(result.text);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível refinar a mensagem sugerida.');
    } finally {
      setRefiningActionId(null);
    }
  };

  const handleContextRefinement = async (action: FollowUpRefinementAction) => {
    const currentMessage = value.trim();
    if (!currentMessage || refiningActionId) {
      return;
    }

    setRefiningActionId(action.id);
    try {
      if (!chatId) {
        toast.error('Selecione uma conversa para refinar com contexto.');
        return;
      }

      const result = await commWhatsAppService.refineFollowUp(chatId, {
        currentMessage,
        adjustmentInstruction: action.instruction,
      });
      onChangeValue(result.text);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível refinar o follow-up com contexto.');
    } finally {
      setRefiningActionId(null);
    }
  };

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
          const nextInstructions = localCustomInstructions + (localCustomInstructions ? ' ' : '') + corrected.text;
          setLocalCustomInstructions(nextInstructions);
          onChangeCustomInstructions(nextInstructions);
        } catch {
          const nextInstructions = localCustomInstructions + (localCustomInstructions ? ' ' : '') + transcript;
          setLocalCustomInstructions(nextInstructions);
          onChangeCustomInstructions(nextInstructions);
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
    <WhatsAppDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Gerar follow-up"
      description="Escolha um cenário, gere uma sugestão e envie. Os ajustes avançados continuam disponíveis quando precisar."
      size="xl"
      panelClassName="max-w-[82rem]"
      footer={(
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs leading-5 text-[var(--text-muted)]">
            Use <code>{WHATSAPP_MESSAGE_BREAK_DELIMITER}</code> em uma linha isolada para separar em várias mensagens.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={handleClose} disabled={generating || submitting || Boolean(refiningActionId)}>
              Fechar
            </Button>
            <Button variant={value.trim() ? 'secondary' : 'primary'} onClick={() => handleGenerateClick()} loading={generating} disabled={submitting}>
              {!generating && <Sparkles className="h-4 w-4" />}
              <span>{value.trim() ? 'Gerar novamente' : 'Gerar agora'}</span>
            </Button>
            <Button variant="secondary" onClick={() => handleGenerateClick({ variantCount: 3 })} loading={generating} disabled={submitting}>
              {!generating && <Sparkles className="h-4 w-4" />}
              <span>{hasVariations ? 'Novas opções' : 'Gerar 3 opções'}</span>
            </Button>
            <Button onClick={onSend} loading={submitting} disabled={generating || submitting || !value.trim()}>
              Enviar
            </Button>
          </div>
        </div>
      )}
    >
      <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.72fr)]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <div className="flex flex-col gap-4">
              {(selectedSituationPresetIds.length > 0 || selectedSalesTechniques.length > 0 || aiContextRationale) && (
                <div className="rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-3 py-2 text-xs text-[var(--accent-gold-hover)]">
                  <div className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>IA aplicou o contexto da conversa</span>
                  </div>
                  {aiContextRationale ? <p className="mt-1 leading-5 opacity-85">{aiContextRationale}</p> : null}
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Cenário</h3>
                  <span className="text-[11px] font-medium text-[var(--text-muted)]">IA seleciona ao gerar</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CONVERSATION_SITUATION_PRESETS.map((preset) => {
                    const active = selectedSituationPresetIds.includes(preset.id);

                    return (
                      <Button
                        key={preset.id}
                        type="button"
                        variant={active ? 'primary' : 'soft'}
                        size="sm"
                        onClick={() => onToggleSituationPreset(preset.id)}
                        disabled={generating || submitting}
                        title={active ? `Remover cenário: ${preset.label}` : `Aplicar cenário: ${preset.label}`}
                      >
                        {active && <Check className="h-3.5 w-3.5" />}
                        {preset.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tom</h3>
                  <span className="text-[11px] font-medium text-[var(--accent-gold-hover)]">{selectedToneOption.label}</span>
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tom do follow-up">
                  {followUpToneOptions.map((option) => {
                    const active = tone === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChangeTone(option.value)}
                        disabled={generating || submitting}
                        title={option.description}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${active
                          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--accent-gold-hover)] shadow-sm'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--brand-primary-border)]'}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <details className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3" open={Boolean(localCustomInstructions.trim())}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ajustes extras</h3>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Instruções, variáveis e áudio ficam aqui.</p>
                  </div>
                  <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {localCustomInstructions.trim() ? 'Ativo' : 'Abrir'}
                  </span>
                </summary>
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Instruções personalizadas</span>
                    <span className="text-[11px] text-[var(--text-muted)]">Digite {'{{'} para variáveis</span>
                  </div>
                  <VariableAutocompleteTextarea
                    value={localCustomInstructions}
                    onChange={setLocalCustomInstructions}
                    onBlur={() => commitCustomInstructions()}
                    suggestions={WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS}
                    rows={5}
                    size="compact"
                    placeholder={
                      'Ex.:\n' +
                      '- Fale mais curto.\n' +
                      '- Não insista demais.\n' +
                      '- Termine com uma pergunta objetiva.'
                    }
                    disabled={generating || submitting || Boolean(refiningActionId)}
                  />
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    {isRecording && currentTranscript ? (
                      <div className="text-xs italic text-[var(--text-muted)]">
                        "...{currentTranscript}"
                      </div>
                    ) : (
                      <p className="text-[11px] leading-5 text-[var(--text-muted)]">
                        O áudio entra como instrução corrigida automaticamente.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant={isRecording ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={handleToggleRecording}
                      loading={isCorrecting}
                      disabled={generating || submitting || Boolean(refiningActionId)}
                      className={isRecording ? 'animate-pulse' : ''}
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      <span>{isCorrecting ? 'Corrigindo...' : isRecording ? 'Parar' : 'Gravar áudio'}</span>
                    </Button>
                  </div>
                </div>
              </details>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Mensagem</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Edite o texto final ou refine com um clique.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-gold-hover)]">
                  {messageSegments.length || 1} mensagem(ns)
                </div>
                {value.trim() ? (
                  <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {value.trim().length} caracteres
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-2" aria-label="Refinamentos da mensagem sugerida">
              {SIMPLE_REFINEMENT_ACTIONS.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleSimpleRefinement(action.id)}
                  loading={refiningActionId === action.id}
                  disabled={generating || submitting || Boolean(refiningActionId) || !value.trim()}
                  title={action.description}
                >
                  {action.label}
                </Button>
              ))}
              {FOLLOW_UP_CONTEXT_REFINEMENT_ACTIONS.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleContextRefinement(action)}
                  loading={refiningActionId === action.id}
                  disabled={generating || submitting || Boolean(refiningActionId) || !value.trim()}
                  title={action.description}
                >
                  {action.label}
                </Button>
              ))}
            </div>

            {hasVariations ? (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Variações geradas">
                {variations.map((variation, index) => (
                  <button
                    key={`${variation.label}:${index}`}
                    type="button"
                    onClick={() => onChangeValue(variation.text)}
                    disabled={generating || submitting || Boolean(refiningActionId)}
                    className="min-w-[12rem] max-w-[16rem] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-left text-xs transition hover:border-[var(--brand-primary-border)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="block truncate font-semibold text-[var(--text-primary)]">{variation.label}</span>
                    <span className="mt-1 line-clamp-2 block leading-5 text-[var(--text-muted)]">{variation.text}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <Textarea
              value={value}
              onChange={(event) => onChangeValue(event.target.value)}
              rows={12}
              className="min-h-[320px] text-sm leading-6"
              placeholder="A sugestão de follow-up vai aparecer aqui. Você também pode escrever manualmente."
              disabled={generating || submitting || Boolean(refiningActionId)}
            />
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                  <MessageSquare className="h-4 w-4" />
                  Preview
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Como será enviado no WhatsApp.</p>
              </div>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {messageSegments.length || 1} bloco(s)
              </span>
            </div>

            <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-1">
              {messageSegments.length > 0 ? (
                messageSegments.map((segment, index) => (
                  <div
                    key={`${index}:${segment}`}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm"
                  >
                    <div className="rounded-t-xl border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-gold-hover)]">
                        Mensagem {index + 1}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-primary)]">
                        {segment}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-10 text-center">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">Gere ou escreva uma sugestão para visualizar.</p>
                </div>
              )}
            </div>
          </div>

          {nextAction ? (
            <div className="rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                    <CalendarPlus className="h-4 w-4 text-[var(--brand-primary)]" />
                    Próxima ação sugerida
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{nextAction.reason}</p>
                </div>
                <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-gold-hover)]">
                  {nextAction.type === 'schedule' ? 'Agendar' : nextAction.type === 'wait' ? 'Aguardar' : 'Perdido?'}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-[var(--text-secondary)] sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                  <div className="font-semibold text-[var(--text-primary)]">{formatNextActionDate(nextAction.suggestedDateTime)}</div>
                  <div className="mt-0.5 flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Tentativa {nextAction.attemptNumber}/{nextAction.maxAttempts}</div>
                </div>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                  <div className="font-semibold text-[var(--text-primary)]">Prioridade {nextAction.priority}</div>
                  <div className="mt-0.5">Dia: {nextAction.dayLoad ?? 0}/{nextAction.dailyCapacity} pendentes</div>
                </div>
              </div>

              <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{nextAction.giveUpRecommendation}</p>

              {nextAction.type === 'schedule' && nextAction.suggestedDateTime ? (
                <Button type="button" variant="primary" size="sm" className="mt-3" onClick={onScheduleNextAction} loading={schedulingNextAction} disabled={generating || submitting || schedulingNextAction}>
                  <CalendarPlus className="h-4 w-4" />
                  Agendar sugestão
                </Button>
              ) : null}
            </div>
          ) : null}

          <details className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4" open={selectedSalesTechniques.length > 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Técnicas avançadas</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Opcional para a próxima geração.</p>
              </div>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {selectedSalesTechniques.length || 'Abrir'}
              </span>
            </summary>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1" role="group" aria-label="Técnicas de venda para o follow-up">
              {followUpSalesTechniqueOptions.map((technique) => {
                const selected = selectedSalesTechniques.includes(technique.id);

                return (
                  <button
                    key={technique.id}
                    type="button"
                    onClick={() => onToggleSalesTechnique(technique.id)}
                    aria-pressed={selected}
                    disabled={generating || submitting}
                    title={technique.description}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--accent-gold-hover)] shadow-sm'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--brand-primary)] hover:text-[var(--accent-gold-hover)]'
                    }`}
                  >
                    {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--border-subtle)]" />}
                    <span>{technique.name}</span>
                  </button>
                );
              })}
            </div>
          </details>
        </aside>
      </div>
    </WhatsAppDialog>
  );
}
