import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import DateTimePicker from '../DateTimePicker';
import { normalizeYearInput, parseCommittedYearInput } from '../dateTimePickerUtils';

const click = (element: Element | null) => {
  assert.ok(element instanceof HTMLElement, 'element to click must exist');
  act(() => {
    (element as HTMLElement).click();
  });
};

const findByText = (root: ParentNode, text: string): HTMLElement | null => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode() as HTMLElement | null;
  while (current) {
    if (current.children.length === 0 && (current.textContent ?? '').trim() === text) {
      return current;
    }
    current = walker.nextNode() as HTMLElement | null;
  }
  return null;
};

const renderControlledPicker = (
  initialValue: string,
  type: 'date' | 'datetime-local' | 'time' = 'date',
  extraProps: Record<string, unknown> = {},
) => {
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
        {...extraProps}
      />
    );
  }

  return {
    ...render(<ControlledPicker />),
    getValue: () => state.current,
  };
};

test('normalizes year input and only commits complete years', () => {
  assert.equal(normalizeYearInput('20a1b0'), '2010');
  assert.equal(parseCommittedYearInput('20'), null);
  assert.equal(parseCommittedYearInput('2010'), 2010);
  assert.equal(parseCommittedYearInput('2200'), 2100);
});

test('renders a trigger showing the formatted date and commits a new value on day click', () => {
  const { container, getValue, unmount } = renderControlledPicker('2026-03-12', 'date');

  const trigger = container.querySelector('.kds-dp-trigger');
  assert.ok(trigger instanceof HTMLButtonElement);
  assert.equal(trigger.textContent, '12/03/2026');

  click(trigger);

  const dayEighteen = findByText(document.body, '18');
  click(dayEighteen);

  assert.equal(getValue(), '2026-03-18');

  unmount();
});

test('clearing the value resets the trigger to the placeholder', () => {
  const { container, getValue, unmount } = renderControlledPicker('2026-03-12', 'date');

  click(container.querySelector('.kds-dp-trigger'));

  const clearButton = findByText(document.body, 'Limpar');
  click(clearButton);

  assert.equal(getValue(), '');

  unmount();
});

test('forwards min/max constraints by disabling out-of-range days', () => {
  const { container, unmount } = renderControlledPicker('2026-03-12T10:00', 'datetime-local', {
    min: '2026-03-15T00:00',
    max: '2026-03-20T00:00',
  });

  click(container.querySelector('.kds-dp-trigger'));

  const inMonthDays = Array.from(
    document.body.querySelectorAll<HTMLButtonElement>('.kds-dp-days button:not(.kds-dp-day-outside)'),
  );
  const dayFive = inMonthDays.find((el) => el.textContent === '5');
  const dayTwentyFive = inMonthDays.find((el) => el.textContent === '25');
  const dayEighteen = inMonthDays.find((el) => el.textContent === '18');

  assert.ok(dayFive instanceof HTMLButtonElement);
  assert.ok(dayTwentyFive instanceof HTMLButtonElement);
  assert.ok(dayEighteen instanceof HTMLButtonElement);
  assert.equal(dayFive.disabled, true, 'day before min should be disabled');
  assert.equal(dayTwentyFive.disabled, true, 'day after max should be disabled');
  assert.equal(dayEighteen.disabled, false, 'day within range should stay enabled');

  unmount();
});
