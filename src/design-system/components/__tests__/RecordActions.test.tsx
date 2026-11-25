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

test('groups compact menu actions while preserving labels, disabled state and keyboard navigation', async () => {
  let selected = 0;
  const view = render(<RecordActions visibleCount={0} actions={[
    { label: 'Ver detalhes', menuGroup: 'Lembrete', icon: Eye, onClick: () => {} },
    { label: 'Concluir e agendar em +1 dia útil', menuGroup: 'Concluir e agendar', compactLabel: '+1', icon: Pencil, disabled: true, onClick: () => { throw Error('Disabled action'); } },
    { label: 'Concluir e agendar em +2 dias úteis', menuGroup: 'Concluir e agendar', compactLabel: '+2', icon: Pencil, onClick: () => { selected = 2; } },
    { label: 'Excluir', menuGroup: 'Ações críticas', icon: Trash2, destructive: true, onClick: () => {} },
  ]} />);
  try {
    const trigger = view.container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]');
    assert.ok(trigger);
    act(() => trigger.click());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 35)); });
    const menu = document.querySelector('[role="menu"]'); assert.ok(menu);
    const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    assert.equal(menu.querySelectorAll('[role="group"]').length, 3);
    assert.equal(items[1].textContent, '+1');
    assert.equal(items[1].disabled, true);
    assert.equal(items[2].getAttribute('aria-label'), 'Concluir e agendar em +2 dias úteis');
    act(() => items[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })));
    assert.equal(document.activeElement, items[2]);
    act(() => items[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
    assert.equal(document.activeElement, items[3]);
    act(() => items[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })));
    assert.equal(document.activeElement, items[2]);
    act(() => items[2].click());
    assert.equal(selected, 2);
    assert.equal(document.querySelector('[role="menu"]'), null);
    assert.equal(document.activeElement, trigger);
  } finally { view.unmount(); }
});
