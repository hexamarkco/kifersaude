async(page)=>{
 const pages=[{"id": "chat-ia", "name": "Chat e testes de IA", "category": "ia", "route": "/chat", "source": "src/features/ai-sandbox/AiSandboxChatScreen.tsx", "kind": "page", "states": [], "screenshots": [], "difficulties": [], "status": "pending"}, {"id": "login", "name": "Acesso ao CRM", "category": "acesso", "route": "/login", "source": "src/pages/LoginPage.tsx", "kind": "page", "states": [], "screenshots": [], "difficulties": [], "status": "pending"}, {"id": "config-system", "name": "Geral", "category": "configuracoes", "route": "/painel/config?tab=system", "source": "src/features/config/general/SystemSettingsScreen.tsx", "kind": "page", "states": [], "screenshots": [], "difficulties": [], "status": "pending"}, {"id": "config-users", "name": "Usuários", "category": "configuracoes", "route": "/painel/config?tab=users", "source": "src/features/config/users/UsersScreen.tsx", "kind": "page", "states": [], "screenshots": [], "difficulties": [], "status": "pending"}, {"id": "config-links", "name": "Links", "category": "configuracoes", "route": "/painel/config?tab=links", "source": "src/features/config/links/LinksScreen.tsx", "kind": "page", "states": [], "screenshots": [], "difficulties": [], "status": "pending"}]; const records=[];
 for(const item of pages){
  for(const [device,width,height] of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
   page.__audit.mode='data';const startErrors=page.__audit.errors.length;
   try{
    await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+item.route,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForLoadState('networkidle',{timeout:2000}).catch(()=>{});
    await page.waitForFunction(()=>document.querySelector('main h1,main h2,form,h1') && !document.querySelector('main .kds-skeleton'),{timeout:30000}).catch(()=>{});
    await page.evaluate(async()=>{await document.fonts.ready;document.querySelectorAll('img[loading=lazy]').forEach(im=>im.loading='eager');await Promise.all([...document.images].map(im=>im.complete?Promise.resolve():Promise.race([im.decode().catch(()=>{}),new Promise(r=>setTimeout(r,8000))])));window.scrollTo(0,0);});
    const heading=await page.locator('main h1,main h2,h1').allTextContents();
    const info=await page.evaluate(()=>({bodyText:document.body.innerText.slice(0,160),scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,height:document.documentElement.scrollHeight,scrollables:[...document.querySelectorAll('main,main *')].filter(el=>el.scrollHeight>el.clientHeight+20&&el.clientHeight>100&&['auto','scroll'].includes(getComputedStyle(el).overflowY)).map(el=>({tag:el.tagName,class:el.className,height:el.clientHeight,total:el.scrollHeight})).slice(0,8)}));
    const prefix=`docs/ui-audit/${device}/${item.category}/${item.id}`;
    await page.screenshot({path:prefix+'-inicial.png',animations:'disabled'});
    await page.screenshot({path:prefix+'-completa.png',fullPage:true,animations:'disabled'});
    const controls=await page.locator('main button,main [role="tab"],main summary').evaluateAll(els=>els.map(el=>({role:el.getAttribute('role')??el.tagName.toLowerCase(),label:el.getAttribute('aria-label')??el.getAttribute('title')??el.textContent.trim(),disabled:el.disabled??false})).filter(e=>e.label).filter((e,i,arr)=>arr.findIndex(v=>v.label===e.label)===i));
    const record={id:item.id,device,route:item.route,heading,info,controls,errors:page.__audit.errors.slice(startErrors),screenshots:[prefix+'-inicial.png',prefix+'-completa.png'],status:'captured'};
    if(info.bodyText.includes('Algo deu errado'))record.status='render-error';
    records.push(record);page.__audit.captures.push(record);
   }catch(e){const record={id:item.id,device,route:item.route,status:'failed',difficulty:e.message};records.push(record);page.__audit.captures.push(record);}
  }
 }
 return {records,unknown:[...new Set(page.__audit.unknown)],errors:page.__audit.errors.slice(-10)};
}