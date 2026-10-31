async (page) => {
  page.setDefaultTimeout(15000);
  await page.context().route('**/_vercel/speed-insights/script.js', route => route.fulfill({contentType:'application/javascript',body:''}));
  await page.context().route('**/functions/v1/public-lead-submit', route => route.fulfill({status:200,contentType:'application/json',body:'{"success":true}'}));
  const report = [];
  for (const version of ['before','after']) {
    for (const width of [320,390,768,1440,1920]) {
      await page.setViewportSize({width,height:900});
      await page.goto(`http://127.0.0.1:${version==='before'?5192:5191}/`,{waitUntil:'domcontentloaded',timeout:60000});
      await page.locator('.home-footer').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      for (const section of await page.locator('.kifer-home main > section,.home-footer').all()) {
        await section.scrollIntoViewIfNeeded();
        for (const image of await section.locator('img:visible').all()) await image.evaluate(el=>new Promise(resolve=>{
          if(el.complete) resolve(); else {el.addEventListener('load',resolve,{once:true});el.addEventListener('error',resolve,{once:true});}
        }));
      }
      await page.waitForFunction(()=>!document.querySelector('.home-motion-entering'));
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.waitForFunction(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity).length===0);
      const metrics = await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,sections:[...document.querySelectorAll('.kifer-home main>section,.home-footer')].map(el=>({id:el.id||'footer',height:el.getBoundingClientRect().height,text:el.textContent.replace(/\s+/g,' ').trim()}))}));
      const file=`${width}-full-${version}.png`;
      await page.screenshot({path:`output/playwright/home-motion/${file}`,fullPage:true,animations:'disabled',style:`.kifer-home {width:${metrics.client}px!important;}`});
      report.push({version,width,file,...metrics});
    }
  }
  const comparison = report.filter(r=>r.version==='before').map(before=>{
    const after=report.find(r=>r.version==='after'&&r.width===before.width);
    const sections=before.sections.map((section,index)=>({id:section.id,delta:after.sections[index].height-section.height,sameText:section.text===after.sections[index].text}));
    if(sections.some(section=>Math.abs(section.delta)>1||!section.sameText)) throw new Error(`Resting layout changed: ${JSON.stringify({width:before.width,sections})}`);
    return {width:before.width,sections};
  });
  return {captures:report.map(({sections,...rest})=>rest),comparison};
}
