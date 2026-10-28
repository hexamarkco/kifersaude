async (page) => {
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.fonts.ready);
  const measurements = [];
  for (const [width, height] of [[1920,1080],[768,1024],[390,844],[320,640]]) {
    await page.setViewportSize({width,height});
    await page.screenshot({path:`output/playwright/blog-preview-${width}.png`,fullPage:true});
    measurements.push(await page.evaluate(() => ({viewport:innerWidth,document:document.documentElement.scrollWidth,table:document.querySelector('.kds-table-wrapper')?.scrollWidth,tableViewport:document.querySelector('.kds-table-wrapper')?.clientWidth})));
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.evaluate(() => document.querySelector('.painel-theme')?.classList.add('theme-dark'));
  await page.screenshot({path:'output/playwright/blog-preview-dark.png',fullPage:true});
  await page.getByRole('textbox',{name:'Buscar artigos'}).fill('carência');
  const search = await page.locator('tbody tr').count();
  return {measurements, search};
}
