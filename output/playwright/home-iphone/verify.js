async (page) => {
  if (!['127.0.0.1', 'localhost'].includes(new URL(page.url()).hostname)) throw new Error('Use a local preview.');
  const base = new URL('/', page.url()).href;
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/_vercel/speed-insights/script.js', route => route.fulfill({contentType:'application/javascript',body:''}));
  await page.context().route('**/servicodados.ibge.gov.br/**', route => route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[{"nome":"Rio de Janeiro"}]'}));
  await page.context().route('**/functions/v1/public-lead-submit', route => route.abort());
  const idle = () => page.waitForFunction(() => !document.getAnimations().some(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity));
  const sections = ['#topo','#prova-social','#para-quem','#como-funciona','#depoimentos','#quem-somos','#faq','#cotacao','#fale-agora','.home-footer'];
  const results = [];
  // The last portrait case also checks returning from landscape without reloading.
  const viewports = [[320,700],[360,740],[375,700],[390,664],[414,736],[430,740],[844,390],[390,664]];
  for (const reducedMotion of ['no-preference','reduce']) {
    await page.emulateMedia({reducedMotion});
    for (const [index, [width,height]] of viewports.entries()) {
      await page.setViewportSize({width,height});
      if (index !== viewports.length-1) await page.goto(base);
      await page.locator('.home-footer').waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (const selector of sections) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.waitForFunction(selector => document.querySelector(selector).dataset.homeMotion === 'played', selector);
        await idle();
      }
      await page.locator('.home-message:nth-child(3)').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('.home-phone').dataset.homeMotion === 'played');
      await idle();
      const geometry = await page.evaluate(() => {
        const box = selector => document.querySelector(selector).getBoundingClientRect();
        const phone = box('.home-phone'), screen = box('.home-phone-screen'), conversation = box('.home-phone-conversation');
        const latestMessages = [...document.querySelectorAll('.home-message')].slice(-3).map(el => {
          const rect = el.getBoundingClientRect();
          return {top:rect.top-conversation.top,bottom:rect.bottom-conversation.top,height:rect.height,overflow:el.scrollHeight>el.clientHeight+1};
        });
        const visibleMessages = [...document.querySelectorAll('.home-message')].filter(el=>getComputedStyle(el).display!=='none').map(el=>{
          const rect=el.getBoundingClientRect();
          return {top:rect.top-conversation.top,bottom:rect.bottom-conversation.top};
        });
        return {
          width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
          phone:{width:phone.width,height:phone.height,ratio:phone.height/phone.width},
          screenInside:screen.bottom<=phone.bottom&&screen.top>=phone.top,
          inputInside:box('.home-phone-input').bottom<=screen.bottom,
          conversationHeight:conversation.height,latestMessages,visibleMessages,
          scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,
          clipped:[...document.querySelectorAll('.kifer-home h1,.kifer-home h2,.kifer-home h3,.kifer-home p')].filter(el=>el.clientWidth>0&&!el.closest('[aria-hidden="true"]')&&el.scrollWidth>el.clientWidth+1).map(el=>el.textContent.slice(0,60)),
          inputFont:getComputedStyle(document.querySelector('#quote-name')).fontSize,
          heroPhotoBelowActions:box('.home-hero-portrait').top>=box('.home-hero-actions').bottom-1,
          quoteCopyBelowPhoto:box('.home-quote-copy>.home-lead').top>=box('.home-quote-background').bottom-1,
          quoteBenefitsBelowForm:box('.home-quote-benefits').top>=box('.home-quote-form').bottom-1,
        };
      });
      assert(geometry.scroll<=geometry.client+1&&!geometry.clipped.length, `Overflow: ${JSON.stringify(geometry)}`);
      assert(geometry.screenInside&&geometry.inputInside, `Phone chrome escaped: ${width}`);
      assert(Math.abs(geometry.phone.ratio-2.1)<0.001, `Stretched phone: ${width}`);
      assert(geometry.latestMessages.every(message=>message.top>=-1&&message.bottom<=geometry.conversationHeight+1&&!message.overflow), `Clipped latest messages: ${JSON.stringify(geometry)}`);
      assert(geometry.visibleMessages.every(message=>message.top>=-1&&message.bottom<=geometry.conversationHeight+1), `Clipped chat history: ${JSON.stringify(geometry)}`);
      if (width<640) {
        assert(geometry.inputFont==='16px'&&geometry.heroPhotoBelowActions&&geometry.quoteCopyBelowPhoto&&geometry.quoteBenefitsBelowForm, `Mobile block order: ${width}`);
        const stable = await page.locator('.home-phone').evaluate(el => {
          const before = el.getBoundingClientRect();
          const clone = el.querySelector('.home-message:last-child').cloneNode(true);
          clone.textContent = clone.textContent.repeat(10);
          el.querySelector('.home-phone-conversation').append(clone);
          const after = el.getBoundingClientRect();
          clone.remove();
          return before.width===after.width&&before.height===after.height;
        });
        assert(stable, 'Chat history changed the phone proportions');
      }
      const profiles = [];
      for (const kind of ['PF','MEI','CNPJ','PF','CNPJ','MEI']) {
        await page.locator(`.home-audience-selector input[value="${kind}"]`).locator('..').tap();
        await idle();
        const value = await page.locator(`#audience-panel-${kind}`).evaluate(el => {
          const panel = el.getBoundingClientRect(), cta = el.querySelector('button').getBoundingClientRect(), photo = el.querySelector('.home-audience-photo').getBoundingClientRect();
          return {height:panel.height,top:panel.top+scrollY,ctaTop:cta.top+scrollY,photoTop:photo.top+scrollY,clear:cta.bottom<=photo.top+1};
        });
        assert(width>=640||value.clear, `Profile CTA overlaps photo: ${kind}`);
        assert(await page.locator('#para-quem').getByRole('region').count()===1, 'Inactive profile exposed');
        profiles.push(value);
      }
      for (const value of profiles) assert(['height','top','ctaTop','photoTop'].every(key=>Math.abs(value[key]-profiles[0][key])<1), `Profile selection shifted content at ${width}: ${JSON.stringify(profiles)}`);
      await page.getByRole('button',{name:'Abrir menu',exact:true}).tap();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({state:'hidden'});
      // Safari does not focus a button after a touch. Check focus restoration separately with keyboard entry.
      await page.getByRole('button',{name:'Abrir menu',exact:true}).focus();
      await page.keyboard.press('Enter');
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({state:'hidden'});
      assert(await page.getByRole('button',{name:'Abrir menu',exact:true}).evaluate(el=>document.activeElement===el), 'Menu focus not restored');
      await page.locator('#faq-trigger-1').tap();
      await page.locator('#faq-answer-1').waitFor();
      await idle();
      assert(await page.locator('#faq-trigger-1').getAttribute('aria-expanded')==='true', 'FAQ touch failed');
      await page.locator('#faq-trigger-1').tap();
      if (width===390&&index===3&&reducedMotion==='reduce') {
        await page.locator('.home-audience-selector input[value="PF"]').locator('..').tap();
        await idle();
        for (const selector of sections) {
          for (const img of await page.locator(selector).locator('img:visible').all()) await img.evaluate(el=>el.decode().catch(()=>{}));
          await page.locator(selector).screenshot({path:`output/playwright/home-iphone/390-webkit-${selector.replace(/[.#]/g,'')}.png`,scale:'css',animations:'disabled',style:'header,.home-skip-link{visibility:hidden!important;}'});
        }
        await page.locator('.home-whatsapp-visual').screenshot({path:'output/playwright/home-iphone/390-webkit-phone.png',scale:'css',animations:'disabled',style:'header,.home-skip-link{visibility:hidden!important;}'});
      }
      if (width===844&&reducedMotion==='reduce') await page.locator('.home-phone').screenshot({path:'output/playwright/home-iphone/844-webkit-phone.png',scale:'css',animations:'disabled',style:'header,.home-skip-link{visibility:hidden!important;}'});
      results.push({reducedMotion,rotatedBack:index===viewports.length-1,...geometry,profiles:'stable',touchMenu:'passed',touchFaq:'passed'});
    }
  }
  assert(!errors.length, `Runtime errors: ${JSON.stringify(errors)}`);
  return {results,errors};
}
