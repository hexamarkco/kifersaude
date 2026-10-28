async page => {
  const root = 'kifersaude-ui-redesign/validacao/revisao-visual/lead-detail';
  const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'mobile-320', width: 320, height: 640 },
  ];
  const results = [];
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('button', { name: 'Fechar' }).click();
  await page.getByRole('button', { name: 'Ativar tema escuro' }).first().click();
  await page.waitForFunction(() => document.querySelector('.painel-theme.theme-dark') !== null);
  await page.getByRole('button', { name: /Contato Demonstração 01/ }).first().click();
  await page.getByRole('dialog', { name: 'Detalhes do lead' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const body = page.locator('.kds-lead-details-drawer-body');
    await body.evaluate(element => { element.scrollTop = 0; });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${root}/${viewport.name}/lead-drawer-dark-viewport.png`, animations: 'disabled' });
    results.push(await page.evaluate(({ viewport }) => ({
      kind: 'drawer', theme: 'dark', viewport,
      viewportWidth: window.innerWidth,
      layoutWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      drawerWidth: Math.round(document.querySelector('.kds-lead-details-drawer').getBoundingClientRect().width),
      bodyClientHeight: document.querySelector('.kds-lead-details-drawer-body').clientHeight,
      bodyScrollHeight: document.querySelector('.kds-lead-details-drawer-body').scrollHeight,
    }), `${viewport.width}x${viewport.height}`));
    if (viewport.name === 'mobile-320') {
      await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${root}/states/lead-drawer-dark-320-scroll-bottom.png`, animations: 'disabled' });
    }
  }
  return results;
}
