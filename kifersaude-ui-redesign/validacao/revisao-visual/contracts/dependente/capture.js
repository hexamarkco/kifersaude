async (page) => {
  const base = 'http://127.0.0.1:5199/output/playwright/contracts-detail-preview/index.html';
  const output = 'kifersaude-ui-redesign/validacao/revisao-visual/contracts/dependente';
  const viewports = [
    { name: 'desktop-1920x1080', width: 1920, height: 1080 },
    { name: 'tablet-768x1024', width: 768, height: 1024 },
    { name: 'mobile-390x844', width: 390, height: 844 },
    { name: 'mobile-320x640', width: 320, height: 640 },
  ];
  const results = [];
  const disableMotion = '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}';

  for (const theme of ['light', 'dark']) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(base);
      await page.addStyleTag({ content: disableMotion });
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('heading', { name: 'Ficha do contrato' }).waitFor({ state: 'visible' });

      if (theme === 'dark') {
        await page.locator('.painel-theme').evaluate((element) => element.classList.add('theme-dark'));
      }

      await page.locator('summary').click();
      await page.getByRole('button', { name: 'Adicionar dependente', exact: true }).click();
      await page.getByRole('heading', { name: 'Novo dependente' }).waitFor({ state: 'visible' });

      const dialog = page.locator('[role="dialog"]');
      const body = dialog.locator('.kds-dialog-body');
      const metrics = await page.evaluate(() => {
        const dialogElement = document.querySelector('[role="dialog"]');
        const bodyElement = dialogElement?.querySelector('.kds-dialog-body');
        const rect = dialogElement?.getBoundingClientRect();
        return {
          viewport: `${innerWidth}x${innerHeight}`,
          documentWidth: document.documentElement.scrollWidth,
          dialogWidth: Math.round(rect?.width ?? 0),
          dialogLeft: Math.round(rect?.left ?? 0),
          dialogRight: Math.round(rect?.right ?? 0),
          bodyClientHeight: bodyElement?.clientHeight ?? 0,
          bodyScrollHeight: bodyElement?.scrollHeight ?? 0,
        };
      });
      if (metrics.documentWidth !== viewport.width || metrics.dialogLeft < 0 || metrics.dialogRight > viewport.width) {
        throw new Error(`Overflow in ${theme} ${viewport.name}: ${JSON.stringify(metrics)}`);
      }

      const prefix = `${output}/dialog-${viewport.name}-${theme}`;
      await page.screenshot({ path: `${prefix}.png`, animations: 'disabled' });

      if (viewport.width <= 390) {
        await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        await page.screenshot({ path: `${prefix}-scrolled.png`, animations: 'disabled' });
        await body.evaluate((element) => { element.scrollTop = 0; });
      }

      if (theme === 'light' && viewport.width === 1920) {
        await page.getByRole('button', { name: 'Filho(a)', exact: true }).click();
        await page.getByRole('option', { name: 'Cônjuge' }).waitFor({ state: 'visible' });
        await page.screenshot({ path: `${output}/relacao-aberta-desktop-1920x1080-light.png`, animations: 'disabled' });
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Data de nascimento' }).click();
        await page.locator('.kds-dp-calendar').waitFor({ state: 'visible' });
        await page.screenshot({ path: `${output}/data-aberta-desktop-1920x1080-light.png`, animations: 'disabled' });
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: 'Salvar dependente' }).click();
        await page.getByRole('alert').first().waitFor({ state: 'visible' });
        await page.screenshot({ path: `${output}/validacao-desktop-1920x1080-light.png`, animations: 'disabled' });
      }

      if (theme === 'light' && viewport.width === 390) {
        await page.getByRole('button', { name: 'Salvar dependente' }).click();
        await page.getByRole('alert').first().waitFor({ state: 'visible' });
        await page.screenshot({ path: `${output}/validacao-mobile-390x844-light.png`, animations: 'disabled' });
      }

      results.push({ theme, ...metrics });
    }
  }

  return results;
}
