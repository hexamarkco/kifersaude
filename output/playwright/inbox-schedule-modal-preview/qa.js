async page => {
  const baseUrl = 'http://127.0.0.1:5176/output/playwright/inbox-schedule-modal-preview/';
  const output = 'kifersaude-ui-redesign/validacao/revisao-visual/inbox/schedule-message/';
  const results = [];

  async function capture(name, width, height, theme = 'light') {
    await page.setViewportSize({ width, height });
    await page.goto(`${baseUrl}?theme=${theme}`);
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const footer = dialog?.querySelector('.kds-dialog-footer');
      const body = dialog?.querySelector('.kds-dialog-body');
      const bounds = dialog?.getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        documentScrollWidth: document.documentElement.scrollWidth,
        dialog: bounds ? { width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right } : null,
        footerVisible: footer ? footer.getBoundingClientRect().bottom <= innerHeight : false,
        bodyScrolls: body ? body.scrollHeight > body.clientHeight : false,
      };
    });
    await page.screenshot({ path: `${output}${name}.png`, fullPage: true });
    results.push({ name, ...metrics });
  }

  await capture('desktop-light-1920', 1920, 1080);
  await capture('desktop-dark-1920', 1920, 1080, 'dark');
  await capture('tablet-light-768', 768, 1024);
  await capture('mobile-light-390', 390, 844);
  await capture('mobile-320-light', 320, 640);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${baseUrl}?theme=light`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('details > summary').click();
  await page.getByRole('button', { name: /Semanal/ }).click();
  const recurrenceEndVisible = await page.getByText('Repetir até').isVisible();
  const invalidRecurrenceSubmitDisabled = await page.getByRole('button', { name: 'Agendar mensagem' }).isDisabled();
  await page.screenshot({ path: `${output}desktop-options-weekly-validation.png`, fullPage: true });
  results.push({ state: 'weekly recurrence', recurrenceEndVisible, invalidRecurrenceSubmitDisabled });

  await page.goto(`${baseUrl}?theme=light`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('button', { name: 'Data e hora do envio' }).click();
  await page.screenshot({ path: `${output}desktop-date-picker-open.png`, fullPage: true });
  results.push({ state: 'date picker open', calendarVisible: await page.getByRole('dialog').getByRole('grid').isVisible().catch(() => false) });

  await page.goto(`${baseUrl}?theme=light`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('tab', { name: 'Criar sequência' }).click();
  await page.screenshot({ path: `${output}desktop-sequence-mode.png`, fullPage: true });
  results.push({ state: 'sequence mode', sequenceStepsVisible: await page.getByText('Etapas da sequência').isVisible() });

  console.log(JSON.stringify(results));
  return results;
}
