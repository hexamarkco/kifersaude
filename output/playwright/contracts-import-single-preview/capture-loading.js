async (page) => {
  const filePath = 'C:\\Users\\Nick Martins\\Documents\\GitHub\\kifersaude\\output\\playwright\\contracts-import-single-preview\\contrato-demo.json';
  await page.evaluate(() => {
    const nativeText = File.prototype.text;
    window.__releaseContractJsonText = null;
    Object.defineProperty(File.prototype, 'text', {
      configurable: true,
      value: function () {
        const selectedFile = this;
        return new Promise((resolve) => {
          window.__releaseContractJsonText = () => {
            void nativeText.call(selectedFile).then(resolve);
          };
        });
      },
    });
  });
  await page.locator('input[type="file"]').setInputFiles(filePath);
  await page.getByRole('button', { name: 'Validar arquivo' }).click();
  await page.getByRole('button', { name: 'Validando JSON...' }).waitFor({ state: 'visible' });
  await page.screenshot({
    path: 'output/playwright/contracts-import-single-preview/loading-320-light.png',
    fullPage: true,
  });
  const buttonDuringLoading = await page.getByRole('button', { name: 'Validando JSON...' }).isDisabled();
  await page.evaluate(() => window.__releaseContractJsonText?.());
  await page.getByText('Arquivo conferido', { exact: true }).waitFor();
  return { buttonDisabledDuringLoading: buttonDuringLoading, validationCompleted: true };
}
