async page => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5177/painel/leads');
  await page.getByRole('heading', { name: 'Gestão de leads' }).waitFor();
  const lightControl = page.getByRole('button', { name: 'Ativar tema claro' }).first();
  if (await lightControl.count()) await lightControl.click();
  await page.getByRole('button', { name: 'Ver detalhes do lead' }).first().waitFor();
  await page.getByRole('button', { name: 'Ver detalhes do lead' }).first().click();
  await page.getByRole('dialog', { name: 'Detalhes do lead' }).waitFor();
  const drawer = await page.evaluate(() => ({
    dialogClass: document.querySelector('[role="dialog"]')?.className,
    documentScrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    leadSummary: document.querySelector('.kds-lead-details-drawer-summary')?.innerText,
  }));
  await page.getByRole('button', { name: 'Mais ações do lead' }).click();
  await page.getByRole('menuitem', { name: 'Abrir ficha completa' }).click();
  await page.getByRole('tablist', { name: 'Seções do lead' }).waitFor();
  return { drawer, fullPageOpened: await page.getByRole('heading', { name: 'Contato Demonstração 01' }).count() > 0, drawerClosed: await page.getByRole('dialog', { name: 'Detalhes do lead' }).count() === 0 };
}
