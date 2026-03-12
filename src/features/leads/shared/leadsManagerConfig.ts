import { LayoutGrid, List } from "lucide-react";

import type { TabItem } from "../../../components/ui/Tabs";
import type {
  LeadsSortField,
  LeadsViewMode,
  StatusReminderRule,
} from "./leadsManagerTypes";

export const STATUS_REMINDER_RULES: Record<string, StatusReminderRule> = {
  "contato realizado": {
    hoursFromNow: 24,
    title: "Revisar contato e planejar próximo passo",
    description: "Confirme interesse e avance para proposta ou requalificação.",
    type: "Follow-up",
    priority: "alta",
  },
  "proposta em análise": {
    hoursFromNow: 48,
    title: "Acompanhar proposta em análise",
    description: "Verifique dúvidas pendentes e reforce benefícios do plano.",
    type: "Retorno",
    priority: "normal",
  },
};

export const SORT_OPTIONS: Array<{ value: LeadsSortField; label: string }> = [
  { value: "created_at", label: "Data de criação" },
  { value: "nome", label: "Nome (A-Z)" },
  { value: "origem", label: "Origem (A-Z)" },
  { value: "tipo_contratacao", label: "Tipo (A-Z)" },
  { value: "telefone", label: "Telefone (0-9)" },
];

export const VIEW_MODE_TABS: TabItem<LeadsViewMode>[] = [
  { id: "list", label: "Lista", icon: List },
  { id: "kanban", label: "Kanban", icon: LayoutGrid },
];
