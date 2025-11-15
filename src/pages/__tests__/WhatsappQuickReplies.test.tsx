import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, useState } from 'react';
import { render } from '../../testing-library/react';
import QuickRepliesMenu from '../../components/QuickRepliesMenu';
import type { QuickReply } from '../../lib/supabase';

const setupDomEnvironment = () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const previousDescriptors = new Map<PropertyKey, PropertyDescriptor | undefined>();

  const applyGlobal = (key: keyof typeof globalThis, value: unknown) => {
    previousDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  };

  applyGlobal('window', dom.window);
  applyGlobal('document', dom.window.document);
  applyGlobal('navigator', dom.window.navigator);
  applyGlobal('HTMLElement', dom.window.HTMLElement);
  applyGlobal('HTMLButtonElement', dom.window.HTMLButtonElement);
  applyGlobal('HTMLTextAreaElement', dom.window.HTMLTextAreaElement);
  applyGlobal('MouseEvent', dom.window.MouseEvent);

  return () => {
    for (const [key, descriptor] of previousDescriptors.entries()) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        Reflect.deleteProperty(globalThis, key);
      }
    }

    dom.window.close();
  };
};

type HarnessReply = QuickReply;

const repliesFixture: HarnessReply[] = [
  {
    id: 'reply-1',
    title: 'Saudação',
    text: 'Olá! Como posso te ajudar hoje?',
    created_at: null,
    updated_at: null,
  },
  {
    id: 'reply-2',
    title: 'Documentos',
    text: 'Poderia, por gentileza, me enviar os documentos necessários?',
    created_at: null,
    updated_at: null,
  },
];

const noopAsync = async () => {};

function QuickRepliesHarness() {
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div>
      <QuickRepliesMenu
        quickReplies={repliesFixture}
        selectedReplyId={selectedId}
        onSelect={reply => {
          setSelectedId(reply.id);
          setMessage(reply.text);
        }}
        onCreate={noopAsync}
        onUpdate={noopAsync}
      />
      <label htmlFor="message-input" className="sr-only">
        Mensagem
      </label>
      <textarea
        id="message-input"
        placeholder="Digite sua mensagem"
        value={message}
        onChange={event => setMessage(event.target.value)}
      />
    </div>
  );
}

const clickElement = (element: HTMLElement) => {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

test('selecionar uma resposta rápida preenche o campo de mensagem', () => {
  const restoreDom = setupDomEnvironment();
  const { container, unmount } = render(<QuickRepliesHarness />);

  try {
    const toggleButton = container.querySelector('[data-testid="quick-replies-toggle"]') as HTMLButtonElement | null;
    assert.ok(toggleButton, 'Toggle button should be rendered');
    clickElement(toggleButton);

    const optionButton = container.querySelector('[data-reply-id="reply-2"]') as HTMLButtonElement | null;
    assert.ok(optionButton, 'Expected quick reply option to be visible');
    clickElement(optionButton);

    const textarea = container.querySelector('textarea#message-input') as HTMLTextAreaElement | null;
    assert.ok(textarea, 'Textarea should be rendered');
    assert.equal(
      textarea.value,
      'Poderia, por gentileza, me enviar os documentos necessários?',
      'Selecting a quick reply should populate the message input',
    );
  } finally {
    unmount();
    restoreDom();
  }
});
