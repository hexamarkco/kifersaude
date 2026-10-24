async (page) => {
  const reports = [];
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  for (const width of [390, 768]) {
    await page.setViewportSize({width, height:900});
    for (const section of ['overview','foundations','components','states','patterns','responsive']) {
      await page.goto('http://127.0.0.1:5173/design-system#' + section);
      await page.locator('main h1').waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      reports.push({width,section,overflow});
      if (section === 'overview') await page.screenshot({path:'output/playwright/design-system-' + width + '.png'});
    }
  }
  await page.setViewportSize({width:390,height:900});
  await page.goto('http://127.0.0.1:5173/design-system#components');
  for (const group of ['Formulários','Navegação','Dados','Feedback','Interações']) {
    await page.getByRole('tab', {name:group, exact:true}).click();
    reports.push({width:390,group,overflow:await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)});
  }
  await page.getByRole('button', {name:'Abrir navegação', exact:true}).click();
  await page.getByRole('dialog', {name:'Design system', exact:true}).waitFor();
  await page.keyboard.press('Escape');
  const mobileMenuFocusRestored = await page.getByRole('button', {name:'Abrir navegação',exact:true}).evaluate(el => el === document.activeElement);
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:5173/design-system#responsive');
  for (const [device,width] of [['desktop',1024],['tablet',768],['mobile',390]]) {
    await page.getByRole('button', {name:'Visualizar em ' + device,exact:true}).click();
    const iframe = page.locator('iframe');
    const frame = page.frameLocator('iframe');
    await frame.getByRole('heading', {name:'Contatos',exact:true}).waitFor();
    const actual = await iframe.evaluate(el => el.contentWindow.innerWidth);
    reports.push({device,actual,expectedMin:width});
    if (device === 'mobile') await page.screenshot({path:'output/playwright/design-system-responsive.png'});
  }
  await page.goto('http://127.0.0.1:5173/design-system?preview=1&pattern=list&theme=light');
  await page.setViewportSize({width:390,height:900});
  await page.getByRole('heading',{name:'Contatos',exact:true}).waitFor();
  await page.screenshot({path:'output/playwright/design-system-contact-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:5173/design-system#foundations');
  await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();
  await page.screenshot({path:'output/playwright/design-system-dark.png'});
  await page.getByRole('button',{name:'Ativar tema claro',exact:true}).click();
  return {reports, mobileMenuFocusRestored, failures};
}
