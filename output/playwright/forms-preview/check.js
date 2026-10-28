async (page) => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 let writes=0,reads=0;
 const forms=[{id:'demo-1',title:'Cotação inicial',slug:'cotacao-inicial',is_published:true,submission_count:12,created_at:'2026-10-25T12:00:00Z'},{id:'demo-2',title:'Solicitação de contato',slug:'contato',is_published:false,submission_count:0,created_at:'2026-10-24T12:00:00Z'}];
 await page.route('**/*',async route=>{ const req=route.request(),u=new URL(req.url()); if(u.hostname==='127.0.0.1'||u.hostname==='localhost') return route.continue(); if(u.pathname.endsWith('/rest/v1/public_forms')&&req.method()==='GET'){reads++;return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify(forms)});} if(!['GET','OPTIONS'].includes(req.method())) writes++; return route.abort(); });
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('http://127.0.0.1:5173/output/playwright/forms-preview.html',{waitUntil:'domcontentloaded'});
 await page.getByText('Cotação inicial').first().waitFor(); await page.evaluate(()=>document.fonts.ready);
 const sizes=[]; for(const [width,height] of [[1920,1080],[768,1024],[390,844],[320,640]]){await page.setViewportSize({width,height}); await page.screenshot({path:`output/playwright/forms-list-${width}.png`,fullPage:true}); sizes.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth})));}
 await page.getByRole('button',{name:'Mais ações de cotação inicial'}).click(); const menu=await page.getByRole('menu').innerText(); await page.keyboard.press('Escape');
 await page.getByRole('textbox',{name:'Buscar formulários'}).fill('contato'); const visible=await page.getByText('Solicitação de contato').count();
 await page.getByRole('button',{name:'Novo formulário'}).click(); await page.getByRole('dialog').waitFor(); await page.screenshot({path:'output/playwright/forms-create-320.png'}); await page.keyboard.press('Escape');
 await page.evaluate(()=>document.querySelector('.painel-theme')?.classList.add('theme-dark')); await page.waitForTimeout(500); await page.screenshot({path:'output/playwright/forms-dark-320.png',fullPage:true});
 return {sizes,menu,visible,reads,writes};
}
