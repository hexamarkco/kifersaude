async(page)=>{
const config={"id":"desktop","width":1920,"height":1080};
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

await go('#components');await page.getByRole('tab',{name:'Interações',exact:true}).click();
async function dialogContinuation(name,label){
 const modal=page.getByRole('dialog').last();
 const bodies=modal.locator('.kds-dialog-body,.kds-drawer-body');
 for(let i=0;i<await bodies.count();i++){
  const body=bodies.nth(i);
  if(await body.evaluate(el=>el.scrollHeight>el.clientHeight+2)){
   await body.evaluate(el=>el.scrollTop=el.scrollHeight);
   await capture(name+'-continuacao',label+' — continuação da área rolável','Sobreposições');
  }
 }
}
await page.getByRole('button',{name:'Criar contato no modal',exact:true}).click();
const modal=page.getByRole('dialog',{name:'Novo contato de exemplo',exact:true});await modal.waitFor();
await capture('40-modal-formulario','Modal de criação de contato aberto','Sobreposições');await dialogContinuation('40-modal-formulario','Modal de criação');
await modal.getByRole('button',{name:'Criar contato',exact:true}).click();await capture('41-modal-erros-validacao','Modal após envio vazio: erros de validação','Sobreposições');await dialogContinuation('41-modal-erros-validacao','Modal com validação');
await modal.getByLabel('Nome completo',{exact:false}).fill('Pessoa de Exemplo');await modal.getByLabel('E-mail',{exact:false}).fill('pessoa@example.com');await modal.getByLabel('Telefone',{exact:false}).fill('11987654321');
await capture('42-modal-formulario-preenchido','Modal preenchido com dados fictícios, sem enviar','Sobreposições');await dialogContinuation('42-modal-formulario-preenchido','Modal preenchido');await close();
await specimen('Confirmação de ação').getByRole('button',{name:'Arquivar exemplo',exact:true}).click();
await page.getByRole('dialog',{name:'Arquivar este exemplo?',exact:true}).waitFor();await capture('43-modal-confirmacao','Confirmação de arquivamento de exemplo: impacto, cancelar e confirmar','Sobreposições');await close();
for(const [value,name] of [['Direita','44-drawer-direita'],['Esquerda','45-drawer-esquerda'],['Abaixo','46-drawer-inferior']]){
 const drawerCard=specimen('Drawer de consulta');await selectField(drawerCard,'Posição do drawer',value);await drawerCard.getByRole('button',{name:'Ver detalhes do contato',exact:true}).click();await page.getByRole('dialog',{name:'Ana Paula Ribeiro',exact:true}).waitFor();
 await capture(name,'Drawer de consulta aberto: '+value,'Sobreposições');await dialogContinuation(name,'Drawer '+value);await close();
}
await specimen('Popover e menu contextual').getByRole('button',{name:'Sobre este status',exact:true}).click();await page.getByRole('dialog',{name:'Sobre o atendimento',exact:true}).waitFor();await capture('47-popover-status','Popover explicativo do status Em atendimento','Sobreposições');await close();
await specimen('Popover e menu contextual').getByRole('button',{name:'Ações',exact:true}).click();await page.getByRole('dialog',{name:'Ações do exemplo',exact:true}).waitFor();await capture('48-menu-contextual','Menu de ações: editar, consultar e arquivar','Sobreposições');await close();
for(const side of ['top','right','bottom','left']){
 const trigger=page.getByRole('button',{name:'Ajuda contextual, posição '+side,exact:true});await trigger.hover();await page.getByRole('tooltip').waitFor();await capture('49-tooltip-'+side,'Tooltip aberto na posição '+side,'Sobreposições','light',{keepPointer:true});await page.mouse.move(1,1);await trigger.blur();
}
await page.getByRole('button',{name:'Abrir área de trabalho',exact:true}).click();await page.getByRole('dialog',{name:'Revisar informações',exact:true}).waitFor();await capture('50-modal-workspace','Modal amplo de revisão de informações','Sobreposições');await dialogContinuation('50-modal-workspace','Modal de área de trabalho');await close();
if(config.id!=='desktop'){
 await go('#overview');await page.getByRole('button',{name:'Abrir navegação',exact:true}).click();await page.getByRole('dialog',{name:'Design system',exact:true}).waitFor();await capture('51-menu-navegacao-mobile','Drawer de navegação do showcase','Navegação interativa');await close();
 await go('?preview=1&pattern=list&theme=light');await page.getByRole('button',{name:'Abrir navegação do exemplo',exact:true}).click();await capture('52-menu-navegacao-previa','Menu recolhido do CRM demonstrativo expandido','Navegação interativa');
}
await go('#states');
await page.getByRole('button',{name:'Testar foco no campo',exact:true}).click();await capture('60-foco-teclado','Campo focado: contorno real de foco e estados indisponíveis','Estados');
await page.getByRole('button',{name:'Novo contato',exact:true}).hover();await capture('61-hover-botao','Estado hover do botão primário','Estados','light',{keepPointer:true});await page.mouse.move(1,1);
for(const [option,name] of [['Lista vazia','62-lista-vazia'],['Falha ao carregar','63-falha-carregamento']]){
 await selectField(page,'Cenário de dados',option);await capture(name,'Cenário de dados: '+option,'Estados');
}
await page.getByRole('button',{name:'Tentar novamente',exact:true}).click();await capture('64-recuperacao-carregando','Recuperação de erro: carregamento transitório real','Estados');await page.getByText('Contatos disponíveis',{exact:true}).waitFor();await capture('65-recuperacao-concluida','Recuperação concluída: dados disponíveis','Estados');
await specimen('Salvamento e conclusão').getByRole('button',{name:'Salvar exemplo',exact:true}).click();await capture('66-salvamento-loading','Ação de salvar em andamento: loading e cancelamento bloqueado','Estados');await page.getByText('Exemplo salvo nesta sessão',{exact:true}).waitFor();await capture('67-salvamento-sucesso','Simulação concluída: confirmação de salvamento local','Estados');
await specimen('Nenhum resultado na busca').getByRole('button',{name:'Limpar filtros do exemplo',exact:true}).click();await capture('68-busca-recuperada','Lista após limpar uma busca sem resultados','Estados');
await specimen('Envio com campos obrigatórios').getByRole('button',{name:'Criar contato',exact:true}).click();await capture('69-validacao-formulario','Erros de campos obrigatórios após envio vazio','Estados');
await go('#responsive');
for(const device of ['desktop','tablet','mobile']){
 await page.getByRole('button',{name:'Visualizar em '+device,exact:true}).click();await stable();await capture('70-previa-'+device,'Controles da prévia selecionados em '+device,'Responsividade');
}
return {config,records,failures};

}