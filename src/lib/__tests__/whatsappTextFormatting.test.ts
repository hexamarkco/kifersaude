import { test } from 'vitest';
import assert from 'node:assert/strict';

import { parseWhatsAppBlocks } from '../whatsappTextFormatting';

test('parses a quoted line as a quote block', () => {
  assert.deepEqual(parseWhatsAppBlocks('> texto'), [
    {
      type: 'quote',
      lines: [[{ type: 'text', value: 'texto' }]],
    },
  ]);
});

test('groups consecutive quoted lines into a single quote block', () => {
  assert.deepEqual(parseWhatsAppBlocks('> linha 1\n> linha 2'), [
    {
      type: 'quote',
      lines: [
        [{ type: 'text', value: 'linha 1' }],
        [{ type: 'text', value: 'linha 2' }],
      ],
    },
  ]);
});

test('groups consecutive list items into a single list block', () => {
  assert.deepEqual(parseWhatsAppBlocks('- item 1\n- item 2'), [
    {
      type: 'list',
      items: [
        [{ type: 'text', value: 'item 1' }],
        [{ type: 'text', value: 'item 2' }],
      ],
    },
  ]);
});

test('supports inline formatting inside quote and list blocks', () => {
  assert.deepEqual(parseWhatsAppBlocks('> *importante*\n- _observacao_'), [
    {
      type: 'quote',
      lines: [[{ type: 'bold', value: 'importante' }]],
    },
    {
      type: 'list',
      items: [[{ type: 'italic', value: 'observacao' }]],
    },
  ]);
});

test('keeps plain hyphens and angle brackets as paragraph text when not used at line start', () => {
  assert.deepEqual(parseWhatsAppBlocks('texto - comum\nabc > citacao?'), [
    {
      type: 'paragraph',
      lines: [[{ type: 'text', value: 'texto - comum' }]],
    },
    {
      type: 'paragraph',
      lines: [[{ type: 'text', value: 'abc > citacao?' }]],
    },
  ]);
});

test('does not format empty quote and list prefixes', () => {
  assert.deepEqual(parseWhatsAppBlocks('>\n- '), [
    {
      type: 'paragraph',
      lines: [[{ type: 'text', value: '>' }]],
    },
    {
      type: 'paragraph',
      lines: [[{ type: 'text', value: '- ' }]],
    },
  ]);
});

test('parses mixed paragraph, list and quote blocks in order', () => {
  assert.deepEqual(parseWhatsAppBlocks('intro\n- item\n> fim'), [
    {
      type: 'paragraph',
      lines: [[{ type: 'text', value: 'intro' }]],
    },
    {
      type: 'list',
      items: [[{ type: 'text', value: 'item' }]],
    },
    {
      type: 'quote',
      lines: [[{ type: 'text', value: 'fim' }]],
    },
  ]);
});
