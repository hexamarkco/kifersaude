import { databaseClient } from '../../../../infrastructure/supabase';

export async function countDailyAutomationInteractions(now = new Date()): Promise<number> {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);

  const { count, error } = await databaseClient
    .from('interactions')
    .select('id', { count: 'exact', head: true })
    .eq('tipo', 'Mensagem Automática')
    .gte('data_interacao', startOfDay.toISOString())
    .lt('data_interacao', startOfNextDay.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function sendAutomationFlowTest(input: {
  flowId: string;
  stepId: string;
  phone: string;
  name: string;
}): Promise<void> {
  const { data, error } = await databaseClient.functions.invoke('leads-api', {
    headers: { 'x-action': 'test-flow' },
    body: {
      flow_id: input.flowId,
      step_id: input.stepId,
      test_phone: input.phone,
      test_name: input.name,
    },
  });

  const response = data && typeof data === 'object'
    ? data as { success?: boolean; error?: string }
    : null;
  if (error || response?.success !== true) {
    throw new Error(response?.error || error?.message || 'Não foi possível enviar a mensagem de teste.');
  }
}
