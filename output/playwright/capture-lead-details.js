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
  const waitForStable = async () => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);
  };
  const setTheme = async (dark) => {
    const target = dark ? 'Ativar tema escuro' : 'Ativar tema claro';
    const count = await page.getByRole('button', { name: target }).count();
    if (count > 0) {
      await page.getByRole('button', { name: target }).first().click();
      await waitForStable();
    }
  };
  const metrics = async (kind, viewport, theme) => page.evaluate(({ kind, viewport, theme }) => {
    const element = kind === 'drawer' ? document.querySelector('.kds-lead-details-drawer') : document.querySelector('.kds-detail-workspace');
    const rect = element?.getBoundingClientRect();
    return {
      kind,
      viewport,
      theme,
      viewportWidth: window.innerWidth,
      layoutWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      surfaceWidth: rect ? Math.round(rect.width) : null,
    };
  }, { kind, viewport: `${viewport.width}x${viewport.height}`, theme });
  await page.goto('http://127.0.0.1:5177/painel/leads');
  await page.getByRole('button', { name: 'Abrir lead Contato Demonstração 01' }).waitFor();
  await page.getByRole('button', { name: 'Abrir lead Contato Demonstração 01' }).click();
  await page.getByRole('tablist', { name: 'Seções do lead' }).waitFor();
  await waitForStable();
  for (const dark of [false, true]) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await setTheme(dark);
    const theme = dark ? 'dark' : 'light';
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(() => window.scrollTo(0, 0));
      await waitForStable();
      const stem = `${root}/${viewport.name}/lead-detail-${theme}`;
      await page.screenshot({ path: `${stem}-viewport.png`, animations: 'disabled' });
      await page.screenshot({ path: `${stem}-full.png`, fullPage: true, animations: 'disabled' });
      results.push(await metrics('page', viewport, theme));
    }
  }
  await page.goto('http://127.0.0.1:5177/painel/dashboard?periodFilter=mes-atual');
  await page.getByRole('button', { name: /Contato Demonstração 01/ }).waitFor();
  await page.getByRole('button', { name: /Contato Demonstração 01/ }).first().click();
  await page.getByRole('dialog', { name: 'Detalhes do lead' }).waitFor();
  await waitForStable();
  for (const dark of [false, true]) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await setTheme(dark);
    const theme = dark ? 'dark' : 'light';
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const body = page.locator('.kds-lead-details-drawer-body');
      await body.evaluate(element => { element.scrollTop = 0; });
      await waitForStable();
      await page.screenshot({ path: `${root}/${viewport.name}/lead-drawer-${theme}-viewport.png`, animations: 'disabled' });
      results.push(await metrics('drawer', viewport, theme));
      if (viewport.name === 'mobile-320' && !dark) {
        await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await waitForStable();
        await page.screenshot({ path: `${root}/states/lead-drawer-light-320-scroll-bottom.png`, animations: 'disabled' });
      }
    }
  }
  return results;
}
