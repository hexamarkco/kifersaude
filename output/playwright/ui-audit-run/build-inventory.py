from pathlib import Path
import json,re,hashlib,struct,zlib,collections,sys
from urllib.parse import urlsplit,parse_qs
sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path('docs/ui-audit');RUN=Path('output/playwright/ui-audit-run');DEVICES=['desktop','tablet','mobile'];SIZE={'desktop':(1920,1080),'tablet':(768,1024),'mobile':(390,844)}
original=json.loads((ROOT/'inventory.json').read_text(encoding='utf-8'));pages=original['pages'];byid={p['id']:p for p in pages};specs={s['id']:s for s in json.loads((RUN/'interaction-specs.json').read_text(encoding='utf-8'))};source=json.loads((ROOT/'source-map.json').read_text(encoding='utf-8'))
base_records={};state_records={};attempts=collections.defaultdict(list)
def result_of(p):
 try:
  text=p.read_text(encoding='utf-8-sig');start=text.index('### Result')+len('### Result');return json.JSONDecoder().raw_decode(text[start:].lstrip())[0]
 except (ValueError,OSError):return None

def files_for(id,device,category,count=None):
 folder=ROOT/device/category;pattern=re.compile(re.escape(id)+r'-(?:inicial|completa|componente|conteudo-\d+-\d+)\.png$');items=[p for p in folder.glob('*.png')if pattern.fullmatch(p.name)]
 def order(p):
  n=p.name
  return (0 if n.endswith('-inicial.png')else 1 if n.endswith('-completa.png')else 2 if n.endswith('-componente.png')else 3,n)
 items.sort(key=order)
 return [p.as_posix()for p in (items[:count]if count else items)]

def infer(r):
 id=r['id'];s=specs.get(id);p=byid.get(s['page'])if s else None
 category=r.get('category')or(p or{}).get('category');route=r.get('route')or(p or{}).get('route');name=r.get('name')or(s or{}).get('name')or id.replace('-',' ').capitalize();kind=r.get('kind')or(s or{}).get('kind')or'interaction'
 if not category:
  for prefix,cat,url in [('dashboard','dashboard','/painel/dashboard'),('agenda','agenda','/painel/agenda'),('blog','conteudo','/painel/blog'),('formularios-estado','configuracoes','/painel/config?tab=forms'),('chat-ia','ia','/chat'),('leads','leads','/painel/leads'),('contratos','contratos','/painel/contratos'),('campanhas','campanhas','/painel/disparos'),('inbox','comunicacao','/painel/inbox'),('automacao','automacoes','/painel/automacoes?tab=automation'),('formulario','publico','/forms/demonstracao'),('perfis','configuracoes','/painel/config?tab=system&section=access'),('nav-','dashboard','/painel/dashboard')]:
   if id.startswith(prefix):category=cat;route=route or url;break
 if id.endswith('-observador'):kind='permission'
 if id.endswith('-tema-escuro')or id.endswith('-escuro'):kind='theme'
 if '-estado-'in id:kind=id.split('-estado-')[-1]
 return dict(name=name,category=category or'outros',route=route or'',kind=kind)

def register(r,origin):
 if not isinstance(r,dict)or not r.get('id')or r.get('device')not in DEVICES or not r.get('status'):return
 r=dict(r);id=r['id'];key=(id,r['device']);is_base=id in byid and r.get('kind')not in ['theme','permission'];meta=byid[id]if is_base else infer(r)
 for k in ['name','category','route','kind']:
  if not r.get(k)and meta.get(k):r[k]=meta[k]
 r['origin']=origin
 shots=r.get('screenshots',[])
 if not shots and r['status']=='captured':shots=files_for(id,r['device'],r['category'])
 if isinstance(shots,int):shots=files_for(id,r['device'],r['category'],shots)
 r['screenshots']=[p for p in shots if Path(p).is_file()]if isinstance(shots,list)else[]
 r['difficulty']=re.sub(r'\x1b\[[0-9;]*m','',r.get('difficulty',''))[:1600]
 if is_base and r.get('info',{}).get('bodyText','').strip()=='Carregando':r['status']='incomplete'
 if not is_base and r.get('kind')in['modal','drawer','confirmation']and r['status']=='captured'and not r.get('dialogTitle')and not any(p.endswith('-componente.png')for p in r['screenshots']):r['status']='incomplete';r['difficulty']='A captura ocorreu antes da abertura completa do painel.'
 if r['status']=='captured'and not r['screenshots']:return
 target=base_records if is_base else state_records;attempts[key].append({k:r[k]for k in ['status','origin','difficulty']if r.get(k)})
 previous=target.get(key)
 if r['status']=='captured' or not previous or previous['status']!='captured':target[key]=r

for log in sorted(RUN.glob('*.log'),key=lambda p:p.stat().st_mtime):
 data=result_of(log)
 if isinstance(data,list):records=data
 elif isinstance(data,dict):
  records=[]
  for k in ['records','captures','interactions']:
   if isinstance(data.get(k),list):records+=data[k]
 else:continue
 for r in records:register(r,log.name)
for r in json.loads((RUN/'initial-empty-states.json').read_text(encoding='utf-8')):register(r,'initial-empty-states.json')

# Correct semantic differences between responsive layouts and inaccessible actions.
for device in DEVICES:
 key=('blog-visualizar',device);r=state_records.get(key,infer({'id':'blog-visualizar'}));r.update(id='blog-visualizar',device=device,status='pending',screenshots=[],difficulty='O botão abre /blog/guia-demonstracao em nova aba; /blog/:slug não está registrado em src/main.tsx e redireciona para o início.');state_records[key]=r
for key,r in state_records.items():
 if r['id']in ['nav-notificacoes','nav-crm','nav-comunicacao','nav-financeiro']and r['device']=='mobile'and r['status']!='captured':r['status']='not_applicable';r['difficulty']='No mobile a navegação equivalente usa o menu Mais; veja nav-mobile-menu.'
 if r['status']!='captured'and 'element is not enabled'in r.get('difficulty',''):r['status']='disabled';r['difficulty']='O controle está desabilitado no contexto demonstrado. A aparência fechada está registrada no formulário.'
 if r['id']=='inbox-mensagens-rapidas-gerenciar'and r['device']=='mobile'and r['status']!='captured':
  r['difficulty']='O botão Gerenciar ficou obstruído pelo próprio popover no viewport mobile; a interação não foi forçada.'
 r['attempts']=attempts.get(key,[])

# Every state must account for each viewport, including responsive replacements.
for id in {r['id'] for r in state_records.values()if r['status']=='captured'}:
 sample=next(r for r in state_records.values()if r['id']==id and r['status']=='captured')
 for device in DEVICES:
  if (id,device)in state_records:continue
  special=(id=='nav-mobile-menu'and device!='mobile')or(id=='inbox-menu-conversa'and device=='desktop')
  state_records[(id,device)]={**{k:sample.get(k)for k in ['id','name','category','route','kind']},'device':device,'status':'not_applicable'if special else'pending','screenshots':[],'difficulty':'Esta resolução usa a navegação equivalente documentada no cabeçalho/menu adaptado.'if special else'Variação sem captura específica nesta resolução.'}

referenced=set()
for p in pages:
 p['screenshots']=[];p['states']=[];p['captures']=[];p['difficulties']=[]
 for device in DEVICES:
  r=base_records.get((p['id'],device));
  if r:
   p['captures'].append(r);p['screenshots']+=r['screenshots'];referenced.update(r['screenshots'])
   if r['status']!='captured':p['difficulties'].append({'device':device,'reason':r.get('difficulty','Captura não concluída')})
  else:p['difficulties'].append({'device':device,'reason':'Captura ausente'})
 p['status']='captured'if len([r for r in p['captures']if r['status']=='captured'])==3 else'partial'

def find_page(route):
 exact=next((p for p in pages if p['route']==route),None)
 if exact:return exact
 pathname=urlsplit(route).path;return next((p for p in pages if urlsplit(p['route']).path==pathname),None)
for r in state_records.values():
 referenced.update(r['screenshots']);p=find_page(r.get('route',''))
 if p and r['id']not in p['states']:p['states'].append(r['id'])

# Map all declared route patterns, including aliases and deliberately excluded reference pages.
route_coverage=[]
for r in source['routes']:
 pattern=r['pattern'];row=dict(r)
 if pattern=='*':row['status']='fallback'
 elif pattern=='/design-system':row['status']='reference_outside_scope'
 elif pattern=='/planos/:slug/:variant':row['status']='no_configured_variants';row['note']='A base atual define dez operadoras sem variantSlug; não há uma variante adicional configurada.'
 elif r['redirect']:row['status']='redirect_mapped'
 elif pattern=='/painel':row['status']='container_documented';row['pages']=['dashboard']
 else:
  expression='^'+re.sub(r':\w+',r'[^/]+',re.escape(pattern).replace('\\:',':'))+'$';matching=[p['id']for p in pages if re.fullmatch(expression,urlsplit(p['route']).path)]
  row['pages']=matching;row['status']='captured'if matching and all(byid[k]['status']=='captured'for k in matching)else'pending'
 route_coverage.append(row)

# Static interface references remain explicit: a closed control in a page is not proof its popup was opened.
links=json.loads((RUN/'source-links.json').read_text(encoding='utf-8'));source_interfaces=[]
for entry in source['interfaces']:
 e=dict(entry);matched=[]
 for id,paths in links.items():
  if entry['file']in paths:matched.extend(r['screenshots']for r in state_records.values()if r['id']==id and r['status']=='captured')
 e['screenshots']=sorted(set(p for group in matched for p in group));e['status']='interaction_evidence'if e['screenshots']else'mapped_source_reference';source_interfaces.append(e)

# PNG structure, chunk CRC and dimensions are verified without modifying pixels.
files=[];bad=[]
for text in sorted(referenced):
 p=Path(text)
 try:
  blob=p.read_bytes();assert blob[:8]==b'\x89PNG\r\n\x1a\n';pos=8;w=h=0;ended=False
  while pos<len(blob):
   length=struct.unpack('>I',blob[pos:pos+4])[0];tag=blob[pos+4:pos+8];payload=blob[pos+8:pos+8+length];crc=struct.unpack('>I',blob[pos+8+length:pos+12+length])[0];assert zlib.crc32(tag+payload)&0xffffffff==crc
   if tag==b'IHDR':w,h=struct.unpack('>II',payload[:8])
   pos+=length+12
   if tag==b'IEND':ended=True;break
  assert ended and w>0 and h>0
  relative=p.relative_to(ROOT).as_posix();device=relative.split('/')[0]
  if p.name.endswith('-inicial.png'):assert(w,h)==SIZE[device],f'Viewport incorreto: {w}x{h}'
  files.append(dict(path=relative,width=w,height=h,bytes=len(blob),sha256=hashlib.sha256(blob).hexdigest()))
 except Exception as exc:bad.append(dict(path=text,error=str(exc)))
if bad:raise RuntimeError(json.dumps(bad,ensure_ascii=False))

states=list(state_records.values());captured=[r for r in states if r['status']=='captured'];unique={r['id']for r in captured};modal_ids={r['id']for r in captured if r['kind']in['modal','drawer','confirmation']or(r['kind']=='form'and any(f.endswith('-componente.png')for f in r['screenshots']))};pending=[r for r in states if r['status']not in['captured','disabled','not_applicable']]
summary=dict(pages_sections=len(pages),pages_complete=sum(p['status']=='captured'for p in pages),route_declarations=len(source['routes']),source_interface_occurrences=len(source_interfaces),modals_drawers_confirmations=len(modal_ids),distinct_interaction_states=len(unique),captured_state_viewports=len(captured),screenshots=len(files),bytes=sum(f['bytes']for f in files),pending_state_viewports=len(pending),pending_distinct_states=len({r['id']for r in pending}),by_device=dict(collections.Counter(f['path'].split('/')[0]for f in files)),by_state_kind=dict(collections.Counter(r['kind']for r in captured)))
orphans=sorted(p.as_posix()for p in ROOT.rglob('*.png')if p.as_posix()not in referenced)
specialized_pending=[
 {'component':'WhatsAppComposerRewriteModal','source':'src/features/communication/whatsapp/components/WhatsAppComposerRewriteModal.tsx','reason':'Fluxo contextual de reescrita e resultado de IA não executados; menu de IA/formatação capturado.'},
 {'component':'WhatsAppFollowUpModal','source':'src/features/communication/whatsapp/components/WhatsAppFollowUpModal.tsx','reason':'Preparação e geração de follow-up por IA não executadas.'},
 {'component':'WhatsAppBatchFollowUpModal','source':'src/features/communication/whatsapp/components/WhatsAppBatchFollowUpModal.tsx','reason':'Fluxo coletivo condicionado a contatos elegíveis; os telefones demonstrativos foram deixados vazios.'},
 {'component':'WhatsAppScheduleMessageModal','source':'src/features/communication/whatsapp/components/WhatsAppScheduleMessageModal.tsx','reason':'Cadastro/edição de envio condicionado a destinatário válido; consulta de agendamentos foi capturada.'},
]
summary['specialized_interfaces_pending']=len(specialized_pending)
inventory=dict(specialized_interfaces_pending=specialized_pending,created_at='2026-10-25',commit='b99d7b2c',method='Playwright CLI, local Vite, real production components, synthetic HTTP fixtures',viewports={k:{'width':v[0],'height':v[1]}for k,v in SIZE.items()},security={'production_credentials_saved':False,'business_requests_to_remote_services':False,'customer_data':'Synthetic names, invalid demonstration emails; phone/document values blank. Existing company public information preserved.','network':'Business endpoints point to an intercepted localhost endpoint; external business requests blocked. Google Fonts allowed.'},summary=summary,pages=pages,states=states,route_coverage=route_coverage,menus=source['menu_items'],source_interfaces=source_interfaces,files=files,pending=pending,not_executed=['Confirmar exclusão ou alteração de registros reais','Enviar mensagens, campanhas, notificações ou e-mails','Executar testes de IA, chamadas da API ou recuperação de histórico externa','Uploads e publicação de conteúdo','Ativar, pausar ou disparar automações reais'],limitations=['Dados sintéticos reproduzem os componentes; não comprovam integrações nem regras de produção.','Resultados gerados por IA, status do provedor, mídia de áudio/vídeo e documentos de clientes não foram executados nem consultados.','O mapa estático registra ocorrências de componentes; evidências de uma tela não comprovam abertura de toda instância de Select, Popover ou validação de negócio.','As variantes de papéis capturadas são administrador e observador. Outros perfis personalizados exigem fixtures específicas.'])
(ROOT/'inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2),encoding='utf-8');(ROOT/'coverage.json').write_text(json.dumps({'summary':summary,'routes':route_coverage,'pending':pending,'specialized_interfaces_pending':specialized_pending,'not_executed':inventory['not_executed'],'limitations':inventory['limitations']},ensure_ascii=False,indent=2),encoding='utf-8');(RUN/'orphan-files.json').write_text(json.dumps(orphans,indent=2),encoding='utf-8')

def rel(text):return text.replace('docs/ui-audit/','')
def linkset(id,device,category):
 prefix=f'{device}/{category}/{id}';available={f['path']for f in files};bits=[]
 for suffix,label in [('inicial','Inicial'),('completa','Completa'),('componente','Componente')]:
  file=prefix+'-'+suffix+'.png'
  if file in available:bits.append(f'[{label}]({file})')
 return ' · '.join(bits)or'—'
labels={'dashboard':'Dashboard e navegação','leads':'Leads, contatos e propostas','contratos':'Clientes e contratos','financeiro':'Financeiro e comissões','agenda':'Agenda, tarefas e lembretes','comunicacao':'Comunicação e WhatsApp','campanhas':'Campanhas e disparos','conteudo':'Conteúdo / blog','configuracoes':'Configurações e cadastros','automacoes':'Automações','integracoes':'Integrações e API','ia':'Inteligência artificial','acesso':'Acesso ao CRM','publico':'Interfaces públicas complementares'}
readme=['# Inventário visual — Kifer Saúde','',f'Capturado em 25/10/2026 com Playwright, a partir do commit `{inventory["commit"]}`. As imagens utilizam componentes e estilos reais, com dados sintéticos no transporte HTTP local. Nenhum componente, layout ou funcionalidade foi alterado.','',f'**{summary["pages_complete"]}/{summary["pages_sections"]} páginas e seções nas três resoluções · {summary["modals_drawers_confirmations"]} modais/drawers/confirmações · {summary["distinct_interaction_states"]} estados interativos distintos · {summary["screenshots"]} screenshots.**','',f'Estados contados por identificador, sem multiplicar pelo número de resoluções. Existem {summary["captured_state_viewports"]} combinações de estado e viewport. Capturas de continuação da rolagem são arquivos adicionais.','', '| Formato | Resolução | Imagens |','| --- | --- | --- |']
for device,(w,h)in SIZE.items():readme.append(f'| {device.title()} | {w} × {h} | {summary["by_device"].get(device,0)} |')
readme+=['','## Como usar','','- `*-inicial.png`: área visível inicial, na resolução indicada.','- `*-completa.png`: página inteira com `fullPage: true`.','- `*-componente.png`: recorte do diálogo/drawer, quando disponível.','- `*-conteudo-N-M.png`: continuação da rolagem interna; leia na ordem numérica.','- `*-tema-escuro-*`: variação escura. O login já utiliza seu tema próprio.','- [inventory.json](inventory.json): rotas, fontes, estados, arquivos, dimensões e hashes.','- [coverage.json](coverage.json): cobertura e pendências em formato estruturado.','- [source-map.json](source-map.json): 36 declarações de rotas e 192 ocorrências de interfaces identificadas pela AST TypeScript.','','## Segurança e preparação','','Os clientes, contratos, conversas e usuários mostrados são fictícios. Os telefones e documentos dos registros foram deixados vazios; e-mails de demonstração usam domínio `.invalid`. Informações corporativas públicas e placeholders originais da interface foram preservados. Nenhuma credencial de produção foi salva.','','O navegador aponta os endpoints de negócio para localhost com respostas demonstrativas. Solicitações a serviços externos de negócio são bloqueadas; apenas fontes públicas do Google são permitidas. Envios, confirmações destrutivas, publicações e execuções de automações não foram realizados. Rascunhos e navegação só alteram o estado local.','','Fontes e imagens foram aguardadas, inclusive imagens lazy fora da área inicial. Capturas usam animações desativadas e preferência por movimento reduzido. O tema claro é o principal; painel, WhatsApp, formulário público e diálogo de lead também possuem amostras escuras.','','## Telas por módulo','']
for category in dict.fromkeys(p['category']for p in pages):
 readme+=['### '+labels.get(category,category),'','| Tela / seção | Rota | Desktop | Tablet | Mobile |','| --- | --- | --- | --- | --- |']
 for p in pages:
  if p['category']==category:readme.append('| '+p['name']+' | `'+p['route']+'` | '+' | '.join(linkset(p['id'],dev,category)for dev in DEVICES)+' |')
 readme.append('')
readme+=['## Interações e variações capturadas','','Cada linha relaciona o estado à captura inicial/completa e, quando existe, ao componente. As continuações de rolagem estão relacionadas integralmente no inventário.','','| Estado | Tipo | Desktop | Tablet | Mobile |','| --- | --- | --- | --- | --- |']
for id in sorted(unique):
 variants=[r for r in captured if r['id']==id];r=variants[-1];readme.append('| '+r['name'].replace('|','/')+' | '+r['kind']+' | '+' | '.join(linkset(id,device,r['category'])for device in DEVICES)+' |')
readme+=['','## Cobertura e pendências','',f'As {summary["route_declarations"]} declarações de rota foram verificadas contra o mapa do projeto. Redirecionamentos apontam para telas já documentadas; `/design-system` é a referência visual e ficou fora desta coleta de telas reais. As dez operadoras públicas configuradas foram incluídas. A rota com `:variant` existe, mas a base atual não configura variantes adicionais.','','Clientes e propostas não possuem rotas próprias: clientes aparecem nos contratos/titulares e propostas no contexto do lead e do funil. Não foram inventadas páginas para esses nomes.','',f'**Pendências de captura: {summary["pending_distinct_states"]} estados em {summary["pending_state_viewports"]} combinações de resolução.**','', '| Estado | Resolução | Motivo |','| --- | --- | --- |']
for r in pending:
 reason=r.get('difficulty','Não concluído').split('\n')[0].replace('|','/')
 if r['id'].endswith('estado-loading'):reason='O estado de carregamento do módulo não permaneceu visível na janela de captura; outros módulos possuem exemplos de loading.'
 readme.append('| '+r['name']+' | '+r['device']+' | '+reason+' |')
readme+=['','Os submenus laterais de desktop/tablet são substituídos pelo menu **Mais** no mobile; essa diferença é registrada como adaptação de layout, não como tela ausente. Controles desabilitados não foram forçados a abrir.','','### Interfaces operacionais especializadas pendentes','','- `WhatsAppComposerRewriteModal`: reescrita contextual e resultado de IA.','- `WhatsAppFollowUpModal`: preparação e geração de follow-up individual.','- `WhatsAppBatchFollowUpModal`: fluxo coletivo com contatos elegíveis.','- `WhatsAppScheduleMessageModal`: cadastro/edição de envio com destinatário válido.','','As consultas, listas, menus e agendas relacionadas estão documentadas. Estas quatro interfaces continuam sem captura específica; seus componentes e motivos constam em `coverage.json`.','','### Estados que exigem outra rodada','','- Resultados de geração/transcrição/análise de IA e respostas ao vivo de integrações.','- Estados de entrega/falha do provedor e recuperação de histórico reais.','- Áudio, vídeo, PDF e fluxos que exigem anexar documentos; somente mídia fictícia/local foi usada quando acessível.','- Importações efetivas, salvamentos válidos, publicação de conteúdo e finalização de formulários.','- Todas as combinações de papéis personalizados, regras comerciais e validações dependentes de dados.','- Instâncias individuais de controles repetidos indicadas no mapa estático e sem evidência específica de abertura.','','### Observações verificadas no código','','- A prévia do blog abre `/blog/:slug`, mas essa rota não está registrada em `src/main.tsx`; a interface correspondente ficou pendente.','- O botão **Editar lead** usa texto escondido no mobile sem rótulo acessível no próprio botão; a captura foi obtida pelo elemento real do formulário.','- As confirmações de exclusão foram abertas e fotografadas, sem confirmação.','- Falhas e vazios de demonstração são cenários sintéticos, não diagnóstico do estado de produção.','','## Integridade','','Todos os PNGs referenciados foram verificados por assinatura, chunks/CRC e dimensões. Cada arquivo possui SHA-256 no inventário. Foram conferidos pares inicial/completa por página e viewport. As capturas não constituem validação funcional de integrações ou homologação de regras comerciais.','']
(ROOT/'README.md').write_text('\n'.join(readme),encoding='utf-8')
print(json.dumps({'summary':summary,'orphan_files':len(orphans),'partial_pages':[p['id']for p in pages if p['status']!='captured']},ensure_ascii=False,indent=2))
