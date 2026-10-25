async(page)=>{
 const records=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.bringToFront();await page.emulateMedia({reducedMotion:'reduce'});page.setDefaultTimeout(12000);
 for(const width of [320,390,768,1920])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:width===1920?1080:1024});await page.goto('about:blank');await page.goto('http://127.0.0.1:5174/design-system#components');await page.getByRole('tab',{name:'Aplicação',exact:true}).waitFor();const toggle=page.getByRole('button',{name:theme==='dark'?'Ativar tema escuro':'Ativar tema claro',exact:true});if(await toggle.count())await toggle.click();await page.getByRole('tab',{name:'Aplicação',exact:true}).click();await page.locator('.ql-editor').waitFor();await page.evaluate(()=>document.fonts.ready);
  const metrics=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,editor:document.querySelector('.ql-editor').getBoundingClientRect().width}));if(metrics.width>metrics.viewport)throw new Error('Application overflow '+JSON.stringify({width,theme,...metrics}));
  await page.getByLabel('Documento do atendimento',{exact:true}).setInputFiles('docs/design-system.md');await page.getByText('design-system.md',{exact:true}).waitFor();
  const slider=page.getByRole('slider');const initial=Number(await slider.inputValue());await slider.focus();await slider.press('ArrowRight');if(Math.abs(Number(await slider.inputValue())-initial-0.1)>0.001)throw new Error('Slider change failed: '+await slider.inputValue());
  const variable=page.getByLabel('Mensagem com variáveis',{exact:true});await variable.fill('Olá, {{n');await page.getByRole('button',{name:/Nome do contato Identificação/}).click();if(!(await variable.inputValue()).includes('{{nome}}'))throw new Error('Variable insertion failed');
  await page.locator('.ql-editor').fill('Orientação atualizada no editor.');if(await page.locator('.ql-editor').innerText()!=='Orientação atualizada no editor.')throw new Error('Editor not editable');
  await page.getByRole('button',{name:'Escolher visualização',exact:true}).click();const menu=page.getByRole('listbox',{name:'Visualização da consulta',exact:true});await menu.waitFor();await menu.getByRole('option',{name:'Aguardando retorno',exact:true}).click();
  const measure=async()=>page.getByRole('button',{name:'Consultar informações',exact:true}).evaluate(el=>{const s=getComputedStyle(el);return {radius:s.borderRadius,height:s.height,font:s.font,background:s.backgroundColor};});const before=await measure();await page.locator('.ds-showcase').evaluate(el=>el.classList.remove('kds-operational'));const after=await measure();if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Showcase-only appearance remains');
  await page.getByRole('button',{name:'Consultar informações',exact:true}).click();await page.getByRole('dialog',{name:'Informações do atendimento',exact:true}).waitFor();await page.getByRole('button',{name:'Concluir consulta',exact:true}).click();
  if(width===390||width===1920){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'output/design-system-adoption/application-'+width+'-'+theme+'.png',fullPage:true,animations:'disabled'});}
  records.push({width,theme,...metrics,sharedStyle:after});
 }
 return {records,errors};
}
