async (page) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5186/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar' }).click();
  const download = await downloadPromise;
  await page.locator('.kds-toast').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'kifersaude-ui-redesign/validacao/revisao-visual/config-ai/export-complete-desktop.png' });
  return { file: download.suggestedFilename(), toast: await page.locator('.kds-toast').innerText() };
}
