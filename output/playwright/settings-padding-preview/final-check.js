async (page) => {
  const cases = [
    { width: 1920, height: 1080, theme: 'light', file: 'settings-catalog-links-desktop-light.png' },
    { width: 1920, height: 1080, theme: 'dark', file: 'settings-catalog-links-desktop-dark.png' },
    { width: 768, height: 1024, theme: 'light', file: 'settings-catalog-links-tablet-light.png' },
    { width: 768, height: 1024, theme: 'dark', file: 'settings-catalog-links-tablet-dark.png' },
    { width: 390, height: 844, theme: 'light', file: 'settings-catalog-links-mobile-light.png' },
    { width: 390, height: 844, theme: 'dark', file: 'settings-catalog-links-mobile-dark.png' },
    { width: 320, height: 640, theme: 'light', file: 'settings-catalog-links-compact-light.png' },
    { width: 320, height: 640, theme: 'dark', file: 'settings-catalog-links-compact-dark.png' },
  ];
  const root = 'C:/Users/Nick Martins/Documents/GitHub/kifersaude/kifersaude-ui-redesign/validacao/revisao-visual/config/';
  const results = [];

  for (const item of cases) {
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.goto('http://127.0.0.1:5180/output/playwright/settings-padding-preview/index.html');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
    if (item.theme === 'dark') await page.locator('.painel-theme').evaluate(element => element.classList.add('theme-dark'));

    const metrics = await page.getByRole('button', { name: 'Abrir perfis e acessos' }).evaluate(button => {
      const content = button.querySelector('.kds-settings-catalog-link-content');
      const text = content.querySelector('.min-w-0');
      const arrow = content.querySelector('svg');
      const buttonBounds = button.getBoundingClientRect();
      const contentBounds = content.getBoundingClientRect();
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        buttonPadding: getComputedStyle(button).padding,
        contentPadding: getComputedStyle(content).padding,
        leftInset: Math.round(text.getBoundingClientRect().left - buttonBounds.left),
        rightInset: Math.round(buttonBounds.right - arrow.getBoundingClientRect().right),
        innerWidth: Math.round(contentBounds.width),
      };
    });
    if (metrics.width !== metrics.scrollWidth || metrics.leftInset !== 20 || metrics.rightInset !== 20) {
      throw new Error(item.file + ': ' + JSON.stringify(metrics));
    }
    await page.screenshot({ path: root + item.file, fullPage: true, animations: 'disabled', caret: 'hide' });
    results.push({ ...item, ...metrics });
  }

  return results;
}
