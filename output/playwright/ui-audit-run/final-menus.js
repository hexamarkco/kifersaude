async(page)=>{
 const records=[];const deep='/painel/inbox?chatId=00000000-0000-4000-8000-000000000810';
 const take=async(id,name,route,device,kind)=>{const r=await page.__audit.captureState({id,name,route,category:'comunicacao',device,kind});records.push({id,device,status:r.status});};
 for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+deep);await page.getByPlaceholder('Digite uma mensagem',{exact:true}).filter({visible:true}).first().waitFor({timeout:15000});
  const actions=page.getByRole('button',{name:'Abrir ações da conversa',exact:true}).filter({visible:true});
  if(await actions.count()){await actions.click();await page.getByRole('menu',{name:'Ações da conversa',exact:true}).waitFor();await take('inbox-menu-conversa','Menu do cabeçalho da conversa',deep,device,'menu');await page.keyboard.press('Escape');}
  if(device==='mobile'){
   try{
    const input=page.getByPlaceholder('Digite uma mensagem',{exact:true}).filter({visible:true}).first();await input.fill('');await input.focus();await input.press('/');await page.getByRole('listbox',{name:'Mensagens rápidas',exact:true}).waitFor({timeout:10000});
    await take('inbox-mensagens-rapidas','Atalhos de mensagens rápidas',deep,device,'popover');await page.getByRole('button',{name:'Gerenciar',exact:true}).click();await page.getByRole('dialog').last().waitFor();await take('inbox-mensagens-rapidas-gerenciar','Gerenciar mensagens rápidas',deep,device,'modal');
   }catch(e){records.push({id:'inbox-mensagens-rapidas',device,status:'pending',difficulty:e.message});}
  }
  await page.goto('http://127.0.0.1:5177/painel/inbox');
  const back=page.getByRole('button',{name:'Voltar para a lista de conversas',exact:true}).filter({visible:true});if(await back.count())await back.click();
  await page.getByText('Contato Demonstração 01',{exact:true}).filter({visible:true}).first().waitFor({timeout:15000});await page.getByText('Contato Demonstração 01',{exact:true}).filter({visible:true}).first().hover();
  const menu=page.getByRole('button',{name:'Abrir menu da conversa',exact:true}).filter({visible:true}).first();await menu.click();
  await page.waitForFunction(el=>el.getAttribute('aria-expanded')==='true',await menu.elementHandle());await take('inbox-menu-linha','Menu contextual da lista de conversas','/painel/inbox',device,'menu');
 }
 return records;
}
