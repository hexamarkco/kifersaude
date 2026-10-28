import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import FormsScreen from '../FormsScreen';

vi.mock('../../../../lib/formsService', () => ({
  formsService: { getForms: async () => [{ id: 'demo', title: 'Cotação inicial', slug: 'cotacao', is_published: true, submission_count: 3 }] },
}));

test('keeps publication and record actions available in the responsive collection', async () => {
  const view = render(<FormsScreen />);
  try {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    assert.ok(view.container.querySelector('.kds-collection-table'));
    assert.ok(view.container.querySelector('.kds-collection-cards'));
    assert.ok(view.container.querySelector('input[aria-label="Buscar formulários"]'));
    const menu = view.container.querySelector<HTMLButtonElement>('.kds-collection-cards button[aria-haspopup="menu"]');
    assert.ok(menu);
    act(() => menu.click());
    const labels = Array.from(document.body.querySelectorAll('[role="menuitem"]')).map(item => item.textContent?.trim());
    assert.deepEqual(labels, ['Editar', 'Copiar link', 'Abrir formulário', 'Excluir']);
    assert.ok(view.container.querySelector('.kds-collection-cards [role="switch"]'));
  } finally { view.unmount(); }
});
