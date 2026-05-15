import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Baby,
  CheckCircle2,
  Loader2,
  Mic,
  MicOff,
  Radio,
  SendHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';

import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import { cx } from '../../../../lib/cx';
import type { CommWhatsAppAssistantResponse, CommWhatsAppAssistantScope } from '../../../../lib/commWhatsAppService';

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

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionType;
  webkitSpeechRecognition?: SpeechRecognitionType;
};

type WhatsAppAssistantModalProps = {
  isOpen: boolean;
  loading: boolean;
  prompt: string;
  scope: CommWhatsAppAssistantScope;
  response: CommWhatsAppAssistantResponse | null;
  selectedChatName?: string | null;
  hasSelectedChat: boolean;
  onClose: () => void;
  onPromptChange: (value: string) => void;
  onScopeChange: (value: CommWhatsAppAssistantScope) => void;
  onAsk: () => void;
  onApplySuggestedMessage: (message: string) => void;
};

type AssistantConversationEntry = {
  id: string;
  role: 'operator' | 'assistant';
  text: string;
  detail?: string | null;
};

const promptExamples = [
  'RAVI, o que responder?',
  'RAVI, resuma esse chat.',
  'RAVI, quais leads falaram sobre Porto Saude?',
  'RAVI, quem priorizar hoje?',
];

const scopeOptions: Array<{ value: CommWhatsAppAssistantScope; label: string; description: string }> = [
  { value: 'free', label: 'Livre', description: 'Operação geral, dúvidas amplas e múltiplos contatos.' },
  { value: 'chat', label: 'Chat atual', description: 'Analisar explicitamente a conversa aberta.' },
  { value: 'inbox', label: 'Inbox', description: 'Fila, status e prioridades do WhatsApp.' },
  { value: 'system', label: 'Sistema/CRM', description: 'Leads, contratos, agenda e processos.' },
];

const getScopeFooterText = (scope: CommWhatsAppAssistantScope, hasSelectedChat: boolean, selectedChatName?: string | null) => {
  if (scope === 'chat') {
    return hasSelectedChat ? `Modo: chat atual${selectedChatName ? ` (${selectedChatName})` : ''}.` : 'Modo: chat atual, mas nenhuma conversa está selecionada.';
  }

  if (scope === 'inbox') return 'Modo: inbox geral do WhatsApp.';
  if (scope === 'system') return 'Modo: sistema/CRM.';
  return hasSelectedChat ? 'Modo: livre. O chat atual só será usado se a pergunta pedir claramente.' : 'Modo: livre.';
};

const confidenceLabel = (confidence: CommWhatsAppAssistantResponse['confidence']) => {
  if (confidence === 'high') return 'Alta confiança';
  if (confidence === 'low') return 'Baixa confiança';
  return 'Confiança média';
};

const actionTypeLabel = (type: string) => {
  if (type === 'draft_message') return 'Mensagem';
  if (type === 'schedule_follow_up') return 'Agenda';
  if (type === 'review_lead') return 'Lead';
  if (type === 'open_dashboard') return 'Painel';
  return 'Manual';
};

const createEntryId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getAssistantSpeechText = (response: CommWhatsAppAssistantResponse) => {
  const firstParagraph = response.answer.split('\n').find((line) => line.trim())?.trim() || response.answer.trim();
  if (response.clarification) return `${firstParagraph}. ${response.clarification}`;
  return firstParagraph;
};

export default function WhatsAppAssistantModal({
  isOpen,
  loading,
  prompt,
  scope,
  response,
  selectedChatName,
  hasSelectedChat,
  onClose,
  onPromptChange,
  onScopeChange,
  onAsk,
  onApplySuggestedMessage,
}: WhatsAppAssistantModalProps) {
  const [conversation, setConversation] = useState<AssistantConversationEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptPreview, setTranscriptPreview] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionType> | null>(null);
  const lastResponseRef = useRef<CommWhatsAppAssistantResponse | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const trimmedPrompt = prompt.trim();
  const canAsk = trimmedPrompt.length > 0 && !loading;
  const visibleConversation = conversation.slice(-5);

  const currentStatus = useMemo(() => {
    if (loading) return 'PROCESSANDO';
    if (isRecording) return 'OUVINDO';
    if (response) return 'RESPOSTA PRONTA';
    return 'ONLINE';
  }, [isRecording, loading, response]);

  useEffect(() => {
    if (!isOpen) return;
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation, isOpen, loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionClass = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    setSpeechSupported('speechSynthesis' in window);
    setVoiceSupported(Boolean(SpeechRecognitionClass));

    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';
    recognition.onresult = (event: unknown) => {
      const results = (event as { results?: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }).results;
      if (!results) return;

      let interimTranscript = '';
      let finalTranscript = '';
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const nextTranscript = `${finalTranscript}${interimTranscript}`.trim();
      setTranscriptPreview(nextTranscript);
      if (nextTranscript) {
        onPromptChange(nextTranscript);
      }
    };
    recognition.onerror = () => {
      setIsRecording(false);
      setTranscriptPreview('');
    };
    recognition.onend = () => {
      setIsRecording(false);
    };
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [onPromptChange]);

  useEffect(() => {
    if (!response || response === lastResponseRef.current) return;
    lastResponseRef.current = response;

    setConversation((current) => [
      ...current,
      {
        id: createEntryId(),
        role: 'assistant',
        text: response.answer,
        detail: response.clarification || null,
      },
    ]);

    if (voiceEnabled && speechSupported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(getAssistantSpeechText(response));
      utterance.lang = 'pt-BR';
      utterance.rate = 0.96;
      utterance.pitch = 0.92;
      window.speechSynthesis.speak(utterance);
    }
  }, [response, speechSupported, voiceEnabled]);

  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, [isOpen]);

  const handleAsk = () => {
    if (!canAsk) return;
    setConversation((current) => [
      ...current,
      {
        id: createEntryId(),
        role: 'operator',
        text: trimmedPrompt,
        detail: getScopeFooterText(scope, hasSelectedChat, selectedChatName),
      },
    ]);
    onAsk();
  };

  const handleToggleRecording = () => {
    if (!voiceSupported) return;

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setTranscriptPreview('');
    recognitionRef.current?.start();
    setIsRecording(true);
  };

  const handleToggleVoice = () => {
    setVoiceEnabled((current) => {
      const next = !current;
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  const handleClose = () => {
    recognitionRef.current?.stop();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title="R.A.V.I."
      description="Interface operacional por texto e voz. O R.A.V.I. sugere ações, mas nada é enviado ou alterado sem confirmação."
      size="xl"
      panelClassName="config-transparent-buttons h-[100dvh] border-orange-300/25 bg-[#100b08] text-orange-50 shadow-[0_0_80px_rgba(200,111,29,0.26)] [&>footer]:px-4 [&>footer]:py-2.5 [&>header]:px-4 [&>header]:py-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] sm:max-w-[min(96vw,88rem)] sm:[&>footer]:px-5 sm:[&>header]:px-5"
      bodyClassName="bg-[radial-gradient(circle_at_50%_0%,rgba(200,111,29,0.25),transparent_32%),linear-gradient(145deg,#130d09_0%,#090604_56%,#1b0f08_100%)] p-0 sm:p-0"
      bodyScrollable={false}
      footer={(
        <div className="flex flex-col gap-2 bg-[#120b07] text-orange-100 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs leading-5 text-orange-100/70">
            {getScopeFooterText(scope, hasSelectedChat, selectedChatName)} Voz: {voiceSupported ? 'microfone disponível' : 'microfone indisponível neste navegador'}.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleToggleVoice} disabled={!speechSupported}>
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {voiceEnabled ? 'Voz ligada' : 'Voz desligada'}
            </Button>
            <Button variant="secondary" onClick={handleClose}>Fechar</Button>
          </div>
        </div>
      )}
    >
      <div className="grid h-full min-h-0 overflow-hidden text-orange-50 lg:grid-cols-[minmax(250px,0.62fr)_minmax(0,1.38fr)]">
        <section className="relative flex min-h-0 flex-col overflow-hidden border-b border-orange-300/15 bg-black/20 p-2 lg:border-b-0 lg:border-r">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,179,96,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,179,96,0.07)_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-2">
            <div className="rounded-[1.2rem] border border-orange-200/15 bg-orange-950/20 p-2 shadow-[inset_0_0_28px_rgba(249,115,22,0.12)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-[0.08em] text-orange-50">R.A.V.I.</h3>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/20 bg-orange-300/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] text-orange-100">
                  <Radio className={cx('h-3.5 w-3.5', loading || isRecording ? 'animate-pulse' : '')} />
                  {currentStatus}
                </span>
              </div>

              <div className="relative mx-auto my-1.5 flex h-20 w-20 items-center justify-center rounded-full border border-orange-200/20 bg-[radial-gradient(circle,rgba(251,146,60,0.28)_0%,rgba(120,53,15,0.1)_43%,transparent_70%)] shadow-[0_0_32px_rgba(249,115,22,0.22)]">
                <div className="absolute inset-2 animate-spin rounded-full border border-dashed border-orange-200/25 [animation-duration:18s]" />
                <div className="absolute inset-5 animate-spin rounded-full border border-orange-300/20 [animation-duration:9s] [animation-direction:reverse]" />
                <div className="absolute h-12 w-12 rounded-full border border-orange-100/15" />
                <div className={cx('h-9 w-9 rounded-full bg-orange-300/80 shadow-[0_0_30px_rgba(251,146,60,0.72)]', loading || isRecording ? 'animate-pulse' : '')} />
                <Baby className="absolute h-5 w-5 text-stone-950" />
              </div>

              <p className="text-center text-[10px] leading-3 text-orange-100/72">
                Voz ou texto. Contexto real, próximos passos e confirmação antes de ações sensíveis.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {scopeOptions.map((option) => {
                const active = option.value === scope;
                const disabled = loading || (option.value === 'chat' && !hasSelectedChat);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onScopeChange(option.value)}
                    disabled={disabled}
                    title={option.description}
                    className={cx(
                      'rounded-xl border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40',
                      active
                        ? 'border-orange-200/40 bg-orange-300/15 text-orange-50 shadow-[0_0_22px_rgba(249,115,22,0.18)]'
                        : 'border-orange-200/15 bg-black/20 text-orange-100/70 hover:border-orange-200/35 hover:text-orange-50',
                    )}
                  >
                    <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.14em]">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto rounded-xl border border-orange-200/15 bg-black/20 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-100/50">Comandos rápidos</p>
              <div className="grid grid-cols-2 gap-1.5">
                {promptExamples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => onPromptChange(example)}
                    disabled={loading}
                    className="truncate rounded-lg border border-orange-200/15 bg-orange-300/5 px-2 py-1 text-left text-[10px] font-medium text-orange-100/70 transition hover:border-orange-200/35 hover:text-orange-50 disabled:opacity-50"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col bg-black/10">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4">
            {conversation.length === 0 && !loading && !response ? (
              <div className="flex min-h-[150px] flex-1 flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-orange-200/20 bg-orange-300/10 shadow-[0_0_30px_rgba(249,115,22,0.18)]">
                  <Baby className="h-7 w-7 text-orange-100" />
                </div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-100">Pronto para conversar</p>
                <p className="mt-2 max-w-lg text-sm leading-6 text-orange-100/62">
                  Diga “RAVI” no começo do comando se quiser manter o fluxo natural. No modo livre, eu não assumo que o chat aberto é o assunto.
                </p>
              </div>
            ) : null}

            {conversation.length > visibleConversation.length ? (
              <p className="text-center text-[11px] uppercase tracking-[0.16em] text-orange-100/38">
                Mostrando interações recentes
              </p>
            ) : null}

            {visibleConversation.map((entry) => (
              <div key={entry.id} className={cx('flex', entry.role === 'operator' ? 'justify-end' : 'justify-start')}>
                <div className={cx(
                  'max-w-[88%] rounded-3xl border px-3.5 py-2.5 shadow-lg',
                  entry.role === 'operator'
                    ? 'border-orange-200/30 bg-orange-300/15 text-orange-50'
                    : 'border-orange-100/15 bg-black/30 text-orange-50 shadow-orange-950/20',
                )}
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-100/50">
                    {entry.role === 'operator' ? 'Operador' : 'R.A.V.I.'}
                  </p>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-5">{entry.text}</p>
                  {entry.detail ? <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-orange-100/55">{entry.detail}</p> : null}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-3xl border border-orange-100/15 bg-black/30 px-4 py-2.5 text-orange-100/70">
                  <div className="flex items-center gap-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-orange-200" />
                    Processando contexto operacional...
                  </div>
                </div>
              </div>
            ) : null}

            {response && !loading ? (
              <div className="min-h-0 space-y-3 overflow-hidden rounded-3xl border border-orange-200/15 bg-orange-950/15 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-orange-300/15 px-3 py-1 text-xs font-semibold text-orange-100">
                    {confidenceLabel(response.confidence)}
                  </span>
                  {response.provider ? (
                    <span className="rounded-full border border-orange-200/15 px-3 py-1 text-xs text-orange-100/62">
                      {response.provider}{response.model ? ` · ${response.model}` : ''}
                    </span>
                  ) : null}
                </div>

                {response.clarification ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 text-amber-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="line-clamp-3 text-sm leading-5">{response.clarification}</p>
                  </div>
                ) : null}

                {response.suggestedMessage ? (
                  <div className="space-y-2 rounded-2xl border border-orange-200/15 bg-black/20 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-orange-50">Mensagem sugerida</p>
                      <Button
                        size="sm"
                        onClick={() => onApplySuggestedMessage(response.suggestedMessage || '')}
                        disabled={!hasSelectedChat}
                      >
                        Aplicar no composer
                      </Button>
                    </div>
                    <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-5 text-orange-100/72">{response.suggestedMessage}</p>
                  </div>
                ) : null}

                {response.actionPlan.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-100/52">Plano confirmável</p>
                    {response.actionPlan.slice(0, 3).map((action) => (
                      <div key={action.id} className="rounded-2xl border border-orange-200/15 bg-black/20 px-3 py-2.5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-orange-50">{action.title}</p>
                            <p className="mt-1 line-clamp-2 text-sm leading-5 text-orange-100/70">{action.description}</p>
                          </div>
                          <span className="rounded-full bg-orange-300/10 px-2.5 py-1 text-[11px] font-semibold text-orange-100/70">
                            {actionTypeLabel(action.type)}
                          </span>
                        </div>
                        <div className={cx('mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold', action.requiresConfirmation ? 'bg-amber-300/12 text-amber-100' : 'bg-emerald-300/12 text-emerald-100')}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {action.requiresConfirmation ? 'Requer confirmação humana' : 'Informativo'}
                        </div>
                      </div>
                    ))}
                    {response.actionPlan.length > 3 ? (
                      <p className="text-xs text-orange-100/50">+{response.actionPlan.length - 3} ações adicionais na resposta do R.A.V.I.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div ref={conversationEndRef} />
          </div>

          <div className="border-t border-orange-200/15 bg-[#100905]/95 p-3 sm:p-4">
            {isRecording && transcriptPreview ? (
              <div className="mb-2 rounded-2xl border border-orange-200/20 bg-orange-300/10 px-3 py-1.5 text-sm text-orange-100/80">
                Ouvindo: {transcriptPreview}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleToggleRecording}
                disabled={!voiceSupported || loading}
                className={cx(
                  'flex h-12 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition sm:w-36',
                  isRecording
                    ? 'border-red-300/50 bg-red-500/20 text-red-50 shadow-[0_0_28px_rgba(248,113,113,0.22)]'
                    : 'border-orange-200/20 bg-orange-300/10 text-orange-50 hover:border-orange-200/40 hover:bg-orange-300/15',
                  (!voiceSupported || loading) && 'cursor-not-allowed opacity-50',
                )}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isRecording ? 'Parar' : 'Falar'}
              </button>

              <textarea
                value={prompt}
                onChange={(event) => onPromptChange(event.target.value)}
                placeholder="Diga ou digite: RAVI, quem eu devo priorizar agora?"
                rows={1}
                className="min-h-12 flex-1 resize-none rounded-2xl border border-orange-200/20 bg-black/35 px-4 py-2.5 text-sm leading-6 text-orange-50 outline-none transition placeholder:text-orange-100/32 focus:border-orange-200/45 focus:ring-2 focus:ring-orange-300/15"
                disabled={loading}
              />

              <Button onClick={handleAsk} loading={loading} disabled={!canAsk} className="h-12 rounded-2xl sm:w-40">
                <SendHorizontal className="h-4 w-4" />
                Enviar
              </Button>
            </div>
          </div>
        </section>
      </div>
    </ModalShell>
  );
}
