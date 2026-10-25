async(page)=>{
 const records=[],route='/painel/contratos';
 for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route);await page.getByRole('button',{name:'Novo contrato',exact:true}).click();await page.getByRole('dialog').last().waitFor();
  await page.getByRole('button',{name:'Importar de arquivo',exact:true}).click();await page.getByRole('dialog').last().getByText(/Importar/).first().waitFor();
  const r=await page.__audit.captureState({id:'contratos-importacao-individual',name:'Importação individual de contrato e titular',category:'contratos',route,device,kind:'modal'});records.push({id:r.id,device,status:r.status});
 }
 return records;
}
