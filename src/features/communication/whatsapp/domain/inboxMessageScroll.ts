export type InboxMessageScrollMode = 'bottom' | 'preserve' | 'prepend' | null;

type CurrentValue<Value> = { current: Value };

export type InboxMessageScrollRefs = {
  pendingScrollModeRef: CurrentValue<InboxMessageScrollMode>;
  pendingScrollTopRef: CurrentValue<number | null>;
  pendingScrollHeightRef: CurrentValue<number | null>;
  isNearBottomRef: CurrentValue<boolean>;
};

type ScrollContainer = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

export const applyInboxMessageScrollPosition = (
  container: Pick<ScrollContainer, 'scrollTop' | 'scrollHeight'>,
  refs: InboxMessageScrollRefs,
) => {
  if (refs.pendingScrollModeRef.current === 'bottom') {
    container.scrollTop = container.scrollHeight;
    refs.isNearBottomRef.current = true;
  } else if (refs.pendingScrollModeRef.current === 'preserve' && refs.pendingScrollTopRef.current !== null) {
    container.scrollTop = refs.pendingScrollTopRef.current;
  } else if (
    refs.pendingScrollModeRef.current === 'prepend'
    && refs.pendingScrollTopRef.current !== null
    && refs.pendingScrollHeightRef.current !== null
  ) {
    const addedHeight = container.scrollHeight - refs.pendingScrollHeightRef.current;
    container.scrollTop = refs.pendingScrollTopRef.current + Math.max(addedHeight, 0);
  }

  refs.pendingScrollModeRef.current = null;
  refs.pendingScrollTopRef.current = null;
  refs.pendingScrollHeightRef.current = null;
};

export const isInboxMessageViewportNearBottom = (container: ScrollContainer) => (
  container.scrollHeight - container.scrollTop - container.clientHeight <= 96
);
