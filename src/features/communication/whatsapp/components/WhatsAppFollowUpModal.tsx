import { useMemo, useRef, useState, useEffect } from 'react';
import { Check, MessageSquare, Mic, MicOff, Sparkles } from 'lucide-react';

import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import Textarea from '../../../../components/ui/Textarea';
import VariableAutocompleteTextarea from '../../../../components/ui/VariableAutocompleteTextarea';
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { WHATSAPP_MESSAGE_BREAK_DELIMITER, splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { commWhatsAppService, type CommWhatsAppFollowUpTone, type CommWhatsAppFollowUpVariation, type CommWhatsAppRewriteTone } from '../../../../lib/commWhatsAppService';
import { toast } from '../../../../lib/toast';
import { followUpSalesTechniqueOptions } from './followUpSalesTechniques';

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
  onClose: () => void;
  onChangeValue: (value: string) => void;
  onChangeCustomInstructions: (value: string) => void;
  onChangeTone: (value: CommWhatsAppFollowUpTone) => void;
  onToggleSalesTechnique: (techniqueId: string) => void;
  onGenerate: (options?: { variantCount?: number }) => void;
  onSend: () => void;
};

type ConversationSituationPresetId =
  | 'cliente_sumiu'
  | 'achou_caro'
  | 'comparando_concorrente'
  | 'pediu_retorno_depois'
  | 'aguardando_documentos';

type ConversationSituationPreset = {
  id: ConversationSituationPresetId;
  label: string;
  instruction: string;
};

const CONVERSATION_SITUATION_PRESETS: ConversationSituationPreset[] = [
  {
    id: 'cliente_sumiu',
    label: 'Cliente sumiu',
    instruction:
      'Cenário: cliente parou de responder. Faça um follow-up curto, leve e sem cobrança. Reforce que está disponível para ajudar e termine com uma pergunta simples para retomar a conversa.',
  },
  {
    id: 'achou_caro',
    label: 'Achou caro',
    instruction:
      'Cenário: cliente achou o plano caro. Reconheça a preocupação com preço, destaque valor e adequação do plano, ofereça revisar alternativas e evite tom defensivo.',
  },
  {
    id: 'comparando_concorrente',
    label: 'Comparando concorrente',
    instruction:
      'Cenário: cliente está comparando com concorrentes. Oriente a mensagem a comparar benefícios, rede, carências e suporte de forma objetiva, sem desqualificar outras empresas.',
  },
  {
    id: 'pediu_retorno_depois',
    label: 'Pediu retorno depois',
    instruction:
      'Cenário: cliente pediu para retornar depois. Seja respeitoso com o prazo, mencione que está retomando conforme combinado e proponha um próximo passo objetivo.',
  },
  {
    id: 'aguardando_documentos',
    label: 'Aguardando documentos',
    instruction:
      'Cenário: estamos aguardando documentos. Lembre de forma cordial quais documentos faltam, explique que eles são necessários para avançar e ofereça ajuda em caso de dúvida.',
  },
];


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

const appendInstruction = (currentInstructions: string, instructionToAppend: string) => {
  const instructionsWithoutTrailingWhitespace = currentInstructions.trimEnd();

  if (!instructionsWithoutTrailingWhitespace.trim()) return instructionToAppend;

  return `${instructionsWithoutTrailingWhitespace}\n\n${instructionToAppend}`;
};

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
  onClose,
  onChangeValue,
  onChangeCustomInstructions,
  onChangeTone,
  onToggleSalesTechnique,
  onGenerate,
  onSend,
}: WhatsAppFollowUpModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [refiningActionId, setRefiningActionId] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const recognitionRef = useRef<unknown>(null);
  const messageSegments = useMemo(() => splitWhatsAppMessageSegments(value), [value]);
  const hasVariations = variations.length > 0;
  const selectedToneOption = followUpToneOptions.find((option) => option.value === tone) ?? followUpToneOptions[0];

  const handleApplySituationPreset = (preset: ConversationSituationPreset) => {
    onChangeCustomInstructions(appendInstruction(customInstructions, preset.instruction));
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
      panelClassName="config-transparent-buttons max-w-[92rem]"
      footer={(
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
            Separador de mensagens: <code>{WHATSAPP_MESSAGE_BREAK_DELIMITER}</code> em uma linha isolada. O envio respeita cada bloco como uma mensagem separada.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={generating || submitting || Boolean(refiningActionId)}>
              Fechar
            </Button>
            <Button variant="secondary" onClick={() => onGenerate()} loading={generating} disabled={submitting}>
              {!generating && <Sparkles className="h-4 w-4" />}
              <span>{value.trim() ? 'Gerar novamente' : 'Gerar agora'}</span>
            </Button>
            <Button variant="secondary" onClick={() => onGenerate({ variantCount: 3 })} loading={generating} disabled={submitting}>
              {!generating && <Sparkles className="h-4 w-4" />}
              <span>{hasVariations ? 'Novas variações' : 'Gerar variações'}</span>
            </Button>
            <Button onClick={onSend} loading={submitting} disabled={generating || submitting || !value.trim()}>
              Enviar mensagens
            </Button>
          </div>
        </div>
      )}
    >
      <div className="grid min-h-0 gap-5 xl:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.28fr)_minmax(300px,0.9fr)]">
        <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-accent-ink,#8b4d12)]">Passo 1</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--panel-text,#1a120d)]">Direção da IA</h3>
              </div>
              <span className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">
                Configuração
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
              Defina o tom, acrescente o cenário e deixe as instruções específicas em um único bloco.
            </p>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-soft,#5b4635)]">Tom</h4>
                <span className="text-[11px] font-medium text-[var(--panel-accent-ink,#8b4d12)]">{selectedToneOption.label}</span>
              </div>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tom do follow-up">
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
                      className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${active
                        ? 'border-[var(--panel-accent,#c46a1a)] bg-[var(--panel-accent-soft,#f4e2cc)] text-[var(--panel-accent-ink,#8b4d12)] shadow-sm'
                        : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-accent-border,#d2ab85)]'}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-3 py-2 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                {selectedToneOption.description}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-accent-ink,#8b4d12)]">Passo 2</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--panel-text,#1a120d)]">Contexto e instruções</h3>
              </div>
              <span className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">
                Editável
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-3">
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-soft,#5b4635)]">Situação da conversa</h4>
              <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                Use um preset para preencher a intenção sem reescrever o prompt manualmente.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CONVERSATION_SITUATION_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="soft"
                    size="sm"
                    onClick={() => handleApplySituationPreset(preset)}
                    disabled={generating || submitting}
                    title={`Adicionar instrução: ${preset.label}`}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-soft,#5b4635)]">Instruções personalizadas</h4>
                <span className="text-[11px] text-[var(--panel-text-muted,#876f5c)]">Digite {'{{'} para variáveis</span>
              </div>
              <VariableAutocompleteTextarea
                value={customInstructions}
                onChange={onChangeCustomInstructions}
                suggestions={WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS}
                rows={7}
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
                  <div className="text-xs italic text-[var(--panel-text-muted,#876f5c)]">
                    "...{currentTranscript}"
                  </div>
                ) : (
                  <p className="text-[11px] leading-5 text-[var(--panel-text-muted,#876f5c)]">
                    O áudio é transcrito e corrigido antes de entrar nas instruções.
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

          <details className="group rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4" open={selectedSalesTechniques.length > 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-accent-ink,#8b4d12)]">Opcional</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--panel-text,#1a120d)]">Técnicas de venda</h3>
              </div>
              <span className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">
                {selectedSalesTechniques.length || 'Ver'}
              </span>
            </summary>
            <p className="mt-2 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
              Selecione abordagens apenas quando elas ajudarem a próxima geração.
            </p>
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
                        ? 'border-[var(--panel-accent,#c46a1a)] bg-[var(--panel-accent-soft,#f4e2cc)] text-[var(--panel-accent-ink,#8b4d12)] shadow-sm'
                        : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-accent,#c46a1a)] hover:text-[var(--panel-accent-ink,#8b4d12)]'
                    }`}
                  >
                    {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--panel-border-subtle,#e7dac8)]" />}
                    <span>{technique.name}</span>
                  </button>
                );
              })}
            </div>
          </details>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-accent-ink,#8b4d12)]">Passo 3</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--panel-text,#1a120d)]">Mensagem sugerida</h3>
                <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                  Edite o texto final e use os atalhos abaixo para refinar sem sair do fluxo.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <div className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
                  {messageSegments.length || 1} mensagem(ns)
                </div>
                {value.trim() ? (
                  <div className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">
                    {value.trim().length} caracteres
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-3">
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-soft,#5b4635)]">Refinar mensagem</h4>
                <p className="text-[11px] text-[var(--panel-text-muted,#876f5c)]">Disponível após existir uma sugestão</p>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Refinamentos da mensagem sugerida">
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
            </div>

            {hasVariations ? (
              <div className="mb-4 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
                    Variações geradas
                  </h4>
                  <span className="text-[11px] text-[var(--panel-text-muted,#876f5c)]">Clique para usar</span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {variations.map((variation, index) => (
                    <button
                      key={`${variation.label}:${index}`}
                      type="button"
                      onClick={() => onChangeValue(variation.text)}
                      disabled={generating || submitting || Boolean(refiningActionId)}
                      className="min-w-0 rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-3 py-2 text-left text-xs transition hover:border-[var(--panel-accent-border,#d2ab85)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="block truncate font-semibold text-[var(--panel-text,#1a120d)]">{variation.label}</span>
                      <span className="mt-1 line-clamp-3 block leading-5 text-[var(--panel-text-muted,#876f5c)]">{variation.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <Textarea
              value={value}
              onChange={(event) => onChangeValue(event.target.value)}
              rows={17}
              className="min-h-[420px] text-sm leading-6"
              placeholder="A sugestão de follow-up vai aparecer aqui. Você também pode escrever manualmente."
              disabled={generating || submitting || Boolean(refiningActionId)}
            />
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
          <div className="rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-accent-ink,#8b4d12)]">Passo 4</p>
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-[var(--panel-text,#1a120d)]">
                  <MessageSquare className="h-4 w-4" />
                  Preview do envio
                </div>
              </div>
              <span className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">
                WhatsApp
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
              Cada bloco separado por <code>{WHATSAPP_MESSAGE_BREAK_DELIMITER}</code> vira uma mensagem independente.
            </p>

            <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
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
                <div className="rounded-xl border-2 border-dashed border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] px-4 py-10 text-center">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 text-[var(--panel-text-muted,#876f5c)]" />
                  <p className="text-sm text-[var(--panel-text-muted,#876f5c)]">
                    Gere ou escreva uma sugestão para visualizar como ela será enviada.
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </ModalShell>
  );
}
