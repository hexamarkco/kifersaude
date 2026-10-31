async (page) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5186/');
  await page.getByRole('button', { name: 'Configurar Reescrita de Mensagem' }).click();
  await page.getByRole('button', { name: 'Restaurar padrão' }).click();
  await page.locator('.kds-toast').waitFor({ state: 'visible' });
  await page.screenshot({ path: 'kifersaude-ui-redesign/validacao/revisao-visual/config-ai/editor-reset-defaults-desktop.png' });
  return { toast: await page.locator('.kds-toast').innerText(), toastRect: await page.locator('.kds-toast-viewport').evaluate(el => el.getBoundingClientRect().toJSON()), footer: await page.locator('.kds-ai-editor-footer').evaluate(el => el.getBoundingClientRect().toJSON()) };
}
