async(page)=>{
 await page.bringToFront();await page.emulateMedia({reducedMotion:'reduce'});page.setDefaultTimeout(8000);
 const records=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const root='http://127.0.0.1:5174/design-system';
 const specimen=name=>page.locator('.ds-specimen').filter({has:page.getByRole('heading',{name,exact:true})});
 async function go(section,theme){await page.goto('about:blank');await page.goto(root+'#'+section);await page.locator('main h1').waitFor();const toggle=page.getByRole('button',{name:theme==='dark'?'Ativar tema escuro':'Ativar tema claro',exact:true});if(await toggle.count())await toggle.click();await page.evaluate(()=>document.fonts.ready);}
 async function bounds(name,locator){const r=await locator.boundingBox();const vp=page.viewportSize();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);if(!r||r.x<-1||r.y<-1||r.x+r.width>vp.width+1||r.y+r.height>vp.height+1||overflow)throw new Error(name+' is outside viewport '+JSON.stringify({r,vp,overflow}));records.push({name,...vp});}
 async function shot(name){await page.mouse.move(1,1);await page.screenshot({path:'output/playwright/design-system-refinement-20261024/'+name+'.png',fullPage:true,animations:'disabled',caret:'hide'});}
 for(const width of [320,390,768,1920]){
  await page.setViewportSize({width,height:width===1920?1080:844});
  for(const theme of ['light','dark']){
   await go('components',theme);await page.getByRole('tab',{name:'Formulários',exact:true}).click();
   await page.getByLabel('Operadora · md',{exact:true}).click();await bounds('select',page.getByRole('listbox'));await page.keyboard.press('Escape');
   await page.getByRole('button',{name:'Buscar operadora',exact:true}).click();await bounds('combobox',page.getByRole('listbox'));await page.keyboard.press('Escape');
   for(const label of ['Data','Horário','Atendimento']){await specimen('Data e horário').getByLabel(label,{exact:true}).click();await bounds('datepicker-'+label,page.getByRole('dialog',{name:'Selecionar data',exact:true}));await page.keyboard.press('Escape');}
   await page.getByRole('tab',{name:'Interações',exact:true}).click();await page.getByRole('button',{name:'Adicionar anotação',exact:true}).click();const modal=page.getByRole('dialog',{name:'Adicionar anotação',exact:true});await bounds('short-modal',modal);
   await modal.getByRole('button',{name:'Salvar anotação',exact:true}).click();await modal.getByRole('alert').waitFor();await modal.getByLabel('Anotação do atendimento',{exact:false}).fill('Prefere atendimento pela manhã.');
   if(width===390)await shot('modal-'+width+'-'+theme);
   await modal.getByRole('button',{name:'Salvar anotação',exact:true}).click();await page.getByText('Última anotação do exemplo',{exact:true}).waitFor();await page.getByRole('button',{name:'Fechar notificação',exact:true}).click();
   for(const position of ['Direita','Esquerda','Abaixo']){await specimen('Drawer de consulta').getByLabel('Posição do drawer',{exact:true}).click();await page.getByRole('option',{name:position,exact:true}).click();await page.getByRole('button',{name:'Ver detalhes do contato',exact:true}).click();await bounds('drawer-'+position,page.getByRole('dialog',{name:'Ana Paula Ribeiro',exact:true}));await page.keyboard.press('Escape');}
   await page.getByRole('button',{name:'Sobre este status',exact:true}).click();await bounds('popover',page.getByRole('dialog',{name:'Sobre o atendimento',exact:true}));await page.keyboard.press('Escape');
   await specimen('Popover e menu contextual').getByRole('button',{name:'Ações',exact:true}).click();await bounds('menu',page.getByRole('dialog',{name:'Ações do exemplo',exact:true}));await page.keyboard.press('Escape');
   for(const side of ['top','right','bottom','left']){const trigger=page.getByRole('button',{name:'Ajuda contextual, posição '+side,exact:true});await trigger.scrollIntoViewIfNeeded();await trigger.focus();await page.getByRole('tooltip').waitFor();await bounds('tooltip-'+side,page.getByRole('tooltip'));await page.keyboard.press('Escape');await trigger.blur();}
   await page.getByRole('button',{name:'Abrir área de trabalho',exact:true}).click();await bounds('workspace-modal',page.getByRole('dialog',{name:'Revisar informações',exact:true}));await page.keyboard.press('Escape');
   await page.getByRole('tab',{name:'Dados',exact:true}).click();await specimen('Barra de filtros').getByRole('button',{name:/Período:/}).click();await page.getByLabel('De',{exact:true}).click();await page.getByRole('button',{name:'Mês anterior',exact:true}).click();if(await page.getByRole('dialog',{name:'Selecionar intervalo de Período',exact:true}).count()!==1)throw new Error('Parent period closed');await page.keyboard.press('Escape');if(await page.getByRole('dialog',{name:'Selecionar intervalo de Período',exact:true}).count()!==1)throw new Error('Escape closed parent prematurely');await page.keyboard.press('Escape');records.push({name:'nested-period-calendar',width,theme});
  }
 }
 return {records,errors};
}
