async (page) => {
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-preview.html');
 await page.evaluate(() => document.fonts.ready);
 await page.locator('.kds-responsive-collection').waitFor();
 const sizes=[];
 for(const [width,height] of [[1920,1080],[768,1024],[390,844],[320,640]]) {
  await page.setViewportSize({width,height});
  await page.screenshot({path:`output/playwright/blog-cards-${width}.png`,fullPage:true});
  sizes.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,table:getComputedStyle(document.querySelector('.kds-collection-table')).display,cards:getComputedStyle(document.querySelector('.kds-collection-cards')).display})));
 }
 await page.getByRole('button',{name:'Mais ações de como escolher um plano de saúde'}).click();
 const menu=await page.getByRole('menu').innerText();
 await page.screenshot({path:'output/playwright/blog-cards-menu-320.png',fullPage:true});
 await page.keyboard.press('Escape');
 await page.evaluate(()=>document.querySelector('.painel-theme')?.classList.add('theme-dark'));
 await page.waitForTimeout(500);
 await page.screenshot({path:'output/playwright/blog-cards-dark-320.png',fullPage:true});
 return {sizes,menu};
}
