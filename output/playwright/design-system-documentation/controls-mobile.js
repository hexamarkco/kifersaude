async(page)=>{
const config={"id":"mobile","width":390,"height":844};
const origin='https://www.kifersaude.com.br';
const records=[];
const failures=[];
page.on('pageerror',error=>failures.push(error.message));
await page.setViewportSize({width:config.width,height:config.height});
await page.emulateMedia({reducedMotion:'reduce'});await page.bringToFront();
async function stable(){
 for(const frame of page.frames()) {
  for(let attempt=0;attempt<4;attempt++){
   if(frame.isDetached()) break;
   try { await frame.waitForLoadState('load');
  await frame.evaluate(async()=>{
   await document.fonts.ready;
   await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});})));

  });
  break;
  } catch(error){if(attempt===3) throw error; await page.waitForTimeout(150);}
  }
 }
}
async function go(route,theme='light'){
 await page.goto('about:blank');
 await page.setViewportSize({width:config.width+1,height:config.height});await page.setViewportSize({width:config.width,height:config.height});
 await page.goto(origin+'/design-system'+route,{waitUntil:'networkidle'});
 await page.locator('h1').first().waitFor();
 if(!route.includes('preview=')) {
  const change=page.getByRole('button',{name:theme==='light'?'Ativar tema claro':'Ativar tema escuro',exact:true});
  if(await change.count()) await change.click();
 }
 if(await page.locator('iframe').count()) await page.frameLocator('iframe').locator('h1').waitFor();
 await stable();
}
function specimen(title){return page.locator('.ds-specimen').filter({has:page.getByRole('heading',{name:title,exact:true})});}
async function repaint(){await page.bringToFront();await page.waitForTimeout(50);}
async function ensureTransient(name){
 const toastLabels={'38-toast-sucesso':'Sucesso','38-toast-erro':'Erro','38-toast-atencao':'Atenção','38-toast-informacao':'Informação','38-toast-neutro':'Neutro'};
 if(toastLabels[name] && !(await page.locator('.kds-toast-container').count())) await specimen('Notificações temporárias').getByRole('button',{name:toastLabels[name],exact:true}).click();
 if(name==='64-recuperacao-carregando' && !(await page.locator('.ds-state-preview .kds-loading-state').count())){await selectField(page,'Cenário de dados','Falha ao carregar');await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();}
 if(name==='66-salvamento-loading' && !(await specimen('Salvamento e conclusão').locator('form button[data-loading]').count())){await specimen('Salvamento e conclusão').getByRole('button',{name:/^Salvar (novamente|exemplo)$/}).click();}
}
async function capture(name,label,group,theme='light',options={}){
 await repaint();
 if(!options.keepPointer) await page.mouse.move(1,1);
 await page.evaluate(()=>{const active=document.activeElement;if(active?.closest('.ds-topbar-actions .kds-tooltip-anchor')) active.blur();});
 await stable();
 const path='docs/design-system/screenshots/'+config.id+'/'+theme+'/'+name+'.png';
 await ensureTransient(name);
 const buffer=await page.screenshot({path,fullPage:true,animations:'disabled',caret:'hide',scale:'css',timeout:60000});
 records.push({file:config.id+'/'+theme+'/'+name+'.png',label,group,theme,device:config.id,viewport:{width:config.width,height:config.height},pixels:{width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)},url:page.url(),capture:'fullPage',bytes:buffer.length});
 if(Number(name.slice(0,2))>=20){
  const viewportPath=path.replace('.png','-viewport.png');
  await repaint();await stable();
  await ensureTransient(name);
  const viewportBuffer=await page.screenshot({path:viewportPath,fullPage:false,animations:'disabled',caret:'hide',scale:'css'});
  records.push({file:config.id+'/'+theme+'/'+name+'-viewport.png',label:label+' — composição no viewport',group,theme,device:config.id,viewport:{width:config.width,height:config.height},pixels:{width:viewportBuffer.readUInt32BE(16),height:viewportBuffer.readUInt32BE(20)},url:page.url(),capture:'viewport',bytes:viewportBuffer.length});
 }
}
async function selectField(scope,label,option){
 await scope.getByLabel(label,{exact:true}).click();
 await page.getByRole('option',{name:option,exact:true}).click();
}
async function close(){await page.keyboard.press('Escape');await page.mouse.move(1,1);}

async function category(tab){await go('#components');await page.getByRole('tab',{name:tab,exact:true}).click();await stable();}
await category('Formulários');
for(const size of ['sm','md','lg']){
 await page.getByLabel('Operadora · '+size,{exact:true}).click();await page.getByRole('listbox').waitFor();await capture('20-select-'+size+'-aberto','Select '+size+' com opções abertas','Formulários interativos');await close();
}
await page.getByRole('button',{name:'Buscar operadora',exact:true}).click();await capture('21-combobox-aberto','Combobox: opções abertas','Formulários interativos');
await page.getByPlaceholder('Buscar operadora…',{exact:true}).fill('sem resultado');await capture('21-combobox-sem-resultados','Combobox: busca sem resultados','Formulários interativos');await close();
await page.getByRole('button',{name:'Operadoras de interesse',exact:true}).click();await capture('22-multiselect-aberto','Seleção múltipla com opções e checkboxes','Formulários interativos');await close();
for(const [label,name] of [['Data','23-calendario-data'],['Horário','24-seletor-horario'],['Atendimento','25-calendario-data-horario']]){
 await specimen('Data e horário').getByLabel(label,{exact:true}).click();await capture(name,label+': seletor aberto','Formulários interativos');await close();
}
const preferences=specimen('Escolhas e preferências');
await preferences.getByRole('radio',{name:/Empresa/}).focus();await page.keyboard.press('Space');await preferences.getByRole('switch',{name:'Mostrar lembretes no exemplo',exact:true}).focus();await page.keyboard.press('Space');await preferences.getByRole('checkbox',{name:/Seleção parcial/}).focus();await page.keyboard.press('Space');await capture('26-preferencias-alternativas','Checkbox marcado, radio Empresa e switch desligado','Formulários interativos');
const mask=specimen('Máscaras brasileiras');
for(const [label,value] of [['Telefone','11987654321'],['CPF','12345678900'],['CNPJ','12345678000190'],['CEP','01001000'],['Cartão nacional de saúde','123456789012345']]) await mask.getByLabel(label,{exact:true}).fill(value);
await capture('27-mascaras-preenchidas','Máscaras de telefone, CPF, CNPJ, CEP e CNS preenchidas com dados fictícios','Formulários interativos');
const form=specimen('Formulário com validação');
await form.getByRole('button',{name:'Criar contato',exact:true}).click();await capture('28-formulario-validacao-erros','Formulário enviado vazio: mensagens de erro e foco no primeiro campo','Formulários interativos');
await category('Navegação');
const tabs=specimen('Abas e segmentação');await tabs.getByRole('tab',{name:'Configurações',exact:true}).first().click();
await specimen('Etapas de um processo').getByRole('button',{name:'Avançar',exact:true}).click();
await specimen('Paginação').getByRole('button',{name:'Próxima página',exact:true}).click();await capture('29-navegacao-selecoes','Abas em Configurações, paginação avançada e etapa seguinte','Navegação interativa');
await category('Dados');
const list=specimen('Tabela com comportamento real');
await list.getByRole('button',{name:'Todos os status',exact:true}).click();await capture('30-filtro-status-aberto','Filtro de status aberto na tabela','Dados e filtros');
await page.getByRole('option',{name:'Contratado',exact:true}).click();await capture('31-tabela-filtrada','Tabela ou cards filtrados por Contratado','Dados e filtros');
await list.getByRole('button',{name:'Limpar filtros',exact:true}).click();
await list.getByRole('searchbox',{name:'Buscar contatos',exact:true}).fill('Sem correspondência');await capture('32-tabela-sem-resultados','Busca na tabela sem resultados e ação para limpar','Dados e filtros');
await list.getByRole('button',{name:'Limpar busca e filtros',exact:true}).click();
if(!(await list.getByRole('button',{name:'Ordenar por Nome',exact:true}).isVisible())){
 await list.getByRole('button',{name:/Ordem crescente/}).click();
}else{
 await list.getByRole('button',{name:'Ordenar por Nome',exact:true}).click();
}
await list.getByRole('button',{name:'Próxima página',exact:true}).click();
await list.getByRole('checkbox',{name:'Selecionar Daniel Oliveira',exact:true}).first().check().catch(async()=>{await list.locator('input[type=checkbox]:visible').first().check();});
await capture('33-tabela-ordenada-paginada-selecionada','Ordenação descendente, segunda página e seleção de contato','Dados e filtros');
const filters=specimen('Barra de filtros');
await filters.getByRole('button',{name:'Operadoras',exact:true}).click();await capture('34-filtro-multiplo-aberto','Filtro múltiplo de operadoras aberto','Dados e filtros');await close();
await filters.getByRole('button',{name:/Período:/}).click();await capture('35-filtro-periodo-aberto','Filtro de intervalo de datas aberto','Dados e filtros');await close();
const cards=specimen('Cards e superfícies');
await selectField(cards,'Superfície semântica','danger');await capture('36-superficie-erro','Superfície semântica de erro','Dados e filtros');
const publicCard=specimen('Composição e superfícies públicas');await publicCard.getByText('Ver composição pública',{exact:true}).click();await capture('37-composicao-publica-expandida','Composição pública expandida com PublicShell, PublicCard e estado vazio','Dados e filtros');
await category('Feedback');
for(const [button,name] of [['Sucesso','38-toast-sucesso'],['Erro','38-toast-erro'],['Atenção','38-toast-atencao'],['Informação','38-toast-informacao'],['Neutro','38-toast-neutro']]){
 await specimen('Notificações temporárias').getByRole('button',{name:button,exact:true}).click();await page.locator('.kds-toast-container').waitFor();await capture(name,'Toast temporário: '+button,'Feedback interativo');
 if(await page.getByRole('button',{name:'Fechar notificação',exact:true}).count()) await page.getByRole('button',{name:'Fechar notificação',exact:true}).click();
}
return {config,records,failures};

}