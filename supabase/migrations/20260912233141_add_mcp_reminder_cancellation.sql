-- Preserve the existing reminder source of truth while distinguishing a
-- cancelled follow-up from a completed one. These fields are internal to the
-- CRM and are not exposed to unauthenticated clients.
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

CREATE INDEX IF NOT EXISTS idx_reminders_cancelled_at
  ON public.reminders (cancelled_at)
  WHERE cancelled_at IS NOT NULL;
