async(page)=>{
const config={"id":"tablet","width":768,"height":1024};
const origin='https://www.kifersaude.com.br';
const records=[];
const failures=[];
page.on('pageerror',error=>failures.push(error.message));
await page.setViewportSize({width:config.width,height:config.height});
await page.emulateMedia({reducedMotion:'reduce'});
async function stable(){
 for(const frame of page.frames()) {
  for(let attempt=0;attempt<4;attempt++){
   if(frame.isDetached()) break;
   try { await frame.waitForLoadState('load');
  await frame.evaluate(async()=>{
   await document.fonts.ready;
   await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});})));
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  break;
  } catch(error){if(attempt===3) throw error; await page.waitForTimeout(150);}
  }
 }
}
async function go(route,theme='light'){
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
async function repaint(){await page.setViewportSize({width:config.width+1,height:config.height});await page.setViewportSize({width:config.width,height:config.height});}
async function capture(name,label,group,theme='light',options={}){
 await repaint();
 if(!options.keepPointer) await page.mouse.move(1,1);
 await page.evaluate(()=>{const active=document.activeElement;if(active?.closest('.ds-topbar-actions .kds-tooltip-anchor')) active.blur();});
 await stable();
 const path='docs/design-system/screenshots/'+config.id+'/'+theme+'/'+name+'.png';
 const buffer=await page.screenshot({path,fullPage:true,animations:'disabled',caret:'hide',scale:'css',timeout:60000});
 records.push({file:config.id+'/'+theme+'/'+name+'.png',label,group,theme,device:config.id,viewport:{width:config.width,height:config.height},pixels:{width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)},url:page.url(),capture:'fullPage',bytes:buffer.length});
 if(Number(name.slice(0,2))>=20){
  const viewportPath=path.replace('.png','-viewport.png');
  await repaint();await stable();
  const viewportBuffer=await page.screenshot({path:viewportPath,fullPage:false,animations:'disabled',caret:'hide',scale:'css'});
  records.push({file:config.id+'/'+theme+'/'+name+'-viewport.png',label:label+' — composição no viewport',group,theme,device:config.id,viewport:{width:config.width,height:config.height},pixels:{width:viewportBuffer.readUInt32BE(16),height:viewportBuffer.readUInt32BE(20)},url:page.url(),capture:'viewport',bytes:viewportBuffer.length});
 }
}
async function selectField(scope,label,option){
 await scope.getByLabel(label,{exact:true}).click();
 await page.getByRole('option',{name:option,exact:true}).click();
}
async function close(){await page.keyboard.press('Escape');await page.mouse.move(1,1);}

for(const theme of ['light','dark']){
 for(const [hash,name,label] of [['overview','01-visao-geral','Visão geral completa'],['foundations','02-fundamentos-visuais','Fundamentos: cores, fontes, espaços, raios, sombras e ícones']]){
  await go('#'+hash,theme);await capture(name,label,'Seções',theme);
 }
 await go('#components',theme);
 for(const [tab,name,label] of [['Ações','03-componentes-acoes','Botões: variantes, tamanhos, ícones, grupos, links e ações de formulário'],['Formulários','04-componentes-formularios','Inputs, máscaras, seleção, escolhas, datas e formulário'],['Navegação','05-componentes-navegacao','Sidebar, header, breadcrumbs, abas, paginação e etapas'],['Dados','06-componentes-dados','Tabela, filtros, cards, indicadores, badges e avatares'],['Feedback','07-componentes-feedback','Alertas, toasts, skeletons, loading e progresso'],['Interações','08-componentes-interacoes','Acionadores de modal, confirmação, drawer, popover, menu e tooltip']]){
  await page.getByRole('tab',{name:tab,exact:true}).click();await page.evaluate(()=>scrollTo(0,0));await capture(name,label,'Componentes',theme);
 }
 for(const [hash,name,label] of [['states','09-estados-validacao','Estados disponíveis, foco, disabled, validação, loading, vazio e erros'],['patterns','10-padroes-layout','Estruturas de página e convenções de UX'],['responsive','11-responsividade','Demonstração e orientações para desktop, tablet e mobile']]){
  await go('#'+hash,theme);await capture(name,label,'Seções',theme);
 }
 for(const [pattern,label] of [['list','Listagem de contatos'],['detail','Detalhes de um contato'],['create','Formulário de criação'],['edit','Formulário de edição'],['dashboard','Dashboard comercial']]){
  await go('?preview=1&pattern='+pattern+'&theme='+theme,theme);
  await capture('12-pagina-'+pattern,label+' — prévia independente com todo o conteúdo','Páginas completas',theme);
 }
}
return {config,records,failures};

}