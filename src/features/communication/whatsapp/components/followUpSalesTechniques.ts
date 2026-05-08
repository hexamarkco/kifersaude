export type FollowUpSalesTechniqueOption = {
  id: string;
  name: string;
  description: string;
};

export const followUpSalesTechniqueOptions = [
  {
    id: 'rapport',
    name: 'Rapport',
    description: 'Criar proximidade e demonstrar atenção ao contexto do cliente.',
  },
  {
    id: 'spin-selling',
    name: 'SPIN Selling',
    description: 'Explorar situação, problema, implicação e necessidade de solução.',
  },
  {
    id: 'social-proof',
    name: 'Prova social',
    description: 'Reforçar segurança com exemplos ou validações sem inventar dados.',
  },
  {
    id: 'scarcity-urgency',
    name: 'Escassez e urgência',
    description: 'Indicar próximos passos e timing com cuidado, sem pressão artificial.',
  },
  {
    id: 'objection-handling',
    name: 'Contorno de objeções',
    description: 'Responder dúvidas prováveis com empatia e clareza comercial.',
  },
  {
    id: 'assumptive-close',
    name: 'Fechamento assumitivo',
    description: 'Conduzir para uma decisão ou ação objetiva de forma natural.',
  },
] as const satisfies readonly FollowUpSalesTechniqueOption[];
