async (page) => {
  const results = [];
  const cases = [
    { name: 'desktop-light', width: 1920, height: 1080, dark: false },
    { name: 'desktop-dark', width: 1920, height: 1080, dark: true },
    { name: 'mobile-light', width: 390, height: 844, dark: false },
    { name: 'mobile-dark', width: 390, height: 844, dark: true },
  ];
  for (const item of cases) {
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.goto('http://127.0.0.1:5174/output/playwright/settings-padding-preview/index.html');
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    if (item.dark) await page.locator('.painel-theme').evaluate(element => element.classList.add('theme-dark'));
    const geometry = await page.locator('.kds-settings-catalog-link').first().evaluate(button => {
      const title = button.querySelector('.min-w-0');
      const buttonRect = button.getBoundingClientRect();
      return { padding: getComputedStyle(button).padding, inset: Math.round(title.getBoundingClientRect().left - buttonRect.left), viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth };
    });
    const screenshotPath = `C:/Users/Nick Martins/Documents/GitHub/kifersaude/kifersaude-ui-redesign/validacao/revisao-visual/config/settings-catalog-links-${item.name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
    results.push({ file: screenshotPath, ...geometry });
  }
  return results;
}
