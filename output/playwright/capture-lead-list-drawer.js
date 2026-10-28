async page => {
  const root = 'kifersaude-ui-redesign/validacao/revisao-visual/lead-detail';
  const viewports = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'mobile-320', width: 320, height: 640 },
  ];
  const results = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: '*, *::before, *::after { animation-duration: 0.01ms !important; animation-delay: 0ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; caret-color: transparent !important; }' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  if (await page.getByRole('dialog', { name: 'Detalhes do lead' }).count()) {
    await page.getByRole('button', { name: 'Fechar' }).click();
  }
  await page.getByRole('table').waitFor();
  for (const dark of [false, true]) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole('button', { name: 'Ver detalhes do lead' }).first().waitFor();
    const label = dark ? 'Ativar tema escuro' : 'Ativar tema claro';
    if (await page.getByRole('button', { name: label }).count()) await page.getByRole('button', { name: label }).first().click();
    await page.waitForFunction((isDark) => Boolean(document.querySelector('.painel-theme.theme-dark')) === isDark, dark);
    await page.getByRole('button', { name: 'Ver detalhes do lead' }).first().click();
    await page.getByRole('dialog', { name: 'Detalhes do lead' }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const theme = dark ? 'dark' : 'light';
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const body = page.locator('.kds-lead-details-drawer-body');
      await body.evaluate(element => { element.scrollTop = 0; });
      await page.waitForTimeout(120);
      await page.screenshot({ path: `${root}/${viewport.name}/lead-drawer-${theme}-viewport.png`, animations: 'disabled' });
      results.push(await page.evaluate(({ viewport, theme }) => ({
        state: 'lead-list-drawer', theme,
        viewport: `${viewport.width}x${viewport.height}`,
        layoutWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        drawerWidth: Math.round(document.querySelector('.kds-lead-details-drawer').getBoundingClientRect().width),
        bodyClientHeight: document.querySelector('.kds-lead-details-drawer-body').clientHeight,
        bodyScrollHeight: document.querySelector('.kds-lead-details-drawer-body').scrollHeight,
      }), { viewport, theme }));
      if (viewport.name === 'mobile-320' && !dark) {
        await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await page.waitForTimeout(120);
        await page.screenshot({ path: `${root}/states/lead-drawer-light-320-scroll-bottom.png`, animations: 'disabled' });
      }
      if ((viewport.name === 'desktop' || (viewport.name === 'mobile-320' && !dark))) {
        await page.getByRole('dialog', { name: 'Detalhes do lead' }).getByRole('button', { name: 'Mais ações do lead' }).click();
        await page.waitForTimeout(120);
        await page.screenshot({ path: `${root}/states/lead-drawer-actions-${theme}-${viewport.name}.png`, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(80);
      }
    }
    await page.getByRole('button', { name: 'Fechar' }).click();
  }
  return results;
}
