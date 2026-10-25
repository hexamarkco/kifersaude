async(page)=>{
 await page.context().addInitScript(()=>{if(sessionStorage.getItem('ui-audit-theme')==='dark')localStorage.setItem('painel.theme.v2','dark');});
 await page.evaluate(()=>sessionStorage.setItem('ui-audit-theme','dark'));
 const records=[];
 for(const [id,category,route,modal]of [['dashboard','dashboard','/painel/dashboard',false],['inbox','comunicacao','/painel/inbox',false],['leads-criar','leads','/painel/leads',true]])for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route);await page.locator('.kds-app-shell.theme-dark').waitFor();
  if(modal){await page.getByRole('button',{name:/Novo lead|Criar novo lead/}).first().click();await page.getByRole('dialog').last().waitFor();}
  await page.waitForLoadState('networkidle',{timeout:1500}).catch(()=>{});
  const r=await page.__audit.captureState({id:id+'-tema-escuro',name:id+' — tema escuro',category,route,device,kind:'theme'});records.push({id:r.id,device,status:r.status});
 }
 await page.evaluate(()=>sessionStorage.removeItem('ui-audit-theme'));return records;
}
