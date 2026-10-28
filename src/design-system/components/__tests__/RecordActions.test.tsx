import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test } from 'vitest';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { RecordActions } from '../RecordActions';

test('keeps quick actions visible and supports keyboard navigation, disabled actions and focus return in the menu', async () => {
  let opened = 0;
  let removed = 0;
  const view = render(<RecordActions actions={[
    { label: 'Abrir', icon: Eye, onClick: () => { opened++; } },
    { label: 'Editar', icon: Pencil, disabled: true, onClick: () => { throw Error('Disabled action'); } },
    { label: 'Excluir', icon: Trash2, destructive: true, onClick: () => { removed++; } },
  ]} />);
  try {
    const quick = view.container.querySelector<HTMLButtonElement>('[aria-label="Abrir"]');
    const trigger = view.container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]');
    assert.ok(quick); assert.ok(trigger);
    assert.equal(trigger.getAttribute('aria-label'), 'Mais ações do registro');
    act(() => quick.click()); assert.equal(opened, 1);
    act(() => trigger.click());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 35)); });
    const menu = document.querySelector('[role="menu"]'); assert.ok(menu);
    const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    assert.equal(items[0].disabled, true);
    assert.ok(document.activeElement === items[1], 'focus reaches the first enabled menu item');
    act(() => items[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    assert.ok(document.activeElement === items[1], 'focus reaches the first enabled menu item');
    act(() => items[1].click());
    assert.equal(removed, 1);
    assert.equal(document.querySelector('[role="menu"]'), null);
    assert.ok(document.activeElement === trigger, 'focus returns to the menu trigger');
    act(() => trigger.click());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 35)); });
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('[role="menu"]'), null);
    assert.ok(document.activeElement === trigger, 'focus returns to the menu trigger');
  } finally { view.unmount(); }
});
