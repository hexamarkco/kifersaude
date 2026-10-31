async page => {
  page.setDefaultTimeout(10000);
  page.setDefaultNavigationTimeout(30000);
  const context=page.context();
  await context.unroute('http://127.0.0.1:5185/**').catch(()=>{});
  await context.unroute('**/rest/v1/**').catch(()=>{});
  await context.unroute('**/auth/v1/**').catch(()=>{});
  const cors=request=>{const h=request.headers();return {'access-control-allow-origin':'*','access-control-allow-methods':h['access-control-request-method']||'GET, POST, PATCH, DELETE, OPTIONS','access-control-allow-headers':h['access-control-request-headers']||'authorization, apikey, content-type, prefer, range, x-client-info','access-control-max-age':'86400','vary':'Origin'}};
  await context.route('**/rest/v1/**',async route=>{const req=route.request(),url=new URL(req.url());if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors(req)});return route.fallback({url:url.origin+'/audit-backend'+url.pathname+url.search})});
  await context.route('**/auth/v1/**',async route=>{const req=route.request(),url=new URL(req.url());if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:cors(req)});if(url.pathname.includes('/auth/v1/token')){const session=await page.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')&&k!=='sb-127-auth-token');return k?JSON.parse(localStorage.getItem(k)):null});if(!session)return route.abort();return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','vary':'Origin'},body:JSON.stringify(session)})}return route.fallback({url:url.origin+'/audit-backend'+url.pathname+url.search})});
  await context.route('http://127.0.0.1:5185/**',route=>route.continue());
  const initial={requests:page.__audit.requests.length,blocked:page.__audit.blocked.length,errors:page.__audit.errors.length};
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('http://127.0.0.1:5185/painel/inbox?chatId=00000000-0000-4000-8000-000000000810',{waitUntil:'commit',timeout:30000}).catch(()=>{});
  const copied=await page.evaluate(()=>{const s=localStorage.getItem('sb-127-auth-token');if(!s)return false;localStorage.setItem('sb-eaxvvhamkmovkoqssahj-auth-token',s);return true});
  await page.reload({waitUntil:'commit',timeout:30000}).catch(()=>{});
  await page.getByText('Contato Demonstração 01',{exact:true}).waitFor({timeout:20000}).catch(()=>{});
  const visible=await page.getByText('WhatsApp Inbox',{exact:true}).count()>0;
  const trigger=page.getByRole('button',{name:'Ver mensagens agendadas desta conversa',exact:true});
  const triggerVisible=(await trigger.count())>0&&await trigger.first().isVisible().catch(()=>false);
  if(triggerVisible)await trigger.first().click();
  await page.getByRole('dialog').first().waitFor({timeout:10000}).catch(()=>{});
  await page.setViewportSize({width:390,height:844});
  const geometry=await page.getByRole('dialog').last().evaluate(d=>{const r=d.getBoundingClientRect();const g=d.querySelector('[aria-label="Ações dos agendamentos"]')?.getBoundingClientRect();return {x:Math.round(r.x),w:Math.round(r.width),scrollWidth:d.scrollWidth,clientWidth:d.clientWidth,group:g?{x:Math.round(g.x),right:Math.round(g.right),w:Math.round(g.width)}:null,dialogRight:Math.round(r.right)}}).catch(()=>null);
  return {copied,visible,triggerVisible,dialogs:await page.getByRole('dialog').count(),geometry,rootOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),requests:page.__audit.requests.length-initial.requests,blocked:page.__audit.blocked.length-initial.blocked,newErrors:page.__audit.errors.length-initial.errors};
}
