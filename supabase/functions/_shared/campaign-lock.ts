import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

/**
 * Gera um token de lock opaco usado para reivindicar um alvo de campanha.
 * Cada invocação do worker gera o seu próprio, evitando que duas invocações
 * concorrentes disputem o mesmo alvo sem que uma delas perca a corrida de forma segura.
 */
export const createLockToken = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `campaign-lock-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export class CampaignTargetLeaseLostError extends Error {
  constructor() {
    super('A reserva do alvo da campanha expirou ou foi assumida por outro worker.');
    this.name = 'CampaignTargetLeaseLostError';
  }
}

export type LockedTargetRef = {
  id: string;
  lock_token: string | null;
};

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Aplica uma transição de estado num alvo de campanha já reivindicado, revalidando
 * atomicamente `id + status='sending' + lock_token` na cláusula WHERE do UPDATE.
 *
 * Essa revalidação é o que impede duas invocações concorrentes do worker de campanha
 * de processarem/despacharem o mesmo alvo duas vezes: se outra invocação já assumiu o
 * alvo (TTL de lock expirado, retry, etc.), o `lock_token` em banco já mudou e este
 * UPDATE não afeta nenhuma linha — o chamador recebe `CampaignTargetLeaseLostError`
 * em vez de seguir adiante com uma reserva que não é mais sua.
 */
export async function updateClaimedTarget(
  supabaseAdmin: SupabaseClient,
  target: LockedTargetRef,
  update: Record<string, unknown>,
): Promise<void> {
  const lockToken = toTrimmedString(target.lock_token);
  if (!lockToken) {
    throw new CampaignTargetLeaseLostError();
  }

  const { data, error } = await supabaseAdmin
    .from('comm_whatsapp_campaign_targets')
    .update(update)
    .eq('id', target.id)
    .eq('status', 'sending')
    .eq('lock_token', lockToken)
    .select('id')
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao atualizar alvo reservado da campanha: ${error.message}`);
  }

  if (!data) {
    throw new CampaignTargetLeaseLostError();
  }
}
