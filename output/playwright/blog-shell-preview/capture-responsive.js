async (page) => {
  await page.unrouteAll({behavior:'ignoreErrors'});
  const directory='kifersaude-ui-redesign/validacao/revisao-visual/blog';
  let reads=0,writes=0,blocked=0;
  const demo=Array.from({length:12},(_,i)=>({id:`demo-${String(i+1).padStart(2,'0')}`,title:`Artigo de demonstração ${String(i+1).padStart(2,'0')}`,slug:`artigo-demonstracao-${i+1}`,excerpt:'Conteúdo sintético para revisar a listagem do blog com o shell real do CRM.',content:`<p>Conteúdo fictício de demonstração para o artigo ${i+1}.</p><p>Esta prévia preserva as interações reais sem salvar nem publicar.</p>`,category:['Guias','Planos','Dicas'][i%3],read_time:`${3+i%4} min`,author_id:'demo-operator',published:i%3===0,published_at:i%3===0?'2026-10-29T12:00:00Z':null,created_at:new Date(Date.UTC(2026,9,29-i,12,0,0)).toISOString(),updated_at:new Date(Date.UTC(2026,9,29-i,12,0,0)).toISOString(),views_count:120-i*7,meta_title:`Artigo de demonstração ${i+1}`,meta_description:'Metadados sintéticos para teste visual.'}));
  await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();if(u.pathname.endsWith('/rest/v1/blog_posts')){if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'}});if(req.method()==='GET'){reads++;return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify(demo)});}writes++;return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}});}blocked++;return route.abort();});
  await page.addInitScript(()=>{const theme=new URL(location.href).searchParams.get('theme');localStorage.setItem('painel.theme.v2',theme==='dark'?'dark':'light');localStorage.setItem('painel.sidebar.collapsed','false');});
  await page.emulateMedia({reducedMotion:'reduce'});
  const ready=async()=>{await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('p')].some(e=>e.textContent?.trim()==='Artigo de demonstração 01'&&e.getClientRects().length>0),null,{timeout:15000});await page.addStyleTag({content:'*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}'});};
  const results=[];
  for(const [theme,themeValue] of [['claro','light'],['escuro','dark']]){
    await page.setViewportSize({width:1920,height:1080});
    await page.goto(`http://127.0.0.1:5181/?theme=${themeValue}`,{waitUntil:'domcontentloaded'});
    await ready();
    const observed=await page.locator('.kds-app-shell').getAttribute('class');
    if(!observed?.includes(`theme-${themeValue}`))throw new Error(`Tema ${theme} não foi aplicado.`);
    for(const [label,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844],['mobile-compacto',320,640]]){
      await page.setViewportSize({width,height});
      await page.screenshot({path:`${directory}/shell-${label}-${theme}-viewport.png`,fullPage:false});
      const nav=page.locator('.terracota-mobile-bottom-nav');
      const oldVisibility=width<1024?await nav.evaluate(el=>el.style.visibility).catch(()=>null):null;
      if(width<1024)await nav.evaluate(el=>{el.style.visibility='hidden';}).catch(()=>undefined);
      await page.screenshot({path:`${directory}/shell-${label}-${theme}-full.png`,fullPage:true});
      if(width<1024)await nav.evaluate((el,value)=>{el.style.visibility=value||'';},oldVisibility).catch(()=>undefined);
      const dims=await page.evaluate(()=>({viewport:innerWidth,client:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      results.push({label,theme,...dims,overflow:dims.document>dims.client||dims.body>dims.client});
    }
  }
  return {reads,writes,blocked,results,themesObserved:results.map(r=>r.theme)};
}
