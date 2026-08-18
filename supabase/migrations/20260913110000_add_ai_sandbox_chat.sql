/*
  # AI sandbox chat (playground de testes do atendimento autonomo)

  Ambiente isolado para simular conversas de WhatsApp com a IA antes de
  ligar a automacao no inbox real. Nao toca em nenhuma tabela do
  comm_whatsapp_* nem em leads/chats reais — e uma pagina separada
  (/chat) onde a equipe entra como se fosse um lead e a IA responde
  seguindo o mesmo playbook/estilo que seria usado no inbox.

  Escritas de mensagens (lead e IA) sao feitas apenas pela edge function
  ai-sandbox-chat via service role. O frontend le e gerencia as
  conversas (criar/renomear/apagar) diretamente via RLS.
*/

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_sandbox_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Nova simulação',
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sandbox_conversations_updated_at
  ON public.ai_sandbox_conversations (updated_at DESC);

DROP TRIGGER IF EXISTS trg_ai_sandbox_conversations_updated_at ON public.ai_sandbox_conversations;
CREATE TRIGGER trg_ai_sandbox_conversations_updated_at
  BEFORE UPDATE ON public.ai_sandbox_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.ai_sandbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_sandbox_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('lead', 'ai')),
  content text NOT NULL,
  handoff_reason text,
  provider text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_sandbox_messages_conversation_created_at
  ON public.ai_sandbox_messages (conversation_id, created_at ASC);

ALTER TABLE public.ai_sandbox_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sandbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ai sandbox conversations" ON public.ai_sandbox_conversations;
CREATE POLICY "Authenticated users can view ai sandbox conversations"
  ON public.ai_sandbox_conversations
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create ai sandbox conversations" ON public.ai_sandbox_conversations;
CREATE POLICY "Authenticated users can create ai sandbox conversations"
  ON public.ai_sandbox_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owners can update ai sandbox conversations" ON public.ai_sandbox_conversations;
CREATE POLICY "Owners can update ai sandbox conversations"
  ON public.ai_sandbox_conversations
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Owners can delete ai sandbox conversations" ON public.ai_sandbox_conversations;
CREATE POLICY "Owners can delete ai sandbox conversations"
  ON public.ai_sandbox_conversations
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can view ai sandbox messages" ON public.ai_sandbox_messages;
CREATE POLICY "Authenticated users can view ai sandbox messages"
  ON public.ai_sandbox_messages
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
