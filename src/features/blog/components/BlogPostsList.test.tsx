import { render } from '@testing-library/react';
import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import BlogPostsList from './BlogPostsList';

test('shows a retry instead of an empty state when loading articles fails', () => {
  let retries = 0;
  const retry = () => { retries += 1; };
  const view = render(<BlogPostsList hasPostsSnapshot={false} loading={false} loadError loadingPhase="hidden"
    onRetry={retry} onCreatePost={vi.fn()} onDeletePost={vi.fn()} onEditPost={vi.fn()}
    onPreviewPost={vi.fn()} onSearchTermChange={vi.fn()} onTogglePublish={vi.fn()}
    posts={[]} searchTerm="" />);

  assert.ok(view.container.querySelector('[role="alert"]')?.textContent?.includes('Não foi possível carregar os artigos'));
  assert.ok(!view.container.textContent?.includes('Nenhum post encontrado'));
  const retryButton = Array.from(view.container.querySelectorAll('button')).find(button => button.textContent === 'Tentar novamente');
  assert.ok(retryButton);
  retryButton.click();
  assert.equal(retries, 1);
});
