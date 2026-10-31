async (page) => {
  await page.getByRole('button', { name: 'Criar versão e ativar' }).click();
  await page.screenshot({ path: 'kifersaude-ui-redesign/validacao/revisao-visual/config-ai/validation-missing-prompt-desktop.png' });
  return await page.evaluate(() => ({ toast: document.querySelector('.kds-toast-viewport')?.getBoundingClientRect().toJSON(), footer: document.querySelector('.kds-ai-editor-footer')?.getBoundingClientRect().toJSON(), toastBottom: getComputedStyle(document.querySelector('.kds-toast-viewport')).bottom }));
}
