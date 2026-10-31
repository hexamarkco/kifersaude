async (page) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('http://127.0.0.1:5179/output/playwright/contracts-detail-preview/index.html');
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
  await page.evaluate(() => document.fonts.ready);
  const summary = page.locator('.kds-contract-detail-expanded > summary');
  const metrics = await summary.evaluate(el => {
    const text = el.querySelector('span');
    const r = el.getBoundingClientRect();
    return {
      label: el.innerText,
      documentWidth: document.documentElement.scrollWidth,
      summaryWidth: Math.round(r.width),
      labelWidth: text ? Math.round(text.getBoundingClientRect().width) : null,
      labelScrollWidth: text?.scrollWidth ?? null,
      labelClientWidth: text?.clientWidth ?? null,
      labelWhiteSpace: text ? getComputedStyle(text).whiteSpace : null,
    };
  });
  await page.screenshot({ path: 'output/playwright/contracts-detail-preview/contract-page-mobile-320-light-after.png', fullPage: true, animations: 'disabled' });
  return metrics;
}
