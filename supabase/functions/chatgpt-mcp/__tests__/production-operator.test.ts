import { expect, test, vi } from 'vitest';
import { productionHeaders, requiresProductionOperator, validateProductionOperator, withProductionOperator } from '../production-operator';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

test('commercial mutations require an operator but reads and automatic campaign execution do not', () => {
  for (const name of ['kifer_send_whatsapp_message','kifer_schedule_whatsapp_sequence','kifer_bulk_schedule_whatsapp_messages','kifer_update_scheduled_whatsapp_message','kifer_complete_reminder','kifer_create_contract_bundle']) expect(requiresProductionOperator(name)).toBe(true);
  expect(withProductionOperator([{name:'kifer_get_contract',annotations:{readOnlyHint:true}}])[0].inputSchema).toBeUndefined();
});
test('discovery adds required declared identity while preserving business schema', () => {
  const [tool] = withProductionOperator([{name:'kifer_send_whatsapp_message',inputSchema:{type:'object',required:['chat_id'],additionalProperties:false,properties:{chat_id:{type:'string'}}},annotations:{readOnlyHint:false}}]);
  expect(tool.inputSchema).toMatchObject({required:['chat_id','operator_user_id'],additionalProperties:false});
  expect(tool.description).toContain('nunca infira');
});
test('missing or invalid operator fails before accessing business data', async () => {
  const from = vi.fn();
  const client = {from} as unknown as SupabaseClient;
  expect(await validateProductionOperator(client,undefined)).toMatchObject({error_code:'OPERATOR_REQUIRED'});
  expect(from).not.toHaveBeenCalled();
  expect(productionHeaders('oauth-luiza','nick')).toMatchObject({'X-Kifer-Production-Authorizer':'oauth-luiza','X-Kifer-Production-Operator':'nick'});
});

test('inactive or missing operators and failed lookup do not fall back to the OAuth user', async () => {
  const id='22222222-2222-4222-8222-222222222222';
  const result: { data: {user_id:string} | null; error: {message:string} | null } = {data:null,error:null};
  const query = { select: () => query,eq: () => query,maybeSingle: async () => result };
  const client = { from: () => query } as unknown as SupabaseClient;
  expect(await validateProductionOperator(client,id)).toMatchObject({error_code:'INVALID_OPERATOR'});
  result.error={message:'offline'};
  expect(await validateProductionOperator(client,id)).toMatchObject({error_code:'OPERATOR_UNAVAILABLE'});
  result.error=null; result.data={user_id:id};
  expect(await validateProductionOperator(client,id)).toBe(null);
});
