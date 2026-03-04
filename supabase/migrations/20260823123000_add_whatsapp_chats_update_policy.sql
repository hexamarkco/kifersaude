/*
  # Permitir atualizar metadados de chats do WhatsApp

  Necessario para persistir arquivamento/silenciamento feitos no painel.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_chats'
      AND policyname = 'Admins can update WhatsApp chats'
  ) THEN
    CREATE POLICY "Admins can update WhatsApp chats"
      ON public.whatsapp_chats
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
END $$;
