import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  applyLinePrefix,
  buildIndexedQuickReplies,
  buildLinkPreviewRetryPayload,
  buildSlashCommandState,
  buildTextRetryPayload,
  splitFollowUpLines,
  splitRewriteChunks,
} from '../utils';

test('builds slash-command results from indexed quick replies', () => {
  const indexed = buildIndexedQuickReplies([
    { id: '1', title: 'Boas vindas', message: 'Ola' },
    { id: '2', title: 'Follow-up', message: 'Vamos retomar' },
  ]);

  const state = buildSlashCommandState('/follow', indexed);
  assert.equal(state.active, true);
  assert.equal(state.results.length, 1);
  assert.equal(state.results[0].id, '2');
});

test('splits rewrite and follow-up drafts into sendable chunks', () => {
  assert.deepEqual(splitRewriteChunks('Parte 1\n---\nParte 2'), ['Parte 1', 'Parte 2']);
  assert.deepEqual(splitFollowUpLines('Linha 1\n\nLinha 2'), ['Linha 1', 'Linha 2']);
});

test('builds retry payloads for text and link preview sends', () => {
  assert.deepEqual(buildTextRetryPayload('Oi', 'msg-1'), {
    kind: 'text',
    content: 'Oi',
    quotedMessageId: 'msg-1',
  });

  assert.deepEqual(
    buildLinkPreviewRetryPayload(
      'Confira',
      {
        title: 'Example',
        description: 'desc',
        canonical: 'https://example.com',
        image: 'https://example.com/image.png',
      },
      'msg-2',
    ),
    {
      kind: 'link_preview',
      body: 'Confira',
      title: 'Example',
      description: 'desc',
      canonical: 'https://example.com',
      preview: 'https://example.com/image.png',
      quotedMessageId: 'msg-2',
    },
  );
});

test('applies quote prefix to the current line when there is no selection', () => {
  assert.deepEqual(applyLinePrefix('Ola mundo', 4, 4, '> '), {
    value: '> Ola mundo',
    selectionStart: 6,
    selectionEnd: 6,
  });
});

test('applies list prefix to a single selected line', () => {
  assert.deepEqual(applyLinePrefix('Primeira linha', 0, 13, '- '), {
    value: '- Primeira linha',
    selectionStart: 2,
    selectionEnd: 15,
  });
});

test('applies prefixes to multiple selected lines without touching blank lines', () => {
  assert.deepEqual(applyLinePrefix('Linha 1\n\nLinha 2', 0, 16, '> '), {
    value: '> Linha 1\n\n> Linha 2',
    selectionStart: 2,
    selectionEnd: 20,
  });
});
