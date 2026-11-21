import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import { resolveCampaignCopySteps } from './campaign-sequence-v2.ts';

type RecordData = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_ID = /^[a-zA-Z0-9:_-]{1,128}$/;
const isRecord = (value: unknown): value is RecordData => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const failure = (code: string, message: string) => ({ success: false, error_code: code, message });
const U = { type: 'string', format: 'uuid' } as const;
const REQ = { type: 'string', pattern: '^[a-zA-Z0-9:_-]{1,128}$', minLength: 1, maxLength: 128 } as const;
const A = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const R = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const draftMessageSchema = {
  type: 'object', additionalProperties: false,
  required: ['messageText'],
  properties: {
    messageText: { type: 'string', maxLength: 4096 },
    mediaUrl: { type: ['string', 'null'], maxLength: 2048 },
    mediaType: { type: ['string', 'null'], enum: ['image','document','video',null] },
    mediaFilename: { type: ['string','null'], maxLength: 255 },
  },
};
const draftStageSchema = {
  type: 'object', additionalProperties: false, required: ['kind', 'messages'],
  properties: {
    kind: { type: 'string', enum: ['message','status_change'] },
    delayAmount: { type: 'integer', minimum: 0, maximum: 31622400 },
    delayUnit: { type: 'string', enum: ['seconds','minutes','hours','days'] },
    statusToSet: { type: 'string', maxLength: 160 },
    messages: { type: 'array', maxItems: 30, items: draftMessageSchema },
    variantMessages: {
      type: 'object', maxProperties: 25, propertyNames: { pattern: '^[B-Z]$' },
      additionalProperties: { type: 'array', minItems: 1, maxItems: 30, items: draftMessageSchema },
    },
  },
};
export const MCP_CAMPAIGN_EXT_READ_NAMES = [
  'kifer_get_whatsapp_campaign_contact_history',
  'kifer_get_whatsapp_campaign_test_status',
  'kifer_find_duplicate_whatsapp_chats',
] as const;
export const MCP_CAMPAIGN_EXT_WRITE_NAMES = [
  'kifer_create_whatsapp_campaign_template',
  'kifer_update_whatsapp_campaign_template',
  'kifer_archive_whatsapp_campaign_template',
  'kifer_send_whatsapp_campaign_test',
  'kifer_reconcile_verified_whatsapp_lid',
] as const;
export const MCP_CAMPAIGN_EXT_TOOLS: McpToolDescriptor[] = [
  { name: 'kifer_create_whatsapp_campaign_template',
    description: 'Salva um modelo de Disparos compatível com o editor. Não cria campanha nem envia mensagens. client_request_id evita duplicidade.',
    inputSchema: { type:'object',required:['name','stages','client_request_id'],additionalProperties:false,properties:{
      name:{ type:'string',minLength:1,maxLength:160 },
      stages:{ type:'array',minItems:1,maxItems:30,items:draftStageSchema }, client_request_id:REQ,
    } },annotations:A },
  { name: 'kifer_update_whatsapp_campaign_template',
    description: 'Edita um modelo ainda não arquivado, com controle otimista de versão. Não envia mensagens.',
    inputSchema: { type:'object',required:['template_id','expected_updated_at','client_request_id'],additionalProperties:false,properties:{
      template_id:U,expected_updated_at:{type:'string',format:'date-time'},client_request_id:REQ,
      name:{type:'string',minLength:1,maxLength:160},stages:{type:'array',minItems:1,maxItems:30,items:draftStageSchema},
    } },annotations:A },
  { name: 'kifer_archive_whatsapp_campaign_template',
    description: 'Arquiva logicamente um modelo de Disparos sem apagar seus dados. Exige versão atual.',
    inputSchema: { type:'object',required:['template_id','expected_updated_at','client_request_id'],additionalProperties:false,properties:{
      template_id:U,expected_updated_at:{type:'string',format:'date-time'},client_request_id:REQ,
    } },annotations:A },
  { name: 'kifer_send_whatsapp_campaign_test',
    description: 'ENVIA UMA MENSAGEM REAL de teste a um telefone explicitamente indicado; não ativa nem agenda a campanha. Exige confirm_send=true, chave idempotente e limita taxa. O mesmo request_id NUNCA é reenviado.',
    inputSchema: { type:'object',required:['campaign_id','phone','variant','step_index','confirm_send','client_request_id'],additionalProperties:false,properties:{
      campaign_id:U,phone:{type:'string',minLength:10,maxLength:32},variant:{type:'string',pattern:'^[A-Z]$'},step_index:{type:'integer',minimum:0,maximum:29},
      confirm_send:{type:'boolean',const:true},client_request_id:REQ,
    } },annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:true} },
  { name: 'kifer_reconcile_verified_whatsapp_lid',
    description: 'Consolida chats WhatsApp exclusivamente quando existem identificadores LID e WA-ID verificados e reciprocamente associados no banco. Não apaga registros; move o histórico para a conversa canônica. Bloqueia conflitos de lead e exige confirmação, versão dos dois chats e operador identificado.',
    inputSchema: {type:'object',required:['lid_chat_id','phone_chat_id','expected_lid_updated_at','expected_phone_updated_at','confirm_merge','client_request_id'],additionalProperties:false,properties:{
      lid_chat_id:U,phone_chat_id:U,expected_lid_updated_at:{type:'string',format:'date-time'},
      expected_phone_updated_at:{type:'string',format:'date-time'},confirm_merge:{type:'boolean',const:true},
      client_request_id:REQ,
    }},annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
  { name: 'kifer_get_whatsapp_campaign_contact_history',
    description: 'Lista balões enviados a um contato de campanha, com etapa, horário e status de entrega, além de eventos técnicos sanitizados. Não mostra o telefone.',
    inputSchema: { type:'object',required:['campaign_id','target_id'],additionalProperties:false,properties:{
      campaign_id:U,target_id:U,page:{type:'integer',minimum:1},page_size:{type:'integer',minimum:1,maximum:50},
    } },annotations:R },
  { name: 'kifer_get_whatsapp_campaign_test_status',
    description: 'Consulta o resultado persistido de um pedido de teste sem expor telefone, conteúdo ou segredo.',
    inputSchema: {type:'object',required:['client_request_id'],additionalProperties:false,properties:{client_request_id:REQ}},annotations:R },
  { name: 'kifer_find_duplicate_whatsapp_chats',
    description: 'Diagnóstico de conversas potencialmente duplicadas do mesmo lead ou telefone, somente leitura. Não mescla chats nem altera histórico.',
    inputSchema:{type:'object',additionalProperties:false,properties:{
      lead_id:U,phone:{type:'string',minLength:10,maxLength:32},include_merged:{type:'boolean',default:false},
    }},annotations:R },
];

const asSafeMedia = (value: string): boolean => {
  if (!value) return true;
  if (value.length > 2048 || /[?#]/.test(value)) return false;
  const prefix = 'storage://whatsapp-campaign-media/';
  if (value.startsWith(prefix)) return /^[a-zA-Z0-9/_\-.]+$/.test(value.slice(prefix.length)) && !value.includes('..');
  const base = typeof Deno !== 'undefined' ? Deno.env.get('SUPABASE_URL') || '' : '';
  const publicPrefix = base + '/storage/v1/object/public/whatsapp-campaign-media/';
  return Boolean(base) && value.startsWith(publicPrefix)
    && /^[a-zA-Z0-9/_\-.]+$/.test(value.slice(publicPrefix.length))
    && !value.includes('..');
};
const normalizeTemplateStages = (value: unknown): RecordData[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) return null;
  const normalized: RecordData[] = [];
  let labels: string[] | null = null;
  const messageList = (raw: unknown): RecordData[] | null => {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 30) return null;
    const list: RecordData[] = [];
    for (const msg of raw) {
      if (!isRecord(msg) || Object.keys(msg).some((k) => !['messageText','mediaUrl','mediaType','mediaFilename'].includes(k))) return null;
      const body = text(msg.messageText);
      const media = text(msg.mediaUrl);
      if ((!body && !media) || body.length > 4096 || !asSafeMedia(media)) return null;
      const type = text(msg.mediaType);
      if (media && !['image','document','video'].includes(type)) return null;
      const name = text(msg.mediaFilename);
      if (name.length > 255) return null;
      list.push({ messageText:body, mediaUrl:media||null, mediaType:media?type:null, mediaFilename:media?name||null:null });
    }
    return list;
  };
  for (const stage of value) {
    if (!isRecord(stage) || Object.keys(stage).some((key) => !['kind','delayAmount','delayUnit','statusToSet','messages','variantMessages'].includes(key))) return null;
    const kind = text(stage.kind);
    const delay = stage.delayAmount ?? 0;
    const unit = text(stage.delayUnit)||'minutes';
    if (!['message','status_change'].includes(kind) || !Number.isInteger(delay)||Number(delay)<0||Number(delay)>31622400
      || !['seconds','minutes','hours','days'].includes(unit)) return null;
    if (kind==='status_change') {
      const status=text(stage.statusToSet);
      if (!status || status.length>160) return null;
      normalized.push({kind,delayAmount:delay,delayUnit:unit,statusToSet:status,messages:[]});
      continue;
    }
    const messages=messageList(stage.messages);if(!messages)return null;
    const variantMessages=isRecord(stage.variantMessages)?stage.variantMessages:{};
    const current=Object.keys(variantMessages).sort();
    if(current.some((label,i)=>label!==String.fromCharCode(66+i)))return null;
    if(labels===null) labels=current;
    if(current.join(',')!==labels.join(',')) return null;
    const variants:RecordData={};
    for(const label of current){const v=messageList(variantMessages[label]);if(!v)return null;variants[label]=v;}
    normalized.push({kind,delayAmount:delay,delayUnit:unit,messages,variantMessages:variants});
  }
  return normalized;
};
const stableJson = (value:unknown) => JSON.stringify(value, (_key, obj) =>
  isRecord(obj) ? Object.fromEntries(Object.entries(obj).sort(([a],[b])=>a.localeCompare(b))) : obj);
const sha256 = async (value:string) => {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
};
const deterministicUuid = async (value:string) => {
  const h=await sha256(value);
  return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);
};
const limitPage = (args:RecordData) => {
  const page=Number.isInteger(args.page) ? Math.max(1,Number(args.page)):1;
  const per=Number.isInteger(args.page_size)?Math.min(50,Math.max(1,Number(args.page_size))):20;
  return {page,per,from:(page-1)*per};
};
const safePhone = (raw:unknown) => {
  const digits=text(raw).replace(/\D/g,'');
  const phone=digits.startsWith('55')?digits:'55'+digits;
  return /^55\d{10,11}$/.test(phone)?phone:null;
};
const mask = (phone:string) => '••••'+phone.slice(-4);
const phoneVariants = (phone:string):string[] => {
  const keys=new Set([phone]);
  if(/^55\d{2}9\d{8}$/.test(phone))keys.add(phone.slice(0,4)+phone.slice(5));
  else if(/^55\d{2}[6-9]\d{7}$/.test(phone))keys.add(phone.slice(0,4)+'9'+phone.slice(4));
  return [...keys];
};
const canonicalDigits = (raw:unknown) => {
  const d=text(raw).replace(/\D/g,'');
  return /^55\d{2}[6-9]\d{7}$/.test(d) ? d.slice(0,4)+'9'+d.slice(4) : d;
};

export async function executeMcpCampaignExtendedRead(args: {
  supabase:SupabaseClient;toolName:string;arguments:RecordData;actorId:string;
}):Promise<RecordData|null> {
  const {supabase,toolName,arguments:input,actorId}=args;
  if (toolName==='kifer_get_whatsapp_campaign_test_status') {
    const requestId=text(input.client_request_id);
    if(!REQUEST_ID.test(requestId)) return failure('INVALID_INPUT','client_request_id inválido.');
    const {data,error}=await supabase.from('mcp_whatsapp_campaign_test_requests')
      .select('campaign_id,variant_label,step_index,status,response_code,created_at,finished_at')
      .eq('actor_id',actorId).eq('client_request_id',requestId).maybeSingle();
    return error?failure('INTERNAL_ERROR','Falha ao consultar o teste.'):{success:true,test:data??null};
  }
  if(toolName==='kifer_get_whatsapp_campaign_contact_history') {
    const campaignId=text(input.campaign_id),targetId=text(input.target_id);
    if(!UUID.test(campaignId)||!UUID.test(targetId)) return failure('INVALID_INPUT','IDs inválidos.');
    const {data:target,error:targetError}=await supabase.from('comm_whatsapp_campaign_targets')
      .select('id,status,ab_variant').eq('id',targetId).eq('campaign_id',campaignId).maybeSingle();
    if(targetError||!target) return failure('NOT_FOUND','Contato da campanha não encontrado.');
    const {page,per,from}=limitPage(input);
    const [messages,events]=await Promise.all([
      supabase.from('comm_whatsapp_messages')
        .select('id,message_at,message_type,delivery_status,text_content,media_file_name,status_updated_at,metadata',{count:'exact'})
        .eq('source','campaign').contains('metadata',{campaign_id:campaignId,campaign_target_id:targetId})
        .order('message_at',{ascending:true}).range(from,from+per-1),
      supabase.from('comm_whatsapp_campaign_events')
        .select('id,event_type,created_at,payload')
        .eq('campaign_id',campaignId).eq('target_id',targetId)
        .order('created_at',{ascending:true}).limit(200),
    ]);
    if(messages.error||events.error)return failure('INTERNAL_ERROR','Não foi possível consultar o histórico do contato.');
    const rows=(messages.data??[]).map((item)=>({
      id:item.id,message_at:item.message_at,delivery_status:item.delivery_status,
      message_type:item.message_type,text_content:typeof item.text_content==='string'?item.text_content.slice(0,4096):null,
      media_filename:item.media_file_name||null,status_updated_at:item.status_updated_at,
      step_index:isRecord(item.metadata)&&Number.isInteger(item.metadata.campaign_step_index)?item.metadata.campaign_step_index:null,
    }));
    const history=(events.data??[]).map((event)=>({
      id:event.id,event_type:event.event_type,created_at:event.created_at,
      step_index:isRecord(event.payload)&&Number.isInteger(event.payload.step_index)?event.payload.step_index:null,
      reason_code:isRecord(event.payload)?text(event.payload.reason_code)||null:null,
    }));
    return {success:true,campaign_id:campaignId,target_id:targetId,target_status:target.status,
      variant:target.ab_variant, page,page_size:per,total:messages.count??0,messages:rows,events:history};
  }
  if(toolName==='kifer_find_duplicate_whatsapp_chats') {
    const leadId=text(input.lead_id),phone=safePhone(input.phone);
    if(!UUID.test(leadId)&&!phone)return failure('INVALID_INPUT','Informe lead_id ou um telefone brasileiro válido.');
    let q=supabase.from('comm_whatsapp_chats')
      .select('id,channel_id,phone_digits,external_chat_id,lead_id,created_at,updated_at,merged_into_chat_id,deleted_at,last_message_at')
      .order('updated_at',{ascending:false}).limit(40);
    if(UUID.test(leadId))q=q.eq('lead_id',leadId);
    else q=q.in('phone_digits',phoneVariants(phone!));
    if(input.include_merged!==true)q=q.is('merged_into_chat_id',null);
    const {data,error}=await q;
    if(error)return failure('INTERNAL_ERROR','Falha ao consultar conversas potencialmente duplicadas.');
    const byKey=new Map<string,RecordData[]>();
    for(const chat of data??[]){
      const digits=text(chat.phone_digits);
      const key=chat.channel_id+':'+canonicalDigits(digits);
      byKey.set(key,[...(byKey.get(key)??[]),{id:chat.id,channel_id:chat.channel_id,
        phone_masked:mask(digits),lead_id:chat.lead_id,created_at:chat.created_at,
        updated_at:chat.updated_at,last_message_at:chat.last_message_at,
        merged_into_chat_id:chat.merged_into_chat_id,deleted:Boolean(chat.deleted_at)}]);
    }
    return {success:true,groups:[...byKey.entries()].filter(([,records])=>records.length>1)
      .map(([key,records])=>({channel_id:key.split(':')[0],count:records.length,chats:records})),
      matched:(data??[]).length,read_only:true};
  }
  return null;
}

export async function executeMcpCampaignExtendedWrite(args:{
  supabase:SupabaseClient;toolName:string;arguments:RecordData;actorId:string;
}):Promise<RecordData|null> {
  const {supabase,toolName,arguments:input,actorId}=args;
  if(!(MCP_CAMPAIGN_EXT_WRITE_NAMES as readonly string[]).includes(toolName))return null;
  const requestId=text(input.client_request_id);
  if(!UUID.test(actorId)||!REQUEST_ID.test(requestId))return failure('INVALID_INPUT','Ator ou chave idempotente inválidos.');
  if(toolName==='kifer_reconcile_verified_whatsapp_lid'){
    const lidId=text(input.lid_chat_id),phoneId=text(input.phone_chat_id);
    const lidAt=text(input.expected_lid_updated_at),phoneAt=text(input.expected_phone_updated_at);
    if(input.confirm_merge!==true||!UUID.test(lidId)||!UUID.test(phoneId)||lidId===phoneId
      ||!Number.isFinite(Date.parse(lidAt))||!Number.isFinite(Date.parse(phoneAt)))
      return failure('INVALID_INPUT','Informe os dois chats, suas versões e confirme a reconciliação.');
    const {data,error}=await supabase.rpc('mcp_reconcile_verified_whatsapp_lid',{
      p_actor_user_id:actorId,p_lid_chat_id:lidId,p_phone_chat_id:phoneId,
      p_expected_lid_updated_at:lidAt,p_expected_phone_updated_at:phoneAt,p_client_request_id:requestId,
    });
    if(error)return failure('REQUIRES_REVIEW','A reconciliação segura foi recusada. Consulte os conflitos de identidade e as evidências.');
    return isRecord(data)?data:failure('INTERNAL_ERROR','A reconciliação não confirmou o resultado.');
  }
  if(toolName==='kifer_create_whatsapp_campaign_template'){
    const name=text(input.name),stages=normalizeTemplateStages(input.stages);
    if(!name||name.length>160||!stages)return failure('INVALID_INPUT','Nome ou etapas de modelo inválidos.');
    const id=await deterministicUuid('kifer-campaign-template:'+actorId+':'+requestId);
    const {data:existing}=await supabase.from('comm_whatsapp_campaign_templates')
      .select('id,name,steps,created_at,updated_at,archived_at').eq('id',id).maybeSingle();
    if(existing)return existing.name===name && stableJson(existing.steps)===stableJson(stages)
      ?{success:true,replayed:true,template:existing}:failure('IDEMPOTENCY_CONFLICT','Chave já usada para outro modelo.');
    const {data,error}=await supabase.from('comm_whatsapp_campaign_templates')
      .insert({id,name,steps:stages,created_by:actorId})
      .select('id,name,steps,created_at,updated_at,archived_at').single();
    if(error)return failure('INTERNAL_ERROR','Não foi possível salvar o modelo.');
    return {success:true,template:data,replayed:false};
  }
  if(toolName==='kifer_update_whatsapp_campaign_template'||toolName==='kifer_archive_whatsapp_campaign_template'){
    const templateId=text(input.template_id),updatedAt=text(input.expected_updated_at);
    if(!UUID.test(templateId)||!Number.isFinite(Date.parse(updatedAt)))return failure('INVALID_INPUT','Informe template_id e expected_updated_at válidos.');
    const {data:stored,error:readError}=await supabase.from('comm_whatsapp_campaign_templates')
      .select('id,name,steps,updated_at,archived_at').eq('id',templateId).maybeSingle();
    if(readError||!stored)return failure('NOT_FOUND','Modelo não encontrado.');
    if(stored.archived_at)return failure('NOT_ALLOWED','O modelo já foi arquivado.');
    if(stored.updated_at!==updatedAt)return failure('STALE_WRITE','Modelo alterado. Consulte novamente.');
    const patch:RecordData={updated_at:new Date().toISOString()};
    if(toolName==='kifer_archive_whatsapp_campaign_template')patch.archived_at=new Date().toISOString();
    else{
      if(!('name' in input)&&!('stages' in input))return failure('INVALID_INPUT','Informe nome ou etapas.');
      if('name'in input){const n=text(input.name);if(!n||n.length>160)return failure('INVALID_INPUT','Nome inválido.');patch.name=n;}
      if('stages'in input){const stages=normalizeTemplateStages(input.stages);if(!stages)return failure('INVALID_INPUT','Etapas inválidas.');patch.steps=stages;}
    }
    const {data,error}=await supabase.from('comm_whatsapp_campaign_templates')
      .update(patch).eq('id',templateId).eq('updated_at',updatedAt).is('archived_at',null)
      .select('id,name,steps,created_at,updated_at,archived_at').maybeSingle();
    if(error)return failure('INTERNAL_ERROR','Não foi possível atualizar o modelo.');
    if(!data)return failure('STALE_WRITE','O modelo mudou durante a atualização.');
    return {success:true,template:data,archived:toolName==='kifer_archive_whatsapp_campaign_template'};
  }
  if(toolName==='kifer_send_whatsapp_campaign_test'){
    const campaignId=text(input.campaign_id),variant=text(input.variant),stepIndex=input.step_index;
    const phone=safePhone(input.phone);
    if(input.confirm_send!==true||!UUID.test(campaignId)||!phone||!/^[A-Z]$/.test(variant)
      ||!Number.isInteger(stepIndex)||Number(stepIndex)<0||Number(stepIndex)>29)
      return failure('INVALID_INPUT','Confirme o teste e informe campanha, telefone, copy e etapa válidos.');
    const {data:campaign,error:ce}=await supabase.from('comm_whatsapp_campaigns')
      .select('id,status,audience_config').eq('id',campaignId).maybeSingle();
    if(ce||!campaign)return failure('NOT_FOUND','Campanha não encontrada.');
    if(!['draft','scheduled','paused'].includes(campaign.status))
      return failure('NOT_ALLOWED','Teste pelo MCP permitido somente em campanhas não ativas.');
    const {data:rows,error:re}=await supabase.from('comm_whatsapp_campaign_steps')
      .select('step_index,variant_label,step_kind,message_text,media_url').eq('campaign_id',campaignId)
      .order('step_index',{ascending:true});
    if(re)return failure('INTERNAL_ERROR','Falha ao consultar as etapas.');
    const independent=isRecord(campaign.audience_config)&&campaign.audience_config.variant_sequences_v2===true;
    const chosen=resolveCampaignCopySteps((rows??[]) as RecordData[],variant,independent)
      .find((row)=>row.step_index===stepIndex&&row.step_kind==='message');
    if(!chosen)return failure('INVALID_STEP','Essa copy não possui mensagem na etapa indicada.');
    const payloadDigest=await sha256([campaignId,variant,String(stepIndex),phone].join('|'));
    const {count,error:rateError}=await supabase.from('mcp_whatsapp_campaign_test_requests')
      .select('id',{count:'exact',head:true}).eq('actor_id',actorId)
      .gte('created_at',new Date(Date.now()-3600000).toISOString());
    if(rateError)return failure('INTERNAL_ERROR','Falha ao validar limite de testes.');
    if((count??0)>=10)return failure('RATE_LIMITED','Limite de dez testes por hora atingido.');
    const row={actor_id:actorId,client_request_id:requestId,campaign_id:campaignId,
      phone_digest:await sha256(phone),request_digest:payloadDigest,variant_label:variant,step_index:stepIndex};
    const {error:insertError}=await supabase.from('mcp_whatsapp_campaign_test_requests').insert(row);
    if(insertError){
      const {data:old}=await supabase.from('mcp_whatsapp_campaign_test_requests')
        .select('request_digest,status').eq('actor_id',actorId).eq('client_request_id',requestId).maybeSingle();
      return old
        ?old.request_digest!==payloadDigest
          ?failure('IDEMPOTENCY_CONFLICT','client_request_id já usado com outros dados.')
          :{success:false,replayed:true,status:old.status,message:'Teste já solicitado; o mesmo pedido não será reenviado.'}
        :failure('INTERNAL_ERROR','Não foi possível reservar o envio de teste.');
    }
    let status='ambiguous',responseCode='WORKER_UNCERTAIN',confirmed=false;
    try{
      const result=await supabase.functions.invoke('comm-whatsapp-campaign-worker',{
        body:{action:'test_send',campaignId,phoneNumber:phone,stepIndex,variant},
      });
      if(!result.error&&isRecord(result.data)&&result.data.success===true){
        confirmed=true;status='confirmed';responseCode='PROVIDER_ACCEPTED';
      }else if(result.error||isRecord(result.data)&&result.data.error){
        status='ambiguous';responseCode='WORKER_REPORTED_ERROR';
      }
    }catch{status='ambiguous';responseCode='WORKER_EXCEPTION';}
    await supabase.from('mcp_whatsapp_campaign_test_requests').update({
      status,response_code:responseCode,finished_at:new Date().toISOString(),
    }).eq('actor_id',actorId).eq('client_request_id',requestId);
    return {success:confirmed,status,campaign_id:campaignId,variant,step_index:stepIndex,
      phone_masked:mask(phone),ambiguous:!confirmed,
      message:confirmed?'Mensagem de teste aceita pelo provedor.':'Resultado do teste incerto. Consulte a conversa antes de qualquer nova tentativa.'};
  }
  return null;
}
