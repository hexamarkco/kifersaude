async (page) => {
  await page.locator('#home-title').waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  const report = [];
  for (const width of [320, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
    const sections = page.locator('main > section, footer');
    for (let index = 0; index < await sections.count(); index++) {
      const section = sections.nth(index);
      await section.scrollIntoViewIfNeeded();
      await section.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
      const id = await section.getAttribute('id') || 'rodape';
      await section.screenshot({ path: `output/playwright/home-redesign/${width}/${String(index + 1).padStart(2, '0')}-${id}.png`, style: '.kds-public-header, .home-skip-link { visibility: hidden !important; }' });
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/home-redesign/${width}/page.png`, fullPage: true });
    await page.screenshot({ path: `output/playwright/home-redesign/${width}/viewport.png` });
    report.push(await page.evaluate(() => ({
      width: innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('main h1, main h2, main h3, main p, main button, main label, footer a')].filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1);
      }).map(element => element.textContent.slice(0, 90)),
      brokenImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).map(image => image.src),
      sections: [...document.querySelectorAll('main > section, footer')].map(section => ({ id: section.id || 'rodape', height: Math.round(section.getBoundingClientRect().height) })),
    })));
  }
  if (report.some(item => item.scrollWidth > item.clientWidth || item.overflow.length || item.brokenImages.length)) throw new Error(JSON.stringify(report));
  return report;
}
