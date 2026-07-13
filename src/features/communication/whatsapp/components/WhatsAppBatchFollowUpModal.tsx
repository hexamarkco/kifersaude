import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarPlus, Check, CheckCircle2, Clock3, Loader2, MessageSquare, Plus, Send, Sparkles } from 'lucide-react';

import { Button, Textarea } from '../../../../design-system';
import VariableAutocompleteTextarea from '../../../../components/ui/VariableAutocompleteTextarea';
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { commWhatsAppService, type CommWhatsAppFollowUpNextAction, type CommWhatsAppFollowUpTone, type CommWhatsAppFollowUpVariation, type CommWhatsAppRewriteTone } from '../../../../lib/commWhatsAppService';
import { toast } from '../../../../lib/toast';
import { followUpSalesTechniqueOptions } from './followUpSalesTechniques';
import { CONVERSATION_SITUATION_PRESETS } from './followUpSituationPresets';
import WhatsAppDialog from './WhatsAppDialog';

// ---- Constants ----

const followUpToneOptions: Array<{
  value: CommWhatsAppFollowUpTone;
  label: string;
  description: string;
}> = [
  { value: 'consultivo', label: 'Consultivo', description: 'Orienta com contexto, escuta ativa e próximo passo claro.' },
  { value: 'amigavel', label: 'Amigável', description: 'Soa leve, acolhedor e próximo sem perder objetividade.' },
  { value: 'direto', label: 'Direto', description: 'Vai ao ponto com chamada objetiva e pouco texto.' },
  { value: 'reativacao', label: 'Reativação', description: 'Retoma contato parado com naturalidade e baixa pressão.' },
  { value: 'premium', label: 'Premium', description: 'Comunica cuidado, exclusividade e atenção personalizada.' },
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

const CONCURRENCY = 3;

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

// ---- Types ----

type BatchItemState = {
  chatId: string;
  leadId: string;
  leadName: string | null;
  leadPhone: string | null;
  reminderId: string;
  reminderTitle: string;
  externalChatId: string | null;

  tone: CommWhatsAppFollowUpTone;
  customInstructions: string;
  selectedSalesTechniques: string[];
  selectedSituationPresetIds: string[];
  manualContext: { tone: boolean; situationPresetIds: boolean; salesTechniques: boolean };

  status: 'pending' | 'generating' | 'ready' | 'failed';
  generatedText: string;
  variations: CommWhatsAppFollowUpVariation[];
  aiContextRationale: string | null;
  nextAction: CommWhatsAppFollowUpNextAction | null;
  error: string | null;
  selected: boolean;
  sendStatus: 'idle' | 'queued' | 'sending' | 'sent' | 'failed';
  sendError: string | null;
  sendSegmentsSent: number;
  sendSegmentsTotal: number;
};

type SentSummary = {
  sentCount: number;
  scheduledCount: number;
  failedCount: number;
  errorMessage?: string;
};

export type WhatsAppBatchFollowUpSendProgress = {
  reminderId: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  sentSegments: number;
  totalSegments: number;
  errorMessage?: string;
};

type WhatsAppBatchFollowUpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSendBatchFollowUps?: (results: Array<{
    chatId: string;
    externalChatId: string | null;
    textSegments: string[];
    reminderId: string;
    leadId: string;
    phone: string | null;
    nextAction: {
      suggestedDateTime: string | null;
      priority: string;
      title: string;
      reason: string;
    } | null;
  }>, options?: {
    onProgress?: (progress: WhatsAppBatchFollowUpSendProgress) => void;
  }) => Promise<SentSummary>;
};

// ---- Helpers ----

const updateItemInList = (items: BatchItemState[], index: number, patch: Partial<BatchItemState>): BatchItemState[] =>
  items.map((it, i) => (i === index ? { ...it, ...patch } : it));

// ---- Component ----

export default function WhatsAppBatchFollowUpModal({
  isOpen,
  onClose,
  onSendBatchFollowUps,
}: WhatsAppBatchFollowUpModalProps) {
  const [items, setItems] = useState<BatchItemState[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'generating' | 'sending' | 'sent'>('loading');
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [refiningActionId, setRefiningActionId] = useState<string | null>(null);
  const [sentSummary, setSentSummary] = useState<SentSummary | null>(null);
  const cancelRequestedRef = useRef(false);

  // Load pending chats on open
  useEffect(() => {
    if (!isOpen) return;

    cancelRequestedRef.current = false;
    setPhase('loading');
    setActiveItemIndex(null);
    setSentSummary(null);

    void (async () => {
      try {
        const pendingChats = await commWhatsAppService.getPendingFollowUpChats();
        const seenReminderIds = new Set<string>();
        const mapped: BatchItemState[] = pendingChats.filter((chat) => {
          if (seenReminderIds.has(chat.reminder_id)) {
            return false;
          }

          seenReminderIds.add(chat.reminder_id);
          return true;
        }).map((chat) => ({
          chatId: chat.chat_id,
          leadId: chat.lead_id,
          leadName: chat.lead_name,
          leadPhone: chat.lead_phone,
          reminderId: chat.reminder_id,
          reminderTitle: chat.reminder_title,
          externalChatId: chat.external_chat_id,
          tone: 'consultivo',
          customInstructions: '',
          selectedSalesTechniques: [],
          selectedSituationPresetIds: [],
          manualContext: { tone: false, situationPresetIds: false, salesTechniques: false },
          status: 'pending',
          generatedText: '',
          variations: [],
          aiContextRationale: null,
          nextAction: null,
          error: null,
          selected: true,
          sendStatus: 'idle',
          sendError: null,
          sendSegmentsSent: 0,
          sendSegmentsTotal: 0,
        }));
        setItems(mapped);
        if (mapped.length > 0) {
          setActiveItemIndex(0);
        }
        setPhase('ready');
        if (mapped.length === 0) {
          toast.info('Nenhum follow-up pendente para hoje.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar follow-ups pendentes.';
        toast.error(message);
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose não pode estar aqui porque a referência muda a cada render do modal de agenda, causando flash/refetch
  }, [isOpen]);

  const activeItem = activeItemIndex !== null ? items[activeItemIndex] : null;
  const activeMessageSegments = useMemo(
    () => (activeItem ? splitWhatsAppMessageSegments(activeItem.generatedText) : []),
    [activeItem],
  );

  const pendingCount = items.filter((i) => i.status === 'pending' && i.selected).length;
  const readyCount = items.filter((i) => i.status === 'ready' && i.selected).length;
  const sendingItems = items.filter((i) => i.selected && ['queued', 'sending', 'sent', 'failed'].includes(i.sendStatus));
  const sentItemsCount = sendingItems.filter((i) => i.sendStatus === 'sent').length;
  const failedItemsCount = sendingItems.filter((i) => i.sendStatus === 'failed').length;
  const currentSendingItem = items.find((i) => i.sendStatus === 'sending') ?? null;
  const sendingTotal = sendingItems.length;
  const sendingFinished = sentItemsCount + failedItemsCount;
  const sendingProgressPercent = sendingTotal > 0 ? Math.round((sendingFinished / sendingTotal) * 100) : 0;

  // ---- Generate single item ----

  const handleGenerateItem = async (index: number, options?: { variantCount?: number }) => {
    const item = items[index];
    if (!item) return;

    setItems((prev) => updateItemInList(prev, index, { status: 'generating', error: null }));

    try {
      const result = await commWhatsAppService.generateFollowUp(item.chatId, {
        tone: item.tone,
        customInstructions: item.customInstructions,
        salesTechniques: item.selectedSalesTechniques,
        situationPresetIds: item.selectedSituationPresetIds,
        variantCount: options?.variantCount,
        autoSelectContext: true,
        manualContext: item.manualContext,
      });

      setItems((prev) =>
        updateItemInList(prev, index, {
          status: 'ready',
          generatedText: result.text.trim(),
          variations: result.variations ?? [],
          aiContextRationale: result.aiContext?.rationale ?? null,
          nextAction: result.nextAction ?? null,
          tone: (result.aiContext?.tone as CommWhatsAppFollowUpTone) ?? item.tone,
          selectedSituationPresetIds: result.aiContext?.situationPresetIds ?? item.selectedSituationPresetIds,
          selectedSalesTechniques: result.aiContext?.salesTechniques ?? item.selectedSalesTechniques,
          manualContext: {
            tone: Boolean(result.aiContext?.tone) || item.manualContext.tone,
            situationPresetIds: Boolean(result.aiContext?.situationPresetIds?.length) || item.manualContext.situationPresetIds,
            salesTechniques: Boolean(result.aiContext?.salesTechniques?.length) || item.manualContext.salesTechniques,
          },
          error: null,
        }),
      );
    } catch (error) {
      setItems((prev) =>
        updateItemInList(prev, index, {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Erro ao gerar follow-up.',
        }),
      );
    }
  };

  // ---- Toggle handlers ----

  const handleToggleSelect = (chatId: string) => {
    setItems((prev) => prev.map((it) => (it.chatId === chatId ? { ...it, selected: !it.selected } : it)));
  };

  const handleToggleSelectAll = () => {
    const allSelected = items.every((i) => i.selected);
    setItems((prev) => prev.map((it) => ({ ...it, selected: !allSelected })));
  };

  // ---- Simple refinement ----

  const handleSimpleRefinement = async (tone: CommWhatsAppRewriteTone) => {
    const idx = activeItemIndex;
    if (idx === null || !activeItem?.generatedText.trim() || refiningActionId) return;
    setRefiningActionId(tone);
    try {
      const result = await commWhatsAppService.rewriteMessage({
        message: activeItem.generatedText.trim(),
        tone,
      });
      setItems((prev) => updateItemInList(prev, idx, { generatedText: result.text }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível refinar a mensagem.');
    } finally {
      setRefiningActionId(null);
    }
  };

  // ---- Context refinement ----

  const handleContextRefinement = async (action: FollowUpRefinementAction) => {
    const idx = activeItemIndex;
    if (idx === null || !activeItem?.generatedText.trim() || refiningActionId) return;
    setRefiningActionId(action.id);
    try {
      const result = await commWhatsAppService.refineFollowUp(activeItem.chatId, {
        currentMessage: activeItem.generatedText.trim(),
        adjustmentInstruction: action.instruction,
      });
      setItems((prev) => updateItemInList(prev, idx, { generatedText: result.text }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível refinar o follow-up com contexto.');
    } finally {
      setRefiningActionId(null);
    }
  };

  // ---- Tone / presets / techniques ----

  const handleChangeTone = (value: CommWhatsAppFollowUpTone) => {
    const idx = activeItemIndex;
    if (idx === null) return;
    setItems((prev) =>
      updateItemInList(prev, idx, {
        tone: value,
        manualContext: { ...prev[idx].manualContext, tone: true },
      }),
    );
  };

  const handleToggleSituationPreset = (presetId: string) => {
    const idx = activeItemIndex;
    if (idx === null) return;
    setItems((prev) => {
      const current = prev[idx].selectedSituationPresetIds;
      const next = current.includes(presetId) ? current.filter((id) => id !== presetId) : [...current, presetId];
      return updateItemInList(prev, idx, {
        selectedSituationPresetIds: next,
        manualContext: { ...prev[idx].manualContext, situationPresetIds: next.length > 0 },
      });
    });
  };

  const handleToggleSalesTechnique = (techniqueId: string) => {
    const idx = activeItemIndex;
    if (idx === null) return;
    setItems((prev) => {
      const current = prev[idx].selectedSalesTechniques;
      const next = current.includes(techniqueId) ? current.filter((id) => id !== techniqueId) : [...current, techniqueId];
      return updateItemInList(prev, idx, {
        selectedSalesTechniques: next,
        manualContext: { ...prev[idx].manualContext, salesTechniques: next.length > 0 },
      });
    });
  };

  // ---- Bulk generate ----

  const handleGenerateAll = async () => {
    const targetIndices = items
      .map((it, idx) => (it.status === 'pending' && it.selected ? idx : -1))
      .filter((idx) => idx !== -1);

    if (targetIndices.length === 0) {
      toast.warning('Nenhum item pendente para gerar.');
      return;
    }

    cancelRequestedRef.current = false;
    setPhase('generating');

    const updatedItems = items.map((it) =>
      targetIndices.includes(items.indexOf(it)) ? { ...it, status: 'generating' as const, error: null } : it,
    );
    setItems(updatedItems);
    let allReady = true;

    for (let i = 0; i < targetIndices.length; i += CONCURRENCY) {
      if (cancelRequestedRef.current) break;
      const batch = targetIndices.slice(i, i + CONCURRENCY);

      const results = await Promise.allSettled(
        batch.map((idx) =>
          commWhatsAppService.generateFollowUp(updatedItems[idx].chatId, {
            tone: updatedItems[idx].tone,
            customInstructions: updatedItems[idx].customInstructions,
            salesTechniques: updatedItems[idx].selectedSalesTechniques,
            situationPresetIds: updatedItems[idx].selectedSituationPresetIds,
            autoSelectContext: true,
            manualContext: updatedItems[idx].manualContext,
          }),
        ),
      );

      results.forEach((result, pos) => {
        const idx = batch[pos];
        if (result.status === 'fulfilled') {
          updatedItems[idx] = {
            ...updatedItems[idx],
            status: 'ready',
            generatedText: result.value.text.trim(),
            variations: result.value.variations ?? [],
            aiContextRationale: result.value.aiContext?.rationale ?? null,
            nextAction: result.value.nextAction ?? null,
          };
        } else {
          allReady = false;
          updatedItems[idx] = {
            ...updatedItems[idx],
            status: 'failed',
            error: result.reason instanceof Error ? result.reason.message : 'Erro ao gerar follow-up.',
          };
        }
      });
      setItems([...updatedItems]);
    }

    setItems(updatedItems);
    setPhase('ready');

    if (cancelRequestedRef.current) {
      toast.info('Geração cancelada.');
    } else if (allReady) {
      toast.success(`Todos os ${targetIndices.length} follow-ups foram gerados.`);
    } else {
      toast.warning('Alguns follow-ups falharam.');
    }
  };

  // ---- Send ----

  const handleSendSelected = async () => {
    const readyItems = items.filter((it) => it.status === 'ready' && it.selected);
    if (readyItems.length === 0 || !onSendBatchFollowUps) {
      if (!onSendBatchFollowUps) toast.error('Envio não disponível.');
      return;
    }

    setPhase('sending');
    setItems((prev) => prev.map((item) => {
      if (!readyItems.some((readyItem) => readyItem.reminderId === item.reminderId)) {
        return item;
      }

      return {
        ...item,
        sendStatus: 'queued',
        sendError: null,
        sendSegmentsSent: 0,
        sendSegmentsTotal: splitWhatsAppMessageSegments(item.generatedText).length,
      };
    }));

    try {
      const summary = await onSendBatchFollowUps(
        readyItems.map((it) => ({
          chatId: it.chatId,
          externalChatId: it.externalChatId,
          textSegments: splitWhatsAppMessageSegments(it.generatedText),
          reminderId: it.reminderId,
          leadId: it.leadId,
          phone: it.leadPhone,
          nextAction: it.nextAction
            ? {
                suggestedDateTime: it.nextAction.suggestedDateTime,
                priority: it.nextAction.priority,
                title: it.nextAction.title,
                reason: it.nextAction.reason,
              }
            : null,
        })),
        {
          onProgress: (progress) => {
            setItems((prev) => prev.map((item) => (
              item.reminderId === progress.reminderId
                ? {
                    ...item,
                    sendStatus: progress.status,
                    sendError: progress.errorMessage ?? null,
                    sendSegmentsSent: progress.sentSegments,
                    sendSegmentsTotal: progress.totalSegments,
                  }
                : item
            )));
          },
        },
      );

      setSentSummary(summary);
    } catch (error) {
      console.error('[WhatsAppBatchFollowUpModal] erro ao enviar:', error);
      setItems((prev) => prev.map((item) => (
        item.sendStatus === 'queued' || item.sendStatus === 'sending'
          ? {
              ...item,
              sendStatus: 'failed',
              sendError: error instanceof Error ? error.message : 'Erro desconhecido ao enviar.',
            }
          : item
      )));
      setSentSummary({
        sentCount: 0,
        scheduledCount: 0,
        failedCount: readyItems.length,
        errorMessage: error instanceof Error ? error.message : 'Erro desconhecido ao enviar.',
      });
    }

    setPhase('sent');
  };

  // ---- Close / cancel ----

  const handleClose = () => {
    if (phase === 'generating') {
      cancelRequestedRef.current = true;
    }
    onClose();
  };

  // ---- Render: sent state ----

  if (phase === 'sent' && sentSummary) {
    return (
      <WhatsAppDialog isOpen={isOpen} onClose={onClose} title="Follow-ups em lote" description="" size="xl" panelClassName="max-w-[90rem]"
        footer={<div className="flex items-center justify-end gap-2"><Button variant="secondary" onClick={onClose}>Fechar</Button></div>}
      >
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
          <CheckCircle2 className="h-12 w-12 text-[var(--success)]" />
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Follow-ups enviados
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--success-border)] bg-[var(--success-soft)] px-4 py-3 text-sm font-medium text-[var(--success-text)]">
              <CheckCircle2 className="h-4 w-4" />
              {sentSummary.sentCount} enviado(s)
            </div>
            {sentSummary.scheduledCount > 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--info-border)] bg-[var(--info-soft)] px-4 py-3 text-sm font-medium text-[var(--info-text)]">
                <CalendarPlus className="h-4 w-4" />
                {sentSummary.scheduledCount} agendado(s)
              </div>
            ) : null}
            {sentSummary.failedCount > 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger-text)]">
                <AlertCircle className="h-4 w-4" />
                <span>{sentSummary.failedCount} falha(s)</span>
              </div>
            ) : null}
          </div>
          {sentSummary.errorMessage ? (
            <p className="max-w-md text-center text-xs text-[var(--danger-text)]">{sentSummary.errorMessage}</p>
          ) : null}
        </div>
      </WhatsAppDialog>
    );
  }

  // ---- Render: loading state ----

  if (phase === 'loading') {
    return (
      <WhatsAppDialog isOpen={isOpen} onClose={handleClose} title="Follow-ups em lote" description="" size="xl" panelClassName="max-w-[90rem]" footer={null}>
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-sm" style={{
            borderColor: 'var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}>
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--brand-primary)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Carregando follow-ups pendentes...
            </span>
          </div>
        </div>
      </WhatsAppDialog>
    );
  }

  // ---- Render: main layout ----

  return (
    <WhatsAppDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Follow-ups em lote"
      description="Gerencie e envie follow-ups para vários leads de uma vez. Cada lead tem seus próprios ajustes de tom, cenário e instruções."
      size="xl"
      panelClassName="max-w-[90rem]"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {phase === 'sending' ? (
              <div className="min-w-[280px] max-w-[520px] space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  <span>
                    Enviando {sendingFinished} de {sendingTotal}
                    {currentSendingItem ? ` - ${currentSendingItem.leadName || 'Sem nome'}` : ''}
                  </span>
                  <span>{sendingProgressPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${sendingProgressPercent}%`,
                      background: 'var(--brand-primary)',
                    }}
                  />
                </div>
              </div>
            ) : phase === 'generating' ? (
              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => { cancelRequestedRef.current = true; }}>
                Cancelar
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={() => void handleGenerateAll()}
                disabled={pendingCount === 0}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Gerar pendentes ({pendingCount})
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="rounded-xl" onClick={handleClose} disabled={phase === 'sending'}>
              Fechar
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="rounded-xl"
              onClick={() => void handleSendSelected()}
                disabled={readyCount === 0 || phase === 'sending'}
                loading={phase === 'sending'}
              >
                <Send className="mr-1.5 h-4 w-4" />
              {phase === 'sending' ? `Enviando (${sendingFinished}/${sendingTotal})` : `Enviar selecionados (${readyCount})`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-[500px] gap-5">
        {/* Sidebar */}
        <aside className="w-[260px] shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
              {items.length} lead(s)
            </span>
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-[11px] font-semibold transition hover:opacity-70"
              style={{ color: 'var(--brand-primary)' }}
            >
              {items.every((i) => i.selected) ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
          </div>
          <div className="max-h-[480px] space-y-1 overflow-y-auto pr-2">
            {items.map((item, index) => {
              const isActive = activeItemIndex === index;
              const statusIcon = phase === 'sending' && item.sendStatus === 'sending' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: 'var(--brand-primary)' }} />
              ) : phase === 'sending' && item.sendStatus === 'sent' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
              ) : phase === 'sending' && item.sendStatus === 'failed' ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" />
              ) : phase === 'sending' && item.sendStatus === 'queued' ? (
                <Clock3 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              ) : item.status === 'generating' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" style={{ color: 'var(--brand-primary)' }} />
              ) : item.status === 'ready' ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--success)]" />
              ) : item.status === 'failed' ? (
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--danger)]" />
              ) : null;

              return (
                <div key={item.reminderId} className="flex items-center gap-2">
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${phase === 'sending' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    style={{
                      borderColor: item.selected ? 'var(--brand-primary)' : 'var(--border-default)',
                      background: item.selected ? 'var(--brand-primary)' : 'transparent',
                    }}
                    onClick={() => {
                      if (phase !== 'sending') handleToggleSelect(item.chatId);
                    }}
                  >
                    {item.selected && <Check className="h-3 w-3 text-[var(--text-on-brand)]" />}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveItemIndex(index)}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                      isActive
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
                        : 'border-transparent bg-transparent hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    {statusIcon}
                    <span className="min-w-0 flex-1 truncate font-medium">{item.leadName || 'Sem nome'}</span>
                    {phase === 'sending' && item.sendStatus === 'sending' && item.sendSegmentsTotal > 1 ? (
                      <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {item.sendSegmentsSent}/{item.sendSegmentsTotal}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Editor + Preview */}
        {activeItem ? (
          <div className="grid min-w-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.72fr)]">
            {/* Main editor */}
            <section className="min-w-0 space-y-4">
              <div className="rounded-2xl border p-4 shadow-sm" style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-surface)',
              }}>
                <div className="flex flex-col gap-4">
                  {/* Header: lead name + generate buttons */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {activeItem.leadName || 'Sem nome'}
                      </h3>
                      {activeItem.leadPhone ? (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {activeItem.leadPhone}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="secondary" size="sm" className="rounded-xl"
                        loading={activeItem.status === 'generating'}
                        disabled={activeItem.status === 'generating' || phase === 'sending'}
                        onClick={() => void handleGenerateItem(activeItemIndex!)}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        {activeItem.generatedText.trim() ? 'Gerar novamente' : 'Gerar'}
                      </Button>
                      <Button
                        variant="soft" size="sm" className="rounded-xl"
                        loading={activeItem.status === 'generating'}
                        disabled={activeItem.status === 'generating' || phase === 'sending'}
                        onClick={() => void handleGenerateItem(activeItemIndex!, { variantCount: 3 })}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        3 opções
                      </Button>
                    </div>
                  </div>

                  {/* AI Context Rationale */}
                  {(activeItem.selectedSituationPresetIds.length > 0 || activeItem.selectedSalesTechniques.length > 0 || activeItem.aiContextRationale) ? (
                    <div className="rounded-2xl border px-3 py-2 text-xs" style={{
                      borderColor: 'var(--brand-primary-border)',
                      background: 'var(--brand-primary-soft)',
                      color: 'var(--accent-gold-hover)',
                    }}>
                      <div className="flex items-center gap-2 font-semibold">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>IA aplicou o contexto da conversa</span>
                      </div>
                      {activeItem.aiContextRationale ? (
                        <p className="mt-1 leading-5 opacity-85">{activeItem.aiContextRationale}</p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Situation presets */}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Cenário</h3>
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>IA seleciona ao gerar</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CONVERSATION_SITUATION_PRESETS.map((preset) => {
                        const activeOption = activeItem.selectedSituationPresetIds.includes(preset.id);
                        return (
                          <Button
                            key={preset.id} type="button"
                            variant={activeOption ? 'primary' : 'soft'} size="sm"
                            onClick={() => handleToggleSituationPreset(preset.id)}
                            disabled={phase !== 'ready'}
                            title={activeOption ? `Remover cenário: ${preset.label}` : `Aplicar cenário: ${preset.label}`}
                          >
                            {activeOption && <Check className="h-3.5 w-3.5" />}
                            {preset.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tone selector */}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tom</h3>
                      <span className="text-[11px] font-medium" style={{ color: 'var(--accent-gold-hover)' }}>
                        {followUpToneOptions.find((o) => o.value === activeItem.tone)?.label ?? 'Consultivo'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tom do follow-up">
                      {followUpToneOptions.map((option) => {
                        const activeOption = activeItem.tone === option.value;
                        return (
                          <button
                            key={option.value} type="button" role="radio"
                            aria-checked={activeOption}
                            onClick={() => handleChangeTone(option.value)}
                            disabled={phase !== 'ready'}
                            title={option.description}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              activeOption
                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--accent-gold-hover)] shadow-sm'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--brand-primary-border)]'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom instructions */}
                  <details className="rounded-2xl border p-3" style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                  }} open={Boolean(activeItem.customInstructions.trim())}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Instruções extras</h3>
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          Instruções e variáveis para personalizar o follow-up.
                        </p>
                      </div>
                      <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-muted)',
                      }}>
                        {activeItem.customInstructions.trim() ? 'Ativo' : 'Abrir'}
                      </span>
                    </summary>
                    <div className="mt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-secondary)' }}>
                          Instruções personalizadas
                        </span>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          Digite {'{{'} para variáveis
                        </span>
                      </div>
                      <VariableAutocompleteTextarea
                        value={activeItem.customInstructions}
                        onChange={(val) => setItems((prev) => updateItemInList(prev, activeItemIndex!, { customInstructions: val }))}
                        suggestions={WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS}
                        rows={4}
                        size="compact"
                        placeholder={'Ex.:\n- Fale mais curto.\n- Não insista demais.\n- Termine com uma pergunta objetiva.'}
                        disabled={phase !== 'ready' || Boolean(refiningActionId)}
                      />
                    </div>
                  </details>
                </div>
              </div>

              {/* Message area */}
              <div className="rounded-2xl border p-4 shadow-sm" style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-surface)',
              }}>
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Mensagem</h3>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                      Edite o texto final ou refine com um clique.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <div className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--accent-gold-hover)',
                    }}>
                      {activeMessageSegments.length || 1} mensagem(ns)
                    </div>
                    {activeItem.generatedText.trim() ? (
                      <div className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-muted)',
                      }}>
                        {activeItem.generatedText.trim().length} caracteres
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Refinement buttons */}
                <div className="mb-3 flex flex-wrap gap-2" aria-label="Refinamentos da mensagem sugerida">
                  {SIMPLE_REFINEMENT_ACTIONS.map((action) => (
                    <Button
                      key={action.id} type="button" variant="secondary" size="sm"
                      onClick={() => void handleSimpleRefinement(action.id)}
                      loading={refiningActionId === action.id}
                      disabled={phase !== 'ready' || Boolean(refiningActionId) || !activeItem.generatedText.trim()}
                      title={action.description}
                    >
                      {action.label}
                    </Button>
                  ))}
                  {FOLLOW_UP_CONTEXT_REFINEMENT_ACTIONS.map((action) => (
                    <Button
                      key={action.id} type="button" variant="secondary" size="sm"
                      onClick={() => void handleContextRefinement(action)}
                      loading={refiningActionId === action.id}
                      disabled={phase !== 'ready' || Boolean(refiningActionId) || !activeItem.generatedText.trim()}
                      title={action.description}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>

                {/* Variations carousel */}
                {activeItem.variations.length > 0 ? (
                  <div className="mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Variações geradas">
                    {activeItem.variations.map((variation, index) => (
                      <button
                        key={`${variation.label}:${index}`}
                        type="button"
                        onClick={() => setItems((prev) => updateItemInList(prev, activeItemIndex!, { generatedText: variation.text }))}
                        disabled={phase !== 'ready' || Boolean(refiningActionId)}
                        className="min-w-[12rem] max-w-[16rem] rounded-xl border px-3 py-2 text-left text-xs transition hover:border-[var(--brand-primary-border)] disabled:cursor-not-allowed disabled:opacity-60" style={{
                          borderColor: 'var(--border-subtle)',
                          background: 'var(--bg-elevated)',
                        }}
                      >
                        <span className="block truncate font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {variation.label}
                        </span>
                        <span className="mt-1 line-clamp-2 block leading-5" style={{ color: 'var(--text-muted)' }}>
                          {variation.text}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}

                {/* Textarea */}
                <Textarea
                  value={activeItem.generatedText}
                  onChange={(e) => setItems((prev) => updateItemInList(prev, activeItemIndex!, { generatedText: e.target.value }))}
                  rows={8}
                  className="min-h-[200px] text-sm leading-6"
                  placeholder="A sugestão de follow-up vai aparecer aqui. Você também pode escrever manualmente."
                  disabled={phase !== 'ready' || Boolean(refiningActionId)}
                />

                {/* Falha error */}
                {activeItem.status === 'failed' && activeItem.error ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-[var(--danger-text)]">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{activeItem.error}</span>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Preview + Next Action + Techniques */}
            <aside className="space-y-4 xl:sticky xl:top-0 xl:self-start">
              {/* Preview */}
              <div className="rounded-2xl border p-4" style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-elevated)',
              }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      <MessageSquare className="h-4 w-4" />
                      Preview
                    </div>
                    <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                      Como será enviado no WhatsApp.
                    </p>
                  </div>
                  <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-muted)',
                  }}>
                    {activeMessageSegments.length || 1} bloco(s)
                  </span>
                </div>

                <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                  {activeMessageSegments.length > 0 ? (
                    activeMessageSegments.map((segment, index) => (
                      <div key={`${index}:${segment}`} className="rounded-xl border shadow-sm" style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-surface)',
                      }}>
                        <div className="rounded-t-xl border-b px-3 py-2" style={{
                          borderColor: 'var(--border-subtle)',
                          background: 'var(--bg-elevated)',
                        }}>
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--accent-gold-hover)' }}>
                            Mensagem {index + 1}
                          </span>
                        </div>
                        <div className="p-3">
                          <p className="whitespace-pre-wrap break-words text-sm leading-6" style={{ color: 'var(--text-primary)' }}>
                            {segment}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border-2 border-dashed px-4 py-10 text-center" style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'var(--bg-surface)',
                    }}>
                      <MessageSquare className="mx-auto mb-2 h-8 w-8" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Gere ou escreva uma sugestão para visualizar.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Next action */}
              {activeItem.nextAction ? (
                <div className="rounded-2xl border p-4 shadow-sm" style={{
                  borderColor: 'var(--brand-primary-border)',
                  background: 'var(--bg-surface)',
                }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        <CalendarPlus className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
                        Próxima ação sugerida
                      </div>
                      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                        {activeItem.nextAction.reason}
                      </p>
                    </div>
                    <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--accent-gold-hover)',
                    }}>
                      {activeItem.nextAction.type === 'schedule' ? 'Agendar' : activeItem.nextAction.type === 'wait' ? 'Aguardar' : 'Perdido?'}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2" style={{ color: 'var(--text-secondary)' }}>
                    <div className="rounded-xl border px-3 py-2" style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'var(--bg-elevated)',
                    }}>
                      <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatNextActionDate(activeItem.nextAction.suggestedDateTime)}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        Tentativa {activeItem.nextAction.attemptNumber}/{activeItem.nextAction.maxAttempts}
                      </div>
                    </div>
                    <div className="rounded-xl border px-3 py-2" style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'var(--bg-elevated)',
                    }}>
                      <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Prioridade {activeItem.nextAction.priority}
                      </div>
                      <div className="mt-0.5">
                        Dia: {activeItem.nextAction.dayLoad ?? 0}/{activeItem.nextAction.dailyCapacity} pendentes
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                    {activeItem.nextAction.giveUpRecommendation}
                  </p>
                </div>
              ) : null}

              {/* Sales techniques */}
              <details className="group rounded-2xl border p-4" style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-surface)',
              }} open={activeItem.selectedSalesTechniques.length > 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Técnicas avançadas</h3>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Opcional para a próxima geração.
                    </p>
                  </div>
                  <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-muted)',
                  }}>
                    {activeItem.selectedSalesTechniques.length || 'Abrir'}
                  </span>
                </summary>
                <div className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1" role="group" aria-label="Técnicas de venda para o follow-up">
                  {followUpSalesTechniqueOptions.map((technique) => {
                    const selected = activeItem.selectedSalesTechniques.includes(technique.id);
                    return (
                      <button
                        key={technique.id} type="button"
                        onClick={() => handleToggleSalesTechnique(technique.id)}
                        aria-pressed={selected}
                        disabled={phase !== 'ready'}
                        title={technique.description}
                        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          selected
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--accent-gold-hover)] shadow-sm'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--brand-primary)]'
                        }`}
                      >
                        {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border" style={{ borderColor: 'var(--border-subtle)' }} />}
                        <span>{technique.name}</span>
                      </button>
                    );
                  })}
                </div>
              </details>
            </aside>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Selecione um lead na lista ao lado.
            </p>
          </div>
        )}
      </div>
    </WhatsAppDialog>
  );
}
