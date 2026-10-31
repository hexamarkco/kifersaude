async (page) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    const mode=new URLSearchParams(location.search).get('motion-fallback');
    if(mode==='no-observer') window.IntersectionObserver=undefined;
    if(mode==='broken-observer') window.IntersectionObserver=class {constructor(){throw new Error('Unavailable observer');}};
    if(mode==='silent-observer') window.IntersectionObserver=class {observe(){} unobserve(){} disconnect(){}};
    if(mode==='no-animation') Element.prototype.animate=undefined;
    if(mode==='broken-animation') Element.prototype.animate=function(){throw new Error('Unsupported animation');};
  });
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:390,height:900});
  const results=[];
  for(const mode of ['no-observer','broken-observer','silent-observer','no-animation','broken-animation']) {
    await page.goto(`http://127.0.0.1:5191/?motion-fallback=${mode}`);
    await page.locator('.home-footer').waitFor();
    await page.waitForFunction(()=>!document.querySelector('.home-motion-entering'),undefined,{polling:50});
    const invisible=await page.evaluate(()=>[...document.querySelectorAll('.kifer-home h1,.kifer-home h2,.home-lead,.home-quote-form')].filter(el=>!el.closest('[aria-hidden="true"]')&&(getComputedStyle(el).visibility==='hidden'||+getComputedStyle(el).opacity<.5)).length);
    if(invisible) throw new Error(`Hidden content: ${mode}`);
    for(const profile of ['MEI','CNPJ','PF']) await page.locator(`input[name="audience-profile"][value="${profile}"]`).locator('..').click();
    await page.waitForFunction(()=>document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity).length===0,undefined,{polling:50});
    if(await page.locator('.home-audience-slides').getByRole('region').count()!==1) throw new Error(`Profile fallback failed: ${mode}`);
    await page.locator('#faq-trigger-0').click();
    await page.locator('#faq-answer-0').waitFor({state:'visible'});
    results.push({mode,invisible,profiles:'passed',faq:'passed'});
  }
  await page.goto('http://127.0.0.1:5191/');
  await page.locator('.home-hero').waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'),undefined,{polling:50});
  const reduced=await page.locator('.home-luiza-photo').evaluate(el=>getComputedStyle(el).transform);
  if(reduced!=='none') throw new Error('Dynamic preference retained a transform');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('http://127.0.0.1:5191/');
  await page.locator('.home-hero').waitFor();
  const background=await page.context().newPage();
  await background.bringToFront();
  try {
    await page.waitForFunction(()=>!document.querySelector('.home-motion-entering'),undefined,{polling:50});
  } finally {
    await background.close();
  }
  await page.bringToFront();
  if(errors.length) throw new Error(JSON.stringify(errors));
  return {results,dynamicPreference:'passed',backgroundCleanup:'passed',errors};
}
