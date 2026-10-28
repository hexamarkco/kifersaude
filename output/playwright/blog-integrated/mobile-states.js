async (page) => {
 await page.unrouteAll({behavior:'ignoreErrors'});
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='127.0.0.1'||u.hostname==='localhost') return route.continue();
  if(u.pathname.endsWith('/rest/v1/blog_posts')&&req.method()==='GET') {await new Promise(r=>setTimeout(r,6500));return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:'[]'});}
  return route.abort();
 });
 await page.setViewportSize({width:320,height:640});
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-integrated.html',{waitUntil:'domcontentloaded'});
 await page.getByRole('status',{name:'Carregando artigos'}).waitFor();
 await page.screenshot({path:'output/playwright/blog-integrated-loading-320.png',fullPage:true});
 const size=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 await page.getByText('Nenhum post encontrado').waitFor();
 await page.screenshot({path:'output/playwright/blog-integrated-empty-320.png',fullPage:true});
 return size;
}
