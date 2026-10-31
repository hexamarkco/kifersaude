async (page) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('http://127.0.0.1:5180/output/playwright/settings-padding-preview/index.html');
  await page.evaluate(() => document.fonts.ready);
  const result = await page.locator('button').evaluate(button => {
    const style = getComputedStyle(button);
    const rect = button.getBoundingClientRect();
    const content = button.querySelector('.min-w-0')?.getBoundingClientRect();
    return {
      className: button.className,
      computedPadding: style.padding,
      paddingTokens: getComputedStyle(document.querySelector('.painel-theme')).getPropertyValue('--card-padding-sm'),
      width: rect.width,
      contentLeft: content?.left,
      buttonLeft: rect.left,
      visibleCSSRules: Array.from(document.styleSheets).flatMap(sheet => { try { return Array.from(sheet.cssRules); } catch { return []; } }).filter(rule => rule.cssText?.includes('kds-card-padding-sm')).map(rule => rule.cssText),
    };
  });
  await page.screenshot({ path: 'output/playwright/settings-padding-preview/before.png' });
  return result;
}
