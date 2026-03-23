/*
  # Optimize WhatsApp inbox hot path

  - Replace per-message read markers with shared per-chat cursors for the hot path
  - Keep unread counts compatible with legacy read markers during rollout
  - Add an index for the primary chat list ordering
*/

CREATE TABLE IF NOT EXISTS public.whatsapp_chat_read_cursors (
  chat_id text PRIMARY KEY,
  last_read_at timestamptz NOT NULL,
  last_read_message_id text REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  marked_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_chat_read_cursors IS
  'Shared WhatsApp unread cursor per chat used to avoid per-message read writes on the hot path.';

CREATE INDEX IF NOT EXISTS idx_whatsapp_chat_read_cursors_updated_at
  ON public.whatsapp_chat_read_cursors (updated_at DESC);

ALTER TABLE public.whatsapp_chat_read_cursors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read whatsapp chat read cursors" ON public.whatsapp_chat_read_cursors;
CREATE POLICY "Authenticated users can read whatsapp chat read cursors"
  ON public.whatsapp_chat_read_cursors FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert whatsapp chat read cursors" ON public.whatsapp_chat_read_cursors;
CREATE POLICY "Authenticated users can insert whatsapp chat read cursors"
  ON public.whatsapp_chat_read_cursors FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND marked_by_user_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can update whatsapp chat read cursors" ON public.whatsapp_chat_read_cursors;
CREATE POLICY "Authenticated users can update whatsapp chat read cursors"
  ON public.whatsapp_chat_read_cursors FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL AND marked_by_user_id = auth.uid());

WITH latest_legacy_reads AS (
  SELECT DISTINCT ON (m.chat_id)
    m.chat_id,
    COALESCE(m.timestamp, m.created_at) AS last_read_at,
    r.message_id AS last_read_message_id,
    r.user_id AS marked_by_user_id,
    r.read_at
  FROM public.whatsapp_message_reads r
  JOIN public.whatsapp_messages m ON m.id = r.message_id
  WHERE m.direction = 'inbound'
    AND COALESCE(m.is_deleted, false) = false
  ORDER BY m.chat_id, COALESCE(m.timestamp, m.created_at) DESC, r.read_at DESC, r.message_id DESC
)
INSERT INTO public.whatsapp_chat_read_cursors (
  chat_id,
  last_read_at,
  last_read_message_id,
  marked_by_user_id,
  created_at,
  updated_at
)
SELECT
  chat_id,
  last_read_at,
  last_read_message_id,
  marked_by_user_id,
  COALESCE(read_at, now()),
  COALESCE(read_at, now())
FROM latest_legacy_reads
ON CONFLICT (chat_id) DO UPDATE
SET
  last_read_at = GREATEST(public.whatsapp_chat_read_cursors.last_read_at, EXCLUDED.last_read_at),
  last_read_message_id = CASE
    WHEN EXCLUDED.last_read_at >= public.whatsapp_chat_read_cursors.last_read_at THEN EXCLUDED.last_read_message_id
    ELSE public.whatsapp_chat_read_cursors.last_read_message_id
  END,
  marked_by_user_id = CASE
    WHEN EXCLUDED.last_read_at >= public.whatsapp_chat_read_cursors.last_read_at THEN EXCLUDED.marked_by_user_id
    ELSE public.whatsapp_chat_read_cursors.marked_by_user_id
  END,
  updated_at = GREATEST(public.whatsapp_chat_read_cursors.updated_at, EXCLUDED.updated_at);

CREATE OR REPLACE FUNCTION public.get_whatsapp_unread_counts(current_user_id uuid)
RETURNS TABLE (chat_id text, unread_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH inbound_messages AS (
    SELECT
      m.chat_id,
      COALESCE(m.timestamp, m.created_at) AS message_at
    FROM public.whatsapp_messages m
    WHERE m.direction = 'inbound'
      AND COALESCE(m.is_deleted, false) = false
  ),
  last_outbound AS (
    SELECT
      m.chat_id,
      MAX(COALESCE(m.timestamp, m.created_at)) AS last_outbound_at
    FROM public.whatsapp_messages m
    WHERE m.direction = 'outbound'
      AND COALESCE(m.is_deleted, false) = false
    GROUP BY m.chat_id
  ),
  last_read_by_anyone AS (
    SELECT
      reads.chat_id,
      MAX(reads.last_read_at) AS last_read_at
    FROM (
      SELECT
        c.chat_id,
        c.last_read_at
      FROM public.whatsapp_chat_read_cursors c

      UNION ALL

      SELECT
        m.chat_id,
        MAX(COALESCE(m.timestamp, m.created_at)) AS last_read_at
      FROM public.whatsapp_message_reads r
      JOIN public.whatsapp_messages m ON m.id = r.message_id
      WHERE m.direction = 'inbound'
        AND COALESCE(m.is_deleted, false) = false
      GROUP BY m.chat_id
    ) reads
    GROUP BY reads.chat_id
  ),
  cutoff_by_chat AS (
    SELECT
      chats.chat_id,
      GREATEST(
        COALESCE(last_outbound.last_outbound_at, '-infinity'::timestamptz),
        COALESCE(last_read_by_anyone.last_read_at, '-infinity'::timestamptz)
      ) AS cutoff_at
    FROM (
      SELECT DISTINCT inbound_messages.chat_id
      FROM inbound_messages
    ) chats
    LEFT JOIN last_outbound ON last_outbound.chat_id = chats.chat_id
    LEFT JOIN last_read_by_anyone ON last_read_by_anyone.chat_id = chats.chat_id
  )
  SELECT
    inbound_messages.chat_id,
    COUNT(*)::int AS unread_count
  FROM inbound_messages
  LEFT JOIN cutoff_by_chat ON cutoff_by_chat.chat_id = inbound_messages.chat_id
  WHERE inbound_messages.message_at > COALESCE(cutoff_by_chat.cutoff_at, '-infinity'::timestamptz)
  GROUP BY inbound_messages.chat_id
  HAVING COUNT(*) > 0;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_unread_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_unread_counts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_whatsapp_chat_read_cursor(
  current_user_id uuid,
  chat_reads jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid;
BEGIN
  requester_id := auth.uid();
  IF requester_id IS NULL THEN
    requester_id := current_user_id;
  END IF;

  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF current_user_id IS NOT NULL AND current_user_id <> requester_id THEN
    RAISE EXCEPTION 'Usuario nao autorizado';
  END IF;

  IF chat_reads IS NULL OR jsonb_typeof(chat_reads) <> 'array' THEN
    RETURN;
  END IF;

  INSERT INTO public.whatsapp_chat_read_cursors (
    chat_id,
    last_read_at,
    last_read_message_id,
    marked_by_user_id,
    updated_at
  )
  SELECT
    normalized.chat_id,
    normalized.last_read_at,
    normalized.last_read_message_id,
    requester_id,
    now()
  FROM (
    SELECT DISTINCT ON (prepared.chat_id)
      prepared.chat_id,
      prepared.last_read_at,
      prepared.last_read_message_id
    FROM (
      SELECT
        NULLIF(trim(entry->>'chat_id'), '') AS chat_id,
        NULLIF(trim(entry->>'last_read_message_id'), '') AS last_read_message_id,
        COALESCE((entry->>'last_read_at')::timestamptz, now()) AS last_read_at
      FROM jsonb_array_elements(chat_reads) AS entry
    ) prepared
    WHERE prepared.chat_id IS NOT NULL
      AND prepared.last_read_at IS NOT NULL
    ORDER BY prepared.chat_id, prepared.last_read_at DESC, prepared.last_read_message_id DESC NULLS LAST
  ) normalized
  ON CONFLICT (chat_id) DO UPDATE
  SET
    last_read_at = GREATEST(public.whatsapp_chat_read_cursors.last_read_at, EXCLUDED.last_read_at),
    last_read_message_id = CASE
      WHEN EXCLUDED.last_read_at >= public.whatsapp_chat_read_cursors.last_read_at THEN EXCLUDED.last_read_message_id
      ELSE public.whatsapp_chat_read_cursors.last_read_message_id
    END,
    marked_by_user_id = CASE
      WHEN EXCLUDED.last_read_at >= public.whatsapp_chat_read_cursors.last_read_at THEN requester_id
      ELSE public.whatsapp_chat_read_cursors.marked_by_user_id
    END,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.advance_whatsapp_chat_read_cursor(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_whatsapp_chat_read_cursor(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_whatsapp_chat_read(current_user_id uuid, chat_ids text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid;
BEGIN
  requester_id := auth.uid();
  IF requester_id IS NULL THEN
    requester_id := current_user_id;
  END IF;

  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF current_user_id IS NOT NULL AND current_user_id <> requester_id THEN
    RAISE EXCEPTION 'Usuario nao autorizado';
  END IF;

  INSERT INTO public.whatsapp_chat_read_cursors (
    chat_id,
    last_read_at,
    last_read_message_id,
    marked_by_user_id,
    updated_at
  )
  SELECT
    latest_chat_reads.chat_id,
    latest_chat_reads.last_read_at,
    latest_chat_reads.last_read_message_id,
    requester_id,
    now()
  FROM (
    SELECT DISTINCT ON (m.chat_id)
      m.chat_id,
      COALESCE(m.timestamp, m.created_at) AS last_read_at,
      m.id AS last_read_message_id
    FROM public.whatsapp_messages m
    WHERE m.direction = 'inbound'
      AND COALESCE(m.is_deleted, false) = false
      AND m.chat_id = ANY(COALESCE(chat_ids, ARRAY[]::text[]))
    ORDER BY m.chat_id, COALESCE(m.timestamp, m.created_at) DESC, m.created_at DESC, m.id DESC
  ) latest_chat_reads
  ON CONFLICT (chat_id) DO UPDATE
  SET
    last_read_at = GREATEST(public.whatsapp_chat_read_cursors.last_read_at, EXCLUDED.last_read_at),
    last_read_message_id = CASE
      WHEN EXCLUDED.last_read_at >= public.whatsapp_chat_read_cursors.last_read_at THEN EXCLUDED.last_read_message_id
      ELSE public.whatsapp_chat_read_cursors.last_read_message_id
    END,
    marked_by_user_id = CASE
      WHEN EXCLUDED.last_read_at >= public.whatsapp_chat_read_cursors.last_read_at THEN requester_id
      ELSE public.whatsapp_chat_read_cursors.marked_by_user_id
    END,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_whatsapp_chat_read(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_whatsapp_chat_read(uuid, text[]) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_last_message_sort
  ON public.whatsapp_chats (last_message_at DESC, created_at DESC);
