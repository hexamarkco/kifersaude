async (page) => {
  const results = [];
  for (const size of [{ name: 'desktop', width: 1920, height: 1080 }, { name: 'mobile', width: 390, height: 844 }]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('http://127.0.0.1:5180/output/playwright/settings-padding-preview/index.html');
      await page.evaluate(() => document.fonts.ready);
      if (theme === 'dark') await page.locator('.painel-theme').evaluate(element => element.classList.add('theme-dark'));
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
      const state = await page.locator('button[aria-label="Abrir perfis e acessos"]').evaluate(button => {
        const style = getComputedStyle(button);
        const content = button.querySelector('.kds-card-padding-sm');
        return {
          viewport: `${innerWidth}x${innerHeight}`,
          documentWidth: document.documentElement.scrollWidth,
          buttonPadding: style.padding,
          contentPadding: content ? getComputedStyle(content).padding : null,
          textInset: content ? Math.round(content.getBoundingClientRect().left - button.getBoundingClientRect().left) : null,
        };
      });
      const file = `output/playwright/settings-padding-preview/atalhos-${size.name}-${theme}.png`;
      await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
      results.push({ file, theme, ...state });
    }
  }
  return results;
}
