async (page) => {
  const phase = new URL(page.url()).searchParams.get('phase') || 'before';
  await page.context().route('**/functions/v1/**', route=>route.abort());
  await page.context().route('**/servicodados.ibge.gov.br/**', route=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}));
  await page.context().route('**/_vercel/**', route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[];
  for(const width of [360,390,430,768,1024,1440,1672,1920]) {
    await page.setViewportSize({width,height:width<640?844:1000});
    await page.goto('http://127.0.0.1:5220/?phase='+phase);
    await page.locator('#para-quem').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.addStyleTag({content:'.kds-public-header{visibility:hidden!important}'});
    const otherSections=await page.evaluate(()=>[...document.querySelectorAll('main > section:not(#para-quem),.home-footer')].map(e=>({id:e.id||e.className,height:e.getBoundingClientRect().height,text:e.textContent})));
    const profiles=[];
    for(const kind of ['PF','MEI','CNPJ']) {
      await page.locator(`.home-audience-selector .kds-radio:has(input[value="${kind}"])`).click();
      const panel=page.locator('#audience-panel-'+kind);
      await panel.locator('img').evaluate(e=>e.decode());
      await page.waitForFunction(()=>!document.querySelector('#para-quem').getAnimations({subtree:true}).some(a=>a.playState==='running'));
      profiles.push(await panel.evaluate(el=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y-el.getBoundingClientRect().y}};
        return {kind:el.id,rect:rect(el),photo:rect(el.querySelector('.home-audience-photo')),cta:rect(el.querySelector('button')),text:el.textContent,src:el.querySelector('img').getAttribute('src'),overflow:document.documentElement.scrollWidth>innerWidth};
      }));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      if([390,1440,1672].includes(width)) await page.locator('#para-quem').screenshot({path:`output/playwright/audience-fidelity/${phase}/${width}-${kind}.png`,animations:'disabled',scale:'css'});
    }
    results.push({width,otherSections,profiles});
  }
  return results;
}
