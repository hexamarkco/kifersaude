import assert from 'node:assert/strict';
import { act } from 'react';
import { test } from 'vitest';
import { render } from '../../../../testing-library/react';
import WhatsAppComposerRewriteModal from './WhatsAppComposerRewriteModal';

test('rewrite dialog keeps source, tone, instructions and suggestion editable; generation and application are distinct', () => {
  const calls: string[] = [];
  const view = render(<WhatsAppComposerRewriteModal isOpen generating={false} sourceValue="Olá, tudo bem?" value="Olá! Como posso ajudar?" tone="friendly" customInstructions="Sem emoji" onClose={() => calls.push('close')} onChangeSourceValue={() => undefined} onChangeValue={() => undefined} onChangeTone={() => undefined} onChangeCustomInstructions={() => undefined} onGenerate={() => calls.push('generate')} onApply={() => calls.push('apply')} />);
  try {
    const dialog = document.body.querySelector<HTMLElement>('.whatsapp-inbox-rewrite-dialog');
    assert.ok(dialog);
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    const fields = [...dialog.querySelectorAll<HTMLTextAreaElement>('textarea')];
    assert.deepEqual(fields.map(field => field.value), ['Olá, tudo bem?', 'Sem emoji', 'Olá! Como posso ajudar?']);
    assert.equal(dialog.querySelector('select')?.value, 'friendly');
    const findButton = (label: string) => [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === label);
    const generate = findButton('Gerar nova versão');
    const apply = findButton('Usar este texto');
    assert.ok(generate); assert.ok(apply);
    act(() => generate.click());
    assert.deepEqual(calls, ['generate']);
    act(() => apply.click());
    assert.deepEqual(calls, ['generate','apply']);
    assert.equal(dialog.querySelector('.kds-avatar'), null);
  } finally { view.unmount(); }
});
