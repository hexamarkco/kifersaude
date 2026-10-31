async (page) => {
  const url = new URL(page.url());
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local preview only');
  const phase = url.searchParams.get('phase') || 'before';
  const widths = url.searchParams.get('mobile') ? [390] : [768, 1440, 1920];
  const output = `output/playwright/home-photography/${phase}`;
  const sections = ['#topo', '#prova-social', '#para-quem', '#como-funciona', '#depoimentos', '#quem-somos', '#faq', '#cotacao', '#fale-agora', '.home-footer'];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/functions/v1/public-lead-submit', route => route.abort());
  await page.context().route('**/servicodados.ibge.gov.br/**', route => route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[{"nome":"Rio de Janeiro"}]'}));
  await page.emulateMedia({reducedMotion:'reduce'});
  const results = [];
  const idle = () => page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity));
  for (const width of widths) {
    await page.setViewportSize({width,height:width === 390 ? 664 : 900});
    await page.goto(url.href, {waitUntil:'domcontentloaded', timeout:60000});
    await page.locator('.home-footer').waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const selector of sections) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      for (const img of await page.locator(selector).locator('img:visible').all()) await img.evaluate(el => el.decode());
      await page.waitForFunction(s => document.querySelector(s).dataset.homeMotion === 'played', selector);
    }
    await idle();
    await page.evaluate(() => scrollTo({top:0,behavior:'instant'}));
    const metrics = await page.evaluate(() => ({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,documentHeight:document.documentElement.scrollHeight,agent:navigator.userAgent}));
    if (metrics.scroll > width) throw new Error(`Overflow at ${width}`);
    const style = `.kifer-home{width:${width}px!important;}header{position:static!important;}.home-skip-link{visibility:hidden!important;}`;
    for (const [i, selector] of sections.entries()) {
      const bounds = await page.locator(selector).evaluate(el => {const r=el.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY};});
      const top = i === 0 ? 0 : Math.floor(bounds.top);
      const height = Math.min(Math.ceil(bounds.bottom),metrics.documentHeight)-top;
      await page.screenshot({path:`${output}/${width}/${String(i+1).padStart(2,'0')}.png`,fullPage:true,clip:{x:0,y:top,width,height},scale:'css',animations:'disabled',style});
    }
    await page.screenshot({path:`${output}/${width}/page.png`,fullPage:true,scale:'css',animations:'disabled',style});
    for (const kind of ['MEI','CNPJ']) {
      await page.locator(`.home-audience-selector input[value="${kind}"]`).locator('..').click();
      await idle();
      await page.locator(`#audience-panel-${kind} img`).evaluate(el => el.decode());
      await page.locator('#para-quem').screenshot({path:`${output}/${width}/03-${kind}.png`,scale:'css',animations:'disabled',style:'header,.home-skip-link{visibility:hidden!important;}'});
    }
    results.push(metrics);
  }
  if(errors.length) throw new Error(JSON.stringify(errors));
  return {phase,capturedAt:new Date().toISOString(),results,errors};
}
