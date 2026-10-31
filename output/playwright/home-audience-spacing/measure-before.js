async (page) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  const results = [];
  for (const width of [1920, 1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('.home-audience-layout').scrollIntoViewIfNeeded();
    const profiles = [];
    for (let index = 0; index < 3; index++) {
      await page.locator('.home-audience-selector .kds-radio').nth(index).click();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      profiles.push(await page.evaluate(() => {
        const rect = (selector) => {
          const box = document.querySelector(selector).getBoundingClientRect();
          return { x: box.x, y: box.y + scrollY, width: box.width, height: box.height };
        };
        return { selected: document.querySelector('.home-audience-selector input:checked').value, layout: rect('.home-audience-layout'), selector: rect('.home-audience-selector'), panel: rect('.home-audience-panel'), copy: rect('.home-audience-copy'), title: rect('.home-audience-title'), cta: rect('.home-audience-copy button'), options: [...document.querySelectorAll('.home-audience-selector .kds-radio')].map(el => { const box = el.getBoundingClientRect(); return { y: box.y + scrollY, height: box.height }; }) };
      }));
      if (width === 1440 || width === 390) await page.locator('.home-audience-layout').screenshot({ path: `output/playwright/home-audience-spacing/before-${width}-${index}.png` });
    }
    results.push({ width, profiles });
  }
  return results;
}
