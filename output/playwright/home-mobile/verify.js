async (page) => {
  page.setDefaultTimeout(12000);
  const errors = [];
  const pageErrors = [];
  const mockedLeads = [];
  let releaseLead;
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.context().route('**/_vercel/speed-insights/script.js', route => route.fulfill({contentType:'application/javascript',body:''}));
  await page.context().route('**/servicodados.ibge.gov.br/**', route => route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify([{nome:'Rio de Janeiro'},{nome:'Niterói'}])}));
  await page.context().route('**/functions/v1/public-lead-submit', async route => {
    const headers = {'access-control-allow-origin':'*','access-control-allow-headers':'authorization, apikey, x-client-info, content-type','access-control-allow-methods':'POST, OPTIONS'};
    if (route.request().method() === 'OPTIONS') return route.fulfill({status:204,headers,body:''});
    mockedLeads.push(route.request().postDataJSON());
    await new Promise(resolve => { releaseLead = resolve; });
    await route.fulfill({status:200,contentType:'application/json',headers,body:'{"success":true}'});
  });
  await page.addInitScript(() => {
    if (window.__homeMotionQA) return;
    window.__homeMotionQA = {runs:[],opens:[],whatsappClicks:0,cls:0,observers:0};
    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = function(frames, options) {
      const section = this.closest('section,footer');
      window.__homeMotionQA.runs.push({section:section?.id || (section?.classList.contains('home-footer')?'footer':''),target:this.className,frames,options});
      return nativeAnimate.call(this, frames, options);
    };
    const NativeObserver = window.IntersectionObserver;
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback, options) {
        super(callback, options);
        if (options?.rootMargin === '0px 0px 70px 0px') window.__homeMotionQA.observers++;
      }
    };
    window.open = url => { window.__homeMotionQA.opens.push(String(url)); return null; };
    document.addEventListener('click', event => {
      const link = event.target instanceof Element && event.target.closest('a[href^="https://wa.me/"]');
      if (link) { event.preventDefault(); window.__homeMotionQA.whatsappClicks++; }
    }, true);
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__homeMotionQA.cls += entry.value;
    }).observe({type:'layout-shift',buffered:true});
  });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const idle = () => page.waitForFunction(() => document.getAnimations().filter(animation => {
    const effect = animation.effect;
    return effect?.target instanceof Element && effect.target.closest('.kifer-home') && animation.playState === 'running' && effect.getTiming().iterations !== Infinity;
  }).length === 0);
  const sections = ['#topo','#prova-social','#para-quem','#como-funciona','#depoimentos','#quem-somos','#faq','#cotacao','#fale-agora','.home-footer'];
  const results = [];
  for (const mode of ['no-preference','reduce']) {
    for (const width of [320,360,375,390,414,430]) {
      await page.emulateMedia({reducedMotion:mode});
      await page.setViewportSize({width,height:900});
      await page.goto('http://127.0.0.1:5194/');
      await page.locator('.home-footer').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await idle();
      await page.evaluate(() => { window.__homeMotionQA.cls = 0; });
      const before = await page.evaluate(() => [...document.querySelectorAll('.kifer-home main > section,.home-footer')].map(el => ({id:el.id || 'footer',height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top+scrollY,text:el.textContent.replace(/\s+/g,' ').trim()})));
      assert(before.length === 10, 'Expected ten original sections');
      assert(await page.locator('.home-hero-actions button').isEnabled(), 'Hero CTA disabled');
      for (const selector of sections) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.locator(selector).evaluate(el => new Promise(resolve => {
          const check = () => el.dataset.homeMotion === 'played' ? resolve() : requestAnimationFrame(check);
          check();
        }));
        await idle();
      }
      await page.locator('.home-message:nth-child(3)').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('.home-phone').dataset.homeMotion==='played');
      await idle();
      await page.waitForFunction(() => document.querySelectorAll('.home-motion-entering').length === 0);
      const settled = await page.evaluate(() => {
        const blocks = [...document.querySelectorAll('.kifer-home main > section,.home-footer')];
        const invisible = [...document.querySelectorAll('.kifer-home h1,.kifer-home .home-title,.home-lead,.home-footer h2,.home-quote-form')].filter(el => !el.closest('[aria-hidden="true"]') && (getComputedStyle(el).visibility === 'hidden' || Number(getComputedStyle(el).opacity) < 0.5));
        return {width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,cls:window.__homeMotionQA.cls,runs:window.__homeMotionQA.runs.length,observers:window.__homeMotionQA.observers,invisible:invisible.length,played:blocks.filter(el=>el.dataset.homeMotion==='played').length,blocks:blocks.map(el=>({id:el.id||'footer',height:el.getBoundingClientRect().height,top:el.getBoundingClientRect().top+scrollY,text:el.textContent.replace(/\s+/g,' ').trim()}))};
      });
      assert(settled.scroll <= settled.client + 1, `Horizontal overflow at ${width}/${mode}`);
      assert(settled.invisible === 0 && settled.played === 10, `Invisible or missed section at ${width}/${mode}`);
      assert(settled.observers === 1, 'Expected one shared intersection observer');
      assert(settled.cls < 0.01, `Unexpected layout shift ${settled.cls}`);
      for (let index=0;index<before.length;index++) {
        assert(before[index].text === settled.blocks[index].text, 'Motion changed section copy');
        assert(Math.abs(before[index].height - settled.blocks[index].height) < 1, `Section resized ${before[index].id}: ${before[index].height} -> ${settled.blocks[index].height}`);
      }
      if (mode === 'reduce') assert(settled.runs === 0, 'Native effects ran under reduced motion');
      else assert(settled.runs > 20, 'Section entrance effects did not run');
      const runCount = settled.runs;
      await page.locator('#topo').scrollIntoViewIfNeeded();
      await page.locator('#como-funciona').scrollIntoViewIfNeeded();
      await page.locator('.home-message:nth-child(3)').scrollIntoViewIfNeeded();
      await page.locator('.home-footer').scrollIntoViewIfNeeded();
      await idle();
      assert(await page.evaluate(() => window.__homeMotionQA.runs.length) === runCount, 'An entrance repeated');

      const profileBoxes = [];
      for (const kind of ['PF','MEI','CNPJ','PF','CNPJ','MEI']) {
        await page.locator(`.home-audience-selector input[value="${kind}"]`).locator('..').click();
        await idle();
        profileBoxes.push(await page.locator('.home-audience-layout').evaluate(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width,top:el.getBoundingClientRect().top+scrollY})));
        assert(await page.locator('#para-quem').getByRole('region').count() === 1, 'Inactive profile exposed');
        assert(await page.locator('#para-quem').getByRole('button').count() === 1, 'Inactive quote button exposed');
      }
      for (const box of profileBoxes) assert(Math.abs(box.height-profileBoxes[0].height)<1 && Math.abs(box.top-profileBoxes[0].top)<1, 'Profile selection shifted the layout');
      await page.locator('.home-audience-selector input[value="MEI"]').focus();
      await page.keyboard.press('ArrowRight');
      assert(await page.locator('.home-audience-selector input[value="CNPJ"]').isChecked(), 'Radio arrow navigation failed');
      await page.keyboard.press('Tab');
      assert(await page.locator('#audience-panel-CNPJ button').evaluate(el=>document.activeElement===el), 'Profile Tab focus failed');
      await page.keyboard.press('Enter');
      assert(await page.locator('input[name="quote-contract-type"]:checked').inputValue() === 'CNPJ', 'Profile CTA changed quote kind');

      for (let index=0;index<5;index++) {
        const trigger = page.locator(`#faq-trigger-${index}`);
        await trigger.focus();
        await page.keyboard.press('Enter');
        await idle();
        assert(await trigger.getAttribute('aria-expanded') === 'true', 'FAQ did not expand');
        assert(await page.locator(`#faq-answer-${index}`).isVisible(), 'FAQ answer remained hidden');
        const faqMetrics = await page.locator(`#faq-answer-${index}`).evaluate(el=>({height:el.getBoundingClientRect().height,scroll:el.scrollHeight,padding:getComputedStyle(el.querySelector('p')).paddingTop}));
        assert(faqMetrics.scroll <= faqMetrics.height+1 && faqMetrics.padding === '16px', 'FAQ content clipped or spacing changed');
        await page.keyboard.press('Enter');
        await idle();
        assert(await trigger.getAttribute('aria-expanded') === 'false', 'FAQ did not collapse');
        assert(!await page.locator(`#faq-answer-${index}`).isVisible(), 'Closed FAQ remained visible');
        assert(await trigger.evaluate(el=>document.activeElement===el), 'FAQ lost focus');
      }
      if (width < 1024) {
        await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        await page.keyboard.press('Shift+Tab');
        assert(await dialog.evaluate(el=>el.contains(document.activeElement)), 'Menu lost keyboard focus');
        await page.keyboard.press('Escape');
        assert(await dialog.count() === 0, 'Mobile menu did not close');
        assert(await page.getByRole('button',{name:'Abrir menu',exact:true}).evaluate(el=>document.activeElement===el), 'Menu trigger focus not restored');
        await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
        await page.getByRole('dialog').locator('a[href="#faq"]').click();
      } else {
        await page.locator('.kds-public-header-navigation a[href="#faq"]').click();
      }
      await page.waitForFunction(()=>{
        const section = document.querySelector('#faq');
        return location.hash==='#faq' && Math.abs(section.getBoundingClientRect().top-parseFloat(getComputedStyle(section).scrollMarginTop))<3;
      });

      await page.locator('.home-quote-profiles input[value="PF"]').locator('..').click();
      await page.locator('#quote-lives').fill('2');
      await page.locator('#quote-range-0').fill('1');
      await page.locator('#quote-lives').fill('1');
      await page.locator('#quote-age').fill('35');
      await page.locator('#quote-name').fill('AB');
      await page.locator('#quote-phone').fill('21999999999');
      await page.locator('#quote-city').fill('Rio');
      await page.getByRole('option',{name:'Rio de Janeiro',exact:true}).click();
      const countBefore = mockedLeads.length;
      await page.locator('.home-quote-form button[type="submit"]').click();
      await page.locator('.home-quote-form .home-form-feedback[role="alert"]').waitFor();
      assert(mockedLeads.length === countBefore, 'Invalid form reached submission');
      assert(await page.locator('#quote-name').evaluate(el=>document.activeElement===el), 'Invalid field not focused');
      await page.locator('#quote-name').fill('Teste Motion');
      await page.locator('.home-quote-form button[type="submit"]').click();
      await page.locator('.home-quote-form[aria-busy="true"]').waitFor();
      assert(await page.locator('.home-quote-fields').evaluate(el=>el.disabled) && await page.locator('#quote-name').isDisabled(), 'Loading form fields not disabled');
      await page.waitForFunction(()=>document.querySelector('.home-quote-form').getAttribute('aria-busy')==='true');
      assert(typeof releaseLead === 'function', 'Mock request missing');
      releaseLead();
      await page.locator('.home-quote-form .home-form-feedback[role="status"]').waitFor();
      assert(mockedLeads.length === countBefore+1, 'Expected one mocked lead request');
      assert(await page.evaluate(()=>window.__homeMotionQA.opens.length) === 1, 'Expected one intercepted WhatsApp continuation');
      await page.locator('.home-whatsapp-copy > a').click();
      assert(await page.evaluate(()=>window.__homeMotionQA.whatsappClicks) === 1, 'WhatsApp CTA was not intercepted');
      await idle();
      assert(errors.length === 0 && pageErrors.length === 0, `Browser errors: ${JSON.stringify({errors,pageErrors})}`);
      results.push({width,mode,...settled,profiles:'stable',faq:'passed',menu:'passed',form:'mocked success and validation',whatsapp:'intercepted'});
    }
  }
  // Curated resting captures for each section in desktop and mobile.
  for (const width of [1440,390]) {
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width,height:width===390?2400:1100});
    await page.goto('http://127.0.0.1:5194/');
    await page.locator('.home-footer').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    for (const selector of sections) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      for (const img of await page.locator(`${selector} img:visible`).all()) await img.evaluate(el=>new Promise(resolve=>{if(el.complete)resolve();else el.addEventListener('load',resolve,{once:true});}));
      await idle();
      const client = await page.evaluate(()=>document.documentElement.clientWidth);
      await page.locator(selector).screenshot({path:`output/playwright/home-mobile/${width}-${selector.replace(/[.#]/g,'')}.png`,animations:'disabled',style:`.kifer-home {width:${client}px !important;} header {visibility:hidden!important;}`});
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('http://127.0.0.1:5194/');
    await page.locator('.home-hero').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`output/playwright/home-mobile/${width}-reduced.png`,animations:'disabled'});
  }
  return {results,errors,pageErrors,mockedLeadCount:mockedLeads.length};
}
