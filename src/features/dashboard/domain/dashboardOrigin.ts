const normalizeComparableOrigin = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

export type DashboardOriginLabel = {
  key: string;
  label: string;
};

/**
 * Origens são texto livre em registros antigos. A chave ignora acentos,
 * maiúsculas/minúsculas e espaços extras, mas a tabela mantém a primeira
 * grafia encontrada como rótulo visível.
 */
export const resolveDashboardOriginLabel = (value: string | null | undefined): DashboardOriginLabel => {
  const label = String(value ?? '').replace(/\s+/g, ' ').trim() || 'Não informado';
  return {
    key: normalizeComparableOrigin(label),
    label,
  };
};
