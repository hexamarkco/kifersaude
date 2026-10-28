import { render } from '@testing-library/react';
import { act, useState } from 'react';
import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import BlogPostsList from './BlogPostsList';

test('shows a retry instead of an empty state when loading articles fails', () => {
  let retries = 0;
  const retry = () => { retries += 1; };
  const view = render(<BlogPostsList hasPostsSnapshot={false} loading={false} loadError loadingPhase="hidden"
    onRetry={retry} onCreatePost={vi.fn()} onDeletePost={vi.fn()} onEditPost={vi.fn()}
    onPreviewPost={vi.fn()} onSearchTermChange={vi.fn()} onTogglePublish={vi.fn()}
    onStatusFilterChange={vi.fn()} statusFilter="" summary={{ published: 0, drafts: 0, views: 0, updated: 0 }}
    posts={[]} searchTerm="" />);

  assert.ok(view.container.querySelector('[role="alert"]')?.textContent?.includes('Não foi possível carregar os artigos'));
  assert.deepEqual(Array.from(view.container.querySelectorAll('.kds-kpi-value')).map(element => element.textContent), ['—', '—', '—', '—']);
  assert.ok(!view.container.textContent?.includes('Nenhum post encontrado'));
  const retryButton = Array.from(view.container.querySelectorAll('button')).find(button => button.textContent === 'Tentar novamente');
  assert.ok(retryButton);
  retryButton.click();
  assert.equal(retries, 1);
});

test('paginates articles and returns to a valid page when results shrink', () => {
  const posts = Array.from({ length: 12 }, (_, index) => ({
    id: String(index), title: `Artigo ${index + 1}`, slug: `artigo-${index + 1}`, excerpt: 'Resumo',
    content: 'Conteúdo', category: 'Guias', read_time: '2 min', author_id: 'demo', published: false,
    created_at: '2026-01-01T12:00:00', updated_at: '2026-01-01T12:00:00', views_count: 0,
  }));
  const props = { hasPostsSnapshot: true, loading: false, loadError: false, loadingPhase: 'hidden' as const,
    onRetry: vi.fn(), onCreatePost: vi.fn(), onDeletePost: vi.fn(), onEditPost: vi.fn(),
    onPreviewPost: vi.fn(), onSearchTermChange: vi.fn(), onStatusFilterChange: vi.fn(), onTogglePublish: vi.fn(),
    searchTerm: '', statusFilter: '', summary: { published: 0, drafts: 12, views: 0, updated: 0 } };
  function Harness() {
    const [visiblePosts, setVisiblePosts] = useState(posts);
    return <><button type="button" onClick={() => setVisiblePosts(posts.slice(0, 2))}>Reduzir</button><BlogPostsList {...props} posts={visiblePosts} /></>;
  }
  const view = render(<Harness />);
  assert.equal(view.container.querySelectorAll('tbody tr').length, 10);
  const next = view.container.querySelector<HTMLButtonElement>('button[aria-label="Próxima página"]');
  assert.ok(next);
  act(() => next.click());
  assert.equal(view.container.querySelectorAll('tbody tr').length, 2);
  assert.ok(view.container.querySelector('tbody')?.textContent?.includes('Artigo 11'));
  const reduce = Array.from(view.container.querySelectorAll('button')).find(button => button.textContent === 'Reduzir');
  assert.ok(reduce);
  act(() => reduce.click());
  assert.equal(view.container.querySelectorAll('tbody tr').length, 2);
  assert.ok(view.container.querySelector('tbody')?.textContent?.includes('Artigo 1'));
  assert.equal(view.container.querySelector('[aria-current="page"]')?.textContent, '1');
  view.unmount();
});
