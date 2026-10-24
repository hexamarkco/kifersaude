async(page)=>{
 await page.bringToFront();await page.emulateMedia({reducedMotion:'reduce'});const checks=[];
 const root='http://127.0.0.1:5174/design-system';
 const css=async(el)=>el.evaluate(node=>{const s=getComputedStyle(node);return {radius:s.borderRadius,tl:parseFloat(s.borderTopLeftRadius),tr:parseFloat(s.borderTopRightRadius),bl:parseFloat(s.borderBottomLeftRadius),br:parseFloat(s.borderBottomRightRadius)};});
 const checkRadius=async(el,r,label)=>{for(const item of await el.all()){const value=await css(item);if(Object.values(value).slice(1).some(n=>n!==r))throw new Error(label+': '+JSON.stringify(value));}checks.push(label);};
 for(const width of [320,390,768,1920])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:width===1920?1080:844});await page.goto(root+'#patterns');await page.locator('main h1').waitFor();const toggle=page.getByRole('button',{name:theme==='dark'?'Ativar tema escuro':'Ativar tema claro',exact:true});if(await toggle.count())await toggle.click();
  const tabs=page.getByRole('tablist',{name:'Padrão de página',exact:true});await checkRadius(tabs,12,'segmented-container-'+width+'-'+theme);await checkRadius(tabs.getByRole('tab'),8,'segmented-items');
  await tabs.getByRole('tab',{name:'Listagem',exact:true}).hover();await checkRadius(tabs.getByRole('tab',{name:'Listagem',exact:true}),8,'segmented-hover');await tabs.getByRole('tab',{name:'Listagem',exact:true}).focus();await page.keyboard.press('End');await checkRadius(tabs.getByRole('tab',{selected:true}),8,'segmented-keyboard');
  if(width===390||width===1920)await tabs.screenshot({path:'output/playwright/design-system-refinement-20261024/segmented-'+width+'-'+theme+'.png',animations:'disabled'});
  await page.goto(root+'?preview=1&pattern=list&theme='+theme);await page.locator('h1').waitFor();
  const trigger=width<768?page.getByRole('button',{name:'Ordenar contatos',exact:true}):page.getByRole('button',{name:/Todos os status/});await trigger.click();await page.getByRole('listbox').waitFor();await checkRadius(page.locator('.kds-dropdown-option'),8,'dropdown-options-'+width+'-'+theme);await checkRadius(page.locator('.kds-dropdown-menu'),12,'dropdown-container');
  const option=page.getByRole('option').first();await option.hover();await option.focus();await checkRadius(option,8,'dropdown-hover-focus');
  if(width===390||width===1920)await page.getByRole('listbox').screenshot({path:'output/playwright/design-system-refinement-20261024/dropdown-'+width+'-'+theme+'.png',animations:'disabled'});
  await page.keyboard.press('Escape');await checkRadius(page.locator('.kds-pagination-button,.kds-pagination-page'),8,'pagination');await checkRadius(page.locator('.kds-checkbox'),6,'checkbox');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(overflow)throw new Error('Overflow '+width+' '+theme);
 }
 await page.goto(root+'#components');await page.locator('main h1').waitFor();await page.getByRole('tab',{name:'Ações',exact:true}).click();const group=page.locator('.kds-button-group');await checkRadius(group,8,'button-group');const buttons=group.getByRole('button');const first=await css(buttons.first()),last=await css(buttons.last()),middle=await css(buttons.nth(1));if(first.tl!==7||first.tr!==0||last.tl!==0||last.tr!==7||middle.tl!==0||middle.tr!==0)throw new Error('Connected group corners');
 return {checks,groups:{first,middle,last}};
}
