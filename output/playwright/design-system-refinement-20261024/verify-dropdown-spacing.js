async(page)=>{
 const reports=[];await page.bringToFront();await page.emulateMedia({reducedMotion:'reduce'});
 const base='http://127.0.0.1:5174/design-system';
 async function check(name,width,theme){await page.getByRole('listbox').waitFor();const opts=page.getByRole('option');const values=await opts.evaluateAll(nodes=>nodes.slice(1).map((el,i)=>el.getBoundingClientRect().top-nodes[i].getBoundingClientRect().bottom));if(values.some(gap=>Math.abs(gap-4)>0.2))throw new Error(name+' gaps: '+values);reports.push({name,width,theme,gaps:values});await page.keyboard.press('Escape');}
 for(const width of [320,390,768,1920])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:width===1920?1080:844});await page.goto(base+'?preview=1&pattern=list&theme='+theme);await page.locator('h1').waitFor();
  const trigger=width<768?page.getByRole('button',{name:'Ordenar contatos',exact:true}):page.getByRole('button',{name:/Todos os status/});await trigger.click();await page.getByRole('option').nth(1).hover();
  if(width===390)await page.getByRole('listbox').screenshot({path:'output/playwright/design-system-refinement-20261024/dropdown-spaced-390-'+theme+'.png',animations:'disabled'});
  await check('filter-or-sort',width,theme);
  await page.goto(base+'#components');await page.locator('main h1').waitFor();const toggle=page.getByRole('button',{name:theme==='dark'?'Ativar tema escuro':'Ativar tema claro',exact:true});if(await toggle.count())await toggle.click();await page.getByRole('tab',{name:'Formulários',exact:true}).click();
  for(const label of ['Operadora · md','Buscar operadora','Operadoras de interesse']){await page.getByLabel(label,{exact:true}).click();await check(label,width,theme);}
 }
 return reports;
}
