import { useCallback, useEffect, useRef, useState } from 'react';

import { whatsappFollowUpService, type CommWhatsAppRewriteTone } from '../data';
import { toast } from '../../../../lib/toast';

type ComposerSelection = { start: number; end: number };

type UseInboxComposerAiOptions = {
  selectedChatId: string | null;
  selectedChatIdRef: { current: string | null };
  replySuggestionKey: string;
  replySuggestionDisabledReason: string | null;
  composerRewriteDisabledReason: string | null;
  messageDraft: string;
  messageDraftRef: { current: string };
  setMessageDraft: (value: string | ((current: string) => string)) => void;
  setComposerSelection: (value: ComposerSelection) => void;
  setComposerFocused: (focused: boolean) => void;
  composerTextareaRef: { current: HTMLTextAreaElement | null };
};

export const useInboxComposerAi = ({
  selectedChatId,
  selectedChatIdRef,
  replySuggestionKey,
  replySuggestionDisabledReason,
  composerRewriteDisabledReason,
  messageDraft,
  messageDraftRef,
  setMessageDraft,
  setComposerSelection,
  setComposerFocused,
  composerTextareaRef,
}: UseInboxComposerAiOptions) => {
  const [composerRewriteModalOpen, setComposerRewriteModalOpen] = useState(false);
  const [composerRewriteSource, setComposerRewriteSource] = useState('');
  const [composerRewriteDraft, setComposerRewriteDraft] = useState('');
  const [composerRewriteCustomInstructions, setComposerRewriteCustomInstructions] = useState('');
  const [composerRewriteTone, setComposerRewriteTone] = useState<CommWhatsAppRewriteTone>('grammar');
  const [rewritingComposer, setRewritingComposer] = useState(false);
  const [replySuggestionText, setReplySuggestionText] = useState('');
  const [replySuggestionLoading, setReplySuggestionLoading] = useState(false);
  const [replySuggestionError, setReplySuggestionError] = useState<string | null>(null);
  const [composerAiMenuOpen, setComposerAiMenuOpen] = useState(false);
  const composerRewriteRequestIdRef = useRef(0);
  const composerRewriteModalOpenRef = useRef(false);
  const composerRewriteSourceRef = useRef('');
  const replySuggestionRequestIdRef = useRef(0);
  const replySuggestionKeyRef = useRef('');

  useEffect(() => {
    replySuggestionKeyRef.current = replySuggestionKey;
    replySuggestionRequestIdRef.current += 1;
    setReplySuggestionLoading(false);
    setReplySuggestionText('');
    setReplySuggestionError(null);
  }, [replySuggestionKey]);

  useEffect(() => {
    composerRewriteRequestIdRef.current += 1;
    composerRewriteModalOpenRef.current = false;
    composerRewriteSourceRef.current = '';
    setComposerRewriteModalOpen(false);
    setComposerRewriteSource('');
    setComposerRewriteDraft('');
    setRewritingComposer(false);
    setComposerAiMenuOpen(false);
  }, [selectedChatId]);

  useEffect(() => () => {
    composerRewriteRequestIdRef.current += 1;
    replySuggestionRequestIdRef.current += 1;
  }, []);

  const applyTextToComposer = useCallback((nextValue: string) => {
    const nextCursor = nextValue.length;

    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setComposerFocused(true);

    requestAnimationFrame(() => {
      const target = composerTextareaRef.current;
      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  }, [composerTextareaRef, setComposerFocused, setComposerSelection, setMessageDraft]);

  const handleCloseComposerRewriteModal = useCallback(() => {
    composerRewriteRequestIdRef.current += 1;
    composerRewriteModalOpenRef.current = false;
    composerRewriteSourceRef.current = '';
    setComposerRewriteModalOpen(false);
    setComposerRewriteSource('');
    setComposerRewriteDraft('');
    setComposerRewriteCustomInstructions('');
    setComposerRewriteTone('grammar');
    setRewritingComposer(false);
  }, []);

  const rewriteComposerText = useCallback(async (
    sourceText: string,
    tone: CommWhatsAppRewriteTone,
    customInstructions: string,
    options: { applyToComposer?: boolean; successMessage?: string } = {},
  ) => {
    if (!sourceText.trim()) {
      toast.error('Digite uma mensagem para reescrever com IA.');
      return;
    }

    const requestId = ++composerRewriteRequestIdRef.current;
    const targetChatId = selectedChatId;
    const sourceSnapshot = sourceText;
    setRewritingComposer(true);

    try {
      const result = await whatsappFollowUpService.rewrite({
        message: sourceText,
        chatId: targetChatId,
        tone,
        customInstructions,
      });
      if (requestId !== composerRewriteRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      const rewrittenText = result.text.trim();
      if (options.applyToComposer) {
        if (messageDraftRef.current !== sourceSnapshot) {
          return;
        }
        applyTextToComposer(rewrittenText);
        if (options.successMessage) {
          toast.success(options.successMessage);
        }
      } else {
        if (!composerRewriteModalOpenRef.current || composerRewriteSourceRef.current !== sourceSnapshot) {
          return;
        }
        setComposerRewriteDraft(rewrittenText);
      }
    } catch (error) {
      if (requestId !== composerRewriteRequestIdRef.current || selectedChatIdRef.current !== targetChatId) {
        return;
      }
      console.error('[WhatsAppInbox] erro ao reescrever mensagem do composer', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível reescrever a mensagem com IA.');
    } finally {
      if (requestId === composerRewriteRequestIdRef.current) {
        setRewritingComposer(false);
      }
    }
  }, [applyTextToComposer, selectedChatId, selectedChatIdRef, messageDraftRef]);

  const handleQuickRewriteComposerText = useCallback((tone: CommWhatsAppRewriteTone) => {
    if (composerRewriteDisabledReason || rewritingComposer) {
      toast.error(composerRewriteDisabledReason ?? 'Reescrevendo mensagem com IA...');
      return;
    }

    const successMessage = tone === 'adapt_context'
      ? 'Mensagem adaptada ao contexto.'
      : 'Mensagem corrigida.';
    void rewriteComposerText(messageDraft, tone, '', { applyToComposer: true, successMessage });
  }, [composerRewriteDisabledReason, messageDraft, rewriteComposerText, rewritingComposer]);

  const handleOpenComposerRewriteModal = useCallback(() => {
    if (composerRewriteDisabledReason || rewritingComposer) {
      toast.error(composerRewriteDisabledReason ?? 'Reescrevendo mensagem com IA...');
      return;
    }

    const sourceText = messageDraft;
    composerRewriteRequestIdRef.current += 1;
    composerRewriteModalOpenRef.current = true;
    composerRewriteSourceRef.current = sourceText;
    setComposerRewriteSource(sourceText);
    setComposerRewriteDraft('');
    setComposerRewriteCustomInstructions('');
    setComposerRewriteTone('grammar');
    setComposerRewriteModalOpen(true);
  }, [composerRewriteDisabledReason, messageDraft, rewritingComposer]);

  const handleRegenerateComposerRewrite = useCallback(() => {
    void rewriteComposerText(composerRewriteSource, composerRewriteTone, composerRewriteCustomInstructions);
  }, [composerRewriteCustomInstructions, composerRewriteSource, composerRewriteTone, rewriteComposerText]);

  const handleApplyComposerRewrite = useCallback(() => {
    if (!composerRewriteDraft.trim()) {
      return;
    }

    applyTextToComposer(composerRewriteDraft);
    handleCloseComposerRewriteModal();
  }, [applyTextToComposer, composerRewriteDraft, handleCloseComposerRewriteModal]);

  const handleGenerateReplySuggestion = useCallback(async (manual = false) => {
    if (!selectedChatId || replySuggestionDisabledReason) {
      if (manual && replySuggestionDisabledReason) {
        toast.error(replySuggestionDisabledReason);
      }
      return;
    }

    const requestId = ++replySuggestionRequestIdRef.current;
    const requestKey = replySuggestionKey;

    setReplySuggestionLoading(true);
    setReplySuggestionError(null);

    try {
      const result = await whatsappFollowUpService.suggestReply({
        chatId: selectedChatId,
        composerDraft: messageDraft,
        mode: messageDraft.trim() ? 'complete_draft' : 'suggest_reply',
      });

      if (requestId !== replySuggestionRequestIdRef.current || requestKey !== replySuggestionKeyRef.current) {
        return;
      }

      setReplySuggestionText(result.text.trim());
    } catch (error) {
      if (requestId !== replySuggestionRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao sugerir resposta com IA', error);
      const message = error instanceof Error ? error.message : 'Não foi possível sugerir uma resposta com IA.';
      setReplySuggestionError(message);
      setReplySuggestionText('');
      if (manual) {
        toast.error(message);
      }
    } finally {
      if (requestId === replySuggestionRequestIdRef.current) {
        setReplySuggestionLoading(false);
      }
    }
  }, [messageDraft, replySuggestionDisabledReason, replySuggestionKey, selectedChatId]);

  const handleApplyReplySuggestion = useCallback(() => {
    const nextValue = replySuggestionText.trim();
    if (!nextValue) {
      return;
    }

    const nextCursor = nextValue.length;
    setMessageDraft(nextValue);
    setComposerSelection({ start: nextCursor, end: nextCursor });
    setComposerFocused(true);
    setReplySuggestionText('');
    setReplySuggestionError(null);

    requestAnimationFrame(() => {
      const target = composerTextareaRef.current;
      if (!target) {
        return;
      }

      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  }, [composerTextareaRef, replySuggestionText, setComposerFocused, setComposerSelection, setMessageDraft]);

  const handleDismissReplySuggestion = useCallback(() => {
    setReplySuggestionText('');
    setReplySuggestionError(null);
  }, []);

  return {
    composerAiMenuOpen,
    setComposerAiMenuOpen,
    composerRewriteModalOpen,
    composerRewriteSource,
    setComposerRewriteSource,
    composerRewriteDraft,
    setComposerRewriteDraft,
    composerRewriteCustomInstructions,
    setComposerRewriteCustomInstructions,
    composerRewriteTone,
    setComposerRewriteTone,
    rewritingComposer,
    replySuggestionText,
    replySuggestionLoading,
    replySuggestionError,
    handleCloseComposerRewriteModal,
    handleQuickRewriteComposerText,
    handleOpenComposerRewriteModal,
    handleRegenerateComposerRewrite,
    handleApplyComposerRewrite,
    handleGenerateReplySuggestion,
    handleApplyReplySuggestion,
    handleDismissReplySuggestion,
  };
};
