async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const reports = [];
  for (const section of ['foundations', 'components', 'states', 'patterns', 'responsive']) {
    await page.goto('http://127.0.0.1:5173/design-system#' + section);
    await page.locator('main h1').waitFor();
    reports.push({ section, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  }
  await page.goto('http://127.0.0.1:5173/design-system#components');
  await page.getByRole('tab', {name:'Formulários', exact:true}).click();
  await page.getByRole('heading', {name:'Campos de texto'}).waitFor();
  await page.screenshot({path:'output/playwright/design-system-forms-desktop.png'});
  await page.getByRole('tab', {name:'Interações', exact:true}).click();
  await page.getByRole('button', {name:'Criar contato no modal', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Novo contato de exemplo'});
  await dialog.getByRole('button', {name:'Criar contato', exact:true}).click();
  const validationErrors = await dialog.getByRole('alert').count();
  await page.keyboard.press('Escape');
  const focusRestored = await page.getByRole('button', {name:'Criar contato no modal', exact:true}).evaluate(el => el === document.activeElement);
  await page.getByRole('button', {name:'Ver detalhes do contato', exact:true}).click();
  await page.getByRole('dialog', {name:'Ana Paula Ribeiro'}).waitFor();
  await page.keyboard.press('Escape');
  for (const group of ['Ações', 'Navegação', 'Dados', 'Feedback', 'Interações']) {
    await page.getByRole('tab', {name:group, exact:true}).click();
    reports.push({ group, specimens: await page.locator('.ds-specimen').count(), overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth) });
  }
  console.log(JSON.stringify({reports, validationErrors, focusRestored, errors}));
}
