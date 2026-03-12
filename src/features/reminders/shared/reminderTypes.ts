import type { Lead } from "../../../lib/supabase";

export type ReminderPriority = "normal" | "alta" | "baixa";

export type ManualReminderPrompt = {
  lead: Lead;
  promptMessage: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultType?: "Retorno" | "Follow-up" | "Outro";
  defaultPriority?: ReminderPriority;
};
