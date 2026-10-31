async (page) => {
  await page.goto('http://127.0.0.1:5174/design-system#components');
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addStyleTag({ content: '*,:before,:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
  await page.evaluate(() => {
    document.querySelector('#title-row-preview')?.remove();
    const preview = document.createElement('div');
    preview.id = 'title-row-preview';
    preview.className = 'painel-theme kifer-ds theme-dark';
    preview.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#17120e;padding:24px;';
    preview.innerHTML = `
      <div class="kds-card" style="width:224px;padding:16px;background:#211a14;border:1px solid #3a2b1e;border-radius:12px;">
        <div class="flex min-w-0 items-center gap-3">
          <div class="kds-card-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 8v4m0 4h.01M4 20h16L12 4 4 20Z"/></svg></div>
          <div class="kds-card-title-row min-w-0 flex-1">
            <h4 class="kds-heading kds-heading-md kds-card-title">Envio automático</h4>
            <span class="kds-tooltip-anchor"><button type="button" class="kds-info-trigger" aria-label="Informações sobre o processamento dos fluxos"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg></button></span>
          </div>
        </div>
      </div>`;
    document.body.append(preview);
  });
  const metrics = await page.locator('#title-row-preview .kds-card-title-row').evaluate((row) => {
    const title = row.querySelector('.kds-card-title').getBoundingClientRect();
    const info = row.querySelector('.kds-tooltip-anchor').getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      row: { x: row.getBoundingClientRect().x, y: row.getBoundingClientRect().y, width: row.getBoundingClientRect().width, flexWrap: getComputedStyle(row).flexWrap },
      title: { x: title.x, y: title.y, width: title.width, height: title.height, right: title.right, bottom: title.bottom },
      info: { x: info.x, y: info.y, width: info.width, height: info.height, right: info.right, bottom: info.bottom },
      documentWidth: document.documentElement.scrollWidth,
    };
  });
  if (metrics.info.x < metrics.title.right - 1 || metrics.info.bottom < metrics.title.y || metrics.info.y > metrics.title.bottom || metrics.documentWidth > metrics.viewport.width) {
    throw new Error(`Information icon is not aligned beside the title: ${JSON.stringify(metrics)}`);
  }
  await page.screenshot({ path: 'output/playwright/config-title-row-preview.png', fullPage: false, animations: 'disabled' });
  await page.locator('#title-row-preview .kds-card').screenshot({ path: 'output/playwright/config-title-row-card.png', animations: 'disabled' });
  return metrics;
}
