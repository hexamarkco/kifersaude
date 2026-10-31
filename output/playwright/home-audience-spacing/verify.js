async (page) => {
  await page.reload();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  const results = [];
  for (const width of [1920, 1440, 1024, 768, 640, 639, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.locator('.home-audience-layout').scrollIntoViewIfNeeded();
    const profiles = [];
    for (let index = 0; index < 3; index++) {
      await page.locator('.home-audience-selector .kds-radio').nth(index).click();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const active = page.locator('.home-audience-panel[aria-hidden="false"]');
      if (await page.locator('.home-audience-panel:visible').count() !== 1) throw new Error('Expected one visible profile');
      await active.locator('img').evaluate(img => img.decode());
      profiles.push(await page.evaluate(() => {
        const rect = (el) => {
          const box = el.getBoundingClientRect();
          return { x: box.x, y: box.y + scrollY, width: box.width, height: box.height };
        };
        const panel = document.querySelector('.home-audience-panel[aria-hidden="false"]');
        const selector = document.querySelector('.home-audience-selector');
        const layout = document.querySelector('.home-audience-layout');
        const box = rect(panel);
        const selectorBox = rect(selector);
        const gap = innerWidth >= 1024 ? box.x - selectorBox.x - selectorBox.width : box.y - selectorBox.y - selectorBox.height;
        return {
          selected: document.querySelector('.home-audience-selector input:checked').value,
          layout: rect(layout), selector: selectorBox, panel: box, gap,
          copy: rect(panel.querySelector('.home-audience-copy')),
          rows: [...panel.querySelector('.home-audience-copy').children].map(rect),
          photo: rect(panel.querySelector('.home-audience-photo')),
          options: [...selector.querySelectorAll('.kds-radio')].map(rect),
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: layout.scrollWidth,
        };
      }));
    }
    const baseline = profiles[0];
    for (const profile of profiles) {
      if (Math.abs(profile.gap - 16) > 0.5) throw new Error(`Expected 16px gap at ${width}: ${profile.gap}`);
      if (profile.layout.x < -0.5 || profile.layout.x + profile.layout.width > profile.clientWidth + 0.5 || profile.scrollWidth > profile.layout.width + 1) throw new Error(`Audience overflow at ${width}`);
      for (const key of ['layout', 'selector', 'panel', 'photo']) {
        for (const axis of ['x', 'y', 'width', 'height']) {
          if (Math.abs(profile[key][axis] - baseline[key][axis]) > 0.5) throw new Error(`${key}.${axis} changed at ${width}: ${profile.selected}`);
        }
      }
      for (let row = 0; row < profile.rows.length; row++) {
        if (Math.abs(profile.rows[row].y - baseline.rows[row].y) > 0.5) throw new Error(`Row ${row} shifted at ${width}: ${profile.selected}`);
      }
      for (let option = 0; option < profile.options.length; option++) {
        for (const axis of ['x', 'y', 'width', 'height']) {
          if (Math.abs(profile.options[option][axis] - baseline.options[option][axis]) > 0.5) throw new Error(`Option ${option} moved at ${width}: ${profile.selected}`);
        }
      }
    }
    results.push({ width, profiles });
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1100 });
    for (let index = 0; index < 3; index++) {
      await page.locator('.home-audience-selector .kds-radio').nth(index).click();
      await page.locator('.home-audience-panel[aria-hidden="false"] img').evaluate(img => img.decode());
      await page.locator('.home-audience-layout').screenshot({ path: `output/playwright/home-audience-spacing/after-${width}-${index}.png`, style: 'header { visibility: hidden !important; }' });
    }
  }
  return results;
}
