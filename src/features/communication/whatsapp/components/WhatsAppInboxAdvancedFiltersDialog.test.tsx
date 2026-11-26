import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test } from 'vitest';

import { render } from '../../../../testing-library/react';
import {
  WhatsAppInboxAdvancedFiltersDialog,
  type InboxAdvancedFilterValues,
} from './WhatsAppInboxAdvancedFiltersDialog';

const sharedProps = {
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

const openOptions = (dialog: HTMLElement, label: string) => {
  const summary = Array.from(dialog.querySelectorAll('summary')).find((item) => item.textContent?.includes(label));
  click(summary ?? null);
  return summary;
};

test('advanced filters are staged and applied together from the shared modal', () => {
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
    assert.ok(document.querySelector('.kds-dialog-backdrop'));
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(dialog.querySelector('h2')?.textContent, 'Filtrar conversas');
    assert.equal(dialog.querySelectorAll('details[open]').length, 0);

    const unreadButton = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Não lidas'));
    const statusSummary = openOptions(dialog, 'Status do lead');
    openOptions(dialog, 'Agente responsável');
    const statusCheckbox = findCheckbox(dialog, 'Convertido');
    const responsavelCheckbox = findCheckbox(dialog, 'Agente de demonstração');
    assert.ok(statusCheckbox);
    assert.ok(responsavelCheckbox);

    click(unreadButton ?? null);
    click(statusCheckbox);
    click(responsavelCheckbox);
    assert.equal(statusSummary?.getAttribute('aria-label'), 'Status do lead, 1 selecionado');
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
    openOptions(dialog, 'Status do lead');
    const statusCheckbox = findCheckbox(dialog, 'Atendimento');
    assert.ok(statusCheckbox);
    click(statusCheckbox);

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
    assert.equal(document.body.querySelector('[role="dialog"]'), null);
    assert.equal(appliedCount, 0);

    click(view.container.querySelector('button'));
    dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    assert.ok(dialog);
    openOptions(dialog, 'Status do lead');
    assert.equal(findCheckbox(dialog, 'Atendimento')?.checked, false);
  } finally {
    view.unmount();
  }
});


test('clicking the backdrop dismisses the filter modal without applying the draft', () => {
  let closed = 0;
  let applied = 0;
  const view = render(<WhatsAppInboxAdvancedFiltersDialog {...sharedProps} isOpen onClose={() => { closed += 1; }} onApply={() => { applied += 1; }} />);
  try {
    const panel = document.body.querySelector('[role="dialog"]');
    assert.ok(panel);
    act(() => panel.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    assert.equal(closed, 0);
    click(document.querySelector('.kds-dialog-backdrop'));
    assert.equal(closed, 1);
    assert.equal(applied, 0);
  } finally { view.unmount(); }
});
