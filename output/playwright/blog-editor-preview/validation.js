async (page) => {
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-editor-preview.html');
 await page.evaluate(() => document.fonts.ready);
 await page.locator('.ql-editor').waitFor();
 await page.getByRole('button',{name:'Criar post'}).click();
 const focus=await page.evaluate(()=>({placeholder:document.activeElement?.getAttribute('placeholder'), visible:document.activeElement?.matches(':focus-visible')}));
 const errors=await page.locator('[role=alert]').allTextContents();
 const sizes=[];
 for(const [width,height] of [[1920,1080],[768,1024],[390,844],[320,640]]){
  await page.setViewportSize({width,height});
  await page.screenshot({path:`output/playwright/blog-validation-${width}.png`,fullPage:true});
  sizes.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth})));
 }
 await page.getByPlaceholder('Digite o título do post').fill('Plano de saúde');
 const remaining=await page.locator('[role=alert]').allTextContents();
 return {focus,errors,remaining,sizes};
}
