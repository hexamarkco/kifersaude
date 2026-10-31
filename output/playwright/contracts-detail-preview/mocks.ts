export const useAuth = () => ({ role: 'admin', user: { id: 'demo-user' } });
export const useConfig = () => ({ getRoleModulePermission: () => ({ can_view: true, can_edit: true }) });
export const getContractDetailsSnapshot = async () => {
  if (window.location.search.includes('error')) throw new Error('Falha de demonstração');
  if (window.location.search.includes('slow')) await new Promise((resolve) => setTimeout(resolve, 1800));
  return {
    holders: [{
      id: 'demo-holder-1',
      contract_id: 'demo-contract-413780',
      nome_completo: 'Titular de demonstração',
      cpf: '000.000.000-00',
      data_nascimento: '1985-05-12',
      telefone: '(21) 00000-0000',
      email: 'titular@example.invalid',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      created_at: '2026-10-29T12:00:00.000Z',
      updated_at: '2026-10-29T12:00:00.000Z',
    }],
    dependents: [{
      id: 'demo-dependent-1',
      contract_id: 'demo-contract-413780',
      holder_id: 'demo-holder-1',
      nome_completo: 'Dependente de demonstração',
      data_nascimento: '2012-03-01',
      relacao: 'Filho(a)',
      created_at: '2026-10-29T12:00:00.000Z',
      updated_at: '2026-10-29T12:00:00.000Z',
    }],
    interactions: [],
    adjustments: [],
    documents: [],
    documentsError: null,
  };
};
export const deleteContractDependent = async () => undefined;
export const deleteContractHolder = async () => undefined;
export const deleteContractInteraction = async () => undefined;
export const saveContractInteraction = async () => undefined;
export const updateContractEligibleLives = async () => undefined;
export const formatContractEntityName = (value: string) => value;
export const formatContractModalityLabel = (value: string) => value;
export const formatContractPlanLabel = (value: string) => value;
