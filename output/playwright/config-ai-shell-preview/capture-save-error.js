async (page) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5186/');
  await page.getByRole('tab', { name: 'Configurações globais' }).click();
  await page.locator('textarea[placeholder="Digite instruções globais..."]').fill('Rascunho local para testar o estado de erro ao salvar.');
  await page.getByRole('button', { name: 'Salvar instruções' }).click();
  await page.locator('[role="alert"]', { hasText: 'Ação de gravação bloqueada' }).waitFor({ state: 'visible' });
  await page.screenshot({ path: 'kifersaude-ui-redesign/validacao/revisao-visual/config-ai/global-config-save-error-desktop.png' });
  return await page.locator('[role="alert"]').innerText();
}
