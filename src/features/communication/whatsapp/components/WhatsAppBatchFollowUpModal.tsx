import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MessageSquare, RefreshCw, Send, Sparkles } from 'lucide-react';

import Button from '../../../../components/ui/Button';
import ModalShell from '../../../../components/ui/ModalShell';
import Textarea from '../../../../components/ui/Textarea';
import { PANEL_EMPTY_STATE_STYLE } from '../../../../components/ui/panelStyles';
import { cx } from '../../../../lib/cx';
import { formatDateTimeFullBR } from '../../../../lib/dateUtils';
import { toast } from '../../../../lib/toast';
import { splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import {
  commWhatsAppService,
  type CommWhatsAppPendingFollowUpChat,
} from '../../../../lib/commWhatsAppService';

type BatchChatItem = {
  chat: CommWhatsAppPendingFollowUpChat;
  status: 'pending' | 'generating' | 'ready' | 'failed';
  generatedText: string;
  error: string | null;
};

type WhatsAppBatchFollowUpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSendBatch: (results: Array<{ chatId: string; textSegments: string[] }>) => void;
};

export default function WhatsAppBatchFollowUpModal({
  isOpen,
  onClose,
  onSendBatch,
}: WhatsAppBatchFollowUpModalProps) {
  const [items, setItems] = useState<BatchChatItem[]>([]);
  const [phase, setPhase] = useState<'loading' | 'idle' | 'generating' | 'review'>('loading');
  const [editingTexts, setEditingTexts] = useState<Map<string, string>>(new Map());
  const generationAbortRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setPhase('loading');
    setItems([]);
    setEditingTexts(new Map());
    generationAbortRef.current = false;

    commWhatsAppService
      .getPendingFollowUpChats()
      .then((chats) => {
        setItems(chats.map((chat) => ({ chat, status: 'pending', generatedText: '', error: null })));
        setPhase(chats.length === 0 ? 'idle' : 'idle');
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Erro ao carregar follow-ups pendentes.';
        toast.error(message);
        setPhase('idle');
      });
  }, [isOpen]);

  const handleGenerateAll = useCallback(async () => {
    generationAbortRef.current = false;
    setPhase('generating');

    let allReady = true;
    for (let i = 0; i < items.length; i += 1) {
      if (generationAbortRef.current) break;

      setItems((prev) => prev.map((item, idx) => (idx === i ? { ...item, status: 'generating', error: null } : item)));

      try {
        const result = await commWhatsAppService.generateFollowUp(items[i].chat.chat_id, {
          autoSelectContext: true,
        });
        setItems((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'ready', generatedText: result.text, error: null } : item)),
        );
      } catch (error) {
        allReady = false;
        const message = error instanceof Error ? error.message : 'Erro ao gerar follow-up.';
        setItems((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'failed', error: message } : item)),
        );
      }
    }

    if (!generationAbortRef.current) {
      setPhase('review');
      if (allReady) {
        toast.success('Todos os follow-ups foram gerados. Revise antes de enviar.');
      } else {
        toast.warning('Alguns follow-ups falharam. Revise e tente novamente.');
      }
    }
  }, [items]);

  const handleRetryChat = useCallback(async (index: number) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, status: 'generating', error: null } : item)));

    try {
      const result = await commWhatsAppService.generateFollowUp(items[index].chat.chat_id, {
        autoSelectContext: true,
      });
      setItems((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, status: 'ready', generatedText: result.text } : item)),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar follow-up.';
      setItems((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, status: 'failed', error: message } : item)),
      );
    }
  }, [items]);

  const handleSendAll = useCallback(() => {
    const readyItems = items.filter((item) => item.status === 'ready');
    if (readyItems.length === 0) {
      toast.error('Nenhum follow-up pronto para enviar.');
      return;
    }

    const results = readyItems.map((item) => {
      const text = editingTexts.get(item.chat.chat_id) ?? item.generatedText;
      return { chatId: item.chat.chat_id, textSegments: splitWhatsAppMessageSegments(text) };
    });

    onSendBatch(results);
    onClose();
  }, [items, editingTexts, onSendBatch, onClose]);

  const isOverdueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const getStatusIcon = (status: BatchChatItem['status']) => {
    switch (status) {
      case 'generating':
        return <Loader2 className="h-4 w-4 animate-spin text-[var(--panel-accent-ink,#6f3f16)]" />;
      case 'ready':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-[var(--panel-text-muted,#8a735f)]" />;
    }
  };

  const readyCount = items.filter((item) => item.status === 'ready').length;
  const totalCount = items.length;

  const footer = phase === 'loading' ? null : (
    <div className="flex items-center justify-end gap-3 border-t border-[var(--panel-border-subtle,#e4d5c0)] px-6 py-4">
      <span className="mr-auto text-sm text-[var(--panel-text-muted,#8a735f)]">
        {totalCount > 0
          ? `${readyCount} de ${totalCount} pronto(s)`
          : 'Nenhum follow-up pendente para hoje.'}
      </span>

      {phase === 'idle' && totalCount > 0 && (
        <Button onClick={handleGenerateAll} variant="primary" className="rounded-xl">
          <Sparkles className="mr-1.5 h-4 w-4" />
          Gerar follow-ups
        </Button>
      )}

      {phase === 'generating' && (
        <Button variant="soft" disabled className="rounded-xl">
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          Gerando...
        </Button>
      )}

      {phase === 'review' && readyCount > 0 && (
        <Button onClick={handleSendAll} variant="primary" className="rounded-xl">
          <Send className="mr-1.5 h-4 w-4" />
          Enviar todos ({readyCount})
        </Button>
      )}
    </div>
  );

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Follow-ups pendentes"
      size="xl"
      footer={footer}
      bodyScrollable
    >
      {phase === 'loading' && (
        <div className="flex items-center justify-center py-24" style={PANEL_EMPTY_STATE_STYLE}>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span>Carregando follow-ups pendentes...</span>
        </div>
      )}

      {phase !== 'loading' && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-24" style={PANEL_EMPTY_STATE_STYLE}>
          <CheckCircle2 className="h-8 w-8 text-green-500" />
          <span>Nenhum follow-up pendente para hoje.</span>
        </div>
      )}

      {phase !== 'loading' && items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item, index) => {
            const isPending = item.status === 'pending';
            const isGenerating = item.status === 'generating';
            const isReady = item.status === 'ready';
            const isFailed = item.status === 'failed';
            const overdue = isOverdueDate(item.chat.reminder_due_at);
            const text = editingTexts.get(item.chat.chat_id) ?? item.generatedText;
            const segments = text ? splitWhatsAppMessageSegments(text) : [];

            return (
              <div
                key={item.chat.chat_id}
                className={cx(
                  'rounded-xl border p-4',
                  isReady && 'border-[var(--panel-accent-border,#d5a25c)]',
                  isFailed && 'border-red-300',
                  !isReady && !isFailed && 'border-[var(--panel-border-subtle,#e4d5c0)]',
                )}
                style={{
                  background: 'var(--panel-surface,#fffdfa)',
                }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(item.status)}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--panel-text,#2d231d)]">
                        {item.chat.lead_name || 'Sem nome'}
                      </p>
                      {item.chat.lead_phone && (
                        <p className="truncate text-xs text-[var(--panel-text-muted,#8a735f)]">
                          {item.chat.lead_phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                      style={{
                        borderColor: overdue ? 'var(--panel-danger,#d9775a)' : 'var(--panel-border-subtle,#e4d5c0)',
                        color: overdue ? 'var(--panel-danger-ink,#942f1a)' : 'var(--panel-text-muted,#8a735f)',
                        background: overdue ? 'color-mix(in srgb, var(--panel-danger,#d9775a) 12%, transparent)' : undefined,
                      }}
                    >
                      {overdue ? 'Atrasado' : formatDateTimeFullBR(item.chat.reminder_due_at)}
                    </span>
                  </div>
                </div>

                {item.chat.reminder_title && (
                  <p className="mb-2 text-xs text-[var(--panel-text-soft,#5b4635)]">
                    {item.chat.reminder_title}
                  </p>
                )}

                {isGenerating && (
                  <div className="flex items-center gap-2 py-3 text-sm text-[var(--panel-text-muted,#8a735f)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Gerando follow-up com IA...
                  </div>
                )}

                {isFailed && (
                  <div className="flex items-center gap-2 py-2">
                    <span className="text-xs text-red-600">{item.error}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRetryChat(index)}
                      className="rounded-lg"
                      aria-label="Tentar novamente"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {isReady && (
                  <div className="mt-2">
                    <Textarea
                      value={text}
                      onChange={(e) => {
                        setEditingTexts((prev) => {
                          const next = new Map(prev);
                          next.set(item.chat.chat_id, e.target.value);
                          return next;
                        });
                      }}
                      rows={3}
                      className="w-full resize-y text-sm"
                    />
                    {segments.length > 1 && (
                      <p className="mt-1 text-xs text-[var(--panel-text-muted,#8a735f)]">
                        {segments.length} mensagens ({segments.length - 1} separador(es) &mdash;)
                      </p>
                    )}
                  </div>
                )}

                {isPending && (
                  <p className="py-2 text-xs text-[var(--panel-text-muted,#8a735f)]">
                    Aguardando geração...
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}
