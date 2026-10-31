import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import WhatsAppQuickRepliesModal from '../WhatsAppQuickRepliesModal';
import type { WhatsAppQuickReply } from '../../domain/quickReplies';

const quickReply = (overrides: Partial<{
  id: string;
  name: string;
  shortcut: string;
  text: string;
  created_at: string | null;
  updated_at: string | null;
}> = {}) => ({
  id: 'quick-reply-1',
  name: 'Saudação',
  shortcut: 'saudacao',
  text: 'Olá! {{nome}}',
  created_at: null,
  updated_at: null,
  ...overrides,
});

const dispatchClick = (element: HTMLElement) => {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};

const setControlValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set;
  assert.ok(setter);
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

test('locks the quick reply editor while a save is in flight', () => {
  const quickReplies = [quickReply({ text: 'Olá!' })];
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

test('matches the standard form dialog and labels its editor fields accessibly', () => {
  const view = render(
    <WhatsAppQuickRepliesModal
      isOpen
      quickReplies={[quickReply()]}
      saving={false}
      onClose={() => undefined}
      onSave={() => undefined}
    />,
  );

  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  assert.ok(dialog);
  assert.equal(dialog.dataset.size, 'form');
  assert.equal(dialog.querySelector('h2')?.textContent, 'Mensagens rápidas');

  const shortcut = dialog.querySelector<HTMLInputElement>('input[placeholder="contato-inicial"]');
  const title = dialog.querySelector<HTMLInputElement>('input[placeholder="Ex.: Contato inicial"]');
  const message = dialog.querySelector<HTMLTextAreaElement>('textarea');
  assert.ok(shortcut?.id);
  assert.ok(title?.id);
  assert.ok(message?.id);
  assert.equal(dialog.querySelector(`label[for="${shortcut?.id}"]`)?.textContent, 'Atalho');
  assert.match(dialog.querySelector(`label[for="${title?.id}"]`)?.textContent ?? '', /Título\s*\*/);
  assert.match(dialog.querySelector(`label[for="${message?.id}"]`)?.textContent ?? '', /Mensagem\s*\*/);
  assert.equal(title?.required, true);
  assert.equal(message?.required, true);
  assert.match(dialog.textContent ?? '', /1 atalho cadastrado/);

  view.unmount();
});

test('switches between saved replies and starts a new local draft', () => {
  const view = render(
    <WhatsAppQuickRepliesModal
      isOpen
      quickReplies={[
        quickReply(),
        quickReply({ id: 'quick-reply-2', name: 'Retorno', shortcut: 'retorno', text: 'Passando para saber se conseguiu avaliar.' }),
      ]}
      saving={false}
      onClose={() => undefined}
      onSave={() => undefined}
    />,
  );

  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  assert.ok(dialog);
  const selector = dialog.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]');
  assert.ok(selector);

  act(() => dispatchClick(selector));
  const returnOption = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="option"]'))
    .find((option) => option.textContent?.includes('Retorno'));
  assert.ok(returnOption);
  act(() => dispatchClick(returnOption));
  assert.equal(dialog.querySelector<HTMLInputElement>('input[placeholder="Ex.: Contato inicial"]')?.value, 'Retorno');

  const addButton = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => button.textContent?.trim() === 'Nova');
  assert.ok(addButton);
  act(() => dispatchClick(addButton));
  assert.equal(dialog.querySelector<HTMLInputElement>('input[placeholder="Ex.: Contato inicial"]')?.value, '');
  assert.match(dialog.textContent ?? '', /3 atalhos cadastrados/);

  view.unmount();
});

test('identifies required title and message before saving a partially filled shortcut', async () => {
  const saveCalls: WhatsAppQuickReply[][] = [];
  const view = render(
    <WhatsAppQuickRepliesModal
      isOpen
      quickReplies={[quickReply({ name: '', text: '' })]}
      saving={false}
      onClose={() => undefined}
      onSave={(nextQuickReplies) => { saveCalls.push(nextQuickReplies); }}
    />,
  );

  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  assert.ok(dialog);
  const saveButton = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Salvar');
  assert.ok(saveButton);

  await act(async () => {
    dispatchClick(saveButton);
  });

  assert.equal(saveCalls.length, 0);
  assert.equal(dialog.querySelector<HTMLInputElement>('input[placeholder="Ex.: Contato inicial"]')?.getAttribute('aria-invalid'), 'true');
  assert.equal(dialog.querySelector<HTMLTextAreaElement>('textarea')?.getAttribute('aria-invalid'), 'true');
  assert.match(dialog.textContent ?? '', /Informe um título para identificar o atalho/);
  assert.match(dialog.textContent ?? '', /Escreva a mensagem que será inserida na conversa/);

  view.unmount();
});

test('saves edits from the selected shortcut without changing its persisted shape', async () => {
  const saveCalls: WhatsAppQuickReply[][] = [];
  const view = render(
    <WhatsAppQuickRepliesModal
      isOpen
      quickReplies={[quickReply()]}
      saving={false}
      onClose={() => undefined}
      onSave={(nextQuickReplies) => { saveCalls.push(nextQuickReplies); }}
    />,
  );

  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
  assert.ok(dialog);
  const title = dialog.querySelector<HTMLInputElement>('input[placeholder="Ex.: Contato inicial"]');
  const message = dialog.querySelector<HTMLTextAreaElement>('textarea');
  const saveButton = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Salvar');
  assert.ok(title);
  assert.ok(message);
  assert.ok(saveButton);

  act(() => {
    setControlValue(title, 'Boas-vindas');
    setControlValue(message, 'Olá, {{nome}}!');
  });
  await act(async () => {
    dispatchClick(saveButton);
    await Promise.resolve();
  });

  assert.deepEqual(saveCalls[0], [{
    id: 'quick-reply-1',
    name: 'Boas-vindas',
    shortcut: 'saudacao',
    text: 'Olá, {{nome}}!',
    created_at: null,
    updated_at: null,
  }]);

  view.unmount();
});
