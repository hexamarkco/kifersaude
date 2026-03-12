import type { Lead } from "../../../lib/supabase";

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
  | "telefone";
export type LeadsViewMode = "list" | "kanban";

export type StatusReminderRule = {
  hoursFromNow: number;
  title: string;
  description?: string;
  type?: string;
  priority?: "alta" | "normal" | "baixa";
};
