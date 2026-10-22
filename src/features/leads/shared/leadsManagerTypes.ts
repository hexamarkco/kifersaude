import type { Lead } from "../domain/types";

export type LeadsManagerProps = {
  onConvertToContract?: (lead: Lead) => void;
  initialStatusFilter?: string[];
  initialLeadIdFilter?: string;
};

export type LeadsSortField =
  | "created_at"
  | "nome"
  | "origem"
  | "tipo_contratacao"
  | "telefone"
  | "status"
  | "responsavel"
  | "proximo_retorno";
export type LeadsViewMode = "list" | "kanban";

export type StatusReminderRule = {
  hoursFromNow: number;
  title: string;
  description?: string;
  type?: string;
  priority?: "alta" | "normal" | "baixa";
};
