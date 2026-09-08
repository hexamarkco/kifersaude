export type Lead = {
  id: string;
  nome_completo: string;
  telefone: string;
  email?: string;
  cep?: string;
  endereco?: string;
  cidade?: string;
  regiao?: string;
  estado?: string;
  origem?: string | null;
  origem_id?: string | null;
  tipo_contratacao?: string | null;
  tipo_contratacao_id?: string | null;
  operadora_atual?: string;
  status?: string | null;
  status_id?: string | null;
  responsavel?: string | null;
  responsavel_id?: string | null;
  data_criacao: string;
  ultimo_contato?: string | null;
  proximo_retorno?: string | null;
  tags?: string[];
  canal?: string | null;
  observacoes?: string;
  blackout_dates?: string[] | null;
  daily_send_limit?: number | null;
  skip_automation?: boolean | null;
  arquivado: boolean;
  favorito?: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadStatusHistory = {
  id: string;
  lead_id: string;
  status_anterior: string;
  status_novo: string;
  responsavel: string;
  observacao?: string;
  created_at: string;
};

export type LeadStatusConfig = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  padrao: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadOrigem = {
  id: string;
  nome: string;
  ativo: boolean;
  visivel_para_observadores: boolean;
  created_at: string;
};

