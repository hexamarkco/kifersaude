async (page) => {
  await page.reload();
  await page.locator('.home-luiza-photo').waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  const expected = {
    hero: ['.home-hero-portrait', '/images/home/luiza-hero.png'],
    about: ['.home-about-photo', '/images/home/luiza-about.png'],
    whatsapp: ['.home-whatsapp-photo', '/images/home/luiza-whatsapp.png'],
  };
  const results = [];
  for (const viewport of [{width:1920,height:1080},{width:1536,height:760},{width:1366,height:768},{width:1093,height:614},{width:1024,height:768},{width:1023,height:900},{width:768,height:1024},{width:640,height:900},{width:639,height:900},{width:390,height:844},{width:320,height:568}]) {
    await page.setViewportSize(viewport);
    const photos = [];
    for (const [name, [selector, src]] of Object.entries(expected)) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      await page.waitForFunction(selector => {
        const img = document.querySelector(`${selector} img`);
        return img.complete && img.naturalWidth > 0;
      }, selector, { timeout: 15000 });
      const metrics = await page.locator(`${selector} img`).evaluate(async img => {
        await img.decode();
        const rect = img.getBoundingClientRect();
        const frame = img.parentElement.getBoundingClientRect();
        return { src: img.getAttribute('src'), naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, width: rect.width, height: rect.height, frameWidth: frame.width, frameHeight: frame.height, fit: getComputedStyle(img).objectFit, position: getComputedStyle(img).objectPosition };
      });
      if (metrics.src !== src || metrics.naturalWidth !== 1672 || metrics.naturalHeight !== 941 || metrics.fit !== 'cover') throw new Error(`Wrong image or sizing for ${name}`);
      if (Math.abs(metrics.width - metrics.frameWidth) > 1 || Math.abs(metrics.height - metrics.frameHeight) > 1 || metrics.height < 100) throw new Error(`Photo does not fill its frame: ${name} at ${viewport.width}`);
      photos.push({ name, ...metrics });
    }
    const pageMetrics = await page.evaluate(() => {
      const phone = document.querySelector('.home-phone').getBoundingClientRect();
      const visual = document.querySelector('.home-whatsapp-visual').getBoundingClientRect();
      const photo = document.querySelector('.home-whatsapp-photo').getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, docWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, phoneClipped: phone.top < visual.top - 1 || phone.bottom > visual.bottom + 1, photoOccluded: matchMedia('(width < 1024px)').matches && phone.top < photo.bottom - 1, ogImage: document.querySelector('meta[property="og:image"]').content };
    });
    if (pageMetrics.docWidth > pageMetrics.clientWidth + 1 || pageMetrics.phoneClipped || pageMetrics.photoOccluded) throw new Error(`Layout overflow or obscured photo at ${viewport.width}`);
    if (!pageMetrics.ogImage.endsWith('/images/home/luiza-hero.png')) throw new Error('Wrong social preview image');
    results.push({ ...pageMetrics, photos });
  }
  await page.setViewportSize({ width: 1536, height: 760 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({path:'output/playwright/home-luiza-photos/hero-1536.png',animations:'disabled'});
  for (const width of [1536,768,390]) {
    await page.setViewportSize({width,height:1600});
    for (const [name, selector] of Object.entries({hero:'.home-hero',about:'.home-about',whatsapp:'.home-whatsapp'})) {
      if (width === 1536 && name === 'hero') continue;
      await page.locator(selector).screenshot({path:`output/playwright/home-luiza-photos/${name}-${width}.png`,animations:'disabled',style:'header { visibility:hidden !important; }'});
    }
  }
  return results;
}
