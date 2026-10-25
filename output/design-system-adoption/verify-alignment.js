async(page)=>{
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('http://127.0.0.1:5175/local-artifacts/design-system-adoption/index.html?mode=catalogs');
 await page.getByRole('heading',{name:'Etapas do funil',exact:true}).waitFor();
 await page.evaluate(()=>document.fonts.ready);
 const headers=await page.locator('.kds-catalog-sort').evaluateAll(els=>els.map(el=>{const b=el.getBoundingClientRect();return {label:el.textContent,width:b.width,scroll:el.scrollWidth,client:el.clientWidth,height:b.height,icon:el.querySelector('svg').getBoundingClientRect().width};}));
 if(headers.some(h=>h.scroll>h.client+1||h.height>40))throw Error('Header overflow '+JSON.stringify(headers));
 await page.screenshot({path:'output/design-system-adoption/crm-settings-1920-dark.png',fullPage:true,animations:'disabled'});
 const records=[];
 for(const width of [320,390]) {
  await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:5174/design-system?preview=1&pattern=list&theme=dark');
  await page.getByRole('heading',{name:'Contatos',exact:true}).waitFor();
  const toolbar=page.locator('.kds-toolbar').first(); await toolbar.waitFor();
  const bounds=await toolbar.evaluate(el=>{const search=el.querySelector('.kds-toolbar-search').getBoundingClientRect();const actions=el.querySelector('.kds-toolbar-actions').getBoundingClientRect();return {searchLeft:search.x,actionsLeft:actions.x,searchWidth:search.width,actionsWidth:actions.width};});
  if(Math.abs(bounds.searchLeft-bounds.actionsLeft)>1||Math.abs(bounds.searchWidth-bounds.actionsWidth)>1)throw Error('Filter misalignment '+JSON.stringify(bounds));
  records.push({width,...bounds});
 }
 return {headers,records};
}
