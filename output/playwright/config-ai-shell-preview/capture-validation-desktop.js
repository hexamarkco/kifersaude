async (page) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5186/');
  await page.getByRole('button', { name: 'Configurar Reescrita de Mensagem' }).click();
  await page.locator('textarea[placeholder="Descreva como a IA deve agir nesta tarefa..."]').fill('');
  await page.getByRole('button', { name: 'Criar versão e ativar' }).click();
  await page.locator('[role="alert"]').filter({ hasText: 'Preencha as instruções da IA' }).waitFor({ state: 'visible' });
  await page.screenshot({ path: 'kifersaude-ui-redesign/validacao/revisao-visual/config-ai/validation-missing-prompt-desktop.png' });
  return { error: await page.locator('[role="alert"]').innerText(), invalid: await page.locator('textarea[placeholder="Descreva como a IA deve agir nesta tarefa..."]').getAttribute('aria-invalid') };
}
