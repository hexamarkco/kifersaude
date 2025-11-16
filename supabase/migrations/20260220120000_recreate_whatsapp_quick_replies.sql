/*
  # Recria tabela de respostas rápidas do WhatsApp

  - Cria tabela simples para armazenar atalhos de mensagens.
  - Habilita gatilho para atualizar updated_at automaticamente.
  - Ativa RLS liberando acesso total para usuários autenticados.
*/

-- Função utilitária para manter colunas updated_at sincronizadas
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_quick_replies_title_idx
  ON public.whatsapp_quick_replies (lower(coalesce(title, text)));

DROP TRIGGER IF EXISTS trg_whatsapp_quick_replies_updated_at ON public.whatsapp_quick_replies;
CREATE TRIGGER trg_whatsapp_quick_replies_updated_at
  BEFORE UPDATE ON public.whatsapp_quick_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Usuários autenticados gerenciam respostas rápidas"
  ON public.whatsapp_quick_replies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
