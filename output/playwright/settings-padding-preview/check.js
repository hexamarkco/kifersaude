async (page) => {
  const sizes = [{ width: 1920, height: 1080 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 640 }];
  const checks = [];
  for (const size of sizes) for (const theme of ['light', 'dark']) {
    await page.setViewportSize(size);
    await page.goto('http://127.0.0.1:5180/output/playwright/settings-padding-preview/index.html');
    await page.evaluate(() => document.fonts.ready);
    if (theme === 'dark') await page.locator('.painel-theme').evaluate(el => el.classList.add('theme-dark'));
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    const geometry = await page.locator('button[aria-label="Abrir perfis e acessos"]').evaluate(button => {
      const title = button.querySelector('span.min-w-0 > span');
      const icon = button.querySelector('svg');
      const rect = button.getBoundingClientRect();
      return {
        viewport: `${innerWidth}x${innerHeight}`,
        documentWidth: document.documentElement.scrollWidth,
        contentPadding: getComputedStyle(button.querySelector('.kds-card-padding-sm')).padding,
        titleInset: Math.round(title.getBoundingClientRect().left - rect.left),
        iconInset: Math.round(rect.right - icon.getBoundingClientRect().right),
      };
    });
    checks.push({ ...geometry, theme });
    if (size.width === 390 && theme === 'light') {
      await page.locator('button[aria-label="Abrir perfis e acessos"]').hover();
      await page.screenshot({ path: 'output/playwright/settings-padding-preview/atalho-hover-mobile-light.png', fullPage: true, animations: 'disabled' });
    }
  }
  return checks;
}
