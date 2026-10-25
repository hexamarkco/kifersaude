async(page)=>{
 const modules=[["campanhas", "campanhas", "/painel/disparos", ["comm_whatsapp_campaigns"]], ["blog", "conteudo", "/painel/blog", ["blog_posts"]]],records=[];
 for(const [id,category,route,tables]of modules)for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]])for(const state of ['empty','error','loading']){
  const backup={};for(const t of tables)backup[t]=page.__audit.db[t];
  page.__audit.mode='data';page.__audit.failTables=state==='error'?tables:[];page.__audit.slowTables=state==='loading'?tables:[];
  if(state==='empty')for(const t of tables)page.__audit.db[t]=[];
  const label={empty:'Sem dados',error:'Erro ao carregar dados',loading:'Carregamento em andamento'}[state];
  try{
   await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route,{waitUntil:'domcontentloaded'});
   if(state==='loading')await page.locator('main .kds-skeleton,main .kds-loading-state').first().waitFor({state:'visible',timeout:12000});
   else{
    await page.waitForLoadState('networkidle',{timeout:3000}).catch(()=>{});
    await page.waitForFunction(()=>document.querySelector('main')&&!document.querySelector('main .kds-skeleton'),{timeout:12000}).catch(()=>{});
   }
   const r=await page.__audit.captureState({id:id+'-estado-'+state,name:label,category,route,device,kind:state});records.push({id:r.id,device,status:r.status});
  }catch(e){const r={id:id+'-estado-'+state,name:label,category,route,device,kind:state,status:'pending',difficulty:e.message};page.__audit.interactions.push(r);records.push(r);}
  for(const t of tables)page.__audit.db[t]=backup[t];page.__audit.failTables=[];page.__audit.slowTables=[];
 }
 return records;
}