/*
  # Enable Realtime for the AI sandbox

  `/chat` subscribes to sandbox messages while a scenario is running and to
  the final test-run verdict. Keep the publication changes idempotent so the
  migration is safe across environments where a table may already be present.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1
        FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'ai_sandbox_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_sandbox_messages;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'ai_sandbox_test_runs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_sandbox_test_runs;
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'ai_sandbox_conversations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_sandbox_conversations;
    END IF;
  END IF;
END;
$$;
