async(page)=>{
 const results=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.hostname==='127.0.0.1'||['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)?route.continue():route.abort();});
 for(const width of [320,390,768,1280,1920])for(const theme of ['light','dark'])for(const long of [false,true]){
  await page.setViewportSize({width,height:844});await page.goto(`http://127.0.0.1:5178/local-artifacts/header-density/index.html?theme=${theme}${long?'&long=1':''}`,{waitUntil:'domcontentloaded'});
  await page.getByText('Agenda em dia',{exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
  const m=await page.locator('.whatsapp-inbox-thread-header').evaluate(el=>({height:el.getBoundingClientRect().height,viewport:innerWidth,scroll:document.documentElement.scrollWidth,padding:getComputedStyle(el).padding,buttonHeights:[...el.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().width).map(b=>b.getBoundingClientRect().height)}));
  if(m.scroll>width)throw Error('Overflow '+JSON.stringify({width,theme,long,...m}));
  if(width===1920&&!long&&m.height>100)throw Error('Header still too tall '+m.height);
  if(!long&&(width===1920||width===390))await page.screenshot({path:`output/playwright/header-density/header-${width}-${theme}.png`,animations:'disabled'});
  results.push({width,theme,long,...m});
 }
 await page.goto('http://127.0.0.1:5178/local-artifacts/header-density/index.html?group=1');await page.getByText('Agenda em dia',{exact:true}).waitFor();
 return {results,errors};
}
