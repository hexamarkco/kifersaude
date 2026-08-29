import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Clock, MessageCirclePlus, Send, Sparkles, Trash2, UserRoundPlus } from 'lucide-react';
import { Badge, Button, EmptyState, Input, LoadingState } from '../../design-system';
import { useAuth } from '../../contexts/AuthContext';
import {
  aiSandboxChatService,
  type AiSandboxConversation,
  type AiSandboxMessage,
} from '../../lib/aiSandboxChatService';

const REPLY_DEBOUNCE_SECONDS = 60;

export default function AiSandboxChatScreen() {
  const { user, signOut } = useAuth();
  const [conversations, setConversations] = useState<AiSandboxConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiSandboxMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sendingDraft, setSendingDraft] = useState(false);
  const [secondsUntilReply, setSecondsUntilReply] = useState<number | null>(null);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [leadNameForApproach, setLeadNameForApproach] = useState('');
  const [startingApproach, setStartingApproach] = useState(false);
  const [showAutomated, setShowAutomated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const pendingTimerRef = useRef<{ intervalId: number; conversationId: string } | null>(null);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  // Depois do handoff, a Luiza (IA) nao responde mais nessa conversa, mesmo
  // que o lead mande agradecimento ou qualquer outra coisa — a partir dai e
  // atendimento humano.
  const isHandedOff = useMemo(
    () => messages.some((message) => message.role === 'ai' && Boolean(message.handoff_code)),
    [messages],
  );

  const clearPendingTimer = useCallback(() => {
    if (pendingTimerRef.current) {
      window.clearInterval(pendingTimerRef.current.intervalId);
      pendingTimerRef.current = null;
    }
    setSecondsUntilReply(null);
  }, []);

  useEffect(() => () => clearPendingTimer(), [clearPendingTimer]);

  const loadConversations = useCallback(async (automatedOnly: boolean) => {
    setConversationsLoading(true);
    try {
      const rows = await aiSandboxChatService.listConversations(automatedOnly);
      setConversations(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar simulações.');
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  useEffect(() => {
    handleNewConversation();
    loadConversations(showAutomated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAutomated]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessagesLoading(true);
    aiSandboxChatService
      .listMessages(activeConversationId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar mensagens.');
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, secondsUntilReply, generatingReply]);

  const handleNewConversation = () => {
    clearPendingTimer();
    setActiveConversationId(null);
    setMessages([]);
    setDraft('');
    setLeadNameForApproach('');
    setError(null);
  };

  const handleSelectConversation = (conversationId: string) => {
    if (conversationId === activeConversationId) return;
    clearPendingTimer();
    setActiveConversationId(conversationId);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await aiSandboxChatService.deleteConversation(conversationId);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        handleNewConversation();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao apagar simulação.');
    }
  };

  const triggerGenerateReply = useCallback(async (conversationId: string) => {
    setGeneratingReply(true);
    try {
      const result = await aiSandboxChatService.generateReply(conversationId);
      if (result === null) return; // conversa ja foi encaminhada — IA nao responde mais

      if (activeConversationIdRef.current !== conversationId) return;

      const aiMessage: AiSandboxMessage = {
        id: `ai-${Date.now()}`,
        conversation_id: conversationId,
        role: 'ai',
        content: result.reply,
        handoff_reason: result.handoffReason,
        handoff_code: result.handoffCode,
        provider: result.provider,
        model: result.model,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, updated_at: new Date().toISOString() } : c)),
      );
    } catch (err) {
      if (activeConversationIdRef.current === conversationId) {
        setError(err instanceof Error ? err.message : 'Erro ao gerar resposta da IA.');
      }
    } finally {
      if (activeConversationIdRef.current === conversationId) {
        setGeneratingReply(false);
      }
    }
  }, []);

  const startReplyCountdown = useCallback(
    (conversationId: string) => {
      clearPendingTimer();
      let secondsLeft = REPLY_DEBOUNCE_SECONDS;
      setSecondsUntilReply(secondsLeft);
      const intervalId = window.setInterval(() => {
        secondsLeft -= 1;
        if (secondsLeft <= 0) {
          window.clearInterval(intervalId);
          pendingTimerRef.current = null;
          setSecondsUntilReply(null);
          triggerGenerateReply(conversationId);
        } else {
          setSecondsUntilReply(secondsLeft);
        }
      }, 1000);
      pendingTimerRef.current = { intervalId, conversationId };
    },
    [clearPendingTimer, triggerGenerateReply],
  );

  const handleReplyNow = () => {
    const pending = pendingTimerRef.current;
    if (!pending) return;
    clearPendingTimer();
    triggerGenerateReply(pending.conversationId);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sendingDraft || !user) return;

    setError(null);
    setSendingDraft(true);
    setDraft('');

    try {
      let conversationId = activeConversationId;

      if (!conversationId) {
        const conversation = await aiSandboxChatService.createConversation(text, user.id);
        conversationId = conversation.id;
        setConversations((prev) => [conversation, ...prev]);
        setActiveConversationId(conversation.id);
      }

      const leadMessage = await aiSandboxChatService.appendLeadMessage(conversationId, text);
      setMessages((prev) => [...prev, leadMessage]);

      // Depois do handoff a IA nao responde mais — o lead pode mandar mais
      // mensagens (ex: agradecendo), mas ninguem gera resposta automatica.
      if (isHandedOff) return;

      // Reinicia a contagem a cada mensagem nova do lead — dá tempo de quem está
      // testando mandar mensagens picotadas antes da IA responder de uma vez.
      startReplyCountdown(conversationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
      setDraft(text);
    } finally {
      setSendingDraft(false);
    }
  };

  const handleStartWithApproach = async () => {
    if (!user || startingApproach) return;

    setError(null);
    setStartingApproach(true);
    const name = leadNameForApproach.trim();

    try {
      const conversation = await aiSandboxChatService.createConversation(name || 'Abordagem', user.id);
      setConversations((prev) => [conversation, ...prev]);
      setActiveConversationId(conversation.id);
      setLeadNameForApproach('');

      setGeneratingReply(true);
      const result = await aiSandboxChatService.generateOpening(conversation.id, name || undefined);
      if (activeConversationIdRef.current !== conversation.id) return;

      const now = Date.now();
      const openingMessages: AiSandboxMessage[] = result.messages.map((content, index) => ({
        id: `ai-opening-${now}-${index}`,
        conversation_id: conversation.id,
        role: 'ai',
        content,
        handoff_reason: index === result.messages.length - 1 ? result.handoffReason : null,
        handoff_code: index === result.messages.length - 1 ? result.handoffCode : null,
        provider: result.provider,
        model: result.model,
        created_at: new Date().toISOString(),
      }));
      setMessages(openingMessages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar abordagem.');
    } finally {
      setStartingApproach(false);
      setGeneratingReply(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="painel-theme kifer-ds flex h-screen w-full bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-4">
          <div>
            <p className="text-sm font-semibold">Chat de testes — IA</p>
            <p className="text-xs text-[var(--text-secondary)]">Simulações de atendimento</p>
          </div>
          <Button variant="text" size="xs" onClick={() => signOut()}>
            Sair
          </Button>
        </div>

        <div className="px-3 pt-3">
          <Button variant="primary" size="sm" fullWidth onClick={handleNewConversation} disabled={showAutomated}>
            <MessageCirclePlus className="mr-1.5 h-4 w-4" />
            Nova simulação
          </Button>
        </div>

        <label className="flex items-center gap-2 px-4 pt-3 text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={showAutomated}
            onChange={(event) => setShowAutomated(event.target.checked)}
            className="h-3.5 w-3.5"
          />
          Ver testes automatizados
        </label>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {conversationsLoading ? (
            <LoadingState compact label="Carregando..." />
          ) : conversations.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-[var(--text-secondary)]">
              {showAutomated
                ? 'Nenhum teste automatizado rodado ainda.'
                : 'Nenhuma simulação ainda. Comece uma conversa como se fosse um lead.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <div
                    className={`group flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-2 text-sm transition-colors ${
                      conversation.id === activeConversationId
                        ? 'bg-[var(--app-surface-selected)] font-medium text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectConversation(conversation.id)}
                      className="min-w-0 flex-1 truncate text-left"
                      title={conversation.title}
                    >
                      {conversation.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteConversation(conversation.id)}
                      className="shrink-0 text-[var(--text-muted)] opacity-0 transition-colors hover:text-[var(--danger)] group-hover:opacity-100"
                      title="Apagar simulação"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {activeConversation && (
          <div className="border-b border-[var(--border-subtle)] px-6 py-3">
            <p className="truncate text-sm font-medium">{activeConversation.title}</p>
          </div>
        )}
        {!activeConversationId && messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="w-full max-w-sm">
              <EmptyState
                icon={<Sparkles className="h-6 w-6" />}
                title="Simule um atendimento"
                description="Na maioria dos casos é você quem aborda o lead primeiro — a IA pode puxar o mesmo fluxo de abordagem. Se for um lead que te procurou por indicação, é só mandar a primeira mensagem no campo abaixo."
              />
              <div className="mt-4 flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-4">
                <p className="text-xs font-medium text-[var(--text-secondary)]">IA aborda o lead primeiro</p>
                <Input
                  value={leadNameForApproach}
                  onChange={(event) => setLeadNameForApproach(event.target.value)}
                  placeholder="Nome do lead (opcional)"
                  size="compact"
                  disabled={startingApproach}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  loading={startingApproach}
                  onClick={handleStartWithApproach}
                >
                  <UserRoundPlus className="mr-1.5 h-4 w-4" />
                  Iniciar abordagem
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {messagesLoading ? (
                <LoadingState compact label="Carregando conversa..." />
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="flex flex-col gap-1">
                    <div
                      className={`flex ${message.role === 'lead' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-4 py-2.5 text-sm shadow-[var(--shadow-card)] ${
                          message.role === 'lead'
                            ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)]'
                            : 'border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                    {message.handoff_code && (
                      <div className="flex justify-start">
                        <div className="flex max-w-[75%] items-start gap-1.5 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-1.5 text-xs text-[var(--warning-text)]">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>
                            <Badge tone="warning" size="sm" className="mr-1.5 align-middle">
                              Handoff: {message.handoff_code}
                            </Badge>
                            {message.handoff_reason}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}

              {secondsUntilReply !== null && (
                <div className="flex items-center justify-start gap-2">
                  <div className="flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
                    <Clock className="h-3.5 w-3.5" />
                    <span>IA responde em {secondsUntilReply}s (aguardando novas mensagens)</span>
                  </div>
                  <Button variant="text" size="xs" onClick={handleReplyNow}>
                    Responder agora
                  </Button>
                </div>
              )}

              {generatingReply && (
                <div className="flex justify-start">
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5 text-sm text-[var(--text-secondary)]">
                    IA está digitando...
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 mb-2 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger-text)]">
            {error}
          </div>
        )}

        {isHandedOff && (
          <div className="mx-6 mb-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            🔒 Essa conversa já foi encaminhada — a partir daqui é atendimento humano, a IA não responde mais aqui (mesmo que o lead mande mais mensagens).
          </div>
        )}

        <div className="border-t border-[var(--border-subtle)] px-6 py-4">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite como se fosse o lead..."
              rows={1}
              disabled={sendingDraft}
              className="kds-textarea min-h-[42px] flex-1 resize-none px-4 py-2.5 text-sm"
            />
            <Button
              variant="primary"
              size="icon"
              loading={sendingDraft}
              onClick={handleSend}
              disabled={!draft.trim()}
              title="Enviar"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
