import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import { MessageVariationsEditor } from './MessageVariationsEditor';
import type { AutoContactFlowStep } from '../../../../lib/autoContactService';

test('adiciona, edita, alterna e remove uma variação sem alterar a principal', () => {
  let latest: AutoContactFlowStep;
  function Editor() {
    const [step, setStep] = useState<AutoContactFlowStep>({
      id: 'step', delayValue: 0, delayUnit: 'minutes', actionType: 'send_message',
      messageSource: 'custom', customMessage: { type: 'text', text: 'Abordagem original' },
    });
    latest = step;
    return <MessageVariationsEditor step={step} messageTemplates={[]}
      onUpdate={(updates) => setStep((current) => ({ ...current, ...updates }))} />;
  }
  const view = render(<Editor />);
  const click = (label: string) => {
    const button = Array.from(view.container.querySelectorAll('button')).find((item) => item.textContent?.trim() === label);
    assert.ok(button, `Botão ${label} disponível`);
    act(() => button.click());
  };
  try {
    click('Adicionar variação');
    assert.equal(latest!.messageVariations?.length, 1);
    const textarea = view.container.querySelector('textarea');
    assert.ok(textarea);
    assert.equal(textarea.value, '');
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Abordagem alternativa');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    assert.deepEqual(latest!.messageVariations?.[0].messages, [{ custom: { type: 'text', text: 'Abordagem alternativa' } }]);
    click('Variação 1');
    assert.equal(view.container.querySelector('textarea')?.value, 'Abordagem original');
    click('Variação 2');
    assert.equal(view.container.querySelector('textarea')?.value, 'Abordagem alternativa');
    click('Remover variação');
    assert.deepEqual(latest!.messageVariations, []);
    assert.equal(view.container.querySelector('textarea')?.value, 'Abordagem original');
    assert.equal(view.container.querySelectorAll('[aria-pressed="true"]').length, 1);
  } finally {
    view.unmount();
  }
});
