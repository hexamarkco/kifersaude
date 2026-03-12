import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import DateTimePicker, { normalizeYearInput, parseCommittedYearInput } from '../DateTimePicker';

const setInputValue = (element: HTMLInputElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(element, value);

  act(() => {
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const focusInput = (element: HTMLInputElement) => {
  act(() => {
    element.focus();
  });
};

const blurInput = (element: HTMLInputElement) => {
  act(() => {
    element.blur();
  });
};

test('normalizes year input and only commits complete years', () => {
  assert.equal(normalizeYearInput('20a1b0'), '2010');
  assert.equal(parseCommittedYearInput('20'), null);
  assert.equal(parseCommittedYearInput('2010'), 2010);
  assert.equal(parseCommittedYearInput('2200'), 2100);
});

test('allows direct typing of a distant year without forcing intermediate clamps', () => {
  const { container, unmount } = render(
    <DateTimePicker value="2026-03-12" onChange={() => {}} type="date" />,
  );

  const trigger = container.querySelector('button[aria-haspopup="dialog"]');
  assert.ok(trigger instanceof HTMLButtonElement);

  act(() => {
    trigger.click();
  });

  const yearInput = document.body.querySelector('input[aria-label="Ano"]');
  assert.ok(yearInput instanceof HTMLInputElement);

  focusInput(yearInput);
  setInputValue(yearInput, '20');
  assert.equal(yearInput.value, '20');

  blurInput(yearInput);
  assert.equal(yearInput.value, '2026');

  focusInput(yearInput);
  setInputValue(yearInput, '2010');
  assert.equal(yearInput.value, '2010');

  const dialog = document.body.querySelector('[role="dialog"]');
  assert.ok(dialog?.textContent?.includes('2010'));

  unmount();
});
