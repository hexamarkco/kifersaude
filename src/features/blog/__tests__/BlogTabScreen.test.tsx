import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '@testing-library/react';
import { test, vi } from 'vitest';
import BlogTabScreen from '../BlogTabScreen';

const calls = vi.hoisted(() => ({ save: 0, remove: 0, publish: 0, open: 0 }));
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'operator-demo' } }) }));
vi.mock('../data/blogRepository', () => ({
  listBlogPosts: async () => [{ id: 'demo', title: 'Orientação para escolher um plano', slug: 'orientacao', excerpt: 'Resumo da publicação', content: '<p>Conteúdo do artigo real.</p>', category: 'Guias', read_time: '3 min', published: false, created_at: '2026-10-20T12:00:00Z', views_count: 0 }],
  saveBlogPost: async () => { calls.save += 1; },
  deleteBlogPost: async () => { calls.remove += 1; },
  setBlogPostPublished: async () => { calls.publish += 1; },
}));
vi.mock('../../../design-system/components/RichTextEditor', () => ({
  default: ({ value, readOnly }: { value: string; readOnly?: boolean }) => <div data-testid="preview-content" data-readonly={readOnly}>{value}</div>,
}));

test('previews the selected article read-only without publishing, saving or opening a missing route', async () => {
  const originalOpen = window.open;
  window.open = () => { calls.open += 1; return null; };
  const view = render(<BlogTabScreen />);
  try {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    const preview = view.container.querySelector<HTMLButtonElement>('button[aria-label="Visualizar"]');
    assert.ok(preview);
    act(() => preview.click());
    const dialog = document.body.querySelector('[role="dialog"][aria-label="Prévia do artigo"]');
    assert.ok(dialog);
    assert.equal(dialog.querySelector('h2')?.textContent, 'Orientação para escolher um plano');
    assert.ok(dialog.textContent?.includes('Resumo da publicação'));
    assert.ok(dialog.textContent?.includes('Rascunho'));
    const content = dialog.querySelector('[data-testid="preview-content"]');
    assert.equal(content?.textContent, '<p>Conteúdo do artigo real.</p>');
    assert.equal(content?.getAttribute('data-readonly'), 'true');
    const close = dialog.querySelector<HTMLButtonElement>('.kds-dialog-footer button');
    assert.ok(close);
    act(() => close.click());
    assert.equal(document.body.querySelector('[role="dialog"]'), null);
    assert.deepEqual(calls, { save: 0, remove: 0, publish: 0, open: 0 });
  } finally { view.unmount(); window.open = originalOpen; }
});

test('filters articles by publication status without changing the totals', async () => {
  const view = render(<BlogTabScreen />);
  try {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    const filter = Array.from(view.container.querySelectorAll('button')).find(button => button.textContent?.includes('Todos os status'));
    assert.ok(filter);
    act(() => filter.click());
    const option = Array.from(document.body.querySelectorAll('[role="option"]')).find(element => element.textContent?.includes('Publicado')) as HTMLButtonElement | undefined;
    assert.ok(option);
    act(() => option.click());
    assert.ok(view.container.textContent?.includes('Nenhum post encontrado'));
    assert.deepEqual(Array.from(view.container.querySelectorAll('.kds-kpi-value')).map(element => element.textContent), ['0', '1', '0', '0']);
    assert.equal(view.container.querySelectorAll('tbody tr').length, 0);
  } finally { view.unmount(); }
});
