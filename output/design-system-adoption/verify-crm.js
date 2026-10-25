async(page)=>{
 const records=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.bringToFront();await page.emulateMedia({reducedMotion:'reduce'});page.setDefaultTimeout(20000);const url='http://127.0.0.1:5175/local-artifacts/design-system-adoption/index.html?mode=catalogs';
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('heading',{name:'Etapas do funil',exact:true}).waitFor();
 for(const width of [320,390,768,1920])for(const theme of ['light','dark']){
  await page.evaluate(theme=>localStorage.setItem('painel.theme.v2',theme),theme);await page.setViewportSize({width,height:width===1920?1080:1024});await page.goto('about:blank');await page.goto(url,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Etapas do funil',exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
  for(const [button,title] of [['Etapas','Etapas do funil'],['Origens','Origens dos leads'],['Modalidades','Modalidades']]){
   await page.getByRole('button',{name:button,exact:true}).click();await page.getByRole('heading',{name:title,exact:true}).waitFor();const metrics=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,theme:document.querySelector('.kds-app-shell').classList.contains('theme-dark')?'dark':'light',button:[...document.querySelectorAll('main button.kds-button')].filter(e=>e.getBoundingClientRect().width).slice(0,4).map(e=>({radius:getComputedStyle(e).borderRadius,height:getComputedStyle(e).height,font:getComputedStyle(e).fontFamily}))}));if(metrics.width>metrics.viewport)throw new Error('CRM overflow '+JSON.stringify({width,theme,title,...metrics}));if(metrics.theme!==theme)throw new Error('CRM theme mismatch');if(metrics.button.some(b=>b.radius!=='8px'))throw new Error('CRM button geometry mismatch');records.push({viewport:width,theme,title,...metrics});
   if((width===390||width===1920)&&button==='Etapas')await page.screenshot({path:'output/design-system-adoption/crm-settings-'+width+'-'+theme+'.png',fullPage:true,animations:'disabled'});
  }
 }
 return {records,errors};
}
