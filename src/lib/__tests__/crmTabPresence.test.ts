import assert from 'node:assert/strict';
import { test } from 'vitest';

import { crmTabPresenceService } from '../crmTabPresence';

const setDocumentActivity = (active: boolean) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: active ? 'visible' : 'hidden',
  });
  Object.defineProperty(document, 'hasFocus', {
    configurable: true,
    value: () => active,
  });
};

const withDocumentActivity = (active: boolean, callback: () => void) => {
  const previousVisibilityState = document.visibilityState;
  const previousHasFocus = document.hasFocus;
  setDocumentActivity(active);

  try {
    callback();
  } finally {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: previousVisibilityState,
    });
    Object.defineProperty(document, 'hasFocus', {
      configurable: true,
      value: previousHasFocus,
    });
    window.localStorage.clear();
  }
};

test('marca a aba ativa para impedir notificações nativas duplicadas', () => {
  withDocumentActivity(true, () => {
    const stop = crmTabPresenceService.start();

    assert.equal(crmTabPresenceService.hasActiveTab(), true);

    stop();
    assert.equal(crmTabPresenceService.hasActiveTab(), false);
  });
});

test('não marca uma aba invisível como ativa', () => {
  withDocumentActivity(false, () => {
    const stop = crmTabPresenceService.start();

    assert.equal(crmTabPresenceService.hasActiveTab(), false);

    stop();
  });
});
