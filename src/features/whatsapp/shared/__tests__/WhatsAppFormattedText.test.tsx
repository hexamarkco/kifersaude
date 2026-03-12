import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import { WhatsAppFormattedText } from '../components/WhatsAppFormattedText';

test('renders quote and list markup with inline formatting', () => {
  const markup = renderToStaticMarkup(
    <WhatsAppFormattedText text={'> *importante*\n- _item_'} className="sample" />,
  );

  assert.ok(markup.includes('class="sample"'));
  assert.ok(markup.includes('comm-card'));
  assert.ok(markup.includes('<strong class="font-semibold">importante</strong>'));
  assert.ok(markup.includes('<ul class="ml-5 list-disc space-y-1">'));
  assert.ok(markup.includes('<em class="italic">item</em>'));
});
