import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import DateTimePicker from '../DateTimePicker';
import { normalizeYearInput, parseCommittedYearInput } from '../dateTimePickerUtils';

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

test('normalizes year input and only commits complete years', () => {
  assert.equal(normalizeYearInput('20a1b0'), '2010');
  assert.equal(parseCommittedYearInput('20'), null);
  assert.equal(parseCommittedYearInput('2010'), 2010);
  assert.equal(parseCommittedYearInput('2200'), 2100);
});

test('renders a native date input and keeps controlled value updates', () => {
  const { container, getValue, unmount } = renderControlledPicker('2026-03-12', 'date');

  const input = container.querySelector('input[type="date"]');
  assert.ok(input instanceof HTMLInputElement);
  assert.equal(input.value, '2026-03-12');

  setInputValue(input, '2026-04-18');
  assert.equal(getValue(), '2026-04-18');

  unmount();
});

test('renders a native month input', () => {
  const { container, unmount } = renderControlledPicker('2026-03', 'month');

  const input = container.querySelector('input[type="month"]');
  assert.ok(input instanceof HTMLInputElement);
  assert.equal(input.value, '2026-03');

  unmount();
});

test('opens the native picker from the action button when showPicker is available', () => {
  const { container, unmount } = render(<DateTimePicker value="2026-03-12" onChange={() => {}} type="date" />);

  const input = container.querySelector('input[type="date"]');
  const button = container.querySelector('button[type="button"]');
  assert.ok(input instanceof HTMLInputElement);
  assert.ok(button instanceof HTMLButtonElement);

  let opened = false;
  Object.defineProperty(input, 'showPicker', {
    value: () => {
      opened = true;
    },
    configurable: true,
  });

  act(() => {
    button.click();
  });

  assert.equal(opened, true);

  unmount();
});

test('forwards native constraints like min and max', () => {
  const { container, unmount } = render(
    <DateTimePicker
      value="2026-03-12T10:00"
      onChange={() => {}}
      type="datetime-local"
      min="2026-03-01T08:00"
      max="2026-03-31T18:00"
      required
    />,
  );

  const input = container.querySelector('input[type="datetime-local"]');
  assert.ok(input instanceof HTMLInputElement);
  assert.equal(input.min, '2026-03-01T08:00');
  assert.equal(input.max, '2026-03-31T18:00');
  assert.equal(input.required, true);

  unmount();
});
