import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test } from 'vitest';

import { render } from '../../../../testing-library/react';
import {
  WhatsAppInboxAdvancedFiltersDialog,
  type InboxAdvancedFilterValues,
} from './WhatsAppInboxAdvancedFiltersDialog';

const sharedProps = {
  position: { top: 40, left: 40, width: 360, maxHeight: 560 },
  activityFilter: 'all' as const,
  leadStatusFilters: [] as string[],
  leadResponsavelFilters: [] as string[],
  statusOptions: [
    { value: 'Atendimento', label: 'Atendimento' },
    { value: 'Convertido', label: 'Convertido' },
  ],
  responsavelOptions: [{ value: 'agent-1', label: 'Agente de demonstração' }],
};

const click = (target: Element | null) => {
  assert.ok(target);
  act(() => (target as HTMLElement).click());
};

const findCheckbox = (dialog: HTMLElement, label: string) => {
  const row = Array.from(dialog.querySelectorAll('label')).find((item) => item.textContent?.includes(label));
  return row?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
};

test('advanced filters are staged and applied together from the accessible dialog', () => {
  const applied: InboxAdvancedFilterValues[] = [];
  let closeCount = 0;
  const view = render(
    <WhatsAppInboxAdvancedFiltersDialog
      {...sharedProps}
      isOpen
      onClose={() => { closeCount += 1; }}
      onApply={(filters) => applied.push(filters)}
    />,
  );

  try {
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    assert.ok(dialog);
    assert.equal(dialog.getAttribute('aria-modal'), 'true');
    assert.equal(dialog.querySelector('h2')?.textContent, 'Filtros do inbox');

    const unreadButton = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Não lidas'));
    const statusCheckbox = findCheckbox(dialog, 'Convertido');
    const responsavelCheckbox = findCheckbox(dialog, 'Agente de demonstração');
    assert.ok(statusCheckbox);
    assert.ok(responsavelCheckbox);

    click(unreadButton ?? null);
    click(statusCheckbox);
    click(responsavelCheckbox);
    assert.equal(applied.length, 0);

    click(Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Aplicar filtros')) ?? null);
    assert.deepEqual(applied, [{
      activityFilter: 'unread',
      leadStatusFilters: ['Convertido'],
      leadResponsavelFilters: ['agent-1'],
    }]);
    assert.equal(closeCount, 1);
  } finally {
    view.unmount();
  }
});

test('closing the filters discards draft selections and reopening starts from applied values', () => {
  let appliedCount = 0;
  function Harness() {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setIsOpen(true)}>Abrir filtros</button>
        <WhatsAppInboxAdvancedFiltersDialog
          {...sharedProps}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onApply={() => { appliedCount += 1; }}
        />
      </>
    );
  }

  const view = render(<Harness />);
  try {
    click(view.container.querySelector('button'));
    let dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    assert.ok(dialog);
    const statusCheckbox = findCheckbox(dialog, 'Atendimento');
    assert.ok(statusCheckbox);
    click(statusCheckbox);

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.equal(document.body.querySelector('[role="dialog"]'), null);
    assert.equal(appliedCount, 0);

    click(view.container.querySelector('button'));
    dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    assert.ok(dialog);
    assert.equal(findCheckbox(dialog, 'Atendimento')?.checked, false);
  } finally {
    view.unmount();
  }
});
