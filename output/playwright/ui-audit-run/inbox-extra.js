async(page)=>{
 page.__audit.db.integration_settings.push({id:'demo-quick-replies',slug:'whatsapp_quick_replies',name:'Mensagens rápidas',settings:{quickReplies:[{id:'demo-reply',name:'Saudação de demonstração',shortcut:'saudacao',text:'Olá! Esta é uma mensagem fictícia, sem envio.',created_at:'2026-10-25T12:00:00Z',updated_at:'2026-10-25T12:00:00Z'}]}});
 for(const m of page.__audit.db.comm_whatsapp_messages)m.external_message_id='demo-external-'+m.id;
 const records=[],route='/painel/inbox?chatId=00000000-0000-4000-8000-000000000810';
 for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  const open=async()=>{await page.goto('http://127.0.0.1:5177'+route);await page.getByPlaceholder('Digite uma mensagem',{exact:true}).filter({visible:true}).first().waitFor({timeout:20000});};
  const take=async(id,name,kind)=>{const r=await page.__audit.captureState({id,name,category:'comunicacao',route,device,kind});records.push({id,device,status:r.status,controls:r.availableControls});};
  const failed=(id,name,e)=>{const r={id,name,category:'comunicacao',route,device,kind:'interaction',status:'pending',difficulty:e.message};page.__audit.interactions.push(r);records.push(r);};
  try{
   await open();const input=page.getByPlaceholder('Digite uma mensagem',{exact:true}).filter({visible:true}).first();await input.fill('/');await page.getByRole('listbox',{name:'Mensagens rápidas',exact:true}).waitFor();
   await take('inbox-mensagens-rapidas','Atalhos de mensagens rápidas','popover');
   await page.getByRole('button',{name:'Gerenciar',exact:true}).click();await page.getByRole('dialog').last().waitFor();await take('inbox-mensagens-rapidas-gerenciar','Gerenciar mensagens rápidas','modal');
  }catch(e){failed('inbox-mensagens-rapidas','Mensagens rápidas',e);}
  try{
   await open();await page.getByPlaceholder('Digite uma mensagem',{exact:true}).filter({visible:true}).first().fill('Rascunho fictício para documentação.');
   await page.getByRole('button',{name:'Ações com IA',exact:true}).click();await page.getByText('Sugerir resposta',{exact:true}).waitFor();await take('inbox-formatacao','Menu de IA e formatação, sem executar ações','popover');
  }catch(e){failed('inbox-formatacao','Menu de IA e formatação',e);}
  for(const [id,label]of [['inbox-dados-mensagem','Dados da mensagem'],['inbox-editar-mensagem','Editar mensagem'],['inbox-encaminhar','Encaminhar mensagem'],['inbox-resposta','Responder mensagem']]){
   try{
    await open();const more=page.getByRole('button',{name:'Mais acoes da mensagem',exact:true}).nth(1);
    await more.locator('xpath=ancestor::*[contains(@class,"message-bubble-row")][1]').hover();await more.click();
    if(id==='inbox-dados-mensagem')await take('inbox-menu-mensagem','Menu de ações da mensagem','menu');
    await page.getByRole('button',{name:label,exact:true}).click();
    if(id!=='inbox-resposta')await page.getByRole('dialog').last().waitFor();await take(id,label,id==='inbox-resposta'?'section':'modal');
   }catch(e){failed(id,label,e);}
  }
  try{await open();await page.locator('button.whatsapp-inbox-media-content').filter({has:page.locator('img')}).first().click();await page.getByRole('dialog').last().waitFor();await take('inbox-visualizador-imagem','Visualizador de imagem demonstrativa','modal');}catch(e){failed('inbox-visualizador-imagem','Visualizador de imagem',e);}
 }
 return records;
}
