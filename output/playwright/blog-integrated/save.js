async (page) => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 let mode='fail', writes=0, reads=0, release;
 const gate=new Promise(resolve=>{release=resolve});
 const demo={id:'demo-1',title:'Guia de planos de saúde',slug:'guia-planos',excerpt:'Dicas para escolher cobertura.',content:'<p>Conteúdo fictício.</p>',category:'Guias',read_time:'3 min',author_id:'demo',published:false,created_at:'2026-10-20T12:00:00Z',updated_at:'2026-10-20T12:00:00Z',views_count:12};
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'||u.hostname==='localhost') return route.continue();
  if(u.pathname.endsWith('/rest/v1/blog_posts')){
    if(req.method()==='GET'){reads++;return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify([demo])});}
    if(req.method()==='PATCH'){writes++; if(mode==='fail'){await gate;return route.fulfill({status:503,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({message:'Falha simulada'})});} return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}});}
  }
  return route.abort();
 });
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-integrated.html',{waitUntil:'domcontentloaded'});
 await page.getByText('Guia de planos de saúde').first().waitFor();
 await page.getByRole('button',{name:'Mais ações de guia de planos de saúde'}).click();
 await page.getByRole('menuitem',{name:'Editar'}).click();
 await page.locator('.ql-editor').waitFor();
 await page.getByRole('button',{name:'Salvar'}).click();
 await page.getByRole('button',{name:'Salvando...'}).waitFor();
 const pending={busy:await page.getByRole('button',{name:'Salvando...'}).getAttribute('aria-busy'),inputDisabled:await page.getByPlaceholder('Digite o título do post').isDisabled(),editable:await page.locator('.ql-editor').getAttribute('contenteditable'),back:await page.getByRole('button',{name:'Voltar para artigos'}).isDisabled()};
 await page.screenshot({path:'output/playwright/blog-saving-1920.png',fullPage:true});
 for(const [width,height] of [[768,1024],[390,844],[320,640]]){ await page.setViewportSize({width,height}); await page.screenshot({path:`output/playwright/blog-saving-${width}.png`,fullPage:true}); }
 release();
 await page.getByText('Não foi possível atualizar o post. Tente novamente.').waitFor();
 const failed={title:await page.getByPlaceholder('Digite o título do post').inputValue(),enabled:await page.getByRole('button',{name:'Salvar'}).isEnabled()};
 await page.screenshot({path:'output/playwright/blog-save-error-320.png',fullPage:true});
 mode='success'; await page.getByRole('button',{name:'Salvar'}).click();
 await page.getByText('Post atualizado.').waitFor();
 await page.getByText('Biblioteca de artigos').waitFor();
 return {pending,failed,writes,reads};
}
