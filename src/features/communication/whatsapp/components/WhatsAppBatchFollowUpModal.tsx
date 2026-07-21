import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarPlus, Check, CheckCircle2, Clock3, Loader2, MessageSquare, RotateCcw, Send, Settings, Sparkles, X } from 'lucide-react';

import { Button, Progress, Stepper, Textarea } from '../../../../design-system';
import VariableAutocompleteTextarea from '../../../../components/ui/VariableAutocompleteTextarea';
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS } from '../../../../lib/templateVariableSuggestions';
import { splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { commWhatsAppService, type CommWhatsAppFollowUpNextAction, type CommWhatsAppFollowUpTone, type CommWhatsAppFollowUpVariation, type CommWhatsAppRewriteTone } from '../../../../lib/commWhatsAppService';
import { toast } from '../../../../lib/toast';
import { followUpSalesTechniqueOptions } from './followUpSalesTechniques';
import { CONVERSATION_SITUATION_PRESETS } from './followUpSituationPresets';
import WhatsAppDialog from './WhatsAppDialog';

// ---- Constants ----

const CONCURRENCY = 3;

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

const SIMPLE_REFINEMENT_ACTIONS: Array<{
  id: CommWhatsAppRewriteTone;
  label: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  { id: 'shorter', label: 'Encurtar', description: 'Reescrever de forma mais curta e objetiva.', icon: X },
  { id: 'friendly', label: 'Suavizar', description: 'Deixar mais leve, humana e acolhedora.', icon: Sparkles },
  { id: 'assertive', label: 'Objetivar', description: 'Tornar o próximo passo mais claro.', icon: Check },
  { id: 'professional', label: 'Profissionalizar', description: 'Ajustar para tom consultivo e profissional.', icon: Settings },
];

const FOLLOW_UP_CONTEXT_REFINEMENT_ACTIONS: Array<{
  id: string;
  label: string;
  description: string;
  instruction: string;
}> = [
  {
    id: 'add-context',
    label: 'Usar contexto',
    description: 'Refinar considerando o histórico da conversa.',
    instruction: 'Refine a mensagem usando o contexto completo do chat. Preserve apenas fatos confirmados no histórico e deixe o próximo passo mais coerente com a conversa.',
  },
  {
    id: 'reduce-pressure',
    label: 'Menos pressão',
    description: 'Diminuir insistência e cobrança.',
    instruction: 'Refine a mensagem para reduzir pressão e cobrança. Mantenha cordialidade, naturalidade e uma pergunta simples para facilitar resposta.',
  },
  {
    id: 'clear-next-step',
    label: 'Próximo passo',
    description: 'Reforçar ação objetiva.',
    instruction: 'Refine a mensagem para terminar com um próximo passo claro, simples e fácil de responder, sem inventar combinados ou dados.',
  },
];

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
  const [configOpen, setConfigOpen] = useState(false);
  const cancelRequestedRef = useRef(false);

  const currentStep = phase === 'loading' ? 0 : phase === 'generating' ? 1 : phase === 'sending' ? 3 : phase === 'sent' ? 4 : items.some((i) => i.status === 'pending') ? 1 : 2;

  const steps = [
    { label: 'Carregar', description: 'Buscando pendências' },
    { label: 'Gerar', description: 'Criar sugestões IA' },
    { label: 'Revisar', description: 'Ajustar mensagens' },
    { label: 'Enviar', description: 'Disparar mensagens' },
    { label: 'Concluído', description: 'Resumo do envio' },
  ];

  // Load pending chats on open
  useEffect(() => {
    if (!isOpen) return;

    cancelRequestedRef.current = false;
    setPhase('loading');
    setActiveItemIndex(null);
    setSentSummary(null);
    setConfigOpen(false);

    void (async () => {
      try {
        const pendingChats = await commWhatsAppService.getPendingFollowUpChats();
        const seenReminderIds = new Set<string>();
        const mapped: BatchItemState[] = pendingChats.filter((chat) => {
          if (seenReminderIds.has(chat.reminder_id)) return false;
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
        if (mapped.length > 0) setActiveItemIndex(0);
        setPhase('ready');
        if (mapped.length === 0) toast.info('Nenhum follow-up pendente para hoje.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar follow-ups pendentes.');
        onClose();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const activeItem = activeItemIndex !== null ? items[activeItemIndex] : null;
  const activeMessageSegments = useMemo(
    () => (activeItem ? splitWhatsAppMessageSegments(activeItem.generatedText) : []),
    [activeItem],
  );

  const pendingCount = items.filter((i) => i.status === 'pending' && i.selected).length;
  const readyCount = items.filter((i) => i.status === 'ready' && i.selected).length;
  const failedGenCount = items.filter((i) => i.status === 'failed' && i.selected).length;
  const currentSendingItem = items.find((i) => i.sendStatus === 'sending') ?? null;
  const totalCount = items.length;
  const selectedCount = items.filter((i) => i.selected).length;
  const allSelected = items.length > 0 && items.every((i) => i.selected);

  const sendingItems = items.filter((i) => i.selected && ['queued', 'sending', 'sent', 'failed'].includes(i.sendStatus));
  const sentItemsCount = sendingItems.filter((i) => i.sendStatus === 'sent').length;
  const failedItemsCount = sendingItems.filter((i) => i.sendStatus === 'failed').length;
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

  const handleContextRefinement = async (action: typeof FOLLOW_UP_CONTEXT_REFINEMENT_ACTIONS[number]) => {
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

  // ---- Batch apply config to all ----

  const handleBatchApplyTone = (tone: CommWhatsAppFollowUpTone) => {
    setItems((prev) => prev.map((it) => ({
      ...it,
      tone,
      manualContext: { ...it.manualContext, tone: true },
    })));
    toast.success(`Tom "${followUpToneOptions.find((o) => o.value === tone)?.label}" aplicado a todos.`);
  };

  const handleBatchApplySituationPreset = (presetId: string) => {
    setItems((prev) => prev.map((it) => {
      const current = it.selectedSituationPresetIds;
      const next = current.includes(presetId) ? current.filter((id) => id !== presetId) : [...current, presetId];
      return {
        ...it,
        selectedSituationPresetIds: next,
        manualContext: { ...it.manualContext, situationPresetIds: next.length > 0 },
      };
    }));
    toast.success('Cenário atualizado para todos os leads.');
  };

  // ---- Bulk generate ----

  const handleGenerateAll = async () => {
    const targetIndices = items
      .map((it, idx) => (it.status === 'pending' && it.selected ? idx : -1))
      .filter((idx) => idx !== -1);

    if (targetIndices.length === 0) {
      if (items.some((it) => it.selected && it.status === 'ready')) {
        toast.info('Todos os selecionados já foram gerados.');
      } else {
        toast.warning('Nenhum item pendente para gerar.');
      }
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
      if (!readyItems.some((readyItem) => readyItem.reminderId === item.reminderId)) return item;
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
          ? { ...item, sendStatus: 'failed', sendError: error instanceof Error ? error.message : 'Erro desconhecido ao enviar.' }
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
    if (phase === 'generating') cancelRequestedRef.current = true;
    onClose();
  };

  // ---- Render: sent state ----

  if (phase === 'sent' && sentSummary) {
    return (
      <WhatsAppDialog isOpen={isOpen} onClose={onClose} title="Follow-ups em lote" description="" size="xl" panelClassName="max-w-[90rem]"
        footer={<div className="flex items-center justify-end gap-2"><Button variant="secondary" onClick={onClose}>Fechar</Button></div>}
      >
        <div className="flex flex-col items-center gap-6 py-12">
          <div className="rounded-full border-4 p-4" style={{ borderColor: 'var(--success)', background: 'var(--success-soft)' }}>
            <CheckCircle2 className="h-10 w-10" style={{ color: 'var(--success-text)' }} />
          </div>
          <div className="text-center">
            <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Follow-ups enviados</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Resumo do disparo em lote</p>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2.5 rounded-xl border px-5 py-3 shadow-sm" style={{ borderColor: 'var(--success-border)', background: 'var(--success-soft)' }}>
              <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--success-text)' }} />
              <div>
                <p className="text-lg font-bold" style={{ color: 'var(--success-text)' }}>{sentSummary.sentCount}</p>
                <p className="text-xs font-medium" style={{ color: 'var(--success-text)' }}>enviado(s)</p>
              </div>
            </div>
            {sentSummary.scheduledCount > 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border px-5 py-3 shadow-sm" style={{ borderColor: 'var(--info-border)', background: 'var(--info-soft)' }}>
                <CalendarPlus className="h-5 w-5" style={{ color: 'var(--info-text)' }} />
                <div>
                  <p className="text-lg font-bold" style={{ color: 'var(--info-text)' }}>{sentSummary.scheduledCount}</p>
                  <p className="text-xs font-medium" style={{ color: 'var(--info-text)' }}>agendado(s)</p>
                </div>
              </div>
            ) : null}
            {sentSummary.failedCount > 0 ? (
              <div className="flex items-center gap-2.5 rounded-xl border px-5 py-3 shadow-sm" style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-soft)' }}>
                <AlertCircle className="h-5 w-5" style={{ color: 'var(--danger-text)' }} />
                <div>
                  <p className="text-lg font-bold" style={{ color: 'var(--danger-text)' }}>{sentSummary.failedCount}</p>
                  <p className="text-xs font-medium" style={{ color: 'var(--danger-text)' }}>falha(s)</p>
                </div>
              </div>
            ) : null}
          </div>
          {sentSummary.errorMessage ? (
            <p className="max-w-md text-center text-sm" style={{ color: 'var(--danger-text)' }}>{sentSummary.errorMessage}</p>
          ) : null}
        </div>
      </WhatsAppDialog>
    );
  }

  // ---- Render: loading state ----

  if (phase === 'loading') {
    return (
      <WhatsAppDialog isOpen={isOpen} onClose={handleClose} title="Follow-ups em lote" description="" size="xl" panelClassName="max-w-[90rem]" footer={null}>
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-5">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--brand-primary)' }} />
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Buscando follow-ups pendentes...</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Aguarde enquanto carregamos os leads com follow-up atrasado.</p>
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
      description={phase === 'sending' ? '' : 'Selecione, gere e envie follow-ups para vários leads de uma vez.'}
      size="xl"
      panelClassName="max-w-[90rem]"
      footer={
        <div className="flex items-center justify-between gap-3">
          {/* Left footer: contextual actions */}
          <div className="flex items-center gap-2">
            {phase === 'generating' ? (
              <Button variant="secondary" size="sm" className="rounded-xl" onClick={() => { cancelRequestedRef.current = true; }}>
                Cancelar geração
              </Button>
            ) : phase === 'sending' ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Enviando {sendingFinished} de {sendingTotal}</span>
                </div>
                <Progress value={sendingProgressPercent} size="sm" className="min-w-[160px]" showLabel />
              </div>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => void handleGenerateAll()}
                  disabled={pendingCount === 0}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Gerar {pendingCount} pendente(s)
                </Button>
                {readyCount > 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setConfigOpen((v) => !v)}
                  >
                    <Settings className="mr-1.5 h-4 w-4" />
                    Configurar IA
                  </Button>
                ) : null}
              </>
            )}
          </div>

          {/* Right footer: close + send */}
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
            >
              {phase === 'sending' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
              {phase === 'sending' ? `Enviando (${sendingFinished}/${sendingTotal})` : `Enviar ${readyCount} selecionado(s)`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-[520px] flex-col gap-4">
        {/* Stepper header */}
        <div className="px-1">
          <Stepper currentStep={currentStep} steps={steps} />
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}>
              {selectedCount}/{totalCount} selecionados
            </span>
            {pendingCount > 0 ? (
              <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{
                background: 'var(--warning-soft)',
                color: 'var(--warning-text)',
              }}>
                {pendingCount} pendente(s)
              </span>
            ) : null}
            {readyCount > 0 ? (
              <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{
                background: 'var(--success-soft)',
                color: 'var(--success-text)',
              }}>
                {readyCount} pronto(s)
              </span>
            ) : null}
            {failedGenCount > 0 ? (
              <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider" style={{
                background: 'var(--danger-soft)',
                color: 'var(--danger-text)',
              }}>
                {failedGenCount} falha(s)
              </span>
            ) : null}
          </div>
          {phase === 'sending' ? (
            <span className="text-xs font-semibold" style={{ color: currentSendingItem ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
              {currentSendingItem ? `Enviando: ${currentSendingItem.leadName || 'Sem nome'}` : 'Finalizando...'}
            </span>
          ) : null}
        </div>

        {/* Main content */}
        <div className="flex min-h-0 flex-1 gap-5 overflow-hidden">
          {/* Sidebar */}
          <aside className="flex w-[248px] shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Leads
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-[11px] font-semibold transition hover:opacity-70"
                style={{ color: 'var(--brand-primary)' }}
                disabled={phase === 'sending'}
              >
                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto pr-1.5">
              {items.map((item, index) => {
                const isActive = activeItemIndex === index;

                let statusDot: 'pending' | 'generating' | 'ready' | 'failed' | 'sending' | 'sent' | 'error';
                if (phase === 'sending') {
                  if (item.sendStatus === 'sending') statusDot = 'sending';
                  else if (item.sendStatus === 'sent') statusDot = 'sent';
                  else if (item.sendStatus === 'failed') statusDot = 'error';
                  else if (item.sendStatus === 'queued') statusDot = 'pending';
                  else statusDot = item.status === 'ready' ? 'ready' : 'pending';
                } else {
                  statusDot = item.status === 'generating' ? 'generating' : item.status === 'ready' ? 'ready' : item.status === 'failed' ? 'failed' : 'pending';
                }

                const statusColors: Record<string, { dot: string; bg: string }> = {
                  pending: { dot: 'var(--text-muted)', bg: 'transparent' },
                  generating: { dot: 'var(--brand-primary)', bg: 'var(--brand-primary-soft)' },
                  ready: { dot: 'var(--success)', bg: 'var(--success-soft)' },
                  failed: { dot: 'var(--danger)', bg: 'var(--danger-soft)' },
                  sending: { dot: 'var(--brand-primary)', bg: 'var(--brand-primary-soft)' },
                  sent: { dot: 'var(--success)', bg: 'var(--success-soft)' },
                  error: { dot: 'var(--danger)', bg: 'var(--danger-soft)' },
                };

                const colors = statusColors[statusDot];

                return (
                  <div key={item.reminderId} className="flex items-center gap-1.5">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${phase === 'sending' ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      style={{
                        borderColor: item.selected ? 'var(--brand-primary)' : 'var(--border-default)',
                        background: item.selected ? 'var(--brand-primary)' : 'transparent',
                      }}
                      onClick={() => { if (phase !== 'sending') handleToggleSelect(item.chatId); }}
                    >
                      {item.selected && <Check className="h-3 w-3" style={{ color: 'var(--text-on-brand)' }} />}
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveItemIndex(index)}
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${
                        isActive
                          ? 'shadow-sm'
                          : 'hover:bg-[var(--bg-elevated)]'
                      }`}
                      style={{
                        background: isActive ? colors.bg || 'var(--bg-elevated)' : 'transparent',
                        border: isActive ? `1px solid ${colors.dot || 'transparent'}` : '1px solid transparent',
                      }}
                    >
                      <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                        {statusDot === 'generating' || statusDot === 'sending' ? (
                          <Loader2 className="h-3 w-3 animate-spin" style={{ color: colors.dot }} />
                        ) : (
                          <span className="block h-2 w-2 rounded-full" style={{ background: colors.dot }} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                        {item.leadName || 'Sem nome'}
                      </span>
                      {phase === 'sending' && item.sendStatus === 'sending' && item.sendSegmentsTotal > 1 ? (
                        <span className="shrink-0 text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>
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
            <div className="flex min-w-0 flex-1 gap-5 overflow-hidden">
              {/* Main editor */}
              <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
                {/* Message editor card */}
                <div className="rounded-2xl border p-4 shadow-sm" style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--bg-surface)',
                }}>
                  {/* Header */}
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                          {activeItem.leadName || 'Sem nome'}
                        </h3>
                        {activeItem.status === 'ready' ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: 'var(--success)' }} />
                        ) : activeItem.status === 'failed' ? (
                          <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--danger)' }} />
                        ) : null}
                      </div>
                      {activeItem.leadPhone ? (
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{activeItem.leadPhone}</p>
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
                        {activeItem.generatedText.trim() ? 'Regenerar' : 'Gerar'}
                      </Button>
                      <Button
                        variant="soft" size="sm" className="rounded-xl"
                        loading={activeItem.status === 'generating'}
                        disabled={activeItem.status === 'generating' || phase === 'sending'}
                        onClick={() => void handleGenerateItem(activeItemIndex!, { variantCount: 3 })}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        3 opções
                      </Button>
                    </div>
                  </div>

                  {/* AI Context Rationale */}
                  {activeItem.aiContextRationale ? (
                    <div className="mb-4 rounded-xl border px-3 py-2.5 text-xs leading-5" style={{
                      borderColor: 'var(--brand-primary-border)',
                      background: 'var(--brand-primary-soft)',
                      color: 'var(--accent-gold-hover)',
                    }}>
                      <div className="flex items-center gap-2 font-semibold">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                        <span>Contexto aplicado pela IA</span>
                      </div>
                      <p className="mt-1 opacity-85">{activeItem.aiContextRationale}</p>
                    </div>
                  ) : null}

                  {/* Variations carousel */}
                  {activeItem.variations.length > 0 ? (
                    <div className="mb-4">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Variações disponíveis
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {activeItem.variations.map((variation, index) => (
                          <button
                            key={`${variation.label}:${index}`}
                            type="button"
                            onClick={() => setItems((prev) => updateItemInList(prev, activeItemIndex!, { generatedText: variation.text }))}
                            disabled={phase !== 'ready' || Boolean(refiningActionId)}
                            className="min-w-[14rem] max-w-[18rem] rounded-xl border px-3 py-2.5 text-left text-xs transition hover:border-[var(--brand-primary-border)] disabled:cursor-not-allowed disabled:opacity-60"
                            style={{
                              borderColor: 'var(--border-subtle)',
                              background: 'var(--bg-elevated)',
                            }}
                          >
                            <span className="block truncate font-bold" style={{ color: 'var(--text-primary)' }}>
                              {variation.label}
                            </span>
                            <span className="mt-1.5 line-clamp-2 block leading-5" style={{ color: 'var(--text-muted)' }}>
                              {variation.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Textarea with word count */}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      Mensagem
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{
                        borderColor: 'var(--border-subtle)',
                        background: 'var(--bg-elevated)',
                        color: 'var(--accent-gold-hover)',
                      }}>
                        {activeMessageSegments.length || 1} blocos
                      </span>
                      {activeItem.generatedText.trim() ? (
                        <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{
                          borderColor: 'var(--border-subtle)',
                          background: 'var(--bg-elevated)',
                          color: 'var(--text-muted)',
                        }}>
                          {activeItem.generatedText.trim().length} caracteres
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Textarea
                    value={activeItem.generatedText}
                    onChange={(e) => setItems((prev) => updateItemInList(prev, activeItemIndex!, { generatedText: e.target.value }))}
                    rows={6}
                    className="min-h-[160px] text-sm leading-6"
                    placeholder="A sugestão de follow-up vai aparecer aqui. Você também pode escrever manualmente."
                    disabled={phase !== 'ready' || Boolean(refiningActionId)}
                  />

                  {/* Refinement toolbar */}
                  {activeItem.generatedText.trim() ? (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Refinar:</span>
                      {SIMPLE_REFINEMENT_ACTIONS.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => void handleSimpleRefinement(action.id)}
                            disabled={phase !== 'ready' || Boolean(refiningActionId)}
                            title={action.description}
                            className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition hover:border-[var(--brand-primary-border)] disabled:cursor-not-allowed disabled:opacity-50"
                            style={{
                              borderColor: 'var(--border-subtle)',
                              background: 'var(--bg-elevated)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {refiningActionId === action.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Icon className="h-3 w-3" />
                            )}
                            {action.label}
                          </button>
                        );
                      })}
                      <span className="mx-1 h-4 w-px" style={{ background: 'var(--border-subtle)' }} />
                      {FOLLOW_UP_CONTEXT_REFINEMENT_ACTIONS.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          onClick={() => void handleContextRefinement(action)}
                          disabled={phase !== 'ready' || Boolean(refiningActionId)}
                          title={action.description}
                          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition hover:border-[var(--brand-primary-border)] disabled:cursor-not-allowed disabled:opacity-50"
                          style={{
                            borderColor: 'var(--border-subtle)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {refiningActionId === action.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* Error state */}
                  {activeItem.status === 'failed' && activeItem.error ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2" style={{
                      borderColor: 'var(--danger-border)',
                      background: 'var(--danger-soft)',
                    }}>
                      <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'var(--danger-text)' }} />
                      <span className="text-xs" style={{ color: 'var(--danger-text)' }}>{activeItem.error}</span>
                    </div>
                  ) : null}
                </div>
              </section>

              {/* Right panel: Preview + Config */}
              <aside className="flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto">
                {/* WhatsApp Preview */}
                <div className="rounded-2xl border p-4 shadow-sm" style={{
                  borderColor: 'var(--border-subtle)',
                  background: 'var(--bg-elevated)',
                }}>
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    <MessageSquare className="h-4 w-4" />
                    Preview WhatsApp
                  </div>
                  <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                    {activeMessageSegments.length > 0 ? (
                      activeMessageSegments.map((segment, index) => (
                        <div key={`${index}:${segment}`} className="flex flex-col items-start">
                          <div className="max-w-[90%] rounded-2xl rounded-bl-sm border px-4 py-3 shadow-sm" style={{
                            borderColor: 'var(--border-subtle)',
                            background: 'var(--bg-surface)',
                          }}>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6" style={{ color: 'var(--text-primary)' }}>
                              {segment}
                            </p>
                          </div>
                          <div className="mt-1 flex items-center gap-2 pl-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent-gold-hover)' }}>
                              Bloco {index + 1}
                            </span>
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
                        <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                          <CalendarPlus className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
                          Próxima ação
                        </div>
                        <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-muted)' }}>
                          {activeItem.nextAction.reason}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{
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
                        <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
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
                        <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
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

                {/* Configuração da IA accordion */}
                <details
                  className="rounded-2xl border shadow-sm"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--bg-surface)',
                  }}
                  open={configOpen || activeItem.customInstructions.trim().length > 0 || activeItem.selectedSalesTechniques.length > 0}
                  onToggle={(e) => setConfigOpen(e.currentTarget.open)}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                      <div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Configurar IA</h3>
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          Tom, cenário, técnicas e instruções
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{
                      borderColor: 'var(--border-subtle)',
                      background: 'var(--bg-elevated)',
                      color: 'var(--text-muted)',
                    }}>
                      {configOpen ? 'Recolher' : 'Abrir'}
                    </span>
                  </summary>
                  <div className="space-y-4 border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                    {/* Tone */}
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Tom</h4>
                        <button
                          type="button"
                          className="text-[10px] font-semibold underline transition hover:opacity-70"
                          style={{ color: 'var(--brand-primary)' }}
                          onClick={() => handleBatchApplyTone(activeItem.tone)}
                          disabled={phase !== 'ready'}
                        >
                          Aplicar a todos
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {followUpToneOptions.map((option) => {
                          const activeOption = activeItem.tone === option.value;
                          return (
                            <button
                              key={option.value} type="button"
                              onClick={() => handleChangeTone(option.value)}
                              disabled={phase !== 'ready'}
                              title={option.description}
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                activeOption
                                  ? 'shadow-sm'
                                  : 'hover:border-[var(--brand-primary-border)]'
                              }`}
                              style={{
                                borderColor: activeOption ? 'var(--brand-primary)' : 'var(--border-subtle)',
                                background: activeOption ? 'var(--brand-primary-soft)' : 'var(--bg-elevated)',
                                color: activeOption ? 'var(--accent-gold-hover)' : 'var(--text-secondary)',
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Situation presets */}
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Cenário</h4>
                        <button
                          type="button"
                          className="text-[10px] font-semibold underline transition hover:opacity-70"
                          style={{ color: 'var(--brand-primary)' }}
                          onClick={() => {
                            const activePresets = activeItem.selectedSituationPresetIds;
                            if (activePresets.length > 0) {
                              activePresets.forEach((id) => handleBatchApplySituationPreset(id));
                            } else {
                              handleBatchApplySituationPreset(CONVERSATION_SITUATION_PRESETS[0].id);
                            }
                          }}
                          disabled={phase !== 'ready'}
                        >
                          Aplicar a todos
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {CONVERSATION_SITUATION_PRESETS.map((preset) => {
                          const activeOption = activeItem.selectedSituationPresetIds.includes(preset.id);
                          return (
                            <button
                              key={preset.id} type="button"
                              onClick={() => handleToggleSituationPreset(preset.id)}
                              disabled={phase !== 'ready'}
                              title={activeOption ? `Remover: ${preset.label}` : `Aplicar: ${preset.label}`}
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                activeOption ? 'shadow-sm' : 'hover:border-[var(--brand-primary-border)]'
                              }`}
                              style={{
                                borderColor: activeOption ? 'var(--brand-primary)' : 'var(--border-subtle)',
                                background: activeOption ? 'var(--brand-primary-soft)' : 'var(--bg-elevated)',
                                color: activeOption ? 'var(--accent-gold-hover)' : 'var(--text-secondary)',
                              }}
                            >
                              {activeOption && <Check className="mr-1 inline h-3 w-3" />}
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sales techniques */}
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Técnicas avançadas
                      </h4>
                      <div className="max-h-32 space-y-1 overflow-y-auto pr-1" role="group" aria-label="Técnicas de venda">
                        {followUpSalesTechniqueOptions.map((technique) => {
                          const selected = activeItem.selectedSalesTechniques.includes(technique.id);
                          return (
                            <button
                              key={technique.id} type="button"
                              onClick={() => handleToggleSalesTechnique(technique.id)}
                              aria-pressed={selected}
                              disabled={phase !== 'ready'}
                              title={technique.description}
                              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-left text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                selected
                                  ? 'shadow-sm'
                                  : 'hover:border-[var(--brand-primary)]'
                              }`}
                              style={{
                                borderColor: selected ? 'var(--brand-primary)' : 'var(--border-subtle)',
                                background: selected ? 'var(--brand-primary-soft)' : 'var(--bg-elevated)',
                                color: selected ? 'var(--accent-gold-hover)' : 'var(--text-secondary)',
                              }}
                            >
                              {selected ? <Check className="h-3 w-3 shrink-0" /> : <span className="h-3 w-3 shrink-0 rounded-full border" style={{ borderColor: 'var(--border-subtle)' }} />}
                              <span>{technique.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom instructions */}
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        Instruções extras
                      </h4>
                      <VariableAutocompleteTextarea
                        value={activeItem.customInstructions}
                        onChange={(val) => setItems((prev) => updateItemInList(prev, activeItemIndex!, { customInstructions: val }))}
                        suggestions={WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS}
                        rows={3}
                        size="compact"
                        placeholder={'Ex.: Fale mais curto, não insista, termine com pergunta objetiva.'}
                        disabled={phase !== 'ready' || Boolean(refiningActionId)}
                      />
                    </div>
                  </div>
                </details>
              </aside>
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10" style={{ color: 'var(--text-muted)' }} />
                <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Nenhum lead carregado
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Selecione um lead na lista ao lado para começar.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </WhatsAppDialog>
  );
}
