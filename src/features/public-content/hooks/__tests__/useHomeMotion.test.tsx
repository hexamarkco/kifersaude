import assert from 'node:assert/strict';
import { act, useRef } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import HomeAudience from '../../components/home/HomeAudience';
import { HomeFaq } from '../../components/home/HomeContact';
import { createHomeMotionController, useHomeMotion } from '../useHomeMotion';

class FakeAnimation extends EventTarget {
  cancelled = false;
  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.dispatchEvent(new Event('cancel'));
  }
  finish() { this.dispatchEvent(new Event('finish')); }
}

function setupMotion() {
  vi.useFakeTimers();
  let reduced = false;
  const animations: { target: Element; animation: FakeAnimation; frames: Keyframe[] }[] = [];
  const mediaListeners = new Set<() => void>();
  const disposers: (() => void)[] = [];
  const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  const originalHidden = Object.getOwnPropertyDescriptor(document, 'hidden');
  const originalMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  const originalObserver = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver');
  Object.defineProperty(document, 'hidden', { configurable: true, writable: true, value: false });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({
    get matches() { return query.includes('prefers-reduced-motion') && reduced; },
    addEventListener: (_event: string, listener: () => void) => { mediaListeners.add(listener); },
    removeEventListener: (_event: string, listener: () => void) => { mediaListeners.delete(listener); },
  }) });
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value(this: Element, frames: Keyframe[]) {
      const animation = new FakeAnimation();
      animations.push({ target: this, animation, frames });
      return animation as unknown as Animation;
    },
  });
  const restore = (target: object, key: string, descriptor?: PropertyDescriptor) => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  };
  return {
    animations, mediaListeners, disposers,
    setReduced(value: boolean) { reduced = value; },
    disableObserver() { Object.defineProperty(globalThis, 'IntersectionObserver', { configurable: true, value: undefined }); },
    fixture() {
      const scope = document.createElement('div');
      scope.className = 'kifer-home';
      scope.innerHTML = '<section class="home-hero"><h1><span class="home-hero-line">Plano de saúde</span></h1><button>Quero cotar</button></section><section class="home-quote"><form><input aria-label="Nome" /></form></section>';
      document.body.append(scope);
      const controller = createHomeMotionController(scope);
      disposers.push(controller.dispose);
      return { scope, controller, hero: scope.querySelector<HTMLElement>('.home-hero')! };
    },
    dispose() {
      disposers.forEach(dispose => dispose());
      document.body.replaceChildren();
      restore(Element.prototype, 'animate', originalAnimate);
      restore(document, 'hidden', originalHidden);
      restore(window, 'matchMedia', originalMedia);
      restore(globalThis, 'IntersectionObserver', originalObserver);
      vi.useRealTimers();
    },
  };
}

function motionTest(name: string, run: (env: ReturnType<typeof setupMotion>) => void) {
  test(name, () => {
    const env = setupMotion();
    try { run(env); } finally { env.dispose(); }
  });
}

motionTest('plays an entrance once, keeps headlines opaque and clears effects on disposal', env => {
  const { controller, hero } = env.fixture();
  controller.enter(hero);
  const count = env.animations.length;
  assert.ok(count > 0);
  assert.ok(env.animations.find(item => item.target.classList.contains('home-hero-line'))?.frames.every(frame => frame.opacity === undefined));
  controller.enter(hero);
  assert.equal(env.animations.length, count);
  controller.dispose();
  assert.ok(env.animations.every(item => item.animation.cancelled));
  assert.equal(hero.classList.contains('home-motion-entering'), false);
  assert.equal(vi.getTimerCount(), 0);
  assert.equal(env.mediaListeners.size, 0);
  assert.equal(hero.querySelector('h1')?.textContent, 'Plano de saúde');
});

motionTest('leaves content at rest when reduced motion is requested', env => {
  env.setReduced(true);
  const { controller, hero } = env.fixture();
  controller.enter(hero);
  assert.equal(env.animations.length, 0);
  assert.equal(hero.classList.contains('home-motion-entering'), false);
  assert.equal(hero.hidden, false);
  assert.equal(hero.style.opacity, '');
  assert.equal(vi.getTimerCount(), 0);
});

motionTest('settles temporary styles when motion is disabled or the tab is hidden', env => {
  const { controller, hero } = env.fixture();
  let cleanupCount = 0;
  const cleanup = () => { cleanupCount++; };
  controller.enter(hero);
  controller.play(hero, [{ opacity: 0 }, { opacity: 1 }], {}, cleanup);
  env.setReduced(true);
  env.mediaListeners.forEach(listener => listener());
  assert.equal(cleanupCount, 1);
  assert.ok(env.animations.every(item => item.animation.cancelled));
  assert.equal(vi.getTimerCount(), 0);
  env.setReduced(false);
  controller.play(hero, [{ opacity: 0 }, { opacity: 1 }], {}, cleanup);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(cleanupCount, 2);
  assert.ok(env.animations.every(item => item.animation.cancelled));
});

motionTest('cancels a form entrance as soon as its input receives focus', env => {
  const { scope, controller } = env.fixture();
  controller.play(scope.querySelector('form'), [{ transform: 'translateY(10px)' }, { transform: 'translateY(0)' }]);
  scope.querySelector('input')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  assert.equal(env.animations[0].animation.cancelled, true);
});

motionTest('restores content when native animation is unavailable or rejects an effect', env => {
  const { controller, hero } = env.fixture();
  let cleanupCount = 0;
  const cleanup = () => { cleanupCount++; };
  Object.defineProperty(hero, 'animate', { configurable: true, value: undefined });
  assert.equal(controller.play(hero, [{ opacity: 0 }, { opacity: 1 }], {}, cleanup), null);
  Object.defineProperty(hero, 'animate', { value: () => { throw new Error('unsupported effect'); } });
  assert.equal(controller.play(hero, [{ opacity: 0 }, { opacity: 1 }], {}, cleanup), null);
  assert.equal(cleanupCount, 2);
  assert.equal(hero.hidden, false);
});

motionTest('reveals only three illustrative messages and never repeats the sequence', env => {
  const { scope, controller } = env.fixture();
  const phone = document.createElement('figure');
  phone.innerHTML = Array.from({ length: 5 }, (_, index) => `<div class="home-message">Mensagem ${index}</div>`).join('');
  scope.append(phone);
  controller.enterConversation(phone);
  assert.equal(env.animations.length, 3);
  assert.deepEqual(env.animations.map(item => item.target.textContent), ['Mensagem 2', 'Mensagem 3', 'Mensagem 4']);
  controller.enterConversation(phone);
  assert.equal(env.animations.length, 3);
});

motionTest('keeps section content usable when the observer cannot be constructed', env => {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    value: class { constructor() { throw new Error('observer unavailable'); } },
  });
  function ObserverHarness() {
    const anchor = useRef<HTMLElement>(null);
    useHomeMotion(anchor);
    return <div className="kifer-home"><main ref={anchor}><section><h1>Conteúdo disponível</h1><button type="button">Cotar</button></section></main></div>;
  }
  const view = render(<ObserverHarness />);
  env.disposers.push(view.unmount);
  assert.equal(view.container.querySelector('h1')?.textContent, 'Conteúdo disponível');
  assert.equal(view.container.querySelector('button')?.disabled, false);
  assert.equal(env.animations.length, 0);
});

motionTest('keeps only the selected quotation action after rapid profile changes without an observer', env => {
  env.disableObserver();
  const quotes: string[] = [];
  function AudienceHarness() {
    const anchor = useRef<HTMLElement>(null);
    useHomeMotion(anchor);
    return <div className="kifer-home"><main ref={anchor}><HomeAudience onQuote={kind => quotes.push(kind)} /></main></div>;
  }
  const view = render(<AudienceHarness />);
  env.disposers.push(view.unmount);
  const radios = [...view.container.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
  for (const index of [1, 2, 0, 2, 1]) act(() => radios[index].click());
  act(() => env.animations.forEach(item => item.animation.finish()));
  const active = view.container.querySelector('.home-audience-panel[aria-hidden="false"]')!;
  assert.equal(radios[1].checked, true);
  assert.equal(active.id, 'audience-panel-MEI');
  assert.equal(view.container.querySelectorAll('.home-audience-panel button[tabindex="0"]').length, 1);
  assert.ok([...view.container.querySelectorAll<HTMLElement>('.home-audience-panel')].every(panel => panel.style.visibility === ''));
  act(() => active.querySelector<HTMLButtonElement>('button')!.click());
  assert.deepEqual(quotes, ['MEI']);
});

motionTest('preserves FAQ controls, exclusive expansion and focus during opening and closing', env => {
  const view = render(<HomeFaq />);
  env.disposers.push(view.unmount);
  const buttons = [...view.container.querySelectorAll<HTMLButtonElement>('.home-faq-trigger')];
  act(() => { buttons[0].focus(); buttons[0].click(); });
  assert.equal(document.activeElement, buttons[0]);
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'true');
  assert.equal(view.container.querySelector('#faq-answer-0')?.getAttribute('aria-hidden'), 'false');
  act(() => buttons[1].click());
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'false');
  assert.equal(view.container.querySelector('#faq-answer-0')?.getAttribute('aria-hidden'), 'true');
  assert.equal(view.container.querySelector('#faq-answer-1')?.getAttribute('aria-hidden'), 'false');
  act(() => buttons[1].click());
  assert.equal(buttons[1].getAttribute('aria-expanded'), 'false');
});
