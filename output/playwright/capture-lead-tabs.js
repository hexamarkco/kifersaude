async page => {
  const root = 'kifersaude-ui-redesign/validacao/revisao-visual/lead-detail/states';
  const viewports = [{ name: 'desktop', width: 1920, height: 1080 }, { name: 'mobile', width: 390, height: 844 }, { name: 'mobile-320', width: 320, height: 640 }];
  const tabs = [
    { label: 'Visão geral', key: 'overview' },
    { label: 'Histórico', key: 'history' },
    { label: 'Follow-ups', key: 'follow-ups' },
    { label: 'Dados do lead', key: 'lead-data' },
  ];
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5177/painel/leads');
  await page.getByRole('button', { name: 'Ver detalhes do lead' }).first().waitFor();
  await page.getByRole('button', { name: 'Ver detalhes do lead' }).first().click();
  await page.getByRole('tablist', { name: 'Seções do lead' }).waitFor();
  const ensureTheme = async (dark) => {
    const label = dark ? 'Ativar tema escuro' : 'Ativar tema claro';
    if (await page.getByRole('button', { name: label }).count()) await page.getByRole('button', { name: label }).first().click();
    await page.waitForFunction((isDark) => Boolean(document.querySelector('.painel-theme.theme-dark')) === isDark, dark);
    await page.evaluate(() => document.fonts.ready);
  };
  const results = [];
  for (const dark of [false, true]) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await ensureTheme(dark);
    for (const tab of tabs) {
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.getByRole('tab', { name: tab.label }).click();
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(120);
        const theme = dark ? 'dark' : 'light';
        await page.screenshot({ path: `${root}/page-tab-${tab.key}-${theme}-${viewport.name}.png`, animations: 'disabled' });
        results.push(await page.evaluate(({ tab, viewport, theme }) => ({ tab: tab.label, viewport: `${viewport.width}x${viewport.height}`, theme, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, selectedTabInViewport: (() => { const selected = document.querySelector('[role="tab"][aria-selected="true"]'); const scroller = selected?.parentElement; if (!selected || !scroller) return false; const a = selected.getBoundingClientRect(); const b = scroller.getBoundingClientRect(); return a.left >= b.left && a.right <= b.right; })() }), { tab, viewport, theme }));
      }
    }
  }
  return results;
}
