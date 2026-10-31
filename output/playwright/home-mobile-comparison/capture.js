async (page) => {
  const source = 'https://www.kifersaude.com.br/';
  const output = 'output/playwright/home-mobile-comparison';
  const entries = [
    ['01','topo','#topo'],['02','prova-social','#prova-social'],
    ['03','para-quem','#para-quem'],['04','como-funciona','#como-funciona'],
    ['05','depoimentos','#depoimentos'],['06','quem-somos','#quem-somos'],
    ['07','faq','#faq'],['08','cotacao','#cotacao'],
    ['09','fale-agora','#fale-agora'],['10','rodape','.home-footer'],
  ];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/functions/v1/public-lead-submit', route => route.abort());
  await page.context().route('**/_vercel/speed-insights/script.js', route => route.fulfill({contentType:'application/javascript',body:''}));
  await page.emulateMedia({reducedMotion:'reduce'});
  const captures = [];
  for (const width of [390,320,360,375,414,430]) {
    await page.setViewportSize({width,height:664});
    await page.goto(source);
    await page.locator('.home-footer').waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const [, , selector] of entries) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      for (const img of await page.locator(selector).locator('img:visible').all()) await img.evaluate(el => el.decode());
      await page.waitForFunction(selector => document.querySelector(selector).dataset.homeMotion === 'played', selector);
    }
    await page.waitForFunction(() => !document.getAnimations().some(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity));
    await page.evaluate(() => scrollTo({top:0,behavior:'instant'}));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics = await page.evaluate(() => ({
      client:document.documentElement.clientWidth,
      scroll:document.documentElement.scrollWidth,
      documentHeight:document.documentElement.scrollHeight,
      screen:{width:screen.width,height:screen.height},
      viewport:{width:innerWidth,height:innerHeight},
      dpr:devicePixelRatio,
      userAgent:navigator.userAgent,
      stylesheets:[...document.querySelectorAll('link[rel="stylesheet"]')].map(el => el.getAttribute('href')),
    }));
    if (metrics.client !== width || metrics.scroll > width) throw new Error(`Unexpected page width: ${JSON.stringify(metrics)}`);
    // Keep the header in its natural first-page position when WebKit expands the capture area.
    // These temporary capture styles preserve its dimensions and never change the website source.
    const style = `.kifer-home{width:${width}px!important;}header{position:static!important;}.home-skip-link{visibility:hidden!important;}`;
    const sections = [];
    for (const [number,id,selector] of entries) {
      const bounds = await page.locator(selector).evaluate(el => {
        const rect = el.getBoundingClientRect();
        return {top:rect.top+scrollY,bottom:rect.bottom+scrollY};
      });
      const top = number === '01' ? 0 : Math.floor(bounds.top);
      const height = Math.min(Math.ceil(bounds.bottom), metrics.documentHeight) - top;
      const file = `${width}/${number}-${id}.png`;
      const buffer = await page.screenshot({path:`${output}/${file}`,fullPage:true,clip:{x:0,y:top,width,height},scale:'css',animations:'disabled',style});
      const image = {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
      if (image.width !== width || Math.abs(image.height-height)>1) throw new Error(`Unexpected screenshot dimensions: ${file}`);
      sections.push({number,id,file,...image});
    }
    const full = await page.screenshot({path:`${output}/${width}/page.png`,fullPage:true,scale:'css',animations:'disabled',style});
    await page.evaluate(() => scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:`${output}/${width}/viewport.png`,scale:'css',animations:'disabled',style});
    captures.push({width,...metrics,page:{width:full.readUInt32BE(16),height:full.readUInt32BE(20)},sections});
  }
  if (errors.length) throw new Error(`Browser runtime errors: ${JSON.stringify(errors)}`);
  return {source,capturedAt:new Date().toISOString(),browser:'WebKit',profile:'iPhone 12 Pro',reducedMotion:true,captures,errors};
}
