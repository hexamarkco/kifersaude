import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import FormsScreen from '../FormsScreen';

const fixture = vi.hoisted(() => ({ forms: [{ id: 'demo', title: 'Cotação inicial', slug: 'cotacao', is_published: true, submission_count: 3 }] }));
vi.mock('../../../../lib/formsService', () => ({ formsService: { getForms: async () => fixture.forms } }));

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

test('filters publication status and resets pagination when searching', async () => {
  fixture.forms = Array.from({ length: 12 }, (_, index) => ({ id: String(index), title: `Formulário ${index + 1}`, slug: `form-${index + 1}`, is_published: index % 2 === 0, submission_count: 0 }));
  const view = render(<FormsScreen />);
  try {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    const next = view.container.querySelector<HTMLButtonElement>('button[aria-label="Próxima página"]');
    assert.ok(next);
    act(() => next.click());
    assert.ok(view.container.querySelector('.kds-collection-table')?.textContent?.includes('Formulário 12'));
    const input = view.container.querySelector<HTMLInputElement>('input[aria-label="Buscar formulários"]')!;
    const search = (value: string) => act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
    search('Formulário 1');
    assert.equal(view.container.querySelector('[aria-current="page"]')?.textContent, '1');
    act(() => Array.from(view.container.querySelectorAll('button')).find(button => button.textContent?.includes('Todos os status'))!.click());
    act(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[role=option]')).find(option => option.textContent?.includes('Rascunho'))!.click());
    assert.ok(view.container.querySelector('.kds-collection-table')?.textContent?.includes('Formulário 10'));
    assert.ok(!view.container.querySelector('.kds-collection-table')?.textContent?.includes('Formulário 11'));
    search('inexistente');
    act(() => Array.from(view.container.querySelectorAll('button')).find(button => button.textContent?.includes('Limpar filtros'))!.click());
    assert.equal((view.container.querySelector<HTMLInputElement>('input[aria-label="Buscar formulários"]')! as HTMLInputElement).value, '');
    assert.ok(Array.from(view.container.querySelectorAll('button')).find(button => button.textContent?.includes('Todos os status'))!);
  } finally {
    view.unmount();
    fixture.forms = [{ id: 'demo', title: 'Cotação inicial', slug: 'cotacao', is_published: true, submission_count: 3 }];
  }
});
