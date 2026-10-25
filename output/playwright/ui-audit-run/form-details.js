async(page)=>{
 const records=[];
 for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  const route='/painel/leads';await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route);
  await page.getByRole('button',{name:/Novo lead|Criar novo lead/}).first().click();
  const dialog=page.getByRole('dialog').last();await dialog.waitFor();
  const menus=dialog.locator('button.kds-select:visible');const count=await menus.count();
  for(let index=0;index<count;index++){
   try{
    const trigger=menus.nth(index);const label=await trigger.evaluate(el=>el.closest('.kds-field')?.querySelector('label')?.textContent??el.textContent);
    await trigger.click();await page.getByRole('listbox').last().waitFor();
    const r=await page.__audit.captureState({id:`leads-criar-seletor-${index+1}`,name:`Novo lead: ${label}`,category:'leads',route,device,kind:'dropdown'});records.push({id:r.id,device,status:r.status});await page.keyboard.press('Escape');
   }catch(e){records.push({id:`leads-criar-seletor-${index+1}`,device,status:'pending',difficulty:e.message});}
  }
  const picker=dialog.locator('.kds-dp-trigger').nth(1);
  if(await picker.count()){
   await picker.click();await page.locator('.kds-dp-popover').waitFor();
   for(const [suffix,label]of [['data','Selecionar data'],['hora','Selecionar hora'],['minutos','Selecionar minutos']]){
    if(suffix==='hora')await page.locator('.kds-dp-popover .kds-dp-day:not(.kds-dp-day-outside):not(:disabled)').first().click();
    if(suffix==='minutos')await page.getByRole('button',{name:'14 horas',exact:true}).click();
    const r=await page.__audit.captureState({id:'leads-datepicker-'+suffix,name:label,category:'leads',route,device,kind:'datepicker'});records.push({id:r.id,device,status:r.status});
   }
   await page.keyboard.press('Escape');
  }
  const save=dialog.getByRole('button',{name:/Salvar|Cadastrar|Criar lead/}).last();
  if(await save.count()){
   await save.click();const r=await page.__audit.captureState({id:'leads-criar-validacao',name:'Novo lead: validação obrigatória',category:'leads',route,device,kind:'validation'});records.push({id:r.id,device,status:r.status});
  }
 }
 return records;
}
