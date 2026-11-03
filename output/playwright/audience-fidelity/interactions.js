async (page) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  const results=[];
  for (const width of [390,1440]) {
    await page.setViewportSize({width,height:1000});
    await page.goto('http://127.0.0.1:5220/');
    await page.locator('#para-quem').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const profiles=[];
    for (const kind of ['PF','MEI','CNPJ','PF']) {
      await page.locator(`.home-audience-selector .kds-radio:has(input[value="${kind}"])`).click();
      const panel=page.locator('#audience-panel-'+kind);
      await panel.locator('img').evaluate(e=>e.decode());
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.waitForFunction(()=>!document.querySelector('#para-quem').getAnimations({subtree:true}).some(a=>a.playState==='running'));
      profiles.push(await panel.evaluate(el=>({height:el.getBoundingClientRect().height,ctaY:el.querySelector('button').getBoundingClientRect().y-el.getBoundingClientRect().y,visible:getComputedStyle(el).visibility==='visible',active:el.getAttribute('aria-hidden')==='false'})));
      await panel.locator('button').click();
      if (!(await page.locator(`input[name="quote-contract-type"][value="${kind}"]`).isChecked())) throw new Error('Quote profile mismatch: '+kind);
    }
    await page.locator('.home-audience-selector input[value="PF"]').focus();
    await page.keyboard.press('ArrowRight');
    if (!(await page.locator('.home-audience-selector input[value="MEI"]').isChecked())) throw new Error('Keyboard radio navigation failed');
    if (profiles.some(p=>!p.active||!p.visible||Math.abs(p.height-profiles[0].height)>1||Math.abs(p.ctaY-profiles[0].ctaY)>1)) throw new Error('Profile layout changed');
    results.push({width,normalMotion:true,stableProfiles:true,quoteProfileMatches:true,keyboardNavigation:true});
  }
  return results;
}
