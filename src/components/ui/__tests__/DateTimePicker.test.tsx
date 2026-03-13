import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import DateTimePicker, { normalizeYearInput, parseCommittedYearInput } from '../DateTimePicker';

const renderControlledPicker = (initialValue: string, type: 'date' | 'month' | 'datetime-local' = 'date') => {
  const state = { current: initialValue };

  function ControlledPicker() {
    const [value, setValue] = useState(initialValue);

    state.current = value;

    return (
      <DateTimePicker
        value={value}
        onChange={(nextValue) => {
          state.current = nextValue;
          setValue(nextValue);
        }}
        type={type}
      />
    );
  }

  return {
    ...render(<ControlledPicker />),
    getValue: () => state.current,
  };
};

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

test('lets users type a full date directly into the main input', () => {
  const { container, getValue, unmount } = renderControlledPicker('2026-03-12', 'date');

  const triggerInput = container.querySelector('input[aria-haspopup="dialog"]');
  assert.ok(triggerInput instanceof HTMLInputElement);

  focusInput(triggerInput);
  setInputValue(triggerInput, '12032010');
  assert.equal(triggerInput.value, '12/03/2010');

  blurInput(triggerInput);
  assert.equal(getValue(), '2010-03-12');

  unmount();
});

test('lets users type a month directly into the main input with MM/AAAA', () => {
  const { container, getValue, unmount } = renderControlledPicker('2026-03', 'month');

  const triggerInput = container.querySelector('input[aria-haspopup="dialog"]');
  assert.ok(triggerInput instanceof HTMLInputElement);

  focusInput(triggerInput);
  setInputValue(triggerInput, '052010');
  assert.equal(triggerInput.value, '05/2010');

  blurInput(triggerInput);
  assert.equal(getValue(), '2010-05');
  assert.equal(triggerInput.value, '05/2010');

  unmount();
});

test('selects the whole month input on focus for quick replacement', () => {
  const { container, unmount } = renderControlledPicker('2026-03', 'month');

  const triggerInput = container.querySelector('input[aria-haspopup="dialog"]');
  assert.ok(triggerInput instanceof HTMLInputElement);

  focusInput(triggerInput);
  assert.equal(triggerInput.value, '03/2026');
  assert.equal(triggerInput.selectionStart, 0);
  assert.equal(triggerInput.selectionEnd, triggerInput.value.length);

  unmount();
});

test('keeps accepting legacy AAAA-MM month input', () => {
  const { container, getValue, unmount } = renderControlledPicker('2026-03', 'month');

  const triggerInput = container.querySelector('input[aria-haspopup="dialog"]');
  assert.ok(triggerInput instanceof HTMLInputElement);

  focusInput(triggerInput);
  setInputValue(triggerInput, '2010-05');
  assert.equal(triggerInput.value, '2010-05');

  blurInput(triggerInput);
  assert.equal(getValue(), '2010-05');
  assert.equal(triggerInput.value, '05/2010');

  unmount();
});
