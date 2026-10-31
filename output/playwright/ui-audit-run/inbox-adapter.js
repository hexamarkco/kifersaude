async page => {
  page.setDefaultNavigationTimeout(25000);
  const context = page.context();
  await context.unroute('http://127.0.0.1:5185/**').catch(() => {});
  await context.unroute('**/rest/v1/**').catch(() => {});
  await context.unroute('**/auth/v1/**').catch(() => {});
  await context.route('**/rest/v1/**', async route => {
    const request=route.request(), url=new URL(request.url()), h=request.headers();
    if(request.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':h['access-control-request-method']||'GET, POST, PATCH, DELETE, OPTIONS','access-control-allow-headers':h['access-control-request-headers']||'authorization, apikey, content-type, prefer, range, x-client-info','access-control-max-age':'86400','vary':'Origin'}});
    return route.fallback({url:url.origin+'/audit-backend'+url.pathname+url.search});
  });
  await context.route('**/auth/v1/**', async route => {
    const request=route.request(), url=new URL(request.url()), h=request.headers();
    if(request.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':h['access-control-request-method']||'GET, POST, PATCH, DELETE, OPTIONS','access-control-allow-headers':h['access-control-request-headers']||'authorization, apikey, content-type, prefer, range, x-client-info','access-control-max-age':'86400','vary':'Origin'}});
    if(url.pathname.includes('/auth/v1/token')){
      const session=await page.evaluate(()=>{const k=Object.keys(localStorage).find(k=>k.startsWith('sb-')&&k.endsWith('-auth-token')&&k!=='sb-127-auth-token');return k?JSON.parse(localStorage.getItem(k)):null;});
      if(!session)return route.abort();
      return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','vary':'Origin'},body:JSON.stringify(session)});
    }
    return route.fallback({url:url.origin+'/audit-backend'+url.pathname+url.search});
  });
  await context.route('http://127.0.0.1:5185/**', route => route.continue());
  const copied=await page.evaluate(()=>{const s=localStorage.getItem('sb-127-auth-token');if(!s)return false;localStorage.setItem('sb-eaxvvhamkmovkoqssahj-auth-token',s);return true;});
  const before={requests:page.__audit.requests.length,blocked:page.__audit.blocked.length,errors:page.__audit.errors.length};
  await page.reload({waitUntil:'commit',timeout:20000}).catch(()=>{});
  await page.getByText('Contato Demonstração 01',{exact:true}).waitFor({timeout:18000}).catch(()=>{});
  return {copied,url:page.url(),inboxHeader:(await page.getByText('WhatsApp Inbox',{exact:true}).count())>0,synthetic:(await page.getByText('Contato Demonstração 01',{exact:true}).count())>0,requests:page.__audit.requests.length-before.requests,blocked:page.__audit.blocked.length-before.blocked,unknown:page.__audit.unknown.length,newErrors:page.__audit.errors.length-before.errors};
}
