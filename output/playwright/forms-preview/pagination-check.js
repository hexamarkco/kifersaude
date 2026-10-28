async (page) => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 let writes=0;
 const forms=Array.from({length:12},(_,i)=>({id:`demo-${i}`,title:`Formulário ${i+1}`,slug:`form-${i+1}`,is_published:i%2===0,submission_count:i,created_at:'2026-10-25T12:00:00Z'}));
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url()); if(['127.0.0.1','localhost'].includes(u.hostname)) return route.continue(); if(u.pathname.endsWith('/rest/v1/public_forms')&&req.method()==='GET') return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify(forms)}); if(!['GET','OPTIONS'].includes(req.method())) writes++; return route.abort();});
 await page.setViewportSize({width:1920,height:1080}); await page.goto('http://127.0.0.1:5173/output/playwright/forms-preview.html',{waitUntil:'domcontentloaded'}); await page.getByText('Formulário 1',{exact:true}).first().waitFor(); await page.evaluate(()=>document.fonts.ready);
 const sizes=[]; for(const [width,height] of [[1920,1080],[768,1024],[390,844],[320,640]]) { await page.setViewportSize({width,height}); await page.screenshot({path:`output/playwright/forms-pagination-${width}.png`,fullPage:true,animations:'disabled'}); sizes.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}))); }
 await page.getByRole('button',{name:'Próxima página'}).click(); const second=await page.getByText('Formulário 12',{exact:true}).locator('visible=true').isVisible();
 await page.getByRole('textbox',{name:'Buscar formulários'}).fill('Formulário 1'); const reset=await page.locator('[aria-current=page]').innerText();
 await page.getByRole('button',{name:'Todos os status'}).click(); await page.getByRole('option',{name:'Rascunho'}).click(); const filtered=await page.getByText('Formulário 10',{exact:true}).locator('visible=true').isVisible();
 await page.getByRole('textbox',{name:'Buscar formulários'}).fill('inexistente'); const empty=await page.getByText('Nenhum formulário encontrado').isVisible(); await page.getByRole('button',{name:'Limpar filtros'}).click();
 await page.evaluate(()=>document.querySelector('.painel-theme')?.classList.add('theme-dark')); await page.screenshot({path:'output/playwright/forms-pagination-dark-320.png',fullPage:true,animations:'disabled'});
 return {sizes,second,reset,filtered,empty,writes};
}