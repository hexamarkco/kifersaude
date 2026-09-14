import type { Lead } from "../../leads";

export type ReminderPriority = "normal" | "alta" | "baixa";

export const FOLLOW_UP_REMINDER_TYPE = "Follow-up";

export const MANUAL_REMINDER_TYPES = [FOLLOW_UP_REMINDER_TYPE, "Outro"] as const;

export type ManualReminderType = (typeof MANUAL_REMINDER_TYPES)[number];

const LEGACY_FOLLOW_UP_TYPES = new Set(["retorno", "follow up", "follow-up", "followup"]);

export const normalizeReminderType = (type: string) =>
  LEGACY_FOLLOW_UP_TYPES.has(type.trim().toLocaleLowerCase("pt-BR"))
    ? FOLLOW_UP_REMINDER_TYPE
    : type;

export const normalizeReminderTitle = (title: string) =>
  title
    .replace(/^retomar contato\s*:/iu, "Follow-up:")
    .replace(/^(?:retorno|follow[ -]?up) agendado\s*:/iu, "Follow-up:")
    .replace(/^(?:retomar )?follow[ -]?up de whatsapp$/iu, "Follow-up");

export type ManualReminderPrompt = {
  lead: Lead;
  promptMessage: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultType?: ManualReminderType;
  defaultPriority?: ReminderPriority;
};
