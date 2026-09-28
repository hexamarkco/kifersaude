import { useLayoutEffect, type Dispatch, type SetStateAction } from 'react';

import {
  createVirtualOverlayAnchorRect,
  getAdvancedFiltersPosition,
  getMediaDrawerPosition,
  getPointerMenuPosition,
  getReactionPickerPosition,
  getThreadActionsMenuPosition,
  type InboxOverlayPosition,
  type InboxPointerAnchor,
} from '../domain/inboxOverlayPosition';

export type { InboxOverlayPosition, InboxPointerAnchor } from '../domain/inboxOverlayPosition';

type CurrentValue<Value> = { current: Value };

type PositionSetter = Dispatch<SetStateAction<InboxOverlayPosition | null>>;

const applyPosition = (setPosition: PositionSetter, nextPosition: InboxOverlayPosition | null) => {
  setPosition((current) => {
    if (!nextPosition) {
      return current === null ? current : null;
    }

    if (
      current
      && current.top === nextPosition.top
      && current.left === nextPosition.left
      && current.width === nextPosition.width
      && current.maxHeight === nextPosition.maxHeight
    ) {
      return current;
    }

    return nextPosition;
  });
};

const subscribeToViewportChanges = (syncPosition: () => void, scheduleSecondFrame = false) => {
  syncPosition();
  const frameId = scheduleSecondFrame ? window.requestAnimationFrame(syncPosition) : null;
  window.addEventListener('resize', syncPosition);
  window.addEventListener('scroll', syncPosition, true);

  return () => {
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
    }
    window.removeEventListener('resize', syncPosition);
    window.removeEventListener('scroll', syncPosition, true);
  };
};

type ElementRef<Element extends HTMLElement> = CurrentValue<Element | null>;

type InboxOverlayPositionRefs = {
  messagesContainerRef: ElementRef<HTMLDivElement>;
  reactionAnchorRefs: CurrentValue<Record<string, HTMLDivElement | null>>;
  messageActionTriggerRefs: CurrentValue<Record<string, HTMLButtonElement | null>>;
  messageActionMenuRef: ElementRef<HTMLDivElement>;
  chatMenuTriggerRefs: CurrentValue<Record<string, HTMLButtonElement | null>>;
  chatMenuRef: ElementRef<HTMLDivElement>;
  advancedFiltersTriggerRef: ElementRef<HTMLButtonElement>;
  threadActionsMenuTriggerRef: ElementRef<HTMLButtonElement>;
  mediaDrawerTriggerRef: ElementRef<HTMLButtonElement>;
};

type UseInboxOverlayPositionsOptions = {
  openReactionPickerMessageId: string | null;
  openMessageActionMenuMessageId: string | null;
  messageActionMenuPointerAnchor: InboxPointerAnchor | null;
  openChatMenuChatId: string | null;
  chatMenuPointerAnchor: InboxPointerAnchor | null;
  advancedFiltersOpen: boolean;
  threadActionsMenuOpen: boolean;
  mediaDrawerOpen: boolean;
  refs: InboxOverlayPositionRefs;
  setReactionPickerPosition: PositionSetter;
  setMessageActionMenuPosition: PositionSetter;
  setChatMenuPosition: PositionSetter;
  setAdvancedFiltersPosition: PositionSetter;
  setThreadActionsMenuPosition: PositionSetter;
  setMediaDrawerPosition: PositionSetter;
};

export const useInboxOverlayPositions = ({
  openReactionPickerMessageId,
  openMessageActionMenuMessageId,
  messageActionMenuPointerAnchor,
  openChatMenuChatId,
  chatMenuPointerAnchor,
  advancedFiltersOpen,
  threadActionsMenuOpen,
  mediaDrawerOpen,
  refs,
  setReactionPickerPosition,
  setMessageActionMenuPosition,
  setChatMenuPosition,
  setAdvancedFiltersPosition,
  setThreadActionsMenuPosition,
  setMediaDrawerPosition,
}: UseInboxOverlayPositionsOptions) => {
  const {
    messagesContainerRef,
    reactionAnchorRefs,
    messageActionTriggerRefs,
    messageActionMenuRef,
    chatMenuTriggerRefs,
    chatMenuRef,
    advancedFiltersTriggerRef,
    threadActionsMenuTriggerRef,
    mediaDrawerTriggerRef,
  } = refs;

  useLayoutEffect(() => {
    if (!openReactionPickerMessageId || typeof window === 'undefined') {
      applyPosition(setReactionPickerPosition, null);
      return;
    }

    const syncPosition = () => {
      const anchor = reactionAnchorRefs.current[openReactionPickerMessageId];
      if (!anchor) {
        applyPosition(setReactionPickerPosition, null);
        return;
      }

      applyPosition(setReactionPickerPosition, getReactionPickerPosition(
        anchor.getBoundingClientRect(),
        messagesContainerRef.current?.getBoundingClientRect() ?? null,
        { width: window.innerWidth, height: window.innerHeight },
      ));
    };

    return subscribeToViewportChanges(syncPosition);
  }, [messagesContainerRef, openReactionPickerMessageId, reactionAnchorRefs, setReactionPickerPosition]);

  useLayoutEffect(() => {
    if (!openMessageActionMenuMessageId || typeof window === 'undefined') {
      applyPosition(setMessageActionMenuPosition, null);
      return;
    }

    const syncPosition = () => {
      const trigger = messageActionMenuPointerAnchor
        ? null
        : messageActionTriggerRefs.current[openMessageActionMenuMessageId];
      if (!trigger && !messageActionMenuPointerAnchor) {
        applyPosition(setMessageActionMenuPosition, null);
        return;
      }

      const anchor = messageActionMenuPointerAnchor
        ? createVirtualOverlayAnchorRect(messageActionMenuPointerAnchor)
        : trigger!.getBoundingClientRect();
      applyPosition(setMessageActionMenuPosition, getPointerMenuPosition({
        anchor,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        menuWidth: 268,
        estimatedHeight: 236,
        minimumMaxHeight: 120,
        measuredHeight: Math.ceil(messageActionMenuRef.current?.getBoundingClientRect().height ?? 0),
      }));
    };

    return subscribeToViewportChanges(syncPosition, true);
  }, [messageActionMenuPointerAnchor, messageActionMenuRef, messageActionTriggerRefs, openMessageActionMenuMessageId, setMessageActionMenuPosition]);

  useLayoutEffect(() => {
    if (!openChatMenuChatId || typeof window === 'undefined') {
      applyPosition(setChatMenuPosition, null);
      return;
    }

    const syncPosition = () => {
      const trigger = chatMenuPointerAnchor ? null : chatMenuTriggerRefs.current[openChatMenuChatId];
      if (!trigger && !chatMenuPointerAnchor) {
        applyPosition(setChatMenuPosition, null);
        return;
      }

      const anchor = chatMenuPointerAnchor
        ? createVirtualOverlayAnchorRect(chatMenuPointerAnchor)
        : trigger!.getBoundingClientRect();
      applyPosition(setChatMenuPosition, getPointerMenuPosition({
        anchor,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        menuWidth: 248,
        estimatedHeight: 232,
        minimumMaxHeight: 160,
        measuredHeight: Math.ceil(chatMenuRef.current?.getBoundingClientRect().height ?? 0),
      }));
    };

    return subscribeToViewportChanges(syncPosition, true);
  }, [chatMenuPointerAnchor, chatMenuRef, chatMenuTriggerRefs, openChatMenuChatId, setChatMenuPosition]);

  useLayoutEffect(() => {
    if (!advancedFiltersOpen || !advancedFiltersTriggerRef.current || typeof window === 'undefined') {
      return;
    }

    const syncPosition = () => {
      const trigger = advancedFiltersTriggerRef.current;
      if (!trigger) {
        return;
      }
      applyPosition(setAdvancedFiltersPosition, getAdvancedFiltersPosition(
        trigger.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
      ));
    };

    return subscribeToViewportChanges(syncPosition);
  }, [advancedFiltersOpen, advancedFiltersTriggerRef, setAdvancedFiltersPosition]);

  useLayoutEffect(() => {
    if (!threadActionsMenuOpen || !threadActionsMenuTriggerRef.current || typeof window === 'undefined') {
      applyPosition(setThreadActionsMenuPosition, null);
      return;
    }

    const syncPosition = () => {
      const trigger = threadActionsMenuTriggerRef.current;
      if (!trigger) {
        return;
      }
      applyPosition(setThreadActionsMenuPosition, getThreadActionsMenuPosition(
        trigger.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
      ));
    };

    return subscribeToViewportChanges(syncPosition);
  }, [setThreadActionsMenuPosition, threadActionsMenuOpen, threadActionsMenuTriggerRef]);

  useLayoutEffect(() => {
    if (!mediaDrawerOpen || !mediaDrawerTriggerRef.current || typeof window === 'undefined') {
      return;
    }

    const syncPosition = () => {
      const trigger = mediaDrawerTriggerRef.current;
      if (!trigger) {
        return;
      }
      applyPosition(setMediaDrawerPosition, getMediaDrawerPosition(
        trigger.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight },
      ));
    };

    return subscribeToViewportChanges(syncPosition);
  }, [mediaDrawerOpen, mediaDrawerTriggerRef, setMediaDrawerPosition]);
};
