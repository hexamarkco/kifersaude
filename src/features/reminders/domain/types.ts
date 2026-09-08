export type Reminder = {
  id: string;
  contract_id?: string;
  lead_id?: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  data_lembrete: string;
  lido: boolean;
  prioridade: string;
  responsavel?: string;
  tags?: string[];
  recorrencia?: string;
  recorrencia_config?: unknown;
  tempo_estimado_minutos?: number;
  anexos?: unknown[];
  concluido_em?: string;
  snooze_count?: number;
  ultima_modificacao?: string;
  created_at: string;
};

