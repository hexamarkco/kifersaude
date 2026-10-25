async (page) => {
 const records=[]; const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [320,390,768,1920]) for(const theme of ['light','dark']) {
  await page.setViewportSize({width,height:width===1920?1080:844});
  await page.goto('http://127.0.0.1:5174/design-system#components');
  await page.getByRole('tab',{name:'Formulários',exact:true}).waitFor();
  const toggle=page.getByRole('button',{name:theme==='dark'?'Ativar tema escuro':'Ativar tema claro',exact:true}); if(await toggle.count()) await toggle.click();
  await page.getByRole('tab',{name:'Formulários',exact:true}).click();
  await page.evaluate(()=>document.fonts.ready);
  const specimen=page.locator('article').filter({has:page.getByRole('heading',{name:'Data e horário',exact:true})});
  const trigger=specimen.locator('.kds-dp-trigger').nth(2); await trigger.click();
  const popup=page.locator('.kds-dp-popover'); await popup.waitFor();
  const measure=async()=>popup.evaluate(el=>{const b=el.getBoundingClientRect();return {x:b.x,right:b.right,y:b.y,bottom:b.bottom,width:b.width,height:b.height,viewport:innerWidth,viewportHeight:innerHeight};});
  const date=await measure(); if(date.x<0||date.right>width+1||date.bottom>date.viewportHeight+1) throw Error('Date clipped '+JSON.stringify(date));
  if(width===390) await page.screenshot({path:`output/design-system-adoption/picker-date-${width}-${theme}.png`,animations:'disabled'});
  await popup.locator('.kds-dp-day:not(.kds-dp-day-outside):not(:disabled)').filter({hasText:/^18$/}).click();
  await popup.getByRole('button',{name:'14 horas',exact:true}).waitFor();
  if(await popup.locator('.kds-dp-days').count()) throw Error('Calendar remained in hour step');
  const hour=await measure(); if(width===390) await page.screenshot({path:`output/design-system-adoption/picker-hour-${width}-${theme}.png`,animations:'disabled'});
  await popup.getByRole('button',{name:'14 horas',exact:true}).click();
  await popup.getByRole('spinbutton',{name:'Minuto exato'}).fill('23');
  if(await popup.getByLabel('Horas',{exact:true}).count()) throw Error('Hours remained in minute step');
  const minute=await measure(); if(width===390) await page.screenshot({path:`output/design-system-adoption/picker-minute-${width}-${theme}.png`,animations:'disabled'});
  if(minute.x<0||minute.right>width+1||minute.bottom>minute.viewportHeight+1) throw Error('Minute clipped '+JSON.stringify(minute));
  const focus=await popup.getByRole('spinbutton').evaluate(el=>({outline:getComputedStyle(el).outlineStyle,shadow:getComputedStyle(el).boxShadow,border:getComputedStyle(el).borderWidth}));
  if(focus.shadow!=='none'||focus.outline!=='none'||parseFloat(focus.border)>1.1||parseFloat(focus.border)<=0) throw Error('Double focus '+JSON.stringify(focus));
  await popup.getByRole('button',{name:'Confirmar horário',exact:true}).click();
  if(!(await trigger.innerText()).includes('14:23')) throw Error('Failed time commit');
  await specimen.locator('.kds-dp-trigger').nth(1).click();
  await popup.getByRole('button',{name:'09 horas',exact:true}).click();
  await popup.getByRole('button',{name:'35 minutos',exact:true}).click();
  await popup.getByRole('button',{name:'Confirmar horário',exact:true}).click();
  if(!(await specimen.locator('.kds-dp-trigger').nth(1).innerText()).includes('09:35')) throw Error('Failed time-only');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth); if(overflow)throw Error('Page overflow '+width);
  await page.getByRole('tab',{name:'Ações',exact:true}).click();
  const tertiary=page.getByRole('button',{name:'Terciário',exact:true}).first(); await tertiary.hover();
  if((await tertiary.evaluate(el=>getComputedStyle(el).textDecorationLine)).includes('underline'))throw Error('Tertiary underlined');
  const text=page.getByRole('button',{name:'Texto',exact:true}).first(); await text.hover();
  const textStyle=await text.evaluate(el=>({bg:getComputedStyle(el).backgroundColor,line:getComputedStyle(el).textDecorationLine}));
  if(textStyle.bg!=='rgba(0, 0, 0, 0)'||!textStyle.line.includes('underline'))throw Error('Text style '+JSON.stringify(textStyle));
  const tab=page.getByRole('tab',{name:'Formulários',exact:true});await tab.hover();
  if(await tab.evaluate(el=>getComputedStyle(el).backgroundColor)!=='rgba(0, 0, 0, 0)')throw Error('Filled underline hover');
  records.push({width,theme,date,hour,minute,focus});
 }
 return {records,errors};
}
