async(page)=>{
 const records=[];const route='/painel/automacoes?tab=automation';
 for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  try{
   await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route);
   await page.getByRole('button',{name:/Retorno de demonstração/}).first().click({timeout:12000});await page.getByRole('dialog').last().waitFor();
   const take=async(id,name)=>{const r=await page.__audit.captureState({id,name,route,category:'automacoes',device,kind:'modal'});records.push({id,device,status:r.status,controls:r.availableControls});};
   await take('automacao-fluxo-editar','Editor do fluxo existente');
   for(const [suffix,label]of [['regras','Regras e agenda'],['testes','Simular e testar']]){
    await page.getByRole('tab',{name:label,exact:true}).click();await take('automacao-fluxo-'+suffix,label);
   }
  }catch(e){const r={id:'automacao-fluxo-editar',name:'Editor do fluxo existente',route,category:'automacoes',device,kind:'modal',status:'pending',difficulty:e.message};page.__audit.interactions.push(r);records.push(r);}
 }
 return records;
}
