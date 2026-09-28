import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  applyInboxMessageScrollPosition,
  isInboxMessageViewportNearBottom,
  type InboxMessageScrollRefs,
  type InboxMessageScrollMode,
} from '../inboxMessageScroll';

const createRefs = (mode: InboxMessageScrollMode): InboxMessageScrollRefs => ({
  pendingScrollModeRef: { current: mode },
  pendingScrollTopRef: { current: 137 },
  pendingScrollHeightRef: { current: 512 },
  isNearBottomRef: { current: false },
});

test('bottom acompanha a altura atual e marca a timeline como próxima do fim', () => {
  const refs = createRefs('bottom');
  const container = { scrollTop: 40, scrollHeight: 900 };

  applyInboxMessageScrollPosition(container, refs);

  assert.equal(container.scrollTop, 900);
  assert.equal(refs.isNearBottomRef.current, true);
  assert.equal(refs.pendingScrollModeRef.current, null);
  assert.equal(refs.pendingScrollTopRef.current, null);
  assert.equal(refs.pendingScrollHeightRef.current, null);
});

test('preserve restaura o scrollTop capturado antes da atualização', () => {
  const refs = createRefs('preserve');
  const container = { scrollTop: 700, scrollHeight: 900 };

  applyInboxMessageScrollPosition(container, refs);

  assert.equal(container.scrollTop, 137);
  assert.equal(refs.isNearBottomRef.current, false);
  assert.equal(refs.pendingScrollModeRef.current, null);
});

test('prepend compensa a altura adicionada para manter a âncora visível', () => {
  const refs = createRefs('prepend');
  const container = { scrollTop: 700, scrollHeight: 640 };

  applyInboxMessageScrollPosition(container, refs);

  assert.equal(container.scrollTop, 265);
  assert.equal(refs.pendingScrollModeRef.current, null);
});

test('prepend não move a posição para cima se o conteúdo diminuiu durante a carga', () => {
  const refs = createRefs('prepend');
  refs.pendingScrollHeightRef.current = 700;
  const container = { scrollTop: 0, scrollHeight: 640 };

  applyInboxMessageScrollPosition(container, refs);

  assert.equal(container.scrollTop, 137);
});

test('a tolerância de 96px define com precisão quando a timeline está no fim', () => {
  assert.equal(isInboxMessageViewportNearBottom({ scrollTop: 304, scrollHeight: 1000, clientHeight: 600 }), true);
  assert.equal(isInboxMessageViewportNearBottom({ scrollTop: 303, scrollHeight: 1000, clientHeight: 600 }), false);
});
