async (page) => {
  const url=new URL(page.url());
  if(!['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('Local preview only');
  const mobile=url.searchParams.has('mobile');
  const widths=mobile?[320,360,375,390,414,430,768,844]:[1024,1440,1920];
  const sections=['#topo','#prova-social','#para-quem','#como-funciona','#depoimentos','#quem-somos','#faq','#cotacao','#fale-agora','.home-footer'];
  const errors=[], submissions=[];
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  page.on('pageerror',error=>errors.push(error.message));
  await page.context().route('**/servicodados.ibge.gov.br/**',route=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[{"nome":"Rio de Janeiro"}]'}));
  await page.context().route('**/_vercel/**',route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.context().route('**/functions/v1/public-lead-submit',route=>{submissions.push(route.request().postDataJSON());return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"success":true}'});});
  await page.addInitScript(()=>{window.__photoOpened=[];window.open=url=>{window.__photoOpened.push(String(url));return null;};});
  const idle=()=>page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity));
  const results=[];
  for(const reducedMotion of ['no-preference','reduce']) {
    await page.emulateMedia({reducedMotion});
    for(const width of widths) {
      await page.setViewportSize({width,height:width===844?390:width<640?664:900});
      await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:60000});
      await page.locator('.home-footer').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      for(const selector of sections) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        for(const img of await page.locator(selector).locator('img:visible').all()) await img.evaluate(el=>el.decode());
        await page.waitForFunction(s=>document.querySelector(s).dataset.homeMotion==='played',selector);
        await idle();
      }
      const metrics=await page.evaluate(()=>{
        const box=s=>document.querySelector(s).getBoundingClientRect();
        const photoSelectors=['.home-luiza-photo','.home-trust-photo img','.home-audience-panel[aria-hidden="false"] img','.home-about-photo img','.home-quote-background img','.home-whatsapp-photo img'];
        const phone=box('.home-phone'),conversation=box('.home-phone-conversation');
        return {
          width:innerWidth,scroll:document.documentElement.scrollWidth,
          photos:photoSelectors.map(s=>{const el=document.querySelector(s),style=getComputedStyle(el);return {selector:s,src:el.getAttribute('src'),width:el.naturalWidth,height:el.naturalHeight,attributesMatch:Number(el.getAttribute('width'))===el.naturalWidth&&Number(el.getAttribute('height'))===el.naturalHeight,fit:style.objectFit,position:style.objectPosition,transform:style.transform};}),
          clipped:[...document.querySelectorAll('.kifer-home h1,.kifer-home h2,.kifer-home h3,.kifer-home p')].filter(el=>el.clientWidth&&!el.closest('[aria-hidden="true"]')&&el.scrollWidth>el.clientWidth+1).map(el=>el.textContent.slice(0,50)),
          phoneRatio:phone.height/phone.width,
          chatFits:[...document.querySelectorAll('.home-message')].filter(el=>getComputedStyle(el).display!=='none').every(el=>{const r=el.getBoundingClientRect();return r.top>=conversation.top-1&&r.bottom<=conversation.bottom+1&&el.scrollWidth<=el.clientWidth+1;}),
          heroClear:innerWidth>=640||box('.home-hero-portrait').top>=box('.home-hero-actions').bottom,
          benefitsClear:innerWidth>=1024||box('.home-quote-benefits').top>=box('.home-quote-background').bottom-1,
          quoteInputFont:getComputedStyle(document.querySelector('#quote-name')).fontSize,
        };
      });
      assert(metrics.scroll<=width+1&&!metrics.clipped.length,`Overflow: ${JSON.stringify(metrics)}`);
      assert(metrics.photos.every(p=>p.attributesMatch&&p.fit==='cover'),`Photo distortion/intrinsic dimensions: ${JSON.stringify(metrics)}`);
      assert(metrics.chatFits&&metrics.heroClear&&metrics.benefitsClear,`Overlap/clipped conversation: ${JSON.stringify(metrics)}`);
      if(width<640||width===844)assert(Math.abs(metrics.phoneRatio-2.1)<0.001,`Phone stretched at ${width}`);
      if(width<640)assert(metrics.quoteInputFont==='16px',`iOS input font at ${width}`);
      const positions=[];
      for(const kind of ['PF','MEI','CNPJ','PF']) {
        await page.locator(`.home-audience-selector input[value="${kind}"]`).locator('..').click();
        await idle();
        await page.locator(`#audience-panel-${kind} img`).evaluate(el=>el.decode());
        positions.push(await page.locator(`#audience-panel-${kind}`).evaluate(el=>{const panel=el.getBoundingClientRect(),cta=el.querySelector('button').getBoundingClientRect(),photo=el.querySelector('.home-audience-photo').getBoundingClientRect();return {height:panel.height,cta:cta.top+scrollY,photo:photo.top+scrollY,clear:innerWidth>=640||cta.bottom<=photo.top+1};}));
        assert(await page.locator('#para-quem').getByRole('region').count()===1,'Hidden profile exposed');
      }
      assert(positions.every(p=>p.clear&&['height','cta','photo'].every(key=>Math.abs(p[key]-positions[0][key])<1)),`Profiles shift at ${width}: ${JSON.stringify(positions)}`);
      await page.locator('#faq-trigger-0').click();
      await idle();
      assert(await page.locator('#faq-trigger-0').getAttribute('aria-expanded')==='true','FAQ failed');
      await page.locator('#faq-trigger-0').click();
      if(width<1024) {
        await page.getByRole('button',{name:'Abrir menu',exact:true}).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({state:'hidden'});
        assert(await page.getByRole('button',{name:'Abrir menu',exact:true}).evaluate(el=>el===document.activeElement),'Menu focus');
      }
      results.push({reducedMotion,...metrics,profiles:'stable',faq:'passed',menu:width<1024?'passed':'desktop'});
    }
  }
  // Read/write browser state only: the endpoint and window.open are intercepted above.
  await page.setViewportSize({width:mobile?390:1440,height:900});
  await page.goto(url.href,{waitUntil:'domcontentloaded'});
  await page.locator('#quote-name').fill('Teste de composição');
  await page.locator('#quote-phone').fill('21999999999');
  await page.locator('#quote-city').fill('Rio de Janeiro');
  await page.locator('#quote-lives').fill('2');
  await page.locator('#quote-range-0').waitFor();
  assert(await page.locator('.home-quote-form').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Age grid overflow');
  await page.locator('#quote-lives').fill('1');
  await page.locator('#quote-age').fill('35');
  await page.locator('#cotacao button[type="submit"]').click();
  await page.getByText('Pedido de cotação enviado. Continue no WhatsApp para falar com a Kifer.').first().waitFor();
  assert(submissions.length===1&&submissions[0].totalLives===1,'Mock submission failed');
  assert(await page.evaluate(()=>window.__photoOpened.length===1),'Confirmation redirect failed');
  assert(!errors.length,JSON.stringify(errors));
  return {results,form:'mocked success; age ranges rendered; no real endpoint or WhatsApp opened',errors};
}
