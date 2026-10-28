async (page) => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 let mode='slow', writes=0, reads=0, blocked=0;
 const demo={id:'demo-1',title:'Guia de planos de saúde',slug:'guia-planos',excerpt:'Dicas para escolher cobertura.',content:'<p>Conteúdo fictício para demonstração.</p>',category:'Guias',read_time:'3 min',author_id:'demo',published:false,created_at:'2026-10-20T12:00:00Z',updated_at:'2026-10-20T12:00:00Z',views_count:12};
 await page.route('**/*', async route => {
   const req=route.request(), u=new URL(req.url());
   if(u.hostname==='127.0.0.1' || u.hostname==='localhost') return route.continue();
   if(u.pathname.endsWith('/rest/v1/blog_posts') && req.method()==='GET') {
     reads++;
     if(mode==='slow') await new Promise(resolve=>setTimeout(resolve,3000));
     if(mode==='error') return route.fulfill({status:503,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({message:'Falha simulada'})});
     return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify(mode==='data'?[demo]:[])});
   }
   if(req.method()!=='GET' && req.method()!=='OPTIONS') writes++;
   blocked++; return route.abort();
 });
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-integrated.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(1700);
 await page.screenshot({path:'output/playwright/blog-integrated-loading.png',fullPage:true});
 await page.getByText('Nenhum post encontrado').waitFor();
 await page.screenshot({path:'output/playwright/blog-integrated-empty.png',fullPage:true});
 mode='error'; await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('alert').waitFor();
 await page.screenshot({path:'output/playwright/blog-integrated-error.png',fullPage:true});
 mode='data'; await page.getByRole('button',{name:'Tentar novamente'}).click();
 await page.getByText('Guia de planos de saúde').first().waitFor();
 await page.getByRole('button',{name:'Visualizar',exact:true}).first().click();
 await page.getByRole('dialog',{name:'Prévia do artigo'}).waitFor();
 await page.screenshot({path:'output/playwright/blog-integrated-preview-1920.png',fullPage:true});
 await page.setViewportSize({width:320,height:640});
 await page.screenshot({path:'output/playwright/blog-integrated-preview-320.png',fullPage:true});
 const previewText=await page.getByRole('dialog',{name:'Prévia do artigo'}).innerText();
 const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 return {reads,writes,blocked,previewHasContent:previewText.includes('Conteúdo fictício'),overflow};
}
