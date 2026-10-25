async(page)=>{
 const route='/painel/inbox?chatId=00000000-0000-4000-8000-000000000810',device='mobile';await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5177'+route);
 const input=page.getByPlaceholder('Digite uma mensagem',{exact:true}).filter({visible:true}).first();await input.waitFor({timeout:15000});await input.fill('/');await page.getByText('Mensagens rápidas por atalho',{exact:true}).waitFor();
 const menu=await page.__audit.captureState({id:'inbox-mensagens-rapidas',name:'Atalhos de mensagens rápidas',category:'comunicacao',route,device,kind:'popover'});menu.note='No mobile a lista pode estar vazia; o menu e suas ações foram capturados sem enviar a mensagem.';
 await page.getByRole('button',{name:'Gerenciar',exact:true}).click();await page.getByRole('dialog').last().waitFor();
 const manager=await page.__audit.captureState({id:'inbox-mensagens-rapidas-gerenciar',name:'Gerenciar mensagens rápidas',category:'comunicacao',route,device,kind:'modal'});
 return [menu,manager];
}
