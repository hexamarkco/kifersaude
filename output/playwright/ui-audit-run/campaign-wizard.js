async(page)=>{
 const records=[];
 for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  const route='/painel/disparos';await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route);
  await page.getByRole('button',{name:'Novo disparo',exact:true}).click();const dialog=page.getByRole('dialog').last();await dialog.waitFor();
  await dialog.getByRole('textbox').first().fill('Campanha de demonstração — sem envio');
  for(let step=1;step<=3;step++){
   await dialog.getByRole('button',{name:'Próximo',exact:true}).click();
   const r=await page.__audit.captureState({id:`campanhas-criar-etapa-${step+1}`,name:`Novo disparo: etapa ${step+1}`,category:'campanhas',route,device,kind:'wizard'});records.push({id:r.id,device,status:r.status,controls:r.availableControls});
  }
 }
 return records;
}
