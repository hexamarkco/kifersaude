/*
  # Restore WhatsApp schema hotfix

  Reconciles schema after the 2026-08 drop/recreate so webhook, sync and UI
  use the same structure again.
*/

-- Core table columns expected by webhook + frontend
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_chats' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE public.whatsapp_chats ADD COLUMN phone_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_chats' AND column_name = 'lid'
  ) THEN
    ALTER TABLE public.whatsapp_chats ADD COLUMN lid text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_chats' AND column_name = 'archived'
  ) THEN
    ALTER TABLE public.whatsapp_chats ADD COLUMN archived boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_chats' AND column_name = 'mute_until'
  ) THEN
    ALTER TABLE public.whatsapp_chats ADD COLUMN mute_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'direction'
  ) THEN
    ALTER TABLE public.whatsapp_messages ADD COLUMN direction text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_messages_direction_check'
      AND conrelid = 'public.whatsapp_messages'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_messages
      ADD CONSTRAINT whatsapp_messages_direction_check
      CHECK (direction IN ('inbound', 'outbound'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'author'
  ) THEN
    ALTER TABLE public.whatsapp_messages ADD COLUMN author text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'ack_status'
  ) THEN
    ALTER TABLE public.whatsapp_messages ADD COLUMN ack_status integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'original_body'
  ) THEN
    ALTER TABLE public.whatsapp_messages ADD COLUMN original_body text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE public.whatsapp_messages ADD COLUMN is_deleted boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'edit_count'
  ) THEN
    ALTER TABLE public.whatsapp_messages ADD COLUMN edit_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE public.whatsapp_messages ADD COLUMN edited_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.whatsapp_messages ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE public.whatsapp_messages ADD COLUMN deleted_by text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_phone_number
  ON public.whatsapp_chats(phone_number)
  WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_lid
  ON public.whatsapp_chats(lid)
  WHERE lid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_archived
  ON public.whatsapp_chats(archived);

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_mute_until
  ON public.whatsapp_chats(mute_until);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_timestamp
  ON public.whatsapp_messages(chat_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction
  ON public.whatsapp_messages(direction);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ack_status
  ON public.whatsapp_messages(ack_status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_author
  ON public.whatsapp_messages(author);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_is_deleted
  ON public.whatsapp_messages(is_deleted)
  WHERE is_deleted = true;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_edited_at
  ON public.whatsapp_messages(edited_at DESC)
  WHERE edited_at IS NOT NULL;

-- Group tracking tables (required by webhook and GroupInfoPanel)
CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text DEFAULT 'group',
  chat_pic text,
  chat_pic_full text,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  name_at timestamptz,
  admin_add_member_mode boolean DEFAULT true,
  first_seen_at timestamptz DEFAULT now(),
  last_updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_group_participants (
  group_id text NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  phone text NOT NULL,
  rank text NOT NULL CHECK (rank IN ('creator', 'admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, phone)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id text NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  participants text[],
  old_value text,
  new_value text,
  triggered_by text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_last_updated
  ON public.whatsapp_groups(last_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_group_participants_group
  ON public.whatsapp_group_participants(group_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_group_events_group
  ON public.whatsapp_group_events(group_id, occurred_at DESC);

-- Contact photos table (used by UI and sync function)
CREATE TABLE IF NOT EXISTS public.whatsapp_contact_photos (
  contact_id text PRIMARY KEY,
  source_url text,
  storage_path text,
  public_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contact_photos_updated_at
  ON public.whatsapp_contact_photos(updated_at DESC);

-- Message read state + unread RPC
CREATE TABLE IF NOT EXISTS public.whatsapp_message_reads (
  message_id text NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_reads_user_id
  ON public.whatsapp_message_reads(user_id);

CREATE OR REPLACE FUNCTION public.get_whatsapp_unread_counts(current_user_id uuid)
RETURNS TABLE (chat_id text, unread_count integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.chat_id,
    COUNT(*)::int AS unread_count
  FROM public.whatsapp_messages m
  LEFT JOIN public.whatsapp_message_reads r
    ON r.message_id = m.id
    AND r.user_id = current_user_id
  WHERE m.direction = 'inbound'
    AND COALESCE(m.is_deleted, false) = false
    AND r.message_id IS NULL
  GROUP BY m.chat_id;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_unread_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_unread_counts(uuid) TO authenticated;

-- RLS
ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_group_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contact_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_reads ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_chats'
      AND policyname = 'Admins can insert WhatsApp chats'
  ) THEN
    CREATE POLICY "Admins can insert WhatsApp chats"
      ON public.whatsapp_chats
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_messages'
      AND policyname = 'Admins can insert WhatsApp messages'
  ) THEN
    CREATE POLICY "Admins can insert WhatsApp messages"
      ON public.whatsapp_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_messages'
      AND policyname = 'Admins can update WhatsApp messages'
  ) THEN
    CREATE POLICY "Admins can update WhatsApp messages"
      ON public.whatsapp_messages
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.user_profiles
          WHERE user_profiles.id = auth.uid()
            AND user_profiles.role = 'admin'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_groups'
      AND policyname = 'Authenticated users can view groups'
  ) THEN
    CREATE POLICY "Authenticated users can view groups"
      ON public.whatsapp_groups
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_group_participants'
      AND policyname = 'Authenticated users can view group participants'
  ) THEN
    CREATE POLICY "Authenticated users can view group participants"
      ON public.whatsapp_group_participants
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_group_events'
      AND policyname = 'Authenticated users can view group events'
  ) THEN
    CREATE POLICY "Authenticated users can view group events"
      ON public.whatsapp_group_events
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_contact_photos'
      AND policyname = 'Authenticated users can view whatsapp contact photos'
  ) THEN
    CREATE POLICY "Authenticated users can view whatsapp contact photos"
      ON public.whatsapp_contact_photos
      FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_contact_photos'
      AND policyname = 'Service role can manage whatsapp contact photos'
  ) THEN
    CREATE POLICY "Service role can manage whatsapp contact photos"
      ON public.whatsapp_contact_photos
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_message_reads'
      AND policyname = 'Authenticated users can read own whatsapp message reads'
  ) THEN
    CREATE POLICY "Authenticated users can read own whatsapp message reads"
      ON public.whatsapp_message_reads
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_message_reads'
      AND policyname = 'Authenticated users can insert own whatsapp message reads'
  ) THEN
    CREATE POLICY "Authenticated users can insert own whatsapp message reads"
      ON public.whatsapp_message_reads
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_message_reads'
      AND policyname = 'Authenticated users can update own whatsapp message reads'
  ) THEN
    CREATE POLICY "Authenticated users can update own whatsapp message reads"
      ON public.whatsapp_message_reads
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Realtime replication after table recreation
ALTER TABLE public.whatsapp_chats REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'Publication supabase_realtime not found, skipping realtime registration.';
END $$;
