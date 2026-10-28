async (page) => {
  await page.goto('http://127.0.0.1:5173/output/playwright/blog-preview.html');
  await page.evaluate(() => document.fonts.ready);
  const sizes=[];
  for (const [width,height] of [[1920,1080],[768,1024],[390,844],[320,640]]) {
    await page.setViewportSize({width,height});
    await page.screenshot({path:`output/playwright/blog-summary-${width}.png`,fullPage:true});
    sizes.push(await page.evaluate(() => ({viewport:innerWidth,document:document.documentElement.scrollWidth})));
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.getByRole('button',{name:'Todos os status'}).click();
  await page.getByRole('option',{name:'Publicado',exact:true}).click();
  const published=await page.locator('tbody tr').count();
  const kpis=await page.locator('.kds-kpi-value').allTextContents();
  await page.evaluate(() => document.querySelector('.painel-theme')?.classList.add('theme-dark'));
  await page.screenshot({path:'output/playwright/blog-summary-dark.png',fullPage:true});
  return {sizes,published,kpis};
}
