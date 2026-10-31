async (page) => {
  await page.emulateMedia({reducedMotion:'no-preference'});
  const width=page.viewportSize()?.width||1440;
  await page.goto('http://127.0.0.1:5191/');
  await page.locator('.home-hero').waitFor();
  await page.waitForTimeout(1200);
  for(const section of ['#prova-social','#para-quem','#como-funciona','#depoimentos','#quem-somos','#faq','#cotacao','#fale-agora','.home-footer']) {
    await page.locator(section).evaluate(el=>el.scrollIntoView({behavior:'smooth',block:'start'}));
    await page.waitForTimeout(1350);
    if(section==='#para-quem') {
      for(const profile of ['MEI','CNPJ','PF']) {
        await page.locator(`input[name="audience-profile"][value="${profile}"]`).locator('..').click();
        await page.waitForTimeout(450);
      }
    }
    if(section==='#faq') {
      await page.locator('#faq-trigger-0').click();
      await page.waitForTimeout(750);
      await page.locator('#faq-trigger-1').click();
      await page.waitForTimeout(750);
    }
    if(section==='#cotacao') {
      await page.locator('#quote-name').focus();
      await page.waitForTimeout(600);
    }
    if(section==='#fale-agora' && width<640) {
      await page.locator('.home-message:nth-child(3)').evaluate(el=>el.scrollIntoView({behavior:'smooth',block:'center'}));
      await page.waitForTimeout(1200);
    }
  }
  await page.waitForTimeout(900);
  return {width,sections:10,form:'focus only',messages:'illustrative'};
}
