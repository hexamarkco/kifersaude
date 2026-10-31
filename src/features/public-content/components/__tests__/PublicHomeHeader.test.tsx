import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import PublicHomeHeader from '../PublicHomeHeader';

function setupHeader() {
  const previousMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  let desktopChanged: (() => void) | undefined;
  const media = {
    matches: false,
    addEventListener: (_type: string, listener: () => void) => { desktopChanged = listener; },
    removeEventListener: () => { desktopChanged = undefined; },
  };
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => media });
  const navigated: string[] = [];
  const callbackOverflowStates: string[] = [];
  let quoteRequestCount = 0;
  const onNavigate = (section: string) => { navigated.push(section); callbackOverflowStates.push(document.body.style.overflow); };
  const onRequestQuote = () => { quoteRequestCount += 1; callbackOverflowStates.push(document.body.style.overflow); };
  const view = render(<PublicHomeHeader onNavigate={onNavigate} onRequestQuote={onRequestQuote} />);
  const trigger = view.container.querySelector<HTMLButtonElement>('[aria-label="Abrir menu"]');
  assert.ok(trigger);
  return {
    ...view,
    trigger,
    navigated,
    callbackOverflowStates,
    get quoteRequestCount() { return quoteRequestCount; },
    resizeToDesktop: () => { media.matches = true; desktopChanged?.(); },
    unmount: () => {
      view.unmount();
      if (previousMatchMedia) Object.defineProperty(window, 'matchMedia', previousMatchMedia);
      else Reflect.deleteProperty(window, 'matchMedia');
    },
  };
}

test('uses the shared wordmark and preserves navigation labels and quote action', () => {
  const view = setupHeader();
  try {
    const brand = view.container.querySelector('[aria-label="Kifer Saúde, início"]');
    const wordmark = brand?.querySelector('[role="img"]');
    assert.equal(wordmark?.getAttribute('aria-label'), 'Kifer Saúde');
    assert.equal(wordmark?.textContent, 'kifersaúde');
    const links = [...view.container.querySelectorAll('nav a')];
    assert.deepEqual(links.map((link) => link.textContent), ['Operadoras', 'Para quem é', 'Como funciona', 'Depoimentos', 'Dúvidas']);
    act(() => (links[2] as HTMLAnchorElement).click());
    assert.deepEqual(view.navigated, ['como-funciona']);
    act(() => view.container.querySelector<HTMLButtonElement>('.kds-button-primary')?.click());
    assert.equal(view.quoteRequestCount, 1);
  } finally {
    view.unmount();
  }
});

test('mobile menu traps keyboard focus and restores focus and scrolling on Escape', async () => {
  const view = setupHeader();
  const previousOverflow = document.body.style.overflow;
  try {
    act(() => { view.trigger.focus(); view.trigger.click(); });
    await act(async () => { await new Promise(requestAnimationFrame); });
    const dialog = document.body.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.equal(dialog.id, view.trigger.getAttribute('aria-controls'));
    assert.equal(view.trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(document.body.style.overflow, 'hidden');
    const controls = [...dialog.querySelectorAll<HTMLElement>('button, a[href]')];
    const first = controls[0];
    const last = controls[controls.length - 1];
    assert.equal(document.activeElement, first);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
    assert.equal(document.activeElement, last);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    assert.equal(document.activeElement, first);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.body.querySelector('[role="dialog"]'), null);
    assert.equal(view.trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(document.activeElement, view.trigger);
    assert.equal(document.body.style.overflow, previousOverflow);
  } finally {
    view.unmount();
  }
});

test('mobile navigation, quote action and resizing close the menu', () => {
  const view = setupHeader();
  const previousOverflow = document.body.style.overflow;
  try {
    act(() => view.trigger.click());
    act(() => document.body.querySelector<HTMLAnchorElement>('[aria-label="Navegação móvel"] a[href="#faq"]')?.click());
    assert.deepEqual(view.navigated, ['faq']);
    assert.equal(document.body.querySelector('[role="dialog"]'), null);
    act(() => view.trigger.click());
    act(() => document.body.querySelector<HTMLButtonElement>('[role="dialog"] .kds-button-primary')?.click());
    assert.equal(view.quoteRequestCount, 1);
    assert.equal(document.body.querySelector('[role="dialog"]'), null);
    assert.deepEqual(view.callbackOverflowStates, [previousOverflow, previousOverflow]);
    act(() => view.trigger.click());
    act(() => view.resizeToDesktop());
    assert.equal(document.body.querySelector('[role="dialog"]'), null);
    assert.equal(document.body.style.overflow, '');
  } finally {
    view.unmount();
  }
});
