import { useMemo, useRef, useState, useEffect } from 'react';
import { Check, MessageSquare, Mic, MicOff, Sparkles } from 'lucide-react';

import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import Textarea from '../../../../components/ui/Textarea';
import VariableAutocompleteTextarea from '../../../../components/ui/VariableAutocompleteTextarea';
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { WHATSAPP_MESSAGE_BREAK_DELIMITER, splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { commWhatsAppService, type CommWhatsAppFollowUpTone } from '../../../../lib/commWhatsAppService';

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

const FOLLOW_UP_OBJECTIVE_OPTIONS = [
  { value: '', label: 'Sem objetivo específico' },
  { value: 'agendar ligação', label: 'Agendar ligação' },
  { value: 'retomar cotação enviada', label: 'Retomar cotação enviada' },
  { value: 'confirmar interesse', label: 'Confirmar interesse' },
  { value: 'tirar dúvidas', label: 'Tirar dúvidas' },
  { value: 'solicitar documentos', label: 'Solicitar documentos' },
  { value: 'avançar para fechamento', label: 'Avançar para fechamento' },
  { value: 'reativar lead frio', label: 'Reativar lead frio' },
] as const;

type WhatsAppFollowUpModalProps = {
  isOpen: boolean;
  generating: boolean;
  submitting: boolean;
  value: string;
  customInstructions: string;
  tone: CommWhatsAppFollowUpTone;
  onClose: () => void;
  onChangeValue: (value: string) => void;
  onChangeCustomInstructions: (value: string) => void;
  onChangeTone: (value: CommWhatsAppFollowUpTone) => void;
  onGenerate: () => void;
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

const appendInstruction = (currentInstructions: string, instructionToAppend: string) => {
  const instructionsWithoutTrailingWhitespace = currentInstructions.trimEnd();

  if (!instructionsWithoutTrailingWhitespace.trim()) return instructionToAppend;

  return `${instructionsWithoutTrailingWhitespace}\n\n${instructionToAppend}`;
};

export default function WhatsAppFollowUpModal({
  isOpen,
  generating,
  submitting,
  value,
  customInstructions,
  tone,
  onClose,
  onChangeValue,
  onChangeCustomInstructions,
  onChangeTone,
  onGenerate,
  onSend,
}: WhatsAppFollowUpModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const recognitionRef = useRef<unknown>(null);
  const messageSegments = useMemo(() => splitWhatsAppMessageSegments(value), [value]);

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
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Tom do follow-up</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                Escolha a abordagem principal da sugestão. As instruções globais da operação continuam sendo respeitadas.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {followUpToneOptions.map((option) => {
                  const active = tone === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onChangeTone(option.value)}
                      disabled={generating || submitting}
                      className={`rounded-2xl border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active
                        ? 'border-[var(--panel-accent-border,#d2ab85)] bg-[var(--panel-accent-soft,#f4e2cc)]/75 text-[var(--panel-text,#1a120d)]'
                        : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-accent-border,#d2ab85)]'}`}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-2">
              <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Instruções personalizadas</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                Essas instruções valem só para esta geração. Digite <code>{'{{'}</code> para usar variáveis do prompt.
              </p>
            </div>

            <div className="mb-3 rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--panel-accent-ink,#8b4d12)]">
                    Situação da conversa
                  </h4>
                  <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                    Presets são aceleradores: eles complementam suas instruções sem apagar o que você já digitou.
                  </p>
                </div>
                <span className="rounded-full border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--panel-text-muted,#876f5c)]">
                  Editável
                </span>
              </div>
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
              <p className="mt-3 text-[11px] leading-5 text-[var(--panel-text-muted,#876f5c)]">
                Depois de escolher um cenário, revise e ajuste a instrução abaixo antes de gerar a mensagem.
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
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[var(--panel-text,#1a120d)]">Técnicas de venda</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                Selecione uma ou mais abordagens para orientar a próxima geração sem deixar a mensagem robótica.
              </p>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Técnicas de venda para o follow-up">
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
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      selected
                        ? 'border-[var(--panel-accent,#c46a1a)] bg-[var(--panel-accent-soft,#f4e2cc)] text-[var(--panel-accent-ink,#8b4d12)] shadow-sm'
                        : 'border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f8f2e9)] text-[var(--panel-text-soft,#5b4635)] hover:border-[var(--panel-accent,#c46a1a)] hover:text-[var(--panel-accent-ink,#8b4d12)]'
                    }`}
                  >
                    {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    <span>{technique.name}</span>
                  </button>
                );
              })}
            </div>
            {selectedSalesTechniques.length > 0 ? (
              <p className="mt-3 text-xs leading-5 text-[var(--panel-text-muted,#876f5c)]">
                {selectedSalesTechniques.length} técnica(s) selecionada(s) para a próxima geração.
              </p>
            ) : null}
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
