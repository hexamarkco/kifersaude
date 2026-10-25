async(page)=>{
 const route='/painel/inbox?chatId=00000000-0000-4000-8000-000000000810';
 const records=[];
 for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route);
  const leadInfo=page.getByRole('button',{name:'Abrir informações do lead',exact:true});
  const openActions=page.getByRole('button',{name:'Abrir ações da conversa',exact:true});
  await page.getByText('Contato Demonstração 01',{exact:true}).filter({visible:true}).first().waitFor({timeout:20000});
  const take=async(id,name,kind)=>{const r=await page.__audit.captureState({id,name,category:'comunicacao',route,device,kind});records.push({id,device,status:r.status,controls:r.availableControls});};
  await take('inbox-conversa','Conversa com histórico fictício','detail');
  const actions=[['inbox-lead-drawer','Informações do lead','Abrir informações do lead','Informações do lead'],['inbox-arquivos-drawer','Arquivos da conversa','Arquivos da conversa','Arquivos da conversa'],['inbox-busca-mensagens','Busca na conversa','Pesquisar mensagens neste chat','Pesquisar neste chat'],['inbox-agendadas-conversa','Agendamentos da conversa','Ver mensagens agendadas desta conversa','Mensagens agendadas desta conversa']];
  for(const [id,name,direct,menu]of actions){
   try{
    const target=page.getByRole('button',{name:direct,exact:true}).filter({visible:true});
    if(await target.count())await target.click();
    else{await openActions.click();await page.getByRole('menuitem',{name:menu,exact:true}).click();}
    if(id.includes('drawer')||id.includes('agendadas'))await page.getByRole('dialog').last().waitFor({timeout:10000});
    await take(id,name,id.includes('drawer')?'drawer':'interaction');
    for(let i=0;i<3;i++)await page.keyboard.press('Escape');
    const close=page.getByRole('dialog').last().getByRole('button',{name:/^Fechar$/}).first();if(await close.count())await close.click();
   }catch(e){const r={id,name,category:'comunicacao',route,device,kind:'interaction',status:'pending',difficulty:e.message};page.__audit.interactions.push(r);records.push(r);}
  }
  for(const [id,label]of [['inbox-mensagens-rapidas','Mensagens rápidas'],['inbox-emojis','Emoji, GIF e figurinha'],['inbox-anexos','Anexar'],['inbox-formatacao','Formatacao do texto']]){
   try{await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).first().click();await take(id,label,'popover');await page.keyboard.press('Escape');}
   catch(e){const r={id,name:label,category:'comunicacao',route,device,kind:'popover',status:'pending',difficulty:e.message};page.__audit.interactions.push(r);records.push(r);}
  }
 }
 return records;
}
