async (page) => {
  const url = new URL(page.url());
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local preview required');
  await page.context().route('**/functions/v1/**', route => route.abort());
  await page.context().route('**/servicodados.ibge.gov.br/**', route => route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}));
  await page.context().route('**/_vercel/**', route => route.fulfill({contentType:'application/javascript',body:''}));
  const phase = url.searchParams.get('phase') || 'before';
  const results = [];
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const width of [390,768,1024,1280,1440,1536,1672,1920]) {
    await page.setViewportSize({width,height:width===390?844:Math.round(width*941/1672)});
    await page.goto(url.href,{waitUntil:'domcontentloaded'});
    await page.locator('.home-footer').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('.home-hero-photo-mask').evaluate(async el => {
      const mask = getComputedStyle(el).maskImage;
      if (mask.startsWith('url("')) {
        const image = new Image(); image.src = mask.slice(5, -2); await image.decode();
      }
    });
    for (const section of await page.locator('main > section,.home-footer').all()) {
      await section.scrollIntoViewIfNeeded();
      for(const img of await section.locator('img:visible').all()) await img.evaluate(el=>el.decode());
    }
    await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'));
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    const metrics = await page.evaluate(()=>{
      const hero=document.querySelector('#topo').getBoundingClientRect();
      const sections=[...document.querySelectorAll('main > section,.home-footer')];
      return {width:innerWidth,scroll:document.documentElement.scrollWidth,heroBottom:hero.bottom+scrollY,documentHeight:document.documentElement.scrollHeight,text:document.querySelector('#topo').textContent,src:document.querySelector('.home-luiza-photo').getAttribute('src'),sections:sections.slice(1).map(s=>({id:s.id||s.className,height:s.getBoundingClientRect().height,text:s.textContent}))};
    });
    if(metrics.scroll>width) throw new Error('Overflow '+width);
    const style='header{position:static!important}.home-skip-link{visibility:hidden!important}';
    await page.screenshot({path:`output/playwright/hero-desktop-fidelity/${phase}/${width}.png`,fullPage:true,clip:{x:0,y:0,width,height:Math.ceil(metrics.heroBottom)},scale:'css',animations:'disabled',style});
    if([390,1672].includes(width)) {
      const top=Math.ceil(metrics.heroBottom);
      await page.screenshot({path:`output/playwright/hero-desktop-fidelity/${phase}/rest-${width}.png`,fullPage:true,clip:{x:0,y:top,width,height:metrics.documentHeight-top},scale:'css',animations:'disabled',style});
    }
    results.push(metrics);
  }
  return results;
}
