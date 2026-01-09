/*
  # Secure WhatsApp data access and helper functions

  - Enables RLS on whatsapp core tables with permissive authenticated policies.
  - Marks SLA and schedule summary views as security invokers.
  - Pins the search_path for helper trigger functions to avoid mutable execution context warnings.
*/

-- Ensure WhatsApp chat/message tables enforce RLS
ALTER TABLE IF EXISTS public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users manage WhatsApp chats" ON public.whatsapp_chats;
CREATE POLICY "Authenticated users manage WhatsApp chats"
  ON public.whatsapp_chats
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage WhatsApp messages" ON public.whatsapp_messages;
CREATE POLICY "Authenticated users manage WhatsApp messages"
  ON public.whatsapp_messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Views should run with caller privileges
ALTER VIEW IF EXISTS public.whatsapp_chat_sla_snapshot SET (security_invoker = true);
ALTER VIEW IF EXISTS public.whatsapp_scheduled_messages_period_summary SET (security_invoker = true);

-- Harden helper trigger functions by pinning the search_path
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'handle_updated_at_whatsapp_scheduled_messages'
      AND p.proargtypes = ''::oidvector
  ) THEN
    ALTER FUNCTION public.handle_updated_at_whatsapp_scheduled_messages()
      SET search_path = public;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_integration_settings_updated_at'
      AND p.proargtypes = ''::oidvector
  ) THEN
    ALTER FUNCTION public.set_integration_settings_updated_at()
      SET search_path = public;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
      AND p.proargtypes = ''::oidvector
  ) THEN
    ALTER FUNCTION public.set_updated_at()
      SET search_path = public;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_updated_at_column'
      AND p.proargtypes = ''::oidvector
  ) THEN
    ALTER FUNCTION public.update_updated_at_column()
      SET search_path = public;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_system_config_updated_at'
      AND p.proargtypes = ''::oidvector
  ) THEN
    ALTER FUNCTION public.update_system_config_updated_at()
      SET search_path = public;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_system_configurations_updated_at'
      AND p.proargtypes = ''::oidvector
  ) THEN
    ALTER FUNCTION public.update_system_configurations_updated_at()
      SET search_path = public;
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_blog_post_updated_at'
      AND p.proargtypes = ''::oidvector
  ) THEN
    ALTER FUNCTION public.update_blog_post_updated_at()
      SET search_path = public;
  END IF;
END$$;
