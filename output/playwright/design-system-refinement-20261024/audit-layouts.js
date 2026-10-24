async(page)=>{
 const reports=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.bringToFront();await page.emulateMedia({reducedMotion:'reduce'});
 async function inspect(name,width,theme){
  const metrics=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left<-1)&&!el.closest('.ds-studio-canvas,.kds-table-wrapper,[hidden]')&&getComputedStyle(el).display!=='none';}).slice(0,12).map(el=>({tag:el.tagName,class:el.className?.toString(),width:Math.round(el.getBoundingClientRect().width),right:Math.round(el.getBoundingClientRect().right)}))}));
  reports.push({name,width,theme,...metrics});
 }
 for(const width of [320,390,768,1920]){
  await page.setViewportSize({width,height:width>=1024?1080:844});
  for(const theme of ['light','dark']){
   for(const section of ['overview','foundations','components','states','patterns','responsive']){
    await page.goto('about:blank');await page.goto('http://127.0.0.1:5174/design-system#'+section);await page.locator('main h1').waitFor();
    const toggle=page.getByRole('button',{name:theme==='dark'?'Ativar tema escuro':'Ativar tema claro',exact:true});if(await toggle.count())await toggle.click();
    await page.evaluate(()=>document.fonts.ready);
    await inspect(section,width,theme);
    if(section==='components')for(const tab of ['Formulários','Navegação','Dados','Feedback','Interações']){await page.getByRole('tab',{name:tab,exact:true}).click();await inspect('components-'+tab,width,theme);}
   }
   for(const pattern of ['list','detail','create','edit','dashboard']){
    await page.goto('about:blank');await page.goto('http://127.0.0.1:5174/design-system?preview=1&pattern='+pattern+'&theme='+theme);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);await inspect('preview-'+pattern,width,theme);
   }
  }
 }
 return {reports,errors};
}
