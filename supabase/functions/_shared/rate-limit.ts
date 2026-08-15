import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

export const RATE_LIMIT_RESPONSE_BODY = {
  error: 'Muitas requisicoes em pouco tempo. Aguarde um instante e tente novamente.',
};

/**
 * Verifica e consome uma unidade do rate limit por usuario+escopo, apoiado na
 * RPC `consume_comm_whatsapp_action_rate_limit` (janela fixa, UPSERT atomico).
 *
 * Falha aberta: se a checagem em si der erro (RPC indisponivel, etc.), permite
 * a requisicao em vez de bloquear o envio de mensagens do Inbox inteiro por uma
 * falha nesse mecanismo acessorio de defesa em profundidade.
 */
export async function checkCommWhatsAppActionRateLimit(
  supabaseAdmin: SupabaseClient,
  userId: string,
  scope: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('consume_comm_whatsapp_action_rate_limit', {
    p_user_id: userId,
    p_scope: scope,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.error('[rate-limit] erro ao verificar limite de requisicoes, permitindo por padrao', {
      scope,
      error: error.message,
    });
    return true;
  }

  return Boolean(data);
}
