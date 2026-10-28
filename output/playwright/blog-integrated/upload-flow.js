async (page) => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 let mode='fail',uploads=0,otherWrites=0;
 await page.route('**/*',async route=>{
  const req=route.request(), u=new URL(req.url());
  if(u.hostname==='127.0.0.1'||u.hostname==='localhost') return route.continue();
  if(u.pathname.endsWith('/rest/v1/blog_posts')&&req.method()==='GET') return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:'[]'});
  if(u.pathname.includes('/storage/v1/object/blog-images/')&&req.method()==='POST'){
   uploads++;
   if(mode==='fail') return route.fulfill({status:503,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({message:'Falha simulada'})});
   return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:JSON.stringify({Key:'blog-images/demo.png'})});
  }
  if(!['GET','OPTIONS'].includes(req.method())) otherWrites++;
  return route.abort();
 });
 await page.setViewportSize({width:320,height:640});
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-integrated.html',{waitUntil:'domcontentloaded'});
 await page.getByText('Nenhum post encontrado').waitFor();
 await page.getByRole('button',{name:'Novo post'}).first().click();
 await page.locator('.ql-editor').waitFor();
 const file={name:'capa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+bPAAAAABJRU5ErkJggg==','base64')};
 const input=page.locator('input[type=file]').first();
 await input.setInputFiles(file);
 await page.getByText('Falha simulada').waitFor();
 await page.waitForTimeout(500);
 const failEnabled=await page.getByRole('button',{name:'Salvar',exact:true}).isEnabled();
 await page.screenshot({path:'output/playwright/blog-upload-falha-320.png',fullPage:true});
 mode='success';
 await input.setInputFiles(file);
 await page.waitForFunction(()=>document.querySelector('input[placeholder^="https://exemplo.com"]')?.value.includes('blog-images'));
 const successEnabled=await page.getByRole('button',{name:'Salvar',exact:true}).isEnabled();
 return {uploads,otherWrites,failEnabled,successEnabled,selectedCleared:await input.inputValue()===''};
}
