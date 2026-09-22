type BirthdayPerson = {
  id: string;
  contract_id: string;
  cpf?: string | null;
  nome_completo: string;
  data_nascimento: string;
  created_at?: string | null;
};

type BirthdayContract = { id: string; created_at?: string | null };

// Keep the identity compatible with the database's build_*_pessoa_chave functions.
const personKey = (person: BirthdayPerson): string => {
  const cpf = person.cpf?.replace(/\D/g, '');
  if (cpf) return `cpf:${cpf}`;
  const name = person.nome_completo.toLowerCase().replace(/\s+/g, ' ').trim();
  return name && person.data_nascimento
    ? `nome:${name}|nasc:${person.data_nascimento}`
    : `id:${person.id}`;
};

const timestamp = (value?: string | null): number => value ? Date.parse(value) || 0 : 0;

export function deduplicateBirthdayPeople<T extends BirthdayPerson>(
  people: readonly T[],
  contracts: readonly BirthdayContract[],
): T[] {
  const contractDates = new Map(contracts.map((contract) => [contract.id, timestamp(contract.created_at)]));
  const byPerson = new Map<string, T>();
  for (const person of people) {
    const key = personKey(person);
    const existing = byPerson.get(key);
    const newest = existing && (
      (contractDates.get(person.contract_id) ?? 0) - (contractDates.get(existing.contract_id) ?? 0)
      || timestamp(person.created_at) - timestamp(existing.created_at)
      || person.id.localeCompare(existing.id)
    );
    if (!existing || (newest ?? 0) > 0) byPerson.set(key, person);
  }
  return [...byPerson.values()];
}
