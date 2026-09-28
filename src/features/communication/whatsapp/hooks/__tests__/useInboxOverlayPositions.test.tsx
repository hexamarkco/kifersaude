import assert from 'node:assert/strict';
import { act, useState, type SetStateAction } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import {
  type InboxOverlayPosition,
  useInboxOverlayPositions,
} from '../useInboxOverlayPositions';

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
  toJSON: () => ({}),
});

const ignorePosition = (_next: SetStateAction<InboxOverlayPosition | null>) => undefined;

const PositionHarness = ({
  trigger,
  enabled,
  capture,
}: {
  trigger: HTMLButtonElement;
  enabled: boolean;
  capture: (position: InboxOverlayPosition | null) => void;
}) => {
  const [position, setPosition] = useState<InboxOverlayPosition | null>(null);
  useInboxOverlayPositions({
    openReactionPickerMessageId: null,
    openMessageActionMenuMessageId: null,
    messageActionMenuPointerAnchor: null,
    openChatMenuChatId: null,
    chatMenuPointerAnchor: null,
    advancedFiltersOpen: enabled,
    threadActionsMenuOpen: false,
    mediaDrawerOpen: false,
    refs: {
      messagesContainerRef: { current: null },
      reactionAnchorRefs: { current: {} },
      messageActionTriggerRefs: { current: {} },
      messageActionMenuRef: { current: null },
      chatMenuTriggerRefs: { current: {} },
      chatMenuRef: { current: null },
      advancedFiltersTriggerRef: { current: trigger },
      threadActionsMenuTriggerRef: { current: null },
      mediaDrawerTriggerRef: { current: null },
    },
    setReactionPickerPosition: ignorePosition,
    setMessageActionMenuPosition: ignorePosition,
    setChatMenuPosition: ignorePosition,
    setAdvancedFiltersPosition: setPosition,
    setThreadActionsMenuPosition: ignorePosition,
    setMediaDrawerPosition: ignorePosition,
  });
  capture(position);
  return null;
};

test('overlay positions update on viewport changes and stop listening after unmount', () => {
  const trigger = document.createElement('button');
  let triggerRect = rect(100, 20, 40, 30);
  let reads = 0;
  Object.defineProperty(trigger, 'getBoundingClientRect', {
    configurable: true,
    value: () => {
      reads += 1;
      return triggerRect;
    },
  });

  const positions: Array<InboxOverlayPosition | null> = [];
  const view = render(<PositionHarness trigger={trigger} enabled capture={(position) => positions.push(position)} />);
  assert.deepEqual(positions[positions.length - 1], { top: 58, left: 100 });

  triggerRect = rect(250, 70, 40, 30);
  act(() => window.dispatchEvent(new Event('resize')));
  assert.deepEqual(positions[positions.length - 1], { top: 108, left: 250 });

  const readsAtUnmount = reads;
  view.unmount();
  act(() => window.dispatchEvent(new Event('scroll')));
  assert.equal(reads, readsAtUnmount);
});
