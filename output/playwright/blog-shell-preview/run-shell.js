async (page) => {
  await page.unrouteAll({behavior:'ignoreErrors'});
  const directory='kifersaude-ui-redesign/validacao/revisao-visual/blog';
  let reads=0,writes=0,blocked=0;
  const demo=Array.from({length:12},(_,i)=>({
    id:`demo-${String(i+1).padStart(2,'0')}`,
    title:`Artigo de demonstração ${String(i+1).padStart(2,'0')}`,
    slug:`artigo-demonstracao-${i+1}`,
    excerpt:'Conteúdo sintético para revisar a listagem do blog com o shell real do CRM.',
    content:`<p>Conteúdo fictício de demonstração para o artigo ${i+1}.</p><p>Esta prévia mantém as interações reais, sem salvar nem publicar.</p>`,
    category:['Guias','Planos','Dicas'][i%3], read_time:`${3+i%4} min`, author_id:'demo-operator',
    published:i%3===0, published_at:i%3===0?'2026-10-29T12:00:00Z':null,
    created_at:new Date(Date.UTC(2026,9,29-i,12,0,0)).toISOString(), updated_at:new Date(Date.UTC(2026,9,29-i,12,0,0)).toISOString(),
    views_count:120-i*7, meta_title:`Artigo de demonstração ${i+1}`, meta_description:'Metadados sintéticos para teste visual.'
  }));
  await page.route('**/*', async route => {
    const req=route.request(), u=new URL(req.url());
    if(['127.0.0.1','localhost'].includes(u.hostname)) return route.continue();
    if(u.pathname.endsWith('/rest/v1/blog_posts')) {
      if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS'}});
      if(req.method()==='GET') { reads++; return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify(demo)}); }
      writes++; return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}});
    }
    blocked++; return route.abort();
  });
  await page.addInitScript(()=>{localStorage.setItem('painel.theme.v2','light');localStorage.setItem('painel.sidebar.collapsed','false');});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('http://127.0.0.1:5181/',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:'*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}' });
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>[...document.querySelectorAll('p')].some(e=>e.textContent?.trim()==='Artigo de demonstração 01'&&e.getClientRects().length>0),null,{timeout:15000});
  await page.waitForTimeout(400);
  const overflows=[];
  for(const [theme,themeValue] of [['claro','light'],['escuro','dark']]) {
    if(themeValue==='dark') { await page.evaluate(()=>localStorage.setItem('painel.theme.v2','dark')); await page.reload({waitUntil:'domcontentloaded'}); await page.evaluate(()=>document.fonts.ready); await page.waitForFunction(()=>[...document.querySelectorAll('p')].some(e=>e.textContent?.trim()==='Artigo de demonstração 01'&&e.getClientRects().length>0),null,{timeout:15000}); }
    for(const [label,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844],['mobile-compacto',320,640]]) {
      await page.setViewportSize({width,height});
      await page.screenshot({path:`${directory}/shell-${label}-${theme}-full.png`,fullPage:true});
      if(label==='desktop' || label==='mobile') await page.screenshot({path:`${directory}/shell-${label}-${theme}-viewport.png`,fullPage:false});
      const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      overflows.push({label,theme,...dimensions});
    }
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.locator('button[aria-label="Visualizar"]:visible').first().click();
  await page.getByRole('dialog',{name:'Prévia do artigo'}).waitFor();
  await page.screenshot({path:`${directory}/shell-preview-desktop-claro.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${directory}/shell-preview-mobile-claro.png`,fullPage:true});
  const previewText=await page.getByRole('dialog',{name:'Prévia do artigo'}).innerText();
  await page.keyboard.press('Escape');
  const focusReturned=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || '');
  return {reads,writes,blocked,overflows,previewHasContent:previewText.includes('Conteúdo fictício'),focusReturned};
}

