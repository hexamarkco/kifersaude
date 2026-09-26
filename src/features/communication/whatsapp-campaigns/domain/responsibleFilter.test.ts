import assert from 'node:assert/strict';
import { test } from 'vitest';
import { getResponsibleDisplayName, resolveResponsibleIds } from './responsibleFilter';

const options = [
  { id: 'owner-luiza', label: 'Luiza', value: 'Luiza' },
  { id: 'owner-nick', label: 'Nick', value: 'Nick' },
];

test('converte valor exibido e filtros antigos por nome para ids do banco', () => {
  assert.deepEqual(resolveResponsibleIds(['Luiza', 'owner-nick'], options), ['owner-luiza', 'owner-nick']);
});

test('ignora responsáveis inexistentes sem remover o filtro', () => {
  assert.deepEqual(resolveResponsibleIds(['Nao cadastrado'], options), []);
});

test('resolve o nome mostrado a partir do id persistido no lead', () => {
  assert.equal(getResponsibleDisplayName('owner-nick', options), 'Nick');
  assert.equal(getResponsibleDisplayName('owner-unknown', options), null);
});
