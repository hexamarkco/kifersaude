import { describe, expect, it } from 'vitest';
import { getResponsibleDisplayName, resolveResponsibleIds } from './responsibleFilter';

const options = [
  { id: 'owner-luiza', label: 'Luiza', value: 'Luiza' },
  { id: 'owner-nick', label: 'Nick', value: 'Nick' },
];

describe('responsibleFilter', () => {
  it('converte valor exibido e filtros antigos por nome para ids do banco', () => {
    expect(resolveResponsibleIds(['Luiza', 'owner-nick'], options)).toEqual(['owner-luiza', 'owner-nick']);
  });

  it('ignora responsáveis inexistentes sem remover o filtro', () => {
    expect(resolveResponsibleIds(['Nao cadastrado'], options)).toEqual([]);
  });

  it('resolve o nome mostrado a partir do id persistido no lead', () => {
    expect(getResponsibleDisplayName('owner-nick', options)).toBe('Nick');
    expect(getResponsibleDisplayName('owner-unknown', options)).toBeNull();
  });
});
