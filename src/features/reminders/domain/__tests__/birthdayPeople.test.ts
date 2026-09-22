import assert from 'node:assert/strict';
import { test } from 'vitest';
import { deduplicateBirthdayPeople } from '../birthdayPeople';

const contracts = [
  { id: 'old', lead_id: 'same-lead', created_at: '2025-01-01T00:00:00Z' },
  { id: 'new', lead_id: 'same-lead', created_at: '2026-01-01T00:00:00Z' },
];
const person = {
  id: 'holder-old', contract_id: 'old', cpf: '123.456.789-00',
  nome_completo: 'Ana Silva', data_nascimento: '1980-09-22',
};

test('one birthday per CPF across contracts, choosing the latest contract regardless of input order', () => {
  const latest = { ...person, id: 'holder-new', contract_id: 'new', cpf: '12345678900' };
  assert.deepEqual(deduplicateBirthdayPeople([person, latest], contracts), [latest]);
  assert.deepEqual(deduplicateBirthdayPeople([latest, person], contracts), [latest]);
});

test('different people keep their own birthdays even with the same name, date and lead', () => {
  const other = { ...person, id: 'other', cpf: '98765432100' };
  assert.equal(deduplicateBirthdayPeople([person, other], contracts).length, 2);
});

test('dependents without CPF use normalized name and full birth date across contracts', () => {
  const dependent = { ...person, cpf: null, nome_completo: '  ANA   Silva  ' };
  const latest = { ...person, cpf: '', id: 'dependent-new', contract_id: 'new' };
  const sibling = { ...latest, id: 'sibling', data_nascimento: '1982-09-22' };
  assert.deepEqual(deduplicateBirthdayPeople([dependent, latest, sibling], contracts), [latest, sibling]);
});

test('incomplete identities are not merged and source arrays are not changed', () => {
  const first = { ...person, cpf: null, nome_completo: '' };
  const second = { ...first, id: 'second' };
  const input = [first, second];
  assert.deepEqual(deduplicateBirthdayPeople(input, contracts), input);
  assert.deepEqual(input, [first, second]);
});

test('equal contract dates have a deterministic representative', () => {
  const second = { ...person, id: 'zzz' };
  assert.deepEqual(deduplicateBirthdayPeople([person, second], contracts), [second]);
  assert.deepEqual(deduplicateBirthdayPeople([second, person], contracts), [second]);
});
