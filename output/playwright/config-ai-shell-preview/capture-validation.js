async (page) => {
  await page.getByRole('tab', { name: 'Funcionalidades' }).click();
  await page.getByRole('button', { name: 'Configurar Reescrita de Mensagem' }).click();
  await page.locator('textarea[placeholder="Descreva como a IA deve agir nesta tarefa..."]').fill('');
  await page.getByRole('button', { name: 'Criar versão e ativar' }).click();
  await page.screenshot({ path: 'kifersaude-ui-redesign/validacao/revisao-visual/config-ai/validation-missing-prompt-desktop.png' });
}
