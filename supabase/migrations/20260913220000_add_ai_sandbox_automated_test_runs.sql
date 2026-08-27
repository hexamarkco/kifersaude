/*
  # Automated test runs for the AI sandbox chat

  Lets a batch of scripted lead personas be run against the autonomous
  attendance playbook (ai-sandbox-run-scenario edge function) without a
  human typing each message. Automated conversations are flagged
  (is_automated) so they stay out of the human's manual sandbox list by
  default, and each run gets an AI-judged verdict against the playbook
  rules stored in ai_sandbox_test_runs for later review.
*/

BEGIN;

ALTER TABLE public.ai_sandbox_conversations
  ADD COLUMN IF NOT EXISTS is_automated boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ai_sandbox_conversations_is_automated
  ON public.ai_sandbox_conversations (is_automated, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_sandbox_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_sandbox_conversations(id) ON DELETE CASCADE,
  scenario_key text NOT NULL,
  scenario_label text NOT NULL,
  turns integer NOT NULL DEFAULT 0,
  handoff_triggered boolean NOT NULL DEFAULT false,
  passed boolean,
  verdict jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sandbox_test_runs_created_at
  ON public.ai_sandbox_test_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_sandbox_test_runs_conversation_id
  ON public.ai_sandbox_test_runs (conversation_id);

ALTER TABLE public.ai_sandbox_test_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ai sandbox test runs" ON public.ai_sandbox_test_runs;
CREATE POLICY "Authenticated users can view ai sandbox test runs"
  ON public.ai_sandbox_test_runs
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
