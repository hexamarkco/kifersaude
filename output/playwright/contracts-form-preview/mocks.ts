const options = {
  contract_status: [{ value: 'Em análise', label: 'Em análise', ativo: true }],
  contract_modalidade: [],
  contract_abrangencia: [],
  contract_acomodacao: [],
  contract_carencia: [],
  lead_responsavel: [],
};
const leadStatuses = [];

export const useConfig = () => ({ options, leadStatuses });
export const useProductionOperators = () => ({ operators: [], error: null });
export const listContractConversionLeads = async () => [];
export const listContractValueAdjustments = async () => [];
export const getOperadoras = async () => [];
export const configService = { getOperadoras };
export const formatContractModalityLabel = (value: string | null | undefined) => value ?? '';
export const formatContractPlanLabel = (value: string | null | undefined) => value ?? '';
export const saveContractRecord = async () => { throw new Error('Salvamento desativado na prévia local.'); };
export const deleteContractValueAdjustment = async () => { throw new Error('Exclusão desativada na prévia local.'); };
export const convertLeadAfterContractCreation = async () => { throw new Error('Conversão desativada na prévia local.'); };
