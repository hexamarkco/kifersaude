import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

export type CommWhatsAppEventReceiptMatch = {
  id: string;
  channel_id: string;
  event_key: string;
  event_type: string;
  resource_id: string | null;
  received_at: string;
  payload_archive_path: string | null;
};

/**
 * Registra um evento de webhook processado em `comm_whatsapp_event_receipts` para
 * dedupe. Se `event_key` já existir (constraint única, código de erro 23505 do
 * Postgres), retorna `false` em vez de lançar — é assim que o webhook trata retries
 * legítimos do provedor como no-op em vez de reprocessar o mesmo evento duas vezes.
 */
export async function recordCommWhatsAppEventReceipt(
  supabaseAdmin: SupabaseClient,
  channelId: string,
  eventKey: string,
  eventType: string,
  resourceId: string | null,
  summary: Record<string, unknown>,
  payloadArchivePath?: string | null,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('comm_whatsapp_event_receipts')
    .insert({
      channel_id: channelId,
      event_key: eventKey,
      event_type: eventType,
      resource_id: resourceId,
      summary,
      payload_archive_path: payloadArchivePath || null,
    });

  if (error) {
    if (error.code === '23505') {
      return false;
    }

    throw new Error(`Erro ao registrar dedupe do webhook: ${error.message}`);
  }

  return true;
}

export async function hasCommWhatsAppEventReceipt(
  supabaseAdmin: SupabaseClient,
  eventKey: string,
): Promise<boolean> {
  return Boolean(await findCommWhatsAppEventReceipt(supabaseAdmin, eventKey));
}

/**
 * Retorna o recibo que causou a deduplicacao. Alem de servir ao predicado
 * simples, os metadados permitem explicar nos logs qual entrega anterior
 * colidiu com a atual sem registrar o conteudo da conversa.
 */
export async function findCommWhatsAppEventReceipt(
  supabaseAdmin: SupabaseClient,
  eventKey: string,
): Promise<CommWhatsAppEventReceiptMatch | null> {
  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_event_receipts')
    .select('id, channel_id, event_key, event_type, resource_id, received_at, payload_archive_path')
    .eq('event_key', eventKey)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao verificar dedupe do webhook: ${error.message}`);
  }

  return (data as CommWhatsAppEventReceiptMatch | null) ?? null;
}
