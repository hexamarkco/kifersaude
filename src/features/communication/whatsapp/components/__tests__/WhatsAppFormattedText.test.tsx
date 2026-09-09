import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { test } from 'vitest';

import WhatsAppFormattedText from '../WhatsAppFormattedText';

test('renders WhatsApp emphasis markers as semantic HTML', () => {
  const markup = renderToStaticMarkup(<WhatsAppFormattedText text="*Importante* e _agora_" />);

  assert.match(markup, /<strong>Importante<\/strong>/);
  assert.match(markup, /<em>agora<\/em>/);
});

test('renders safe external links without trailing punctuation', () => {
  const markup = renderToStaticMarkup(<WhatsAppFormattedText text="Veja https://example.com." />);

  assert.match(markup, /href="https:\/\/example\.com"/);
  assert.match(markup, /target="_blank"/);
  assert.match(markup, /rel="noreferrer"/);
});
