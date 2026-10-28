async (page) => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 await page.route('**/*', route => {const u=new URL(route.request().url());return (u.hostname==='127.0.0.1'||u.hostname==='localhost')?route.continue():route.abort()});
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-editor-preview.html');
 await page.locator('.ql-editor').waitFor();
 const sizes=[];
 for(const [width,height] of [[1920,1080],[768,1024],[390,844],[320,640]]) {
  await page.setViewportSize({width,height});
  await page.screenshot({path:`output/playwright/blog-upload-${width}.png`,fullPage:true});
  sizes.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth})));
 }
 return {sizes,saveDisabled:await page.getByRole('button',{name:'Salvar',exact:true}).isDisabled(),cancelDisabled:await page.getByRole('button',{name:'Cancelar'}).isDisabled(),message:await page.getByText('Aguarde o envio da imagem para salvar ou sair.').count()};
}
