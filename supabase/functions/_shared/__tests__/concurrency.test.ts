import assert from 'node:assert/strict';
import { test } from 'vitest';

import { mapWithConcurrency } from '../concurrency';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('processa todos os itens e preserva a ordem dos resultados independente da ordem de conclusão', async () => {
  const items = [30, 10, 20, 5, 25];
  const results = await mapWithConcurrency(items, 3, async (item) => {
    await delay(item);
    return item * 2;
  });

  assert.deepEqual(results, [60, 20, 40, 10, 50]);
});

test('nunca excede o limite de concorrência configurado', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const items = Array.from({ length: 12 }, (_, i) => i);

  await mapWithConcurrency(items, 4, async (item) => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await delay(5);
    inFlight -= 1;
    return item;
  });

  assert.ok(maxInFlight <= 4, `esperava no máximo 4 simultâneos, teve ${maxInFlight}`);
  assert.equal(maxInFlight, 4, 'deveria de fato atingir o teto de concorrência com 12 itens e limite 4');
});

test('lista vazia retorna resultado vazio sem chamar o worker', async () => {
  let calls = 0;
  const results = await mapWithConcurrency([], 5, async () => {
    calls += 1;
    return null;
  });

  assert.deepEqual(results, []);
  assert.equal(calls, 0);
});

test('concorrência maior que o número de itens não gera chamadas extras', async () => {
  let calls = 0;
  const results = await mapWithConcurrency([1, 2, 3], 10, async (item) => {
    calls += 1;
    return item;
  });

  assert.equal(calls, 3);
  assert.deepEqual(results, [1, 2, 3]);
});

test('propaga rejeição de um worker sem travar (Promise.all padrão)', async () => {
  await assert.rejects(
    () =>
      mapWithConcurrency([1, 2, 3], 2, async (item) => {
        if (item === 2) throw new Error('falhou no item 2');
        await delay(5);
        return item;
      }),
    /falhou no item 2/,
  );
});
