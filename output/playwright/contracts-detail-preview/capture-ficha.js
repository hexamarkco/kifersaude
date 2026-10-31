async (page) => {
  const base = 'http://127.0.0.1:5179/output/playwright/contracts-detail-preview/index.html';
  const output = 'output/playwright/contracts-detail-preview';
  const cases = [];
  const viewports = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '768x1024', width: 768, height: 1024 },
    { name: '390x844', width: 390, height: 844 },
    { name: '320x640', width: 320, height: 640 },
  ];
  const style = '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}';
  for (const theme of ['light', 'dark']) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(base);
      await page.addStyleTag({ content: style });
      await page.evaluate(() => document.fonts.ready);
      if (theme === 'dark') await page.locator('.painel-theme').evaluate(element => element.classList.add('theme-dark'));
      await page.getByRole('heading', { name: 'Ficha do contrato', exact: true }).waitFor({ state: 'visible' });
      const file = `${output}/ficha-${viewport.name}-${theme}-full.png`;
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
      const metrics = await page.evaluate(() => {
        const summary = document.querySelector('.kds-contract-detail-expanded > summary');
        const label = summary?.querySelector('span');
        const box = summary?.getBoundingClientRect();
        return {
          viewport: `${innerWidth}x${innerHeight}`,
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          disclosureText: summary?.textContent?.trim() ?? null,
          disclosureWidth: box ? Math.round(box.width) : null,
          disclosureLabelWidth: label ? Math.round(label.getBoundingClientRect().width) : null,
          disclosureLabelScrollWidth: label?.scrollWidth ?? null,
          disclosureLabelClientWidth: label?.clientWidth ?? null,
        };
      });
      cases.push({ file, theme, ...metrics });
      if (theme === 'light' && (viewport.width === 1920 || viewport.width === 390)) {
        const viewportFile = `${output}/ficha-${viewport.name}-light-viewport.png`;
        await page.screenshot({ path: viewportFile, animations: 'disabled' });
        cases.push({ file: viewportFile, theme, viewportCapture: true, ...metrics });
      }
    }
  }
  for (const viewport of [viewports[0], viewports[2]]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(base);
    await page.addStyleTag({ content: style });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.kds-contract-detail-expanded > summary').click();
    const file = `${output}/ficha-${viewport.name}-light-expanded-full.png`;
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
    cases.push({ file, expanded: true, viewport: `${viewport.width}x${viewport.height}` });
  }
  return { screenshots: cases.length, documentWidthsMatch: cases.every(item => !item.documentWidth || item.documentWidth === Number(item.viewport.split('x')[0])), cases };
}
