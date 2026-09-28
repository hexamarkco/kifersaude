import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  createVirtualOverlayAnchorRect,
  getAdvancedFiltersPosition,
  getMediaDrawerPosition,
  getPointerMenuPosition,
  getReactionPickerPosition,
  getThreadActionsMenuPosition,
} from '../inboxOverlayPosition';

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

test('virtual context-menu anchors retain the pointer coordinates', () => {
  assert.deepEqual(createVirtualOverlayAnchorRect({ x: 35, y: 64 }), {
    left: 35,
    right: 35,
    top: 64,
    bottom: 64,
    width: 0,
    height: 0,
  });
});

test('reaction picker stays inside the thread and viewport edges', () => {
  assert.deepEqual(
    getReactionPickerPosition(
      rect(450, 20, 20, 20),
      rect(200, 0, 400, 500),
      { width: 800, height: 600 },
    ),
    { top: 12, left: 334 },
  );
});

test('context menu opens above a low pointer and respects measured content height', () => {
  assert.deepEqual(getPointerMenuPosition({
    anchor: rect(620, 400, 20, 20),
    viewport: { width: 800, height: 500 },
    menuWidth: 268,
    estimatedHeight: 236,
    minimumMaxHeight: 120,
    measuredHeight: 200,
  }), { top: 194, left: 372, width: 268, maxHeight: 236 });
});

test('chat menu uses its own minimum height and clamps to a narrow viewport', () => {
  assert.deepEqual(getPointerMenuPosition({
    anchor: rect(300, 100, 20, 20),
    viewport: { width: 360, height: 600 },
    menuWidth: 248,
    estimatedHeight: 232,
    minimumMaxHeight: 160,
    measuredHeight: 0,
  }), { top: 126, left: 72, width: 248, maxHeight: 232 });
});

test('advanced filters and thread actions panels stay aligned and bounded', () => {
  assert.deepEqual(
    getAdvancedFiltersPosition(rect(900, 20, 40, 32), { width: 1024, height: 768 }),
    { top: 60, left: 716 },
  );
  assert.deepEqual(
    getThreadActionsMenuPosition(rect(900, 700, 20, 40), { width: 1024, height: 768 }),
    { top: 336, left: 632, width: 288, maxHeight: 420 },
  );
});

test('media drawer keeps its established width, height, and above-trigger placement', () => {
  assert.deepEqual(
    getMediaDrawerPosition(rect(980, 650, 20, 32), { width: 1024, height: 768 }),
    { top: 242, left: 652, width: 360, maxHeight: 400 },
  );
});
