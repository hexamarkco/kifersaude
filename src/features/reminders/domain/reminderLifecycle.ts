import type { Database } from '../../../infrastructure/supabase';

type ReminderState = { lido?: boolean | null; cancelled_at?: string | null };
type ReminderPatch = Database['public']['Tables']['reminders']['Update'];

// lido é o estado de encerramento, inclusive no histórico sem data conhecida.
export const isReminderPending = (reminder: ReminderState): boolean =>
  reminder.lido === false && !reminder.cancelled_at;

export function normalizeReminderLifecyclePatch(patch: ReminderPatch): ReminderPatch {
  if (patch.lido === true) {
    return { ...patch, concluido_em: patch.concluido_em ?? new Date().toISOString() };
  }
  if (patch.lido === false) {
    return { ...patch, concluido_em: null };
  }
  return patch;
}
