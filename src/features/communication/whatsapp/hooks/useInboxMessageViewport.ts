import { useCallback, useEffect, useLayoutEffect, type Dispatch, type SetStateAction } from 'react';

import {
  applyInboxMessageScrollPosition,
  isInboxMessageViewportNearBottom,
  type InboxMessageScrollRefs,
} from '../domain/inboxMessageScroll';
import type { CommWhatsAppMessage } from '../domain/types';

type CurrentValue<Value> = { current: Value };

type InboxMessageViewportRefs = InboxMessageScrollRefs & {
  messagesContainerRef: CurrentValue<HTMLDivElement | null>;
  messageBubbleRefs: CurrentValue<Record<string, HTMLDivElement | null>>;
};

type InboxMessageViewportOptions = {
  refs: InboxMessageViewportRefs;
  messages: CommWhatsAppMessage[];
  localOutgoingMessages: CommWhatsAppMessage[];
  selectedChatId: string | null;
  highlightedMessageId: string | null;
  setHighlightedMessageId: Dispatch<SetStateAction<string | null>>;
  markSelectedChatReadIfEligible: (source: 'scroll') => void;
};

export const useInboxMessageViewport = ({
  refs,
  messages,
  localOutgoingMessages,
  selectedChatId,
  highlightedMessageId,
  setHighlightedMessageId,
  markSelectedChatReadIfEligible,
}: InboxMessageViewportOptions) => {
  const {
    messagesContainerRef,
    messageBubbleRefs,
    pendingScrollModeRef,
    pendingScrollTopRef,
    pendingScrollHeightRef,
    isNearBottomRef,
  } = refs;

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    applyInboxMessageScrollPosition(container, {
      pendingScrollModeRef,
      pendingScrollTopRef,
      pendingScrollHeightRef,
      isNearBottomRef,
    });
  }, [isNearBottomRef, localOutgoingMessages, messages, messagesContainerRef, pendingScrollHeightRef, pendingScrollModeRef, pendingScrollTopRef, selectedChatId]);

  useLayoutEffect(() => {
    if (!highlightedMessageId) {
      return;
    }

    messageBubbleRefs.current[highlightedMessageId]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightedMessageId, messageBubbleRefs, messages]);

  useEffect(() => {
    if (!highlightedMessageId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedMessageId((current) => (current === highlightedMessageId ? null : current));
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedMessageId, setHighlightedMessageId]);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    isNearBottomRef.current = isInboxMessageViewportNearBottom(container);
    if (isNearBottomRef.current) {
      markSelectedChatReadIfEligible('scroll');
    }
  }, [isNearBottomRef, markSelectedChatReadIfEligible, messagesContainerRef]);

  return { handleMessagesScroll };
};
