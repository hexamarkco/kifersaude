async(page)=>{
 await page.bringToFront();await page.emulateMedia({reducedMotion:'reduce'});
 const root='http://127.0.0.1:5174/design-system';
 const output='docs/design-system/screenshots/refinement-20261024/';
 const shots=[];
 for(const [name,width,height,path] of [
 ['overview-desktop-light',1920,1080,'#overview'],
 ['foundations-desktop-light',1920,1080,'#foundations'],
 ['list-desktop-light',1920,1080,'?preview=1&pattern=list&theme=light'],
 ['dashboard-desktop-dark',1920,1080,'?preview=1&pattern=dashboard&theme=dark'],
 ['edit-tablet-dark',768,1024,'?preview=1&pattern=edit&theme=dark'],
 ['create-mobile-light',390,844,'?preview=1&pattern=create&theme=light'],
 ['list-compact-dark',320,844,'?preview=1&pattern=list&theme=dark'],
 ['detail-mobile-light',390,844,'?preview=1&pattern=detail&theme=light']
 ]){
  await page.setViewportSize({width,height});await page.goto(root+path);if(!path.includes('preview=1')){const light=page.getByRole('button',{name:'Ativar tema claro',exact:true});if(await light.count())await light.click();}await page.locator('h1').waitFor();if(path.includes('preview=1')&&!(await page.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily.includes('Inter'))))throw new Error('Operational font must be Inter');await page.evaluate(()=>document.fonts.ready);await page.evaluate(async()=>{await Promise.all([...document.images].map(im=>im.decode().catch(()=>{})));});for(const iframe of await page.locator('iframe').all()){await iframe.scrollIntoViewIfNeeded();const handle=await iframe.elementHandle();const frame=await handle.contentFrame();await frame.locator('h1').waitFor();await frame.evaluate(()=>document.fonts.ready);}await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:output+name+'.png',fullPage:true,animations:'disabled'});shots.push({name,width,height});
 }
 await page.setViewportSize({width:1920,height:1080});await page.goto(root+'#components');const lightToggle=page.getByRole('button',{name:'Ativar tema claro',exact:true});if(await lightToggle.count())await lightToggle.click();await page.getByRole('tab',{name:'Interações',exact:true}).click();await page.getByRole('button',{name:'Adicionar anotação',exact:true}).click();await page.getByRole('dialog',{name:'Adicionar anotação',exact:true}).waitFor();await page.screenshot({path:output+'short-modal-desktop-light.png',fullPage:true,animations:'disabled'});
 return shots;
}
