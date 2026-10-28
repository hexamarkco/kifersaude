async (page) => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 let writes=0, reads=0;
 const demo={id:'demo-1',title:'Guia de planos de saúde',slug:'guia-planos',excerpt:'Dicas para escolher cobertura.',content:'<p>Conteúdo fictício para demonstração.</p>',category:'Guias',read_time:'3 min',author_id:'demo',published:false,created_at:'2026-10-20T12:00:00Z',updated_at:'2026-10-20T12:00:00Z',views_count:12};
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'||u.hostname==='localhost') return route.continue();
  if(u.pathname.endsWith('/rest/v1/blog_posts')&&req.method()==='GET'){reads++;return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify([demo])});}
  if(!['GET','OPTIONS'].includes(req.method())) writes++;
  return route.abort();
 });
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-integrated.html',{waitUntil:'domcontentloaded'});
 await page.getByText('Guia de planos de saúde').first().waitFor();
 await page.getByRole('button',{name:'Mais ações de guia de planos de saúde'}).click();
 await page.getByRole('menuitem',{name:'Excluir'}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByText('O artigo “Guia de planos de saúde” será excluído permanentemente. Esta ação não pode ser desfeita.').waitFor();
 let sizes=[];
 for(const [width,height] of [[1920,1080],[768,1024],[390,844],[320,640]]){
  await page.setViewportSize({width,height});
  await page.screenshot({path:`output/playwright/blog-confirm-${width}.png`});
  sizes.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth})));
 }
 await dialog.getByRole('button',{name:'Cancelar'}).click();
 await page.getByRole('button',{name:'Mais ações de guia de planos de saúde'}).click();
 await page.getByRole('menuitem',{name:'Editar'}).click();
 await page.locator('.ql-editor').waitFor();
 const title=await page.getByPlaceholder('Digite o título do post').inputValue();
 const slug=await page.getByPlaceholder('url-amigavel-do-post').inputValue();
 const content=await page.locator('.ql-editor').innerText();
 await page.screenshot({path:'output/playwright/blog-edicao-integrada-320.png',fullPage:true});
 await page.setViewportSize({width:1920,height:1080});
 await page.screenshot({path:'output/playwright/blog-edicao-integrada-1920.png',fullPage:true});
 await page.getByRole('button',{name:'Cancelar'}).click();
 await page.getByText('Biblioteca de artigos').waitFor();
 return {sizes,reads,writes,title,slug,content};
}
