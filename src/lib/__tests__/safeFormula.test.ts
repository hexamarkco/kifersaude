import assert from 'node:assert/strict';
import { test } from 'vitest';

import { evaluateSafeFormula } from '../safeFormula';

const context = {
  primeiro_nome: 'Luiza',
  lead: {
    id: 'LEAD-1',
    telefone: '11999999999',
  },
};

test('avalia helpers permitidos, operadores e propriedades proprias', () => {
  assert.equal(evaluateSafeFormula('lead.telefone', context), '11999999999');
  assert.equal(evaluateSafeFormula('len(lead.telefone) > 10', context), true);
  assert.equal(evaluateSafeFormula('upper(primeiro_nome)', context), 'LUIZA');
  assert.equal(evaluateSafeFormula('concat("a", "b")', context), 'ab');
  assert.equal(evaluateSafeFormula('if(true, "sim", "nao")', context), 'sim');
  assert.equal(evaluateSafeFormula('=if(true, "sim", "nao")', context), 'sim');
  assert.equal(
    evaluateSafeFormula('=if(len(lead.telefone) > 10, concat(upper(primeiro_nome), "-", lower(lead.id)), "invalido")', context),
    'LUIZA-lead-1',
  );
  assert.equal(evaluateSafeFormula('number("12") + 3', context), 15);

  const date = evaluateSafeFormula('dateAdd(now(), 2, "days")', context, {
    now: () => new Date('2025-01-10T12:00:00.000Z'),
  });
  assert.ok(date instanceof Date);
  assert.equal(date.toISOString(), '2025-01-12T12:00:00.000Z');

  assert.equal(
    evaluateSafeFormula('formatDate(now(), "datetime")', context, {
      now: () => new Date('2025-01-10T12:00:00.000Z'),
      formatDate: (value, format) => `${format}:${(value as Date).toISOString()}`,
    }),
    'datetime:2025-01-10T12:00:00.000Z',
  );
});

test('rejeita globals, execucao arbitraria e acesso a prototipos', () => {
  (globalThis as { safeFormulaExploit?: boolean }).safeFormulaExploit = false;

  [
    'globalThis.safeFormulaExploit = true',
    'Function("return globalThis")()',
    'lead.__proto__',
    'lead.constructor.constructor("return 1")()',
    'lead.toString',
    'lead["id"]',
    'now().getTime()',
  ].forEach((expression) => {
    assert.equal(evaluateSafeFormula(expression, context), null, expression);
  });

  assert.equal((globalThis as { safeFormulaExploit?: boolean }).safeFormulaExploit, false);
  delete (globalThis as { safeFormulaExploit?: boolean }).safeFormulaExploit;
});
