import assert from 'node:assert/strict';
import { test } from 'vitest';

import { isClickOutsideAll } from '../useClickOutside';

test('retorna false quando o target não existe (sem clique real)', () => {
  const popover = document.createElement('div');
  assert.equal(isClickOutsideAll(null, [popover]), false);
});

test('retorna false quando o clique é dentro de um dos elementos contidos', () => {
  const popover = document.createElement('div');
  const child = document.createElement('button');
  popover.appendChild(child);

  assert.equal(isClickOutsideAll(child, [popover]), false);
  assert.equal(isClickOutsideAll(popover, [popover]), false);
});

test('retorna true quando o clique é fora de todos os elementos contidos', () => {
  const popover = document.createElement('div');
  const outside = document.createElement('span');

  assert.equal(isClickOutsideAll(outside, [popover]), true);
});

test('suporta múltiplos elementos contidos (popover + gatilho separados)', () => {
  const popover = document.createElement('div');
  const trigger = document.createElement('button');
  const outside = document.createElement('span');

  assert.equal(isClickOutsideAll(trigger, [popover, trigger]), false);
  assert.equal(isClickOutsideAll(outside, [popover, trigger]), true);
});

test('ignora elementos nulos/indefinidos na lista (gatilho ainda não montado)', () => {
  const popover = document.createElement('div');
  const outside = document.createElement('span');

  assert.equal(isClickOutsideAll(outside, [popover, null, undefined]), true);
  assert.equal(isClickOutsideAll(popover, [popover, null, undefined]), false);
});

test('lista vazia de elementos contidos: qualquer clique é "fora"', () => {
  const anything = document.createElement('div');
  assert.equal(isClickOutsideAll(anything, []), true);
});
