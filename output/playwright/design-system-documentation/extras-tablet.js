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
 await page.goto('about:blank');
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

await go('#components');await page.getByRole('tab',{name:'Formulários',exact:true}).click();
await page.getByRole('button',{name:'Buscar operadora',exact:true}).click();await page.getByPlaceholder('Buscar operadora…',{exact:true}).fill('Sul');await capture('80-combobox-filtrado','Combobox filtrado: apenas SulAmérica','Formulários interativos');await close();
await page.getByRole('button',{name:'Operadoras de interesse',exact:true}).click();
await page.getByRole('option',{name:'Bradesco Saúde',exact:true}).click();await page.getByRole('option',{name:'SulAmérica',exact:true}).click();await capture('81-multiselect-tres-opcoes','Seleção múltipla com três operadoras marcadas','Formulários interativos');await close();
await page.getByRole('tab',{name:'Dados',exact:true}).click();
await specimen('Tabela com comportamento real').getByRole('button',{name:'Ver Ana Paula Ribeiro',exact:true}).first().click();await page.getByRole('dialog',{name:'Ana Paula Ribeiro',exact:true}).waitFor();await capture('82-modal-consulta-tabela','Modal de consulta acionado a partir da tabela','Sobreposições');await close();
await specimen('Barra de filtros').getByRole('button',{name:/Período:/}).click();await page.getByLabel('De',{exact:true}).click();await capture('83-calendario-em-filtro-periodo','Calendário aberto dentro do popover de período','Dados e filtros');await close();await close();
for(const surface of ['muted','strong','hero','warning','success','info']){
 await selectField(specimen('Cards e superfícies'),'Superfície semântica',surface);await capture('84-superficie-'+surface,'Superfície semântica: '+surface,'Dados e filtros');
}
await go('#components','dark');await page.getByRole('tab',{name:'Formulários',exact:true}).click();await page.getByLabel('Operadora · md',{exact:true}).click();await capture('85-select-aberto','Select aberto no tema escuro','Formulários interativos','dark');await close();
await page.getByRole('tab',{name:'Interações',exact:true}).click();await page.getByRole('button',{name:'Criar contato no modal',exact:true}).click();await capture('86-modal-formulario','Modal de criação no tema escuro','Sobreposições','dark');await close();
await specimen('Popover e menu contextual').getByRole('button',{name:'Sobre este status',exact:true}).click();await capture('87-popover-status','Popover de status no tema escuro','Sobreposições','dark');await close();
return {config,records,failures};

}