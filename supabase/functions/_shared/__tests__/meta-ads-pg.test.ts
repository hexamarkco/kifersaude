// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { createWebhookHandler } from '../../meta-lead-webhook/handler.ts';
import { runMetaWorker } from '../meta-ads/worker.ts';
import type { MetaConfig, Receipt } from '../meta-ads/domain.ts';

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const admin = id(1), observer = id(2), origin = id(3), responsible = id(4), status = id(5);
const metaLead = '999999999999999999', page = '111111111111111', form = '222222222222222';
let db: PGlite;
const value = async <T>(sql: string, args: unknown[] = []) => (await db.query<{ value: T }>(sql,args)).rows[0]?.value;
const scalar = <T>(fn: string,args: unknown[] = []) => value<T>(`SELECT public.${fn}(${args.map((_,i) => `$${i+1}`).join(',')}) AS value`,args);
const count = (table: string) => value<number>(`SELECT count(*)::integer AS value FROM public.${table}`);
const paidOriginMigration = () => db.exec(readFileSync(resolve('supabase/migrations/20261113151151_fix_meta_paid_lead_origin.sql'),'utf8'));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE TABLE public.user_profiles(id uuid PRIMARY KEY,role text);
    CREATE TABLE public.integration_settings(slug text PRIMARY KEY,settings jsonb,updated_at timestamptz DEFAULT now());
    CREATE TABLE public.lead_origens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nome text UNIQUE,ativo boolean);
    CREATE TABLE public.lead_responsaveis(id uuid PRIMARY KEY,label text,value text,ativo boolean);
    CREATE TABLE public.lead_status_config(id uuid PRIMARY KEY,nome text,ativo boolean,padrao boolean,ordem integer);
    CREATE TABLE public.leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nome_completo text NOT NULL,telefone text NOT NULL,
      origem_id uuid NOT NULL REFERENCES public.lead_origens(id),responsavel_id uuid NOT NULL REFERENCES public.lead_responsaveis(id),
      status_id uuid NOT NULL REFERENCES public.lead_status_config(id),status text,data_criacao timestamptz,arquivado boolean,
      skip_automation boolean,observacoes text);
    CREATE TABLE public.contracts(id uuid PRIMARY KEY,lead_id uuid REFERENCES public.leads(id),codigo_contrato text,created_at timestamptz,status text);
    CREATE TABLE public.opportunities(id uuid PRIMARY KEY,name text,status text,archived boolean DEFAULT false);
    CREATE TABLE public.opportunity_leads(opportunity_id uuid REFERENCES public.opportunities(id),lead_id uuid REFERENCES public.leads(id),removed_at timestamptz);
    -- Isolate external communication. Count canonical lead_created insertions.
    CREATE TABLE public.test_flow_entries(lead_id uuid);
    CREATE FUNCTION public.test_lead_created() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NOT NEW.skip_automation THEN INSERT INTO public.test_flow_entries VALUES(NEW.id); END IF; RETURN NEW; END $$;
    CREATE TRIGGER test_lead_created AFTER INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.test_lead_created();
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
  `);
  const old = readFileSync(resolve('supabase/migrations/20260910100000_add_comm_whatsapp_inbox_mvp.sql'),'utf8');
  const start = old.indexOf('CREATE OR REPLACE FUNCTION public.normalize_comm_whatsapp_phone(');
  await db.exec(old.slice(start,old.indexOf('$$;',start)+3));
  await db.query(`INSERT INTO public.integration_settings VALUES('facebook_ads_manager','{"pageAccessToken":"synthetic-old-secret","verifyToken":"synthetic-old-verify"}',now())`);
  await db.exec(readFileSync(resolve('supabase/migrations/20261024011732_meta_lead_ads_crm_pipeline.sql'),'utf8'));
  await db.exec(readFileSync(resolve('supabase/migrations/20261024022700_meta_lead_validation_probe.sql'),'utf8'));
  await db.exec(readFileSync(resolve('supabase/migrations/20261112230739_meta_commercial_review_modalities.sql'),'utf8'));
  expect(await value<string>(`SELECT settings->>'pageAccessToken' AS value FROM integration_settings`)).toBeNull();
  expect(await value<boolean>(`SELECT (settings->>'enabled')::boolean AS value FROM integration_settings`)).toBe(false);
  await db.exec(`REVOKE ALL ON public.opportunities,public.opportunity_leads FROM service_role;
    INSERT INTO auth.users VALUES('${admin}'),('${observer}');
    INSERT INTO public.user_profiles VALUES('${admin}','admin'),('${observer}','observer');
    INSERT INTO public.lead_origens VALUES('${origin}','tráfego pago',true);
    INSERT INTO public.lead_responsaveis VALUES('${responsible}','Luiza','Luiza',true);
    INSERT INTO public.lead_status_config VALUES('${status}','Novo',true,true,0);`);
},60000);
beforeEach(async () => {
  await db.exec(`TRUNCATE public.meta_integration_attempts,public.meta_conversion_events,public.meta_commercial_reviews,
    public.meta_lead_attributions,public.meta_lead_receipts,public.opportunity_leads,public.opportunities,public.contracts,
    public.leads,public.test_flow_entries CASCADE;`);
  await db.query(`UPDATE integration_settings SET settings=jsonb_build_object('enabled',true,'pageId',$1::text,'formId',$2::text,
    'defaultOrigem','tráfego pago','defaultResponsavel','Luiza','unconfirmedOrigem','Meta — origem não confirmada')`,[page,form]);
});
afterAll(async () => { await db?.close(); });

const enqueue = async (leadgenId = metaLead, formId = form) => scalar<number>('meta_ads_enqueue',[JSON.stringify([{
  leadgen_id: leadgenId,page_id: page,form_id: formId,ad_id: '333333333333333',meta_created_at: new Date(Date.now()-86400000).toISOString(),
}])]);
type Claimed = { leadgen_id: string; lock_token: string; attempts: number };
const claim = () => scalar<Claimed | null>('meta_ads_claim',['inbound']);
const importClaim = (lease: Claimed,phone = '12025550100') => scalar<string>('meta_ads_import',[lease.leadgen_id,lease.lock_token,JSON.stringify({
  name: 'Synthetic Contact',phone,campaign_id: '444444444444444',adset_id: '555555555555555',commercial_answer: 'MEI, duas vidas',traffic_type: 'paid',
})]);
async function imported() {
  await enqueue(); const lease = (await claim())!; const leadId = await importClaim(lease);
  const attr = await value<string>('SELECT id::text AS value FROM meta_lead_attributions LIMIT 1');
  return { lease,leadId,attr };
}
const review = (attr: string,eligible = true,lives = 2,contract: string | null = null,completed = false,actor = admin,opportunity: string | null = null) =>
  scalar<string>('meta_ads_review',[actor,attr,eligible,lives,true,true,opportunity,contract,completed]);
const reviewV2 = (attr: string,modality = 'individual',eligible = true,lives = 1,closed = false,contract: string | null = null,completed = false,opportunity: string | null = null,actor = admin) =>
  scalar<string>('meta_ads_review_v2',[actor,attr,modality,eligible,lives,true,true,closed,opportunity,contract,completed]);

it('atomically deduplicates notifications and imports through the canonical lead insertion', async () => {
  expect(await enqueue()).toBe(1); expect(await enqueue()).toBe(0);
  const lease = (await claim())!; expect(lease.attempts).toBe(1); expect(await claim()).toBeNull();
  const leadId = await importClaim(lease); expect(await importClaim(lease)).toBe(leadId);
  expect(await count('leads')).toBe(1); expect(await count('meta_lead_attributions')).toBe(1); expect(await count('test_flow_entries')).toBe(1);
  expect(await value<string>('SELECT status AS value FROM meta_lead_receipts')).toBe('imported');
  expect(await value<string>('SELECT campaign_id AS value FROM meta_lead_attributions')).toBe('444444444444444');
  expect(await count('meta_conversion_events')).toBe(0);
  await expect(enqueue('888888888888888','777777777777777')).rejects.toThrow('ORIGIN_MISMATCH');
});

it('preserves existing lead history and contact restrictions; ambiguity never creates another lead', async () => {
  const oldLead = id(10);
  await db.query(`INSERT INTO leads(id,nome_completo,telefone,origem_id,responsavel_id,status_id,status,skip_automation,observacoes)
    VALUES($1,'Existing Synthetic','+1 202 555 0100',$2,$3,$4,'Atendimento',true,'Existing history')`,[oldLead,origin,responsible,status]);
  const { leadId } = await imported(); expect(leadId).toBe(oldLead);
  expect(await value<string>('SELECT observacoes AS value FROM leads')).toBe('Existing history');
  expect(await value<boolean>('SELECT skip_automation AS value FROM leads')).toBe(true);
  expect(await count('test_flow_entries')).toBe(0);
  expect(await value<boolean>('SELECT matched_existing AS value FROM meta_lead_attributions')).toBe(true);
  await db.query(`INSERT INTO leads(id,nome_completo,telefone,origem_id,responsavel_id,status_id,skip_automation)
    VALUES($1,'Ambiguous Synthetic','+1 202 555 0100',$2,$3,$4,true)`,[id(11),origin,responsible,status]);
  await enqueue('888888888888888'); const lease = (await claim())!;
  await expect(importClaim(lease)).rejects.toThrow('AMBIGUOUS_CONTACT');
  expect(await count('leads')).toBe(2); expect(await count('meta_lead_attributions')).toBe(1);
});

it('repairs the paid Meta default and proven FBS imports while preserving other lead origins', async () => {
  await db.exec(`INSERT INTO lead_origens(nome,ativo) VALUES('FBS',true) ON CONFLICT (nome) DO NOTHING;
    UPDATE integration_settings SET settings=jsonb_set(settings,'{defaultOrigem}','"FBS"');`);
  const fbs = (await value<string>(`SELECT id AS value FROM lead_origens WHERE nome='FBS'`))!;
  const { leadId } = await imported();
  const leadOrigin = (lead: string) => value<string>(`SELECT o.nome AS value FROM leads l JOIN lead_origens o ON o.id=l.origem_id WHERE l.id=$1`,[lead]);
  expect(await leadOrigin(leadId)).toBe('FBS');

  const existing = id(40);
  await db.query(`INSERT INTO leads(id,nome_completo,telefone,origem_id,responsavel_id,status_id,skip_automation)
    VALUES($1,'Existing Synthetic','12025550101',$2,$3,$4,true)`,[existing,fbs,responsible,status]);
  await enqueue('888888888888881');
  await importClaim((await claim())!,'12025550101');

  // Even FBS records must stay untouched if their attribution is not paid.
  const nonPaid: string[] = [];
  for (const [index,traffic] of ['organic','unknown'].entries()) {
    await enqueue(`88888888888888${index+2}`);
    const lease = (await claim())!;
    nonPaid.push(await scalar<string>('meta_ads_import',[lease.leadgen_id,lease.lock_token,JSON.stringify({
      name:'Synthetic Contact',phone:`1202555010${index+2}`,traffic_type:traffic,
    })]));
  }
  await db.query(`UPDATE leads SET origem_id=$1 WHERE id=ANY($2::uuid[])`,[fbs,nonPaid]);

  await enqueue('888888888888884');
  const reassigned = await importClaim((await claim())!,'12025550104');
  await db.query('UPDATE leads SET origem_id=$1 WHERE id=$2',[origin,reassigned]);
  await db.query(`INSERT INTO leads(id,nome_completo,telefone,origem_id,responsavel_id,status_id,skip_automation)
    VALUES($1,'Manual Synthetic','12025550105',$2,$3,$4,true)`,[id(41),fbs,responsible,status]);
  const entries = await count('test_flow_entries');
  const before = (await db.query('SELECT * FROM leads ORDER BY id')).rows;
  const settings = await value<Record<string,unknown>>('SELECT settings AS value FROM integration_settings');

  await paidOriginMigration();
  await paidOriginMigration();
  expect(await leadOrigin(leadId)).toBe('Facebook / Instagram');
  for (const untouched of [existing,...nonPaid,id(41)]) expect(await leadOrigin(untouched)).toBe('FBS');
  expect(await leadOrigin(reassigned)).toBe('tráfego pago');
  const after = (await db.query('SELECT * FROM leads ORDER BY id')).rows;
  expect(after).toEqual(before.map(lead => lead.id === leadId ? {...lead,origem_id:after.find(row => row.id === leadId)!.origem_id} : lead));
  expect(await value('SELECT settings AS value FROM integration_settings')).toEqual({...settings,defaultOrigem:'Facebook / Instagram'});
  expect(await count('test_flow_entries')).toBe(entries);
  expect(await count('meta_conversion_events')).toBe(0);

  await enqueue('888888888888886');
  const next = await importClaim((await claim())!,'12025550106');
  expect(await leadOrigin(next)).toBe('Facebook / Instagram');
  expect(await count('test_flow_entries')).toBe(entries+1);
});

it('updates the legacy paid default but preserves an explicitly custom integration origin', async () => {
  await paidOriginMigration();
  expect(await value(`SELECT settings->>'defaultOrigem' AS value FROM integration_settings`)).toBe('Facebook / Instagram');
  await db.exec(`UPDATE integration_settings SET settings=jsonb_set(settings,'{defaultOrigem}','"Custom campaign"')`);
  await paidOriginMigration();
  expect(await value(`SELECT settings->>'defaultOrigem' AS value FROM integration_settings`)).toBe('Custom campaign');
});

it('recovers expired leases and fences stale workers without losing the attempt history', async () => {
  await enqueue(); const first = (await claim())!;
  await db.exec(`UPDATE meta_lead_receipts SET locked_until=now()-interval '1 minute'`);
  const second = (await claim())!; expect(second.lock_token).not.toBe(first.lock_token); expect(second.attempts).toBe(2);
  await expect(importClaim(first)).rejects.toThrow('LEASE_LOST');
  expect(await scalar<boolean>('meta_ads_finish',['inbound',metaLead,first.lock_token,'GRAPH_NETWORK',60])).toBe(false);
  expect(await scalar<boolean>('meta_ads_finish',['inbound',metaLead,second.lock_token,'GRAPH_NETWORK',60])).toBe(true);
  expect(await claim()).toBeNull();
  await db.exec(`UPDATE meta_lead_receipts SET next_attempt_at=now()-interval '1 second'`);
  const third = (await claim())!; expect(third.attempts).toBe(3); await importClaim(third);
  expect(await count('meta_integration_attempts')).toBe(5); expect(await count('leads')).toBe(1);
});

it('fails transactionally when CRM defaults are unavailable and never grants consent from a form submission', async () => {
  await enqueue(); const lease = (await claim())!;
  await db.exec(`UPDATE lead_status_config SET padrao=false`);
  try {
    await expect(importClaim(lease)).rejects.toThrow('LEAD_DEFAULTS_MISSING');
    expect(await count('leads')).toBe(0); expect(await count('meta_lead_attributions')).toBe(0);
  } finally { await db.exec(`UPDATE lead_status_config SET padrao=true`); }
  // This migration never writes contact_permission_policies or weakens the outbound send guard.
  await importClaim(lease); expect(await count('leads')).toBe(1);
});

it('requires explicit commercial evidence and an actual related contract, with separate idempotent held events', async () => {
  const { leadId,attr } = await imported();
  await db.query(`UPDATE leads SET status='Proposta Enviada' WHERE id=$1`,[leadId]);
  expect(await count('meta_conversion_events')).toBe(0);
  await review(attr,false); await review(attr,true,1); expect(await count('meta_conversion_events')).toBe(0);
  await expect(review(attr,true,2,null,false,observer)).rejects.toThrow('FORBIDDEN');
  await review(attr); await review(attr); expect(await count('meta_conversion_events')).toBe(1);
  expect(await value<string>('SELECT status AS value FROM meta_conversion_events')).toBe('held');
  expect(await scalar('meta_ads_claim',['outbound'])).toBeNull();
  await db.query(`INSERT INTO contracts VALUES($1,$2,'SYNTHETIC-OLD',now()-interval '10 days','Ativo'),
    ($3,$2,'SYNTHETIC-NEW',now(),'Em análise')`,[id(20),leadId,id(21)]);
  await expect(review(attr,true,2,id(20),true)).rejects.toThrow('CONTRACT_MISMATCH');
  await expect(review(attr,true,2,null,true)).rejects.toThrow();
  await review(attr,true,2,id(21),false); expect(await count('meta_conversion_events')).toBe(1);
  await review(attr,true,2,id(21),true); await review(attr,true,2,id(21),true);
  expect(await count('meta_conversion_events')).toBe(2);
  const snapshot = await scalar<{ attributions: { contracts: { id: string }[] }[] }>('meta_ads_snapshot',[admin]);
  expect(snapshot.attributions[0].contracts.map((c) => c.id)).toEqual([id(21)]);
  await expect(review(attr,true,2,null,false,admin,id(30))).rejects.toThrow('OPPORTUNITY_MISMATCH');
});

it('qualifies all three modalities with a single person when product eligibility is confirmed, preserving legacy decisions', async () => {
  const { attr } = await imported();
  const legacy = await review(attr,true,1);
  for (const modality of ['individual','business','collective_membership']) {
    const reviewId = await reviewV2(attr,modality);
    const saved = await value<{ qualified: boolean; eligible_business: boolean; eligibility_confirmed: boolean; contracting_modality: string; criteria_version: string }>(
      'SELECT to_jsonb(r) AS value FROM meta_commercial_reviews r WHERE id=$1',[reviewId]);
    expect(saved.qualified).toBe(true);
    expect(saved.eligible_business).toBe(modality === 'business');
    expect(saved.eligibility_confirmed).toBe(true);
    expect(saved.contracting_modality).toBe(modality);
    expect(saved.criteria_version).toBe('all-modalities-v2');
    const unqualified = await reviewV2(attr,modality,false);
    expect(await value<boolean>('SELECT qualified AS value FROM meta_commercial_reviews WHERE id=$1',[unqualified])).toBe(false);
  }
  const original = await value<{ qualified: boolean; criteria_version: string; contracting_modality: string | null }>(
    'SELECT to_jsonb(r) AS value FROM meta_commercial_reviews r WHERE id=$1',[legacy]);
  expect(original.qualified).toBe(false);
  expect(original.criteria_version).toBe('pme-mei-v1');
  expect(original.contracting_modality).toBeNull();
});

it('records a sale with contract entry pending without producing a contract conversion', async () => {
  const { attr } = await imported();
  const reviewId = await reviewV2(attr,'collective_membership',true,1,true);
  expect(await value<boolean>('SELECT sale_closed AND NOT contract_completed AND contract_id IS NULL AS value FROM meta_commercial_reviews WHERE id=$1',[reviewId])).toBe(true);
  expect(await value<number>("SELECT count(*)::integer AS value FROM meta_conversion_events WHERE kind='contract_completed'")).toBe(0);
  const snapshot = await scalar<{ attributions: { latest_review: { sale_closed: boolean; contract_completed: boolean; contracting_modality: string } }[] }>('meta_ads_snapshot',[admin]);
  expect(snapshot.attributions[0].latest_review.sale_closed).toBe(true);
  expect(snapshot.attributions[0].latest_review.contract_completed).toBe(false);
  expect(snapshot.attributions[0].latest_review.contracting_modality).toBe('collective_membership');
  await expect(reviewV2(attr,'individual',true,1,true,null,true)).rejects.toThrow('CONTRACT_CONFIRMATION_REQUIRED');
  expect(await count('meta_commercial_reviews')).toBe(1);
  expect(await scalar('meta_ads_claim',['outbound'])).toBeNull();
});

it('requires an explicitly selected shared negotiation for a beneficiary contract and revalidates membership before sending', async () => {
  const { leadId,attr } = await imported();
  const daughter = id(61), group = id(62), contract = id(63), unrelated = id(64);
  await db.query(`INSERT INTO leads(id,nome_completo,telefone,origem_id,responsavel_id,status_id,status,skip_automation)
    VALUES($1,'Synthetic Daughter','12025550102',$2,$3,$4,'Convertido',true)`,[daughter,origin,responsible,status]);
  await db.query(`INSERT INTO opportunities VALUES($1,'Synthetic family sale','won',false)`,[group]);
  await db.query(`INSERT INTO opportunity_leads VALUES($1,$2,NULL),($1,$3,NULL)`,[group,leadId,daughter]);
  await db.query(`INSERT INTO contracts VALUES($1,$2,'SYNTHETIC-DAUGHTER',now(),'Ativo'),($3,$2,'SYNTHETIC-OLD',now()-interval '10 days','Ativo')`,[contract,daughter,unrelated]);
  await expect(reviewV2(attr,'collective_membership',true,1,true,contract,true)).rejects.toThrow('CONTRACT_MISMATCH');
  await expect(reviewV2(attr,'collective_membership',true,1,true,unrelated,true,group)).rejects.toThrow('CONTRACT_MISMATCH');
  const snapshot = await scalar<{ attributions: { contracts: { id: string; lead_id: string; opportunity_ids: string[] }[] }[] }>('meta_ads_snapshot',[admin]);
  expect(snapshot.attributions[0].contracts).toHaveLength(1);
  expect(snapshot.attributions[0].contracts[0].lead_id).toBe(daughter);
  expect(snapshot.attributions[0].contracts[0].opportunity_ids).toEqual([group]);
  await reviewV2(attr,'collective_membership',true,1,true,contract,true,group);
  await reviewV2(attr,'collective_membership',true,1,true,contract,true,group);
  expect(await value<number>("SELECT count(*)::integer AS value FROM meta_conversion_events WHERE kind='contract_completed'")).toBe(1);
  expect(await value<string>('SELECT lead_id::text AS value FROM contracts WHERE id=$1',[contract])).toBe(daughter);
  const eventId = await value<string>("SELECT event_id::text AS value FROM meta_conversion_events WHERE kind='contract_completed'");
  await scalar('meta_ads_release',[[eventId],'666666666666666','QualifiedLead','ConvertedLead','approval']);
  const event = await scalar<{ event_id: string; lock_token: string }>('meta_ads_claim',['outbound']);
  expect(await scalar('meta_ads_validate_event',[event.event_id,event.lock_token])).toBe(true);
  await db.query('UPDATE opportunity_leads SET removed_at=now() WHERE lead_id=$1',[daughter]);
  expect(await scalar('meta_ads_validate_event',[event.event_id,event.lock_token])).toBe(false);
  const after = await scalar<{ attributions: { contracts: unknown[] }[] }>('meta_ads_snapshot',[admin]);
  expect(after.attributions[0].contracts).toHaveLength(0);
});

it('rejects unknown modalities, invalid evidence and unauthorized actors without recording a review', async () => {
  const { attr } = await imported();
  await expect(reviewV2(attr,'other')).rejects.toThrow('INVALID_REVIEW');
  await expect(reviewV2(attr,'individual',true,0)).rejects.toThrow('INVALID_REVIEW');
  await expect(reviewV2(attr,'individual',true,100001)).rejects.toThrow('INVALID_REVIEW');
  await expect(reviewV2(attr,'individual',true,1,false,null,false,null,observer)).rejects.toThrow('FORBIDDEN');
  await expect(reviewV2(attr,'individual',true,1,false,id(90),true)).rejects.toThrow('CONTRACT_CONFIRMATION_REQUIRED');
  expect(await count('meta_commercial_reviews')).toBe(0);
  await db.exec('SET ROLE authenticated');
  await expect(reviewV2(attr)).rejects.toThrow('permission denied');
  await db.exec('RESET ROLE');
});

it('freezes approval/destination and validates the current commercial signal before transmission', async () => {
  const { attr } = await imported(); await review(attr);
  const eventId = await value<string>('SELECT event_id::text AS value FROM meta_conversion_events');
  await expect(scalar('meta_ads_release',[[eventId],null,'QualifiedLead','ConvertedLead','approval'])).rejects.toThrow('APPROVAL_REQUIRED');
  expect(await scalar<number>('meta_ads_release',[[eventId],'666666666666666','QualifiedLead','ConvertedLead','approval'])).toBe(1);
  expect(await scalar<number>('meta_ads_release',[[eventId],'777777777777777','ChangedEvent','ConvertedLead','other'])).toBe(0);
  const event = await scalar<{ event_id: string; lock_token: string; event_name: string }>('meta_ads_claim',['outbound']);
  expect(event.event_name).toBe('QualifiedLead');
  expect(await scalar<boolean>('meta_ads_validate_event',[event.event_id,event.lock_token])).toBe(true);
  await review(attr,false);
  expect(await scalar<boolean>('meta_ads_validate_event',[event.event_id,event.lock_token])).toBe(false);
});

it('denies direct client table/RPC access and rejects credentials in integration settings', async () => {
  await expect(db.query(`UPDATE integration_settings SET settings=settings || '{"pageAccessToken":"example-meta-secret"}'`)).rejects.toThrow('Edge Secrets');
  await expect(scalar('meta_ads_snapshot',[observer])).rejects.toThrow('FORBIDDEN');
  for (const role of ['anon','authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await expect(db.query('SELECT * FROM public.meta_lead_attributions')).rejects.toThrow('permission denied');
      await expect(scalar('meta_ads_snapshot',[admin])).rejects.toThrow('permission denied');
      await expect(scalar('meta_ads_claim',['inbound'])).rejects.toThrow('permission denied');
      await expect(scalar('meta_ads_review_v2',[admin,id(99),'individual',true,1,true,true,false,null,null,false])).rejects.toThrow('permission denied');
      await expect(scalar('meta_ads_contract_is_related',[id(99),new Date().toISOString(),id(98),null])).rejects.toThrow('permission denied');
    } finally { await db.exec('RESET ROLE'); }
  }
  await db.exec('SET ROLE service_role');
  try {
    expect(await enqueue()).toBe(1); await importClaim((await claim())!);
    const snapshot = await scalar<{ imported: number }>('meta_ads_snapshot',[admin]); expect(snapshot.imported).toBe(1);
    await expect(scalar('meta_ads_contract_is_related',[id(99),new Date().toISOString(),id(98),null])).rejects.toThrow('permission denied');
  } finally { await db.exec('RESET ROLE'); }
});

it('runs the local webhook → durable queue → mocked Graph → canonical CRM path end to end without CAPI', async () => {
  const config: MetaConfig = { enabled: true,pageId: page,formId: form,graphVersion: 'v25.0',commercialField: 'business' };
  const handler = createWebhookHandler({ config: async () => config,secret: 'example-meta-secret',verifyToken: 'example-verify-token',
    enqueue: async (receipts) => { await scalar('meta_ads_enqueue',[JSON.stringify(receipts)]); },
  });
  const body=JSON.stringify({ object: 'page',entry: [{ id: page,changes: [{ field: 'leadgen',value: {
    page_id: page,form_id: form,ad_id: '333333333333333',leadgen_id: metaLead,created_time: Math.floor(Date.now()/1000)-60,
  } }] }] });
  const signature=`sha256=${createHmac('sha256','example-meta-secret').update(body).digest('hex')}`;
  for (let i=0;i<2;i++) expect((await handler(new Request('https://local.invalid',{ method: 'POST',body,headers: { 'x-hub-signature-256': signature } }))).status).toBe(200);
  let retrieved=0;
  const result=await runMetaWorker({
    config: async () => config,
    approval: { enabled: false,complianceApproved: false,authorizationReference: '',datasetId: '',qualifiedEvent: '',contractEvent: '',token: '' },
    claimInbound: () => scalar<Receipt | null>('meta_ads_claim',['inbound']),
    claimOutbound: async () => { throw new Error('CAPI MUST NOT BE CLAIMED'); },
    retrieve: async () => { retrieved++; return { id: metaLead,form_id: form,ad_id: '333333333333333',is_organic: false,
      field_data: [{ name: 'full_name',values: ['Synthetic E2E'] },{ name: 'phone_number',values: ['+1 202 555 0100'] },{ name: 'business',values: ['MEI'] }] }; },
    importLead: async (receipt,lead) => { await scalar('meta_ads_import',[receipt.leadgen_id,receipt.lock_token,JSON.stringify(lead)]); },
    validateOutbound: async () => { throw new Error('CAPI MUST NOT BE VALIDATED'); },
    send: async () => { throw new Error('NO EXTERNAL TRAFFIC'); },
    finish: async () => { throw new Error('UNEXPECTED IMPORT FAILURE'); },
  });
  expect(result.imported).toBe(1); expect(retrieved).toBe(1); expect(await count('leads')).toBe(1);
  expect(await value<string>('SELECT commercial_answer AS value FROM meta_lead_attributions')).toBe('MEI');
  expect(await count('test_flow_entries')).toBe(1);
  const attr=await value<string>('SELECT id::text AS value FROM meta_lead_attributions'); await review(attr);
  expect(await value<string>('SELECT status AS value FROM meta_conversion_events')).toBe('held');
});

it('retains organic/unknown entries separately and never prepares advertising signals for them', async () => {
  await enqueue(); const lease=(await claim())!;
  await scalar('meta_ads_import',[metaLead,lease.lock_token,JSON.stringify({ name: 'Organic Synthetic',phone: '12025550100',traffic_type: 'organic' })]);
  const attr=await value<string>('SELECT id::text AS value FROM meta_lead_attributions'); await review(attr);
  expect(await count('meta_conversion_events')).toBe(0);
  expect(await value<string>('SELECT o.nome AS value FROM leads l JOIN lead_origens o ON o.id=l.origem_id')).toBe('Meta — origem não confirmada');
});

it('reconciliation preserves conversion identity and time, requires release again, and forbids switching datasets', async () => {
  const { attr }=await imported(); await review(attr);
  const eventId=await value<string>('SELECT event_id::text AS value FROM meta_conversion_events');
  await scalar('meta_ads_release',[[eventId],'666666666666666','QualifiedLead','ConvertedLead','approval']);
  const event=await scalar<{ event_id: string;lock_token: string;occurred_at: string }>('meta_ads_claim',['outbound']);
  await scalar('meta_ads_finish',['outbound',eventId,event.lock_token,'GRAPH_AUTH',null]);
  expect(await scalar('meta_ads_requeue_event',[admin,eventId])).toBe(true);
  expect(await scalar('meta_ads_claim',['outbound'])).toBeNull();
  expect(await scalar('meta_ads_release',[[eventId],'777777777777777','QualifiedLead','ConvertedLead','approval'])).toBe(0);
  expect(await scalar('meta_ads_release',[[eventId],'666666666666666','QualifiedLead','ConvertedLead','approval'])).toBe(1);
  const retry=await scalar<{ event_id: string;occurred_at: string }>('meta_ads_claim',['outbound']);
  expect(retry.event_id).toBe(eventId); expect(retry.occurred_at).toBe(event.occurred_at);
});

it('expires held events without fabricating fresh timestamps or changing their identity', async () => {
  const { attr }=await imported(); await review(attr);
  await db.exec(`UPDATE meta_conversion_events SET occurred_at=now()-interval '8 days'`);
  const before=await value<string>('SELECT occurred_at::text AS value FROM meta_conversion_events');
  expect(await scalar('meta_ads_reconcile')).toBe(1);
  expect(await value<string>('SELECT status AS value FROM meta_conversion_events')).toBe('dead');
  expect(await value<string>('SELECT occurred_at::text AS value FROM meta_conversion_events')).toBe(before);
  const eventId=await value<string>('SELECT event_id::text AS value FROM meta_conversion_events');
  expect(await scalar('meta_ads_requeue_event',[admin,eventId])).toBe(false);
});

it('searches attribution by contact or exact Meta ID and paginates the complete sanitized history', async () => {
  await imported();
  const found=await scalar<{ attributions: { leadgen_id: string }[] }>('meta_ads_snapshot',[admin,'Synthetic']);
  expect(found.attributions[0].leadgen_id).toBe(metaLead);
  const missing=await scalar<{ attributions: unknown[] }>('meta_ads_snapshot',[admin,'not-a-contact']);
  expect(missing.attributions).toEqual([]);
  await db.exec(`TRUNCATE meta_integration_attempts;
    INSERT INTO meta_integration_attempts(direction,entity_id,attempt,outcome)
    SELECT 'inbound','999999999999999999',n,'started' FROM generate_series(1,55) n;`);
  const snapshot=await scalar<{ history: { id: string }[] }>('meta_ads_snapshot',[admin,metaLead]);
  expect(snapshot.history).toHaveLength(50);
  const older=await scalar<{ id: string }[]>('meta_ads_history',[admin,snapshot.history.at(-1)!.id]);
  expect(older).toHaveLength(5);
  expect(new Set([...snapshot.history,...older].map((entry) => entry.id)).size).toBe(55);
  await expect(scalar('meta_ads_history',[observer,snapshot.history.at(-1)!.id])).rejects.toThrow('FORBIDDEN');
});

it('executes the canonical CRM import for an official test but rolls back records and automation atomically', async () => {
  await enqueue(); const lease=(await claim())!;
  const lead=JSON.stringify({name:'KIFER TESTE DE INTEGRACAO',phone:'12025550100',commercial_answer:'Synthetic choice',traffic_type:'organic'});
  const result=await scalar<{canonical_import_validated:boolean;crm_record_persisted:boolean}>('meta_ads_validate_test_import',[metaLead,lease.lock_token,lead]);
  expect(result.canonical_import_validated).toBe(true);expect(result.crm_record_persisted).toBe(false);
  expect(await count('leads')).toBe(0);expect(await count('test_flow_entries')).toBe(0);
  expect(await count('meta_lead_attributions')).toBe(0);expect(await count('meta_conversion_events')).toBe(0);
  expect(await value<string>('SELECT status AS value FROM meta_lead_receipts')).toBe('validation_passed');
  expect(await claim()).toBeNull();
});

it('never accepts a real or arbitrary contact in the validation-only transaction', async () => {
  await enqueue();const lease=(await claim())!;
  await expect(scalar('meta_ads_validate_test_import',[metaLead,lease.lock_token,JSON.stringify({name:'Other Contact',phone:'12025550100',commercial_answer:'Synthetic'})])).rejects.toThrow('INVALID_VALIDATION_CONTACT');
  expect(await count('leads')).toBe(0);
});
