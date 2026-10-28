async (page) => {
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-preview.html');
 await page.evaluate(()=>document.fonts.ready);
 await page.getByRole('button',{name:'Próxima página'}).click();
 const selected=await page.locator('[aria-current=page]').innerText();
 const sizes=[];
 for(const [width,height] of [[1920,1080],[768,1024],[390,844],[320,640]]){
  await page.setViewportSize({width,height});
  await page.screenshot({path:`output/playwright/blog-paginacao-${width}.png`,fullPage:true});
  sizes.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth})));
 }
 await page.getByRole('textbox',{name:'Buscar artigos'}).fill('sem resultado');
 const empty=await page.getByText('Nenhum post encontrado').count();
 await page.screenshot({path:'output/playwright/blog-busca-vazia-320.png',fullPage:true});
 await page.getByRole('button',{name:'Limpar filtros'}).click();
 const restored=await page.locator('[aria-current=page]').innerText();
 return {selected,restored,empty,sizes};
}
