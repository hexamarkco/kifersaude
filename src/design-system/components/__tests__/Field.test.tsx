import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import Field from '../Field';
import Input from '../Input';

test('contextual help stays accessible without adding a visible row, and validation stays visible', async () => {
  const view = render(<Field label="Cidade" description="Escolha primeiro o estado." descriptionPlacement="tooltip" error="Informe uma cidade."><Input /></Field>);
  try {
    const input = view.container.querySelector('input');
    const help = view.container.querySelector<HTMLButtonElement>('button');
    assert.ok(input);
    assert.ok(help);
    assert.equal(help.type, 'button');
    assert.equal(help.getAttribute('aria-label'), 'Ajuda: Cidade');
    assert.equal(view.container.querySelector('.kds-field-description'), null);
    const describedBy = input.getAttribute('aria-describedby')?.split(' ') ?? [];
    assert.equal(describedBy.length, 2);
    assert.equal(document.getElementById(describedBy[0])?.textContent, 'Escolha primeiro o estado.');
    assert.equal(view.container.querySelector('[role="alert"]')?.textContent, 'Informe uma cidade.');
    await act(async () => { help.focus(); await new Promise(resolve => setTimeout(resolve, 15)); });
    assert.equal(document.querySelector('[role="tooltip"]')?.textContent, 'Escolha primeiro o estado.');
  } finally { view.unmount(); }
});
