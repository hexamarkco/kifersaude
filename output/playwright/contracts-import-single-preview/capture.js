async (page) => {
  const base = 'http://127.0.0.1:5173/output/playwright/contracts-import-single-preview/index.html';
  const output = 'output/playwright/contracts-import-single-preview';
  const viewports = [[1920,1080],[768,1024],[390,844],[320,640]];
  const captured = [];
  for (const theme of ['light','dark']) {
    for (const [width,height] of viewports) {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}?theme=${theme}`);
      await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole('dialog').waitFor({ state: 'visible' });
      const path = `${output}/final-${theme}-${width}.png`;
      await page.screenshot({ path, fullPage: true, animations: 'disabled' });
      captured.push(path);
    }
  }
  const jsonPath = 'C:/Users/Nick Martins/Documents/GitHub/kifersaude/output/playwright/contracts-import-single-preview/contrato-invalido.json';
  const textPath = 'C:/Users/Nick Martins/Documents/GitHub/kifersaude/output/playwright/contracts-import-single-preview/contrato-demo.txt';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}?theme=light`);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('input[type="file"]').setInputFiles(textPath);
  await page.getByText('Selecione um arquivo com extensão .json.').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${output}/filename-error-390-light.png`, fullPage: true, animations: 'disabled' });
  captured.push(`${output}/filename-error-390-light.png`);

  await page.goto(`${base}?theme=light`);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('input[type="file"]').setInputFiles(jsonPath);
  await page.getByRole('button', { name: 'Validar arquivo' }).click();
  await page.locator('.kds-alert').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${output}/json-error-390-light.png`, fullPage: true, animations: 'disabled' });
  captured.push(`${output}/json-error-390-light.png`);

  const validPath = 'C:/Users/Nick Martins/Documents/GitHub/kifersaude/output/playwright/contracts-import-single-preview/contrato-demo.json';
  await page.goto(`${base}?theme=light`);
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('input[type="file"]').setInputFiles(validPath);
  await page.getByRole('button', { name: 'Validar arquivo' }).click();
  await page.getByText('Arquivo conferido', { exact: true }).waitFor({ state: 'visible' });
  await page.screenshot({ path: `${output}/validated-success-390-light.png`, fullPage: true, animations: 'disabled' });
  captured.push(`${output}/validated-success-390-light.png`);

  await page.goto(`${base}?theme=light`);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    const nativeText = File.prototype.text;
    Object.defineProperty(File.prototype, 'text', { configurable: true, value: function () {
      const selectedFile = this;
      return new Promise((resolve) => { window.__releaseContractJsonText = () => { void nativeText.call(selectedFile).then(resolve); }; });
    }});
  });
  await page.locator('input[type="file"]').setInputFiles(validPath);
  await page.getByRole('button', { name: 'Validar arquivo' }).click();
  await page.getByRole('button', { name: 'Validando JSON...' }).waitFor({ state: 'visible' });
  const loadingDisabled = await page.getByRole('button', { name: 'Validando JSON...' }).isDisabled();
  await page.screenshot({ path: `${output}/loading-320-light.png`, fullPage: true, animations: 'disabled' });
  captured.push(`${output}/loading-320-light.png`);
  await page.evaluate(() => window.__releaseContractJsonText?.());
  await page.getByText('Arquivo conferido', { exact: true }).waitFor({ state: 'visible' });
  return { captured, loadingDisabled, screenshotCount: captured.length };
}

