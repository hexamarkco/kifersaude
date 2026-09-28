import assert from 'node:assert/strict';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxOptimisticMessageTimestamps } from '../useInboxOptimisticMessageTimestamps';

type Allocator = ReturnType<typeof useInboxOptimisticMessageTimestamps>;

const Harness = ({ capture }: { capture: (allocator: Allocator) => void }) => {
  capture(useInboxOptimisticMessageTimestamps());
  return null;
};

test('gera timestamps crescentes por conversa sem serializar conversas diferentes', () => {
  const originalNow = Date.now;
  Date.now = () => 1_000;
  let allocator!: Allocator;
  const view = render(<Harness capture={(value) => { allocator = value; }} />);

  try {
    assert.deepEqual(allocator.allocateOptimisticMessageTimestamps('chat-1', 3), [
      '1970-01-01T00:00:01.000Z',
      '1970-01-01T00:00:01.001Z',
      '1970-01-01T00:00:01.002Z',
    ]);
    assert.deepEqual(allocator.allocateOptimisticMessageTimestamps('chat-1', 2), [
      '1970-01-01T00:00:01.003Z',
      '1970-01-01T00:00:01.004Z',
    ]);
    assert.deepEqual(allocator.allocateOptimisticMessageTimestamps('chat-2', 1), [
      '1970-01-01T00:00:01.000Z',
    ]);
  } finally {
    view.unmount();
    Date.now = originalNow;
  }
});
