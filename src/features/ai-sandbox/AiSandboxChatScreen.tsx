import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, MessageCirclePlus, Send, Trash2 } from 'lucide-react';
import { Button, EmptyState, LoadingState } from '../../design-system';
import { useAuth } from '../../contexts/AuthContext';
import {
  aiSandboxChatService,
  type AiSandboxConversation,
  type AiSandboxMessage,
} from '../../lib/aiSandboxChatService';

export default function AiSandboxChatScreen() {
  const { signOut } = useAuth();
  const [conversations, setConversations] = useState<AiSandboxConversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiSandboxMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const loadConversations = async () => {
    setConversationsLoading(true);
    try {
      const rows = await aiSandboxChatService.listConversations();
      setConversations(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar simulações.');
    } finally {
      setConversationsLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

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
  }, [messages]);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setDraft('');
    setError(null);
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

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setError(null);
    setSending(true);
    setDraft('');

    const optimisticLeadMessage: AiSandboxMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeConversationId ?? 'pending',
      role: 'lead',
      content: text,
      handoff_reason: null,
      provider: null,
      model: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticLeadMessage]);

    try {
      const result = await aiSandboxChatService.sendMessage({
        conversationId: activeConversationId,
        message: text,
      });

      if (!activeConversationId) {
        setActiveConversationId(result.conversationId);
        await loadConversations();
      } else {
        setConversations((prev) =>
          prev.map((c) => (c.id === result.conversationId ? { ...c, updated_at: new Date().toISOString() } : c)),
        );
      }

      const aiMessage: AiSandboxMessage = {
        id: `ai-${Date.now()}`,
        conversation_id: result.conversationId,
        role: 'ai',
        content: result.reply,
        handoff_reason: result.handoffReason,
        provider: result.provider,
        model: result.model,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar mensagem.');
      setMessages((prev) => prev.filter((m) => m.id !== optimisticLeadMessage.id));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="kifer-ds flex h-screen w-full bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-4">
          <div>
            <p className="text-sm font-semibold">Chat de testes — IA</p>
            <p className="text-xs text-[var(--text-secondary)]">Simulações de atendimento</p>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline"
          >
            Sair
          </button>
        </div>

        <div className="px-3 pt-3">
          <Button variant="primary" size="sm" fullWidth onClick={handleNewConversation}>
            <MessageCirclePlus className="mr-1.5 h-4 w-4" />
            Nova simulação
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {conversationsLoading ? (
            <LoadingState compact label="Carregando..." />
          ) : conversations.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-[var(--text-secondary)]">
              Nenhuma simulação ainda. Comece uma conversa como se fosse um lead.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <div
                    className={`group flex items-center gap-1 rounded-lg px-2 py-2 text-sm ${
                      conversation.id === activeConversationId
                        ? 'bg-[var(--bg-selected,rgba(59,130,246,0.12))] font-medium'
                        : 'hover:bg-[var(--bg-hover,rgba(0,0,0,0.04))]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className="min-w-0 flex-1 truncate text-left"
                      title={conversation.title}
                    >
                      {conversation.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteConversation(conversation.id)}
                      className="shrink-0 text-[var(--text-secondary)] opacity-0 hover:text-red-500 group-hover:opacity-100"
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
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="Simule um atendimento"
              description="Digite como se você fosse um lead chegando no WhatsApp. A IA responde seguindo o playbook e o estilo real da operação."
            />
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
                        className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                          message.role === 'lead'
                            ? 'bg-[var(--brand-primary,#2563eb)] text-white'
                            : 'bg-[var(--bg-surface-elevated,#f1f5f9)] text-[var(--text-primary)]'
                        }`}
                      >
                        {message.content}
                      </div>
                    </div>
                    {message.handoff_reason && (
                      <div className="flex justify-start">
                        <div className="flex max-w-[75%] items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>Handoff sugerido: {message.handoff_reason}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-6 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
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
              disabled={sending}
              className="min-h-[42px] flex-1 resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-primary,#2563eb)]"
            />
            <Button variant="primary" size="md" loading={sending} onClick={handleSend} disabled={!draft.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
