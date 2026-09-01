import { useMemo, useRef, useState, useEffect } from 'react';
import { CalendarPlus, MessageSquare, Mic, MicOff, Sparkles } from 'lucide-react';

import { Button, Textarea } from '../../../../design-system';
import VariableAutocompleteTextarea from '../../../../components/ui/VariableAutocompleteTextarea';
import { LeadFavoriteBadge } from '../../../../components/LeadFavoriteStar';
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { WHATSAPP_MESSAGE_BREAK_DELIMITER, splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { commWhatsAppService, type CommWhatsAppFollowUpEmotionalContext, type CommWhatsAppFollowUpNextAction, type CommWhatsAppFollowUpVariation, type CommWhatsAppRewriteTone } from '../../../../lib/commWhatsAppService';
import { toast } from '../../../../lib/toast';
import WhatsAppDialog from './WhatsAppDialog';
import {
  AiContextPanel,
  CONTEXT_REFINEMENT_ACTIONS,
  ChatBubblePreview,
  NextActionCard,
  Pill,
  RefinementChip,
  SIMPLE_REFINEMENT_ACTIONS,
  SectionCard,
  VariationCarousel,
} from './followUpModalUi';

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

type WhatsAppFollowUpModalProps = {
  isOpen: boolean;
  generating: boolean;
  submitting: boolean;
  chatId?: string | null;
  leadName?: string | null;
  leadFavorito?: boolean | null;
  value: string;
  customInstructions: string;
  variations?: CommWhatsAppFollowUpVariation[];
  aiContextRationale?: string | null;
  emotionalContext?: CommWhatsAppFollowUpEmotionalContext | null;
  currentAction?: 'send' | 'wait' | null;
  currentActionReason?: string | null;
  opportunityRecommendation?: 'continue' | 'pause' | 'mark_lost_recommended' | null;
  nextAction?: CommWhatsAppFollowUpNextAction | null;
  schedulingNextAction?: boolean;
  onClose: () => void;
  onChangeValue: (value: string) => void;
  onChangeCustomInstructions: (value: string) => void;
  onGenerate: (options?: { variantCount?: number; customInstructions?: string }) => void;
  onScheduleNextAction: () => void;
  onSend: () => void;
};

export default function WhatsAppFollowUpModal({
  isOpen,
  generating,
  submitting,
  chatId,
  leadName,
  leadFavorito,
  value,
  customInstructions,
  variations = [],
  aiContextRationale,
  emotionalContext,
  currentAction = 'send',
  currentActionReason,
  opportunityRecommendation,
  nextAction,
  schedulingNextAction = false,
  onClose,
  onChangeValue,
  onChangeCustomInstructions,
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
  const hasAiInsight = Boolean(aiContextRationale || emotionalContext?.detected);

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

  const handleManualSendOverride = () => {
    const overrideInstruction = 'A corretora revisou o caso e solicitou explicitamente uma mensagem agora. Gere uma mensagem apenas se continuar coerente com o histórico.';
    const nextInstructions = [localCustomInstructions.trim(), overrideInstruction].filter(Boolean).join('\n');
    setLocalCustomInstructions(nextInstructions);
    onChangeCustomInstructions(nextInstructions);
    onGenerate({ customInstructions: nextInstructions });
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

  const handleSimpleRefinement = async (refinementTone: CommWhatsAppRewriteTone) => {
    const currentMessage = value.trim();
    if (!currentMessage || refiningActionId) {
      return;
    }

    setRefiningActionId(refinementTone);
    try {
      const result = await commWhatsAppService.rewriteMessage({
        message: currentMessage,
        tone: refinementTone,
      });
      onChangeValue(result.text ?? currentMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível refinar a mensagem sugerida.');
    } finally {
      setRefiningActionId(null);
    }
  };

  const handleContextRefinement = async (action: (typeof CONTEXT_REFINEMENT_ACTIONS)[number]) => {
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
      onChangeValue(result.text ?? currentMessage);
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
      description="A IA interpreta a conversa inteira antes de escrever. Ajustes manuais continuam disponíveis quando precisar."
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
            {currentAction === 'wait' ? (
              <Button variant="secondary" onClick={handleManualSendOverride} loading={generating} disabled={submitting}>
                <Sparkles className="h-4 w-4" />
                Gerar mesmo assim
              </Button>
            ) : null}
            <Button onClick={onSend} loading={submitting} disabled={generating || submitting || !value.trim() || currentAction === 'wait'}>
              Enviar
            </Button>
          </div>
        </div>
      )}
    >
      {leadName ? (
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
          <LeadFavoriteBadge favorito={leadFavorito} />
          {leadName}
        </div>
      ) : null}
      <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.72fr)]">
        <section className="min-w-0 space-y-4">
          <SectionCard>
            <div className="flex flex-col gap-4">
              {hasAiInsight ? <AiContextPanel rationale={aiContextRationale} emotionalContext={emotionalContext} /> : null}
              {currentAction === 'wait' ? (
                <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning-text)]">
                  <strong>Aguardar antes de enviar.</strong>{' '}
                  {currentActionReason || 'A IA identificou que ainda não é o momento de um novo contato.'}
                </div>
              ) : null}
              {opportunityRecommendation === 'mark_lost_recommended' ? (
                <div className="rounded-xl border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-[var(--warning-text)]">
                  A IA recomenda avaliar o encerramento desta oportunidade, sem enviar uma nova cobrança automática.
                </div>
              ) : null}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Ajustes extras</h3>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">Diga à IA o que ela precisa saber para escrever a melhor mensagem agora — a IA decide sozinha o estágio, o tom e a estratégia com base no histórico.</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[var(--text-muted)]">Digite {'{{'} para variáveis</span>
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
                    '- Ela me falou por telefone que vai viajar amanhã.\n' +
                    '- Não fale de preço.\n' +
                    '- Quero descobrir o que está travando.'
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
            </div>
          </SectionCard>

          <SectionCard
            title="Mensagem"
            description="Edite o texto final ou refine com um clique."
            action={(
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="accent">{messageSegments.length || 1} mensagem(ns)</Pill>
                {value.trim() ? <Pill>{value.trim().length} caracteres</Pill> : null}
              </div>
            )}
          >
            <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Refinamentos da mensagem sugerida">
              {SIMPLE_REFINEMENT_ACTIONS.map((action) => (
                <RefinementChip
                  key={action.id}
                  icon={action.icon}
                  label={action.label}
                  description={action.description}
                  onClick={() => void handleSimpleRefinement(action.id)}
                  loading={refiningActionId === action.id}
                  disabled={generating || submitting || Boolean(refiningActionId) || !value.trim()}
                />
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--border-subtle)]" />
              {CONTEXT_REFINEMENT_ACTIONS.map((action) => (
                <RefinementChip
                  key={action.id}
                  icon={action.icon}
                  label={action.label}
                  description={action.description}
                  onClick={() => void handleContextRefinement(action)}
                  loading={refiningActionId === action.id}
                  disabled={generating || submitting || Boolean(refiningActionId) || !value.trim()}
                />
              ))}
            </div>

            {hasVariations ? (
              <div className="mb-3">
                <VariationCarousel
                  variations={variations}
                  onSelect={onChangeValue}
                  disabled={generating || submitting || Boolean(refiningActionId)}
                />
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
          </SectionCard>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <SectionCard
            title={(
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Preview
              </span>
            )}
            description="Como será enviado no WhatsApp."
            action={<Pill tone="accent">{messageSegments.length || 1} bloco(s)</Pill>}
            bodyClassName="max-h-[430px] overflow-y-auto pr-1"
          >
            <ChatBubblePreview segments={messageSegments} />
          </SectionCard>

          {nextAction ? (
            <NextActionCard
              nextAction={nextAction}
              action={nextAction.type !== 'mark_lost_recommended' && nextAction.suggestedDateTime ? (
                <Button type="button" variant="primary" size="sm" onClick={onScheduleNextAction} loading={schedulingNextAction} disabled={generating || submitting || schedulingNextAction}>
                  {!schedulingNextAction && <CalendarPlus className="h-4 w-4" />}
                  Agendar sugestão
                </Button>
              ) : null}
            />
          ) : null}
        </aside>
      </div>
    </WhatsAppDialog>
  );
}
