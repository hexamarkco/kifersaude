async (page) => {
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-editor-preview.html');
 await page.evaluate(() => document.fonts.ready);
 await page.locator('.ql-editor').waitFor();
 let results=[];
 for(const [width,height] of [[1920,1080],[768,1024],[390,844],[320,640]]) {
  await page.setViewportSize({width,height});
  await page.screenshot({path:`output/playwright/blog-editor-${width}.png`,fullPage:true});
  results.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth})));
 }
 await page.setViewportSize({width:1920,height:1080});
 await page.getByPlaceholder('Digite o título do post').fill('Plano de saúde');
 const slug=await page.getByPlaceholder('url-amigavel-do-post').inputValue();
 await page.evaluate(()=>document.querySelector('.painel-theme')?.classList.add('theme-dark'));
 await page.waitForTimeout(500);
 await page.screenshot({path:'output/playwright/blog-editor-dark.png',fullPage:true});
 return {results,slug};
}
