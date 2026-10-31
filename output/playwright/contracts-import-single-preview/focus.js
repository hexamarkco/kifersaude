async (page) => {
  await page.goto('http://127.0.0.1:5173/output/playwright/contracts-import-single-preview/index.html?theme=light');
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('button', { name: 'Fechar' }).click();
  const launcher = page.getByRole('button', { name: 'Abrir importação de arquivo' });
  await launcher.click();
  await page.getByRole('dialog').waitFor();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const focusAfterOpen = await page.evaluate(() => {
    const focused = document.activeElement;
    return focused instanceof HTMLElement ? { tag: focused.tagName, label: focused.getAttribute('aria-label'), text: focused.innerText } : null;
  });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const focusReturnedToLauncher = await launcher.evaluate((el) => document.activeElement === el);
  return { focusAfterOpen, focusReturnedToLauncher, dialogClosedByEscape: await page.getByRole('dialog').count() === 0 };
}
