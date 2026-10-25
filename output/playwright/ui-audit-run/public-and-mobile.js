async(page)=>{
 const records=[];
 for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  const route='/forms/demonstracao';
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route);
  const light=page.getByRole('button',{name:'Ativar modo claro',exact:true});if(await light.count())await light.click();
  await page.getByRole('radio',{name:'Individual',exact:true}).click();await page.getByLabel('Nome completo',{exact:true}).waitFor();
  const toLight=page.getByRole('button',{name:'Ativar modo claro',exact:true});if(await toLight.count())await toLight.click();
  const r=await page.__audit.captureState({id:'formulario-publico-contato',name:'Formulário público: etapa de contato',category:'publico',route,device,kind:'wizard'});records.push({id:r.id,device,status:r.status});
  const toggle=page.getByRole('button',{name:'Ativar modo escuro',exact:true});if(await toggle.count())await toggle.click();
  const dark=await page.__audit.captureState({id:'formulario-publico-contato-escuro',name:'Formulário público: contato em tema escuro',category:'publico',route,device,kind:'theme'});records.push({id:dark.id,device,status:dark.status});
 }
 for(const device of ['tablet','mobile']){
  const width=device==='mobile'?390:768,height=device==='mobile'?844:1024;await page.setViewportSize({width,height});const route='/painel/config?tab=system&section=access';await page.goto('http://127.0.0.1:5177'+route);
  await page.getByRole('heading',{name:'Acesso por área',exact:true}).waitFor();
  const r=await page.__audit.captureState({id:'perfis-permissoes',name:'Permissões do administrador',category:'configuracoes',route,device,kind:'section'});records.push({id:r.id,device,status:r.status});
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5177/painel/dashboard');await page.getByRole('button',{name:'Abrir mais opções',exact:true}).click();
 const nav=await page.__audit.captureState({id:'nav-mobile-menu',name:'Menu de navegação mobile',category:'dashboard',route:'/painel/dashboard',device:'mobile',kind:'menu'});records.push({id:nav.id,device:'mobile',status:nav.status});
 return records;
}
