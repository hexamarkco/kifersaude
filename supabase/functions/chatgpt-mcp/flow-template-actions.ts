import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';

type Obj = Record<string,unknown>;
const obj = (v:unknown):v is Obj => !!v && typeof v==='object' && !Array.isArray(v);
const str = (v:unknown):string => typeof v==='string'?v.trim():'';
const fail = (code:string,message:string)=>({success:false,error_code:code,message});
const keySchema={type:'string',pattern:'^[A-Za-z0-9:_-]{1,128}$'};
const dateSchema={type:'string',format:'date-time'};
const textsSchema={type:'array',minItems:1,maxItems:20,items:{type:'string',minLength:1,maxLength:4096}};
export const MCP_FLOW_TEMPLATE_READ_NAMES=['kifer_list_followup_message_templates','kifer_get_followup_message_template'] as const;
export const MCP_FLOW_TEMPLATE_WRITE_NAMES=['kifer_create_followup_message_template','kifer_update_followup_message_template'] as const;
export const MCP_FLOW_TEMPLATE_TOOLS:McpToolDescriptor[]=[
  {name:'kifer_list_followup_message_templates',description:'Lista modelos reutilizáveis de mensagens dos Fluxos e a versão da configuração.',inputSchema:{type:'object',additionalProperties:false,properties:{}},annotations:{readOnlyHint:true}},
  {name:'kifer_get_followup_message_template',description:'Consulta o modelo com textos e metadados, sem URLs de mídia.',inputSchema:{type:'object',required:['template_id'],additionalProperties:false,properties:{template_id:{type:'string',minLength:1,maxLength:128}}},annotations:{readOnlyHint:true}},
  {name:'kifer_create_followup_message_template',description:'Cria modelo de texto em Fluxos, sem ativar ou enviar. Protege alterações da interface com versão e chave estável.',inputSchema:{type:'object',required:['name','messages','expected_updated_at','client_request_id'],additionalProperties:false,properties:{name:{type:'string',minLength:1,maxLength:160},messages:textsSchema,expected_updated_at:dateSchema,client_request_id:keySchema}},annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
  {name:'kifer_update_followup_message_template',description:'Edita nome ou balões de texto do modelo dos Fluxos com versão e preservação do ID.',inputSchema:{type:'object',required:['template_id','expected_updated_at','client_request_id'],additionalProperties:false,properties:{template_id:{type:'string',minLength:1,maxLength:128},name:{type:'string',minLength:1,maxLength:160},messages:textsSchema,expected_updated_at:dateSchema,client_request_id:keySchema}},annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:false}},
];
const list = (settings:Obj)=>Array.isArray(settings.messageTemplates)?settings.messageTemplates.filter(obj):[];
const safe=(t:Obj)=>({id:str(t.id),name:str(t.name),messages:(Array.isArray(t.messages)?t.messages.filter(obj):[]).map(m=>({id:str(m.id),type:str(m.type),text:str(m.text)||null,has_media:Boolean(str(m.mediaUrl)),caption:str(m.caption)||null}))});
const load=async(client:SupabaseClient)=>{
  const {data,error}=await client.from('integration_settings').select('id,settings,updated_at').eq('slug','whatsapp_auto_contact').maybeSingle();
  return !error&&data&&obj(data.settings)?data:null;
};
const digest=async(input:string)=>{
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input)));
  const x=Array.from(bytes).map(n=>n.toString(16).padStart(2,'0')).join('');
  return x.slice(0,8)+'-'+x.slice(8,12)+'-5'+x.slice(13,16)+'-a'+x.slice(17,20)+'-'+x.slice(20,32);
};
const normalizeTexts=(v:unknown):string[]|null=>{
  if(!Array.isArray(v)||v.length<1||v.length>20||v.some(x=>typeof x!=='string'||!x.trim()||x.length>4096))return null;
  return v.map(x=>x.trim());
};
export async function executeMcpFlowTemplateRead({supabase,toolName,args}:{supabase:SupabaseClient,toolName:string,args:Obj}):Promise<Obj|null>{
  if(!(MCP_FLOW_TEMPLATE_READ_NAMES as readonly string[]).includes(toolName))return null;
  const config=await load(supabase);
  if(!config)return fail('NOT_FOUND','Configuração de Fluxos indisponível.');
  const templates=list(config.settings);
  if(toolName==='kifer_list_followup_message_templates')return {success:true,settings_updated_at:config.updated_at,templates:templates.map(t=>({id:str(t.id),name:str(t.name),message_count:Array.isArray(t.messages)?t.messages.length:0}))};
  const found=templates.find(t=>str(t.id)===str(args.template_id));
  return found?{success:true,settings_updated_at:config.updated_at,template:safe(found)}:fail('NOT_FOUND','Modelo não encontrado.');
}
export async function executeMcpFlowTemplateWrite({supabase,toolName,args,actorId}:{supabase:SupabaseClient,toolName:string,args:Obj,actorId:string}):Promise<Obj|null>{
  if(!(MCP_FLOW_TEMPLATE_WRITE_NAMES as readonly string[]).includes(toolName))return null;
  const request=str(args.client_request_id),version=str(args.expected_updated_at);
  if(!/^[a-f0-9-]{36}$/i.test(actorId)||!/^[A-Za-z0-9:_-]{1,128}$/.test(request)||!Number.isFinite(Date.parse(version)))return fail('INVALID_INPUT','Identidade, chave ou versão inválida.');
  const config=await load(supabase);
  if(!config)return fail('NOT_FOUND','Configuração de Fluxos indisponível.');
  const templates=list(config.settings);
  const create=toolName==='kifer_create_followup_message_template';
  const id=create?await digest('kifer-flow-template:'+actorId+':'+request):str(args.template_id);
  if(!id||id.length>128)return fail('INVALID_INPUT','template_id inválido.');
  const current=templates.find(t=>str(t.id)===id);
  const name='name'in args?str(args.name):str(current?.name);
  const messages='messages'in args?normalizeTexts(args.messages):null;
  if(!name||name.length>160||('messages'in args&&!messages))return fail('INVALID_INPUT','Nome ou mensagens inválidas.');
  if(create&&current){
    const stored=Array.isArray(current.messages)?current.messages.filter(obj):[];
    const same=str(current.name)===name&&!!messages&&stored.length===messages.length&&stored.every((m,i)=>str(m.type)==='text'&&str(m.text)===messages[i]);
    return same?{success:true,replayed:true,template:safe(current)}:fail('IDEMPOTENCY_CONFLICT','Chave já utilizada para outro modelo.');
  }
  if(!create&&!current)return fail('NOT_FOUND','Modelo não encontrado.');
  if(version!==config.updated_at)return fail('STALE_WRITE','A configuração foi modificada. Consulte novamente.');
  if(create&&!messages||!create&&!('name'in args)&&!('messages'in args))return fail('INVALID_INPUT','Informe as mensagens ou campos a editar.');
  if(templates.some(t=>str(t.id)!==id&&str(t.name).toLowerCase()===name.toLowerCase()))return fail('CONFLICT','Nome já existente.');
  const next:Obj={...(current??{}),id,name};
  if(messages){
    const old=Array.isArray(current?.messages)?current!.messages.filter(obj):[];
    next.messages=messages.map((m,i)=>({id:str(old[i]?.id)||id+'-'+i,type:'text',text:m}));
    next.message=messages.join('\n\n');
  }
  const updated=create?[...templates,next]:templates.map(t=>str(t.id)===id?next:t);
  const {data,error}=await supabase.from('integration_settings').update({settings:{...config.settings,messageTemplates:updated},updated_at:new Date().toISOString()})
    .eq('id',config.id).eq('updated_at',version).select('id,updated_at').maybeSingle();
  if(error)return fail('INTERNAL_ERROR','Falha ao salvar modelo.');
  if(!data)return fail('STALE_WRITE','Modelo alterado simultaneamente.');
  return {success:true,replayed:false,template:safe(next),settings_updated_at:data.updated_at};
}
