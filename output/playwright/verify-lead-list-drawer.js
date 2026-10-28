async page => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  if (await page.getByRole('dialog', { name: 'Detalhes do lead' }).count()) {
    await page.getByRole('button', { name: 'Fechar' }).click();
  }
  await page.getByRole('table').waitFor();
  const beforeRows = await page.getByRole('row').count();
  await page.getByRole('button', { name: 'Ver detalhes do lead' }).first().click();
  await page.getByRole('dialog', { name: 'Detalhes do lead' }).waitFor();
  const drawer = {
    tableVisible: await page.getByRole('table').isVisible(),
    rows: await page.getByRole('row').count(),
    leadName: await page.getByRole('dialog').getByText('Contato Demonstração 01', { exact: true }).count(),
    listScrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
    listClientWidth: await page.evaluate(() => document.documentElement.clientWidth),
  };
  await page.getByRole('dialog').getByRole('button', { name: 'Mais ações do lead' }).click();
  await page.getByRole('menuitem', { name: 'Abrir ficha completa' }).click();
  await page.getByRole('tablist', { name: 'Seções do lead' }).waitFor();
  return {
    beforeRows,
    drawer,
    fullPageOpened: await page.getByRole('heading', { name: 'Contato Demonstração 01' }).count() > 0,
    drawerClosed: await page.getByRole('dialog', { name: 'Detalhes do lead' }).count() === 0,
    tableHiddenInPage: !(await page.getByRole('table').count()),
  };
}
