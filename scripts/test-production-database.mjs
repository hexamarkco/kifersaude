import { after as afterAll, before as beforeAll, test } from 'node:test';
import assert from 'node:assert/strict';
import { createProductionTestDatabase } from './lib/production-test-database.mjs';



function expect(value) {
  return {
    toHaveLength: (length) => assert.equal(value.length,length),
    toBe: (other) => assert.equal(value,other),
    toEqual: (other) => assert.deepEqual(value,other),
    toBeGreaterThan: (other) => assert.ok(value > other),
    toMatchObject: (other) => { for (const [key,expected] of Object.entries(other)) assert.deepEqual(value[key],expected); },
    rejects: { toThrow: (message) => assert.rejects(value,(error) => error.message.includes(message)) },
  };
}

const luiza = '11111111-1111-4111-8111-111111111111';
const nick = '22222222-2222-4222-8222-222222222222';
const qa = '33333333-3333-4333-8333-333333333333';
let db;
beforeAll(async () => { db = await createProductionTestDatabase(); });
afterAll(async () => { await db?.close(); });
async function context(operator, origin = 'crm', authorizer = operator) {
  await db.query("SELECT set_config('request.jwt.claims',$1,false),set_config('request.headers',$2,false)", [
    JSON.stringify({ role: 'service_role' }), JSON.stringify(operator ? { 'x-kifer-production-operator': operator,'x-kifer-production-authorizer': authorizer,'x-kifer-production-source':origin } : {}),
  ]);
}
async function count(action) {
  return (await db.query('SELECT count(*)::int AS count FROM public.production_activities WHERE action=$1 AND active',[action])).rows[0].count;
}
test('records only after activation and excludes QA enrollment', async () => {
  expect((await db.query('SELECT * FROM public.production_operators')).rows).toHaveLength(2);
  await context(nick);
  await db.exec('INSERT INTO public.interactions DEFAULT VALUES');
  expect(await count('interaction_created')).toBe(0);
  await db.exec('UPDATE public.production_settings SET started_at=clock_timestamp()');
});
test('MCP attribution is distinct from authorization; inactive users cannot receive credit', async () => {
  await context(nick,'mcp',luiza);
  await db.exec('INSERT INTO public.interactions DEFAULT VALUES');
  const event = (await db.query("SELECT * FROM public.production_activities WHERE action='interaction_created' ORDER BY id DESC LIMIT 1")).rows[0];
  expect(event).toMatchObject({operator_user_id:nick,authorizer_user_id:luiza,origin:'mcp',identity_kind:'declared'});
  await context(qa,'mcp',luiza);
  await expect(db.exec('INSERT INTO public.interactions DEFAULT VALUES')).rejects.toThrow('INVALID_OPERATOR');
  await db.exec(`UPDATE public.user_profiles SET role='observer' WHERE id='${qa}'`);
  await context(nick,'mcp',qa);
  await expect(db.exec('INSERT INTO public.interactions DEFAULT VALUES')).rejects.toThrow('MCP authorization required');
});
test('authenticated CRM ignores spoofed operator headers', async () => {
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated',sub:luiza})]);
  await db.exec('INSERT INTO public.interactions DEFAULT VALUES');
  expect((await db.query("SELECT operator_user_id FROM public.production_activities ORDER BY id DESC LIMIT 1")).rows[0].operator_user_id).toBe(luiza);
});
test('reminder reading is not completion, reopening revokes the completion and cancellation is excluded', async () => {
  await context(nick);
  const id = (await db.query('INSERT INTO public.reminders DEFAULT VALUES RETURNING id')).rows[0].id;
  await db.query('UPDATE public.reminders SET lido=true WHERE id=$1',[id]);
  expect(await count('reminder_completed')).toBe(0);
  await db.query('UPDATE public.reminders SET concluido_em=clock_timestamp() WHERE id=$1',[id]);
  expect(await count('reminder_completed')).toBe(1);
  await db.query('UPDATE public.reminders SET concluido_em=NULL WHERE id=$1',[id]);
  expect(await count('reminder_completed')).toBe(0);
});

test('atomic reminder completion counts production once and preserves undated historical closures', async () => {
  await context(nick);
  const before = await count('reminder_completed');
  const legacy = (await db.query('INSERT INTO public.reminders(lido) VALUES(true) RETURNING id')).rows[0].id;
  const current = (await db.query('INSERT INTO public.reminders DEFAULT VALUES RETURNING id')).rows[0].id;
  await db.query('UPDATE public.reminders SET lido=true,concluido_em=clock_timestamp() WHERE id=$1', [current]);
  expect(await count('reminder_completed')).toBe(before + 1);
  expect((await db.query('SELECT lido,concluido_em FROM public.reminders WHERE id=$1', [legacy])).rows[0]).toEqual({ lido: true, concluido_em: null });
  await db.query('UPDATE public.reminders SET lido=false,concluido_em=NULL WHERE id=$1', [current]);
  expect(await count('reminder_completed')).toBe(before);
  await db.query('UPDATE public.reminders SET lido=true,concluido_em=clock_timestamp() WHERE id=$1', [current]);
  expect(await count('reminder_completed')).toBe(before + 1);
  await db.query('UPDATE public.reminders SET cancelled_at=clock_timestamp() WHERE id=$1', [current]);
  expect(await count('reminder_completed')).toBe(before);
});
test('scheduled MCP sends preserve original operator, despite later edits and webhook races', async () => {
  await context(nick,'mcp',luiza);
  const schedule = (await db.query("INSERT INTO public.comm_whatsapp_scheduled_messages(status) VALUES('scheduled') RETURNING id")).rows[0].id;
  await context(luiza,'mcp',luiza);
  await db.query("UPDATE public.comm_whatsapp_scheduled_messages SET status='sending' WHERE id=$1",[schedule]);
  await context(null);
  const chat = (await db.query('INSERT INTO public.comm_whatsapp_chats DEFAULT VALUES RETURNING id')).rows[0].id;
  const channel = '44444444-4444-4444-8444-444444444444';
  await db.query("INSERT INTO public.comm_whatsapp_messages(channel_id,chat_id,direction,source,delivery_status,external_message_id) VALUES($1,$2,'outbound','webhook','sent','test-message')",[channel,chat]);
  await db.query("SELECT set_config('request.headers',$1,false)",[JSON.stringify({'x-kifer-production-schedule-id':schedule})]);
  await db.query('SELECT public.production_message_attribution($1,$2)',['test-message',channel]);
  await db.query('SELECT public.production_message_attribution($1,$2)',['test-message',channel]);
  const events = (await db.query("SELECT * FROM public.production_activities WHERE action='message_sent'")).rows;
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({operator_user_id:nick,authorizer_user_id:luiza,origin:'mcp',identity_kind:'declared'});
  expect(await count('schedule_created')).toBe(1);
});
test('sale owner may differ from executor and remains fixed on cancellation', async () => {
  await context(nick,'mcp',luiza);
  const id = (await db.query("INSERT INTO public.contracts(status,sale_operator_user_id) VALUES('Ativo',$1) RETURNING id",[luiza])).rows[0].id;
  expect((await db.query("SELECT operator_user_id FROM public.production_activities WHERE action='sale_closed'")).rows[0].operator_user_id).toBe(luiza);
  await db.query("UPDATE public.contracts SET sale_operator_user_id=$1,status='Cancelado' WHERE id=$2",[nick,id]);
  expect((await db.query('SELECT sale_operator_user_id FROM public.contracts WHERE id=$1',[id])).rows[0].sale_operator_user_id).toBe(luiza);
  expect(await count('sale_cancelled')).toBe(1);
  await expect(db.exec("INSERT INTO public.contracts(status) VALUES('Ativo')")).rejects.toThrow('Escolha Nick ou Luiza');
});
test('report uses Sao Paulo boundaries and returns all explaining records with paging', async () => {
  const response = await db.query("SELECT public.team_production_report('2026-01-01','2099-01-01') AS report");
  expect(response.rows[0].report.summary.map((row) => row.display_name).sort()).toEqual(['Equipe','Luiza','Nick']);
  expect(response.rows[0].report.total_events).toBeGreaterThan(0);
});

test('sequence children inherit declared attribution without duplicating schedule creation', async () => {
  await context(nick,'mcp',luiza);
  const sequence = (await db.query("INSERT INTO public.comm_whatsapp_scheduled_sequences(status) VALUES('scheduled') RETURNING id")).rows[0].id;
  const before = await count('schedule_created');
  await context(null);
  const child = (await db.query("INSERT INTO public.comm_whatsapp_scheduled_messages(sequence_id,status) VALUES($1,'sending') RETURNING id",[sequence])).rows[0].id;
  expect(await count('schedule_created')).toBe(before);
  expect((await db.query('SELECT public.production_scheduled_operator($1) AS operator',[child])).rows[0].operator).toBe(nick);
  const legacy = (await db.query("INSERT INTO public.comm_whatsapp_scheduled_messages(created_by,status) VALUES($1,'sending') RETURNING id",[luiza])).rows[0].id;
  expect((await db.query('SELECT public.production_scheduled_operator($1) AS operator',[legacy])).rows[0].operator).toBe(null);
});

test('automation wins a webhook race without taking credit for a human; failed sends are excluded', async () => {
  await context(null);
  const channel='44444444-4444-4444-8444-444444444444';
  await db.query("SELECT set_config('request.headers',$1,false)",[JSON.stringify({'x-kifer-production-source':'external'})]);
  await db.query("INSERT INTO public.comm_whatsapp_messages(channel_id,direction,source,delivery_status,external_message_id) VALUES($1,'outbound','webhook','sent','auto-race')",[channel]);
  await context(null);
  await db.query('SELECT public.production_message_attribution($1,$2)',['auto-race',channel]);
  expect((await db.query("SELECT origin,operator_user_id FROM public.production_activities a JOIN public.comm_whatsapp_messages m ON m.id=a.entity_id WHERE m.external_message_id='auto-race'")).rows[0]).toMatchObject({origin:'automation',operator_user_id:null});
  await context(nick);
  const before=await count('message_sent');
  await db.exec("INSERT INTO public.comm_whatsapp_messages(direction,source,delivery_status) VALUES('outbound','api','failed')");
  expect(await count('message_sent')).toBe(before);
});

test('team distinct clients differ from sum of individual clients and use Brazilian calendar days', async () => {
  const lead=(await db.query('INSERT INTO public.leads DEFAULT VALUES RETURNING id')).rows[0].id;
  for (const operator of [nick,luiza]) {
    await context(operator);
    await db.query('INSERT INTO public.interactions(lead_id) VALUES($1)',[lead]);
  }
  const report=(await db.query("SELECT public.team_production_report('2026-01-01','2099-01-01') AS report")).rows[0].report;
  expect(report.summary.find((row)=>row.display_name==='Equipe').clients).toBe(1);
  expect(report.summary.find((row)=>row.display_name==='Nick').clients).toBe(1);
  expect(report.summary.find((row)=>row.display_name==='Luiza').clients).toBe(1);
  await db.exec("UPDATE public.production_settings SET started_at='2026-01-01'; INSERT INTO public.production_activities(event_key,entity_table,entity_id,action,origin,identity_kind,operator_user_id,occurred_at) VALUES('boundary-previous','interactions',gen_random_uuid(),'interaction_created','crm','authenticated','11111111-1111-4111-8111-111111111111','2026-05-02T02:59:59Z'),('boundary-current','interactions',gen_random_uuid(),'interaction_created','crm','authenticated','11111111-1111-4111-8111-111111111111','2026-05-02T03:00:00Z')");
  const boundary=(await db.query("SELECT public.team_production_report('2026-05-02','2026-05-02') AS report")).rows[0].report;
  expect(boundary.total_events).toBe(1);
});

test('RLS prevents reading production without module access and direct ledger writes', async () => {
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated',sub:qa})]);
  await db.exec('SET ROLE authenticated');
  try {
    expect((await db.query('SELECT count(*)::int AS count FROM public.production_activities')).rows[0].count).toBe(0);
    await expect(db.exec("INSERT INTO public.production_activities DEFAULT VALUES")).rejects.toThrow('permission denied');
    await expect(db.exec('SELECT public.activate_team_production()')).rejects.toThrow('Admin required');
  } finally { await db.exec('RESET ROLE'); }
});

test('existing user management finalization enrolls Nick and creates the commercial responsible option', async () => {
  await context(null);
  const id='55555555-5555-4555-8555-555555555555';
  await db.query("INSERT INTO public.user_profiles VALUES($1,'new-user','observer')",[id]);
  await db.query("UPDATE public.user_profiles SET username='nick',role='admin' WHERE id=$1",[id]);
  expect((await db.query('SELECT display_name FROM public.production_operators WHERE user_id=$1',[id])).rows[0].display_name).toBe('Nick');
  expect((await db.query("SELECT count(*)::int AS count FROM public.lead_responsaveis WHERE value='Nick'")).rows[0].count).toBe(1);
});
