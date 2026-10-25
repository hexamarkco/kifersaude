import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import { ActionSurface, DropdownOption, Field, FieldLabel, FileInput, Radio, Slider, VariableAutocompleteTextarea } from '../../index';

test('standalone radio keeps native label activation and controlled change handlers', () => {
  let checked = false;
  const view = render(<FieldLabel><Radio checked={false} name="mode" onChange={(event) => { checked = event.target.checked; }} />Personalizado</FieldLabel>);
  assert.equal(view.container.querySelectorAll('label').length, 1);
  act(() => view.container.querySelector('label')!.click());
  assert.equal(checked, true);
  view.unmount();
});

test('file and range controls preserve native form attributes and field associations', () => {
  const view = render(<><Field label="Documento" description="Até 10 MB" required><FileInput accept="application/pdf" name="attachment" /></Field><Field label="Multiplicador"><Slider min="0" max="10" step="0.1" defaultValue="2.8" /></Field></>);
  const labels = [...view.container.querySelectorAll('label')];
  const file = document.getElementById(labels[0].htmlFor) as HTMLInputElement;
  const range = document.getElementById(labels[1].htmlFor) as HTMLInputElement;
  assert.equal(file.type, 'file');
  assert.equal(file.accept, 'application/pdf');
  assert.equal(file.required, true);
  assert.equal(document.getElementById(file.getAttribute('aria-describedby')!)?.textContent, 'Até 10 MB');
  assert.equal(range.type, 'range');
  assert.equal(range.value, '2.8');
  assert.equal(range.step, '0.1');
  view.unmount();
});

test('variable textarea receives the same label and error contract as other fields', () => {
  const view = render(<Field label="Mensagem" error="Revise o texto" required><VariableAutocompleteTextarea value="" onChange={() => undefined} suggestions={[]} /></Field>);
  const label = view.container.querySelector('label')!;
  const input = document.getElementById(label.htmlFor) as HTMLTextAreaElement;
  assert.equal(input.tagName, 'TEXTAREA');
  assert.equal(input.required, true);
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.match(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent ?? '', /Revise o texto/);
  view.unmount();
});

test('menu keyboard traversal skips disabled options without replacing the consumer handler', () => {
  let custom = 0;
  const view = render(<div role="listbox"><DropdownOption onKeyDown={() => { custom++; }}>Primeiro</DropdownOption><DropdownOption disabled>Indisponível</DropdownOption><DropdownOption>Último</DropdownOption></div>);
  const options = view.container.querySelectorAll('button');
  act(() => { options[0].focus(); options[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); });
  assert.equal(document.activeElement, options[2]);
  assert.equal(custom, 1);
  view.unmount();
});

test('action surfaces keep refs and non-submit semantics for existing application tiles', () => {
  let node: HTMLButtonElement | null = null;
  let clicked = 0;
  const view = render(<ActionSurface variant="plain" padding="none" ref={(element) => { node = element; }} onClick={() => { clicked++; }}><div>Conversa</div></ActionSurface>);
  assert.equal(node, view.container.querySelector('button'));
  act(() => view.container.querySelector('button')!.click());
  assert.equal(clicked, 1);
  assert.equal(view.container.querySelector('button')!.type, 'button');
  view.unmount();
});
