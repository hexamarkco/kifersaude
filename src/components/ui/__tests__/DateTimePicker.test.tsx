import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';

import {
  DateTimePicker,
} from '../../../design-system';
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
        onChange={(event) => {
          state.current = event.target.value;
          setValue(event.target.value);
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
  assert.equal(trigger.querySelectorAll('svg').length, 1);

  click(trigger);

  const dayEighteen = findByText(document.body, '18');
  click(dayEighteen);

  assert.equal(getValue(), '2026-03-18');

  unmount();
});

test('allows hiding the decorative trigger icon while retaining the accessible date button', () => {
  const { container, unmount } = renderControlledPicker('', 'date', {
    showIcon: false,
    placeholder: 'Selecionar data',
    'aria-label': 'Data de criação',
  });

  const trigger = container.querySelector<HTMLButtonElement>('.kds-dp-trigger');
  assert.ok(trigger);
  assert.equal(trigger.getAttribute('aria-label'), 'Data de criação');
  assert.equal(trigger.textContent, 'Selecionar data');
  assert.equal(trigger.querySelector('svg'), null);

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


test('datetime selection advances through compact steps and commits only on confirmation', () => {
  const { container, getValue, unmount } = renderControlledPicker('2026-03-12T10:17', 'datetime-local');
  click(container.querySelector('.kds-dp-trigger'));
  click(findByText(document.body, '18'));
  assert.equal(document.querySelector('.kds-dp-days'), null);
  assert.equal(getValue(), '2026-03-12T10:17');
  click(document.querySelector('[aria-label="14 horas"]'));
  assert.equal(document.querySelector('[aria-label="Horas"]'), null);
  const input = document.querySelector('[aria-label="Minuto exato"]');
  assert.ok(input instanceof HTMLInputElement);
  changeMinute(input, '23');
  click(findByText(document.body, 'Confirmar horário'));
  assert.equal(getValue(), '2026-03-18T14:23');
  unmount();
});

test('time boundaries reject invalid minutes and clearing a draft does not commit', () => {
  const { container, getValue, unmount } = renderControlledPicker('10:17', 'time', { min: '10:15', max: '11:30' });
  click(container.querySelector('.kds-dp-trigger'));
  const earlyHour = document.querySelector('[aria-label="09 horas"]');
  assert.ok(earlyHour instanceof HTMLButtonElement && earlyHour.disabled);
  click(document.querySelector('[aria-label="10 horas"]'));
  const earlyMinute = document.querySelector('[aria-label="10 minutos"]');
  assert.ok(earlyMinute instanceof HTMLButtonElement && earlyMinute.disabled);
  const input = document.querySelector('[aria-label="Minuto exato"]');
  assert.ok(input instanceof HTMLInputElement);
  changeMinute(input, '60');
  const confirm = findByText(document.body, 'Confirmar horário')?.closest('button');
  assert.ok(confirm?.disabled);
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  assert.equal(getValue(), '10:17');
  click(container.querySelector('.kds-dp-trigger'));
  click(document.querySelector('[aria-label="11 horas"]'));
  changeMinute(document.querySelector('[aria-label="Minuto exato"]')!, '29');
  click(findByText(document.body, 'Confirmar horário'));
  assert.equal(getValue(), '11:29');
  unmount();
});

function changeMinute(element: Element, value: string) {
  assert.ok(element instanceof HTMLInputElement);
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
