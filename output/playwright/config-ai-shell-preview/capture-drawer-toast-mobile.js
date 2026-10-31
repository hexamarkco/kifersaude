async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Criar versão e ativar' }).click();
  await page.screenshot({ path: 'kifersaude-ui-redesign/validacao/revisao-visual/config-ai/validation-missing-prompt-mobile-390.png' });
  return await page.evaluate(() => ({ viewport: [innerWidth, innerHeight], toast: document.querySelector('.kds-toast-viewport')?.getBoundingClientRect().toJSON(), footer: document.querySelector('.kds-ai-editor-footer')?.getBoundingClientRect().toJSON(), toastBottom: getComputedStyle(document.querySelector('.kds-toast-viewport')).bottom }));
}
