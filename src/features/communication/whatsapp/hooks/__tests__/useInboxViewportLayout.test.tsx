import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxViewportLayout } from '../useInboxViewportLayout';

const Harness = ({ selectedChatId }: { selectedChatId: string | null }) => {
  const [composerFocused, setComposerFocused] = useState(false);
  useInboxViewportLayout({ selectedChatId, composerFocused });

  return (
    <button type="button" data-testid="focus-composer" onClick={() => setComposerFocused(true)}>
      Focar composer
    </button>
  );
};

const setWindowDimension = (name: 'innerHeight' | 'innerWidth', value: number) => {
  Object.defineProperty(window, name, { configurable: true, value });
};

const restoreWindowDimension = (name: 'innerHeight' | 'innerWidth', descriptor: PropertyDescriptor | undefined) => {
  if (descriptor) {
    Object.defineProperty(window, name, descriptor);
  } else {
    Reflect.deleteProperty(window, name);
  }
};

const mockViewport = () => {
  const originalHeight = Object.getOwnPropertyDescriptor(window, 'innerHeight');
  const originalWidth = Object.getOwnPropertyDescriptor(window, 'innerWidth');
  const root = document.documentElement;
  const originalViewportHeight = root.style.getPropertyValue('--comm-inbox-viewport-height');
  const originallyHadKeyboardClass = root.classList.contains('comm-inbox-keyboard-open');
  setWindowDimension('innerHeight', 800);
  setWindowDimension('innerWidth', 390);

  return () => {
    restoreWindowDimension('innerHeight', originalHeight);
    restoreWindowDimension('innerWidth', originalWidth);
    if (originalViewportHeight) {
      root.style.setProperty('--comm-inbox-viewport-height', originalViewportHeight);
    } else {
      root.style.removeProperty('--comm-inbox-viewport-height');
    }
    root.classList.toggle('comm-inbox-keyboard-open', originallyHadKeyboardClass);
  };
};

test('ativa estado de teclado para conversa focada e remove listeners ao desmontar', () => {
  const restoreViewport = mockViewport();
  const root = document.documentElement;
  let view: ReturnType<typeof render> | null = null;

  try {
    view = render(<Harness selectedChatId="chat-1" />);
    assert.equal(root.style.getPropertyValue('--comm-inbox-viewport-height'), '800px');

    setWindowDimension('innerHeight', 500);
    act(() => window.dispatchEvent(new Event('resize')));
    assert.equal(root.style.getPropertyValue('--comm-inbox-viewport-height'), '500px');
    assert.equal(root.classList.contains('comm-inbox-keyboard-open'), false);

    const focusButton = view.container.querySelector('[data-testid="focus-composer"]');
    assert.ok(focusButton instanceof HTMLButtonElement);
    act(() => focusButton.click());
    assert.equal(root.classList.contains('comm-inbox-keyboard-open'), true);

    view.unmount();
    view = null;
    assert.equal(root.style.getPropertyValue('--comm-inbox-viewport-height'), '');
    assert.equal(root.classList.contains('comm-inbox-keyboard-open'), false);
    act(() => window.dispatchEvent(new Event('resize')));
    assert.equal(root.style.getPropertyValue('--comm-inbox-viewport-height'), '');
  } finally {
    view?.unmount();
    restoreViewport();
  }
});

test('não abre o estado de teclado sem uma conversa selecionada', () => {
  const restoreViewport = mockViewport();
  const root = document.documentElement;
  let view: ReturnType<typeof render> | null = null;

  try {
    view = render(<Harness selectedChatId={null} />);
    setWindowDimension('innerHeight', 500);
    act(() => window.dispatchEvent(new Event('resize')));
    const focusButton = view.container.querySelector('[data-testid="focus-composer"]');
    assert.ok(focusButton instanceof HTMLButtonElement);
    act(() => focusButton.click());
    assert.equal(root.classList.contains('comm-inbox-keyboard-open'), false);
  } finally {
    view?.unmount();
    restoreViewport();
  }
});
