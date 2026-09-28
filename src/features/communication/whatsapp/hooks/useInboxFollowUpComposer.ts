import { useCallback, useEffect, useRef, useState } from 'react';

import {
  scheduleInboxFollowUp,
  updateInboxFollowUpSentAudit,
  whatsappFollowUpService,
  type CommWhatsAppFollowUpEmotionalContext,
  type CommWhatsAppFollowUpNextAction,
  type CommWhatsAppFollowUpVariation,
} from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { splitWhatsAppMessageSegments } from '../../../../lib/whatsAppMessageSegments';
import { toast } from '../../../../lib/toast';

type CurrentValue<Value> = { current: Value };

type SendFollowUpSegments = (
  chat: CommWhatsAppChat,
  textSegments: string[],
  quotePayload: null,
  onSent?: () => void | Promise<void>,
) => Promise<void>;

type UseInboxFollowUpComposerOptions = {
  selectedChat: CommWhatsAppChat | null;
  selectedChatIdRef: CurrentValue<string | null>;
  selectedChatDisplayName: string;
  generatingFollowUp: boolean;
  setGeneratingFollowUp: (value: boolean) => void;
  leadPanelId: string | null;
  leadContracts: Array<{ id: string }>;
  canEditAgenda: boolean;
  followUpGenerationBaseDisabledReason: string | null;
  sendDisabledReason: string | null;
  loadChatAgendaSummary: (leadId: string | null, contractIds?: string[]) => Promise<void>;
  sendTextSegments: SendFollowUpSegments;
};

export const useInboxFollowUpComposer = ({
  selectedChat,
  selectedChatIdRef,
  selectedChatDisplayName,
  generatingFollowUp,
  setGeneratingFollowUp,
  leadPanelId,
  leadContracts,
  canEditAgenda,
  followUpGenerationBaseDisabledReason,
  sendDisabledReason,
  loadChatAgendaSummary,
  sendTextSegments,
}: UseInboxFollowUpComposerOptions) => {
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [followUpCustomInstructions, setFollowUpCustomInstructions] = useState('');
  const [followUpVariations, setFollowUpVariations] = useState<CommWhatsAppFollowUpVariation[]>([]);
  const [followUpAiContextRationale, setFollowUpAiContextRationale] = useState<string | null>(null);
  const [followUpEmotionalContext, setFollowUpEmotionalContext] = useState<CommWhatsAppFollowUpEmotionalContext | null>(null);
  const [followUpCurrentAction, setFollowUpCurrentAction] = useState<'send' | 'wait'>('send');
  const [followUpCurrentActionReason, setFollowUpCurrentActionReason] = useState<string | null>(null);
  const [followUpOpportunityRecommendation, setFollowUpOpportunityRecommendation] = useState<'continue' | 'pause' | 'mark_lost_recommended'>('continue');
  const [followUpGenerationId, setFollowUpGenerationId] = useState<string | null>(null);
  const [followUpNextAction, setFollowUpNextAction] = useState<CommWhatsAppFollowUpNextAction | null>(null);
  const [schedulingFollowUpNextAction, setSchedulingFollowUpNextAction] = useState(false);
  const followUpGenerationRequestIdRef = useRef(0);
  const followUpScheduleRequestIdRef = useRef(0);

  const resetFollowUpComposer = useCallback(() => {
    setFollowUpDraft('');
    setFollowUpCustomInstructions('');
    setFollowUpVariations([]);
    setFollowUpAiContextRationale(null);
    setFollowUpEmotionalContext(null);
    setFollowUpCurrentAction('send');
    setFollowUpCurrentActionReason(null);
    setFollowUpOpportunityRecommendation('continue');
    setFollowUpGenerationId(null);
    setFollowUpNextAction(null);
  }, []);

  const invalidateFollowUpRequests = useCallback(() => {
    followUpGenerationRequestIdRef.current += 1;
    followUpScheduleRequestIdRef.current += 1;
  }, []);

  useEffect(() => {
    invalidateFollowUpRequests();
    setFollowUpModalOpen(false);
    setGeneratingFollowUp(false);
    setSchedulingFollowUpNextAction(false);
    resetFollowUpComposer();
  }, [invalidateFollowUpRequests, leadPanelId, resetFollowUpComposer, selectedChat?.id, selectedChat?.lead_id, setGeneratingFollowUp]);

  useEffect(() => () => {
    invalidateFollowUpRequests();
  }, [invalidateFollowUpRequests, setGeneratingFollowUp]);

  const handleCloseFollowUpModal = useCallback(() => {
    invalidateFollowUpRequests();
    setGeneratingFollowUp(false);
    setSchedulingFollowUpNextAction(false);
    setFollowUpModalOpen(false);
  }, [invalidateFollowUpRequests, setGeneratingFollowUp]);

  const handleGenerateFollowUp = useCallback(async (customInstructions: string) => {
    if (!selectedChat || followUpGenerationBaseDisabledReason || generatingFollowUp) {
      return;
    }

    const requestId = ++followUpGenerationRequestIdRef.current;
    const targetChatId = selectedChat.id;
    console.debug('[FollowUpAI][inbox] request', {
      chatId: selectedChat.id,
      customInstructions,
      selectedChat,
    });
    setGeneratingFollowUp(true);

    try {
      const result = await whatsappFollowUpService.generate(selectedChat.id, {
        customInstructions,
        triggerSource: 'individual',
      });
      console.debug('[FollowUpAI][inbox] response', {
        requestId,
        chatId: selectedChat.id,
        result,
      });
      if (requestId !== followUpGenerationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        console.debug('[FollowUpAI][inbox] response ignored due to stale request', {
          requestId,
          activeRequestId: followUpGenerationRequestIdRef.current,
          targetChatId,
          selectedChatId: selectedChatIdRef.current,
        });
        return;
      }
      setFollowUpDraft(result.text ?? '');
      setFollowUpVariations(result.variations ?? []);
      setFollowUpCustomInstructions(customInstructions);
      setFollowUpAiContextRationale(result.aiContext?.rationale ?? null);
      setFollowUpEmotionalContext(result.aiContext?.emotionalContext ?? null);
      setFollowUpCurrentAction(result.currentAction ?? 'send');
      setFollowUpCurrentActionReason(result.currentActionReason ?? null);
      setFollowUpOpportunityRecommendation(result.opportunityRecommendation ?? 'continue');
      setFollowUpGenerationId(result.generationId ?? null);
      setFollowUpNextAction(result.nextAction ?? null);
    } catch (error) {
      if (requestId !== followUpGenerationRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        console.debug('[FollowUpAI][inbox] error ignored due to stale request', {
          requestId,
          activeRequestId: followUpGenerationRequestIdRef.current,
          targetChatId,
          selectedChatId: selectedChatIdRef.current,
          error,
        });
        return;
      }
      console.error('[WhatsAppInbox] erro ao gerar follow-up', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível gerar o follow-up com IA.');
    } finally {
      if (requestId === followUpGenerationRequestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setGeneratingFollowUp(false);
      }
    }
  }, [followUpGenerationBaseDisabledReason, generatingFollowUp, selectedChat, selectedChatIdRef, setGeneratingFollowUp]);

  const followUpGenerationDisabledReason = followUpGenerationBaseDisabledReason
    ?? (generatingFollowUp ? 'Gerando follow-up com IA...' : null);

  const handleOpenFollowUpModal = useCallback(() => {
    if (followUpGenerationDisabledReason) {
      toast.error(followUpGenerationDisabledReason);
      return;
    }

    setFollowUpModalOpen(true);
  }, [followUpGenerationDisabledReason]);

  const handleRegenerateFollowUp = useCallback((options: { customInstructions?: string } = {}) => {
    void handleGenerateFollowUp(options.customInstructions ?? followUpCustomInstructions);
  }, [followUpCustomInstructions, handleGenerateFollowUp]);

  const handleScheduleFollowUpNextAction = useCallback(async () => {
    if (!selectedChat || !followUpNextAction?.suggestedDateTime) {
      return;
    }

    const leadId = selectedChat.lead_id ?? leadPanelId ?? null;
    if (!leadId) {
      toast.error('Vincule um lead antes de agendar a próxima ação.');
      return;
    }

    if (!canEditAgenda) {
      toast.error('Você não tem permissão para editar a agenda.');
      return;
    }

    const requestId = ++followUpScheduleRequestIdRef.current;
    const targetChatId = selectedChat.id;
    setSchedulingFollowUpNextAction(true);
    try {
      const description = [
        followUpNextAction.reason,
        followUpNextAction.giveUpRecommendation,
      ].filter(Boolean).join('\n\n');

      const result = await scheduleInboxFollowUp({
        leadId,
        title: followUpNextAction.title || `Follow-up: ${selectedChatDisplayName}`,
        description: description || null,
        dueAt: followUpNextAction.suggestedDateTime,
        priority: followUpNextAction.priority,
      });

      if (requestId !== followUpScheduleRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      await loadChatAgendaSummary(leadId, leadContracts.map((contract) => contract.id));
      if (requestId !== followUpScheduleRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      toast.success(result.inserted === false ? 'Este follow-up já estava agendado.' : 'Próximo follow-up agendado.');
      setFollowUpNextAction(null);
    } catch (error) {
      if (requestId !== followUpScheduleRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao agendar proxima acao do follow-up', error);
      toast.error('Não foi possível agendar a próxima ação.');
    } finally {
      if (requestId === followUpScheduleRequestIdRef.current && selectedChatIdRef.current === targetChatId) {
        setSchedulingFollowUpNextAction(false);
      }
    }
  }, [canEditAgenda, followUpNextAction, leadContracts, leadPanelId, loadChatAgendaSummary, selectedChat, selectedChatDisplayName, selectedChatIdRef]);

  const handleSendFollowUpDraft = useCallback(async () => {
    if (!selectedChat) {
      return;
    }

    const textSegments = splitWhatsAppMessageSegments(followUpDraft);
    if (textSegments.length === 0) {
      return;
    }

    if (sendDisabledReason) {
      toast.error(sendDisabledReason);
      return;
    }

    try {
      const sentText = textSegments.join('\n\n');
      const generationId = followUpGenerationId;
      sendTextSegments(selectedChat, textSegments, null, generationId
        ? () => updateInboxFollowUpSentAudit(generationId, sentText)
        : undefined);
      resetFollowUpComposer();
      handleCloseFollowUpModal();
    } catch (error) {
      console.error('[WhatsAppInbox] erro ao enviar follow-up', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar o follow-up.');
    }
  }, [followUpDraft, followUpGenerationId, handleCloseFollowUpModal, resetFollowUpComposer, selectedChat, sendDisabledReason, sendTextSegments]);

  return {
    followUpModalOpen,
    followUpDraft,
    setFollowUpDraft,
    followUpCustomInstructions,
    setFollowUpCustomInstructions,
    followUpVariations,
    followUpAiContextRationale,
    followUpEmotionalContext,
    followUpCurrentAction,
    followUpCurrentActionReason,
    followUpOpportunityRecommendation,
    followUpGenerationId,
    followUpNextAction,
    setFollowUpNextAction,
    schedulingFollowUpNextAction,
    generatingFollowUp,
    followUpGenerationDisabledReason,
    resetFollowUpComposer,
    handleCloseFollowUpModal,
    handleGenerateFollowUp,
    handleOpenFollowUpModal,
    handleRegenerateFollowUp,
    handleScheduleFollowUpNextAction,
    handleSendFollowUpDraft,
  };
};
