async (page) => {
  page.setDefaultTimeout(10000);
  await page.reload();
  await page.locator('.home-hero-title').waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  const results = [];
  const viewports = [
    { width: 2560, height: 1440 }, { width: 1920, height: 1080 },
    { width: 1536, height: 864 }, { width: 1536, height: 760 },
    { width: 1366, height: 768 }, { width: 1280, height: 720 },
    { width: 1093, height: 614 }, { width: 1024, height: 576 },
    { width: 1023, height: 768 }, { width: 768, height: 1024 },
    { width: 640, height: 900 }, { width: 639, height: 900 },
    { width: 390, height: 844 }, { width: 320, height: 568 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo(0, 0));
    const metrics = await page.evaluate(() => {
      const measure = (selector) => {
        const el = document.querySelector(selector);
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return { height: rect.height, fontSize: style.fontSize, paddingTop: style.paddingTop, paddingBottom: style.paddingBottom, bottom: rect.bottom };
      };
      const overflowingControls = [...document.querySelectorAll('.kifer-home a, .kifer-home button, .kifer-home input, .kifer-home select')].filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && getComputedStyle(el).visibility !== 'hidden' && (rect.x < -1 || rect.right > document.documentElement.clientWidth + 1);
      }).map(el => el.textContent.trim() || el.getAttribute('aria-label') || el.id);
      const phone = document.querySelector('.home-phone').getBoundingClientRect();
      const whatsapp = document.querySelector('.home-whatsapp').getBoundingClientRect();
      return { viewport: { width: innerWidth, height: innerHeight }, mobile: matchMedia('(width < 640px)').matches, phoneClipped: phone.top < whatsapp.top - 1 || phone.bottom > whatsapp.bottom + 1, docWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
        overflowingControls, header: measure('.kds-public-header'), hero: measure('.home-hero'), title: measure('.home-hero-title'), lead: measure('.home-hero-description'), actions: measure('.home-hero-actions'), trust: measure('.home-trust'), audience: measure('.home-audience'), faq: measure('.home-faq'), about: measure('.home-about'), quote: measure('.home-quote'), whatsapp: measure('.home-whatsapp'), footer: measure('.home-footer') };
    });
    if (metrics.docWidth > metrics.clientWidth + 1 || metrics.overflowingControls.length) throw new Error(`Overflow at ${viewport.width}: ${JSON.stringify(metrics)}`);
    if (metrics.phoneClipped) throw new Error(`WhatsApp phone clipped at ${viewport.width}`);
    if (viewport.width >= 1024 && metrics.actions.bottom > viewport.height) throw new Error(`Hero actions below viewport at ${viewport.width}x${viewport.height}`);
    const profiles = [];
    for (const kind of ['PF', 'MEI', 'CNPJ']) {
      await page.locator(`.home-audience-selector input[value="${kind}"]`).locator('..').click();
      profiles.push(await page.locator('.home-audience-layout').evaluate(el => {
        const rect = el.getBoundingClientRect();
        const panel = el.querySelector('.home-audience-panel[aria-hidden="false"]');
        return { x: rect.x, y: rect.y + scrollY, width: rect.width, height: rect.height, rowY: [...panel.querySelector('.home-audience-copy').children].map(child => child.getBoundingClientRect().y + scrollY) };
      }));
    }
    for (const profile of profiles) {
      for (const key of ['x', 'y', 'width', 'height']) if (Math.abs(profile[key] - profiles[0][key]) > 0.5) throw new Error(`Profile ${key} shifted at ${viewport.width}`);
      profile.rowY.forEach((y, index) => { if (Math.abs(y - profiles[0].rowY[index]) > 0.5) throw new Error(`Profile row ${index} shifted at ${viewport.width}`); });
    }
    for (let index = 0; index < ([1536, 390, 320].includes(viewport.width) ? 5 : 0); index++) {
      await page.locator(`#faq-trigger-${index}`).click();
      if (!await page.locator(`#faq-answer-${index}`).isVisible()) throw new Error('FAQ did not open');
      if (await page.locator(`#faq-answer-${index} p`).evaluate(el => getComputedStyle(el).paddingTop) !== '16px') throw new Error('FAQ spacing regressed');
      await page.locator(`#faq-trigger-${index}`).click();
    }
    results.push({ ...metrics, profiles });
  }
  for (const viewport of [{ width: 1536, height: 760 }, { width: 1366, height: 768 }, { width: 1093, height: 614 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/home-responsive-scale/after-${viewport.width}x${viewport.height}.png`, animations: 'disabled' });
  }
  await page.setViewportSize({ width: 1536, height: 1000 });
  await page.locator('.home-audience-selector input[value="PF"]').locator('..').click();
  for (const [name, selector] of Object.entries({ trust: '.home-trust', audience: '.home-audience', about: '.home-about', faq: '.home-faq', quote: '.home-quote', whatsapp: '.home-whatsapp', footer: '.home-footer' })) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    for (const img of await page.locator(`${selector} img:visible`).all()) await img.evaluate(el => el.decode());
    await page.locator(selector).screenshot({ path: `output/playwright/home-responsive-scale/after-${name}-1536.png`, animations: 'disabled', style: 'header { visibility: hidden !important; }' });
  }
  return results;
}
