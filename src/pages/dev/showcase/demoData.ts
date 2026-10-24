export type DemoContact = {
  id: number;
  name: string;
  email: string;
  phone: string;
  operator: string;
  status: string;
  value: number;
  notes?: string;
};
export const demoContacts: DemoContact[] = [
  {
    id: 1,
    name: 'Ana Paula Ribeiro',
    email: 'ana@example.com',
    phone: '(11) 99999-0101',
    operator: 'Amil',
    status: 'Em atendimento',
    value: 1240,
  },
  {
    id: 2,
    name: 'Bruno Costa',
    email: 'bruno@example.com',
    phone: '(11) 99999-0102',
    operator: 'Bradesco Saúde',
    status: 'Proposta enviada',
    value: 1850,
  },
  {
    id: 3,
    name: 'Carolina Mendes',
    email: 'carolina@example.com',
    phone: '(11) 99999-0103',
    operator: 'SulAmérica',
    status: 'Novo contato',
    value: 980,
  },
  {
    id: 4,
    name: 'Daniel Oliveira',
    email: 'daniel@example.com',
    phone: '(11) 99999-0104',
    operator: 'Amil',
    status: 'Contratado',
    value: 1620,
  },
  {
    id: 5,
    name: 'Elisa Santos',
    email: 'elisa@example.com',
    phone: '(11) 99999-0105',
    operator: 'SulAmérica',
    status: 'Em atendimento',
    value: 2100,
  },
  {
    id: 6,
    name: 'Felipe Almeida',
    email: 'felipe@example.com',
    phone: '(11) 99999-0106',
    operator: 'Bradesco Saúde',
    status: 'Proposta enviada',
    value: 1450,
  },
  {
    id: 7,
    name: 'Gabriela Lima',
    email: 'gabriela@example.com',
    phone: '(11) 99999-0107',
    operator: 'Amil',
    status: 'Novo contato',
    value: 860,
  },
  {
    id: 8,
    name: 'Henrique Souza',
    email: 'henrique@example.com',
    phone: '(11) 99999-0108',
    operator: 'SulAmérica',
    status: 'Contratado',
    value: 2380,
  },
];
export const operatorOptions = ['Amil', 'Bradesco Saúde', 'SulAmérica'].map(
  (value) => ({ value, label: value }),
);
export const statuses = [
  'Novo contato',
  'Em atendimento',
  'Proposta enviada',
  'Contratado',
];
export const statusOptions = statuses.map((value) => ({ value, label: value }));
