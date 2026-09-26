import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import WhatsAppQuickRepliesModal from '../WhatsAppQuickRepliesModal';

test('locks the quick reply editor while a save is in flight', () => {
  const quickReplies = [{
    id: 'quick-reply-1',
    name: 'Saudação',
    shortcut: 'saudacao',
    text: 'Olá!',
    created_at: null,
    updated_at: null,
  }];
  let closeCalls = 0;

  const view = render(
    <WhatsAppQuickRepliesModal
      isOpen
      quickReplies={quickReplies}
      saving
      onClose={() => { closeCalls += 1; }}
      onSave={async () => undefined}
    />,
  );

  const dialog = document.body.querySelector('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(dialog.querySelector('[aria-label="Fechar"]'), null);
  assert.equal(Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Nova'))?.disabled, true);
  assert.equal(Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Cancelar'))?.disabled, true);
  assert.equal(dialog.querySelector<HTMLButtonElement>('button[data-loading="true"]')?.disabled, true);
  assert.equal(dialog.querySelector('input')?.disabled, true);
  assert.equal(dialog.querySelector('textarea')?.disabled, true);

  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });

  assert.ok(document.body.querySelector('[role="dialog"]'));
  assert.equal(closeCalls, 0);
  view.unmount();
});
