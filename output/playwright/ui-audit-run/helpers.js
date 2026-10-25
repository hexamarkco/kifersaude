async(page)=>{
 page.__audit.interactions=[];
 page.__audit.captureState=async ({id,category,name,route,device,kind='interaction',path=[]})=>{
  await page.evaluate(async()=>{await document.fonts.ready;document.querySelectorAll('img[loading=lazy]').forEach(im=>im.loading='eager');await Promise.all([...document.images].map(im=>im.complete?Promise.resolve():Promise.race([im.decode().catch(()=>{}),new Promise(r=>setTimeout(r,8000))])));});
  const prefix=`docs/ui-audit/${device}/${category}/${id}`;
  const files=[];
  await page.screenshot({path:prefix+'-inicial.png',animations:'disabled'});files.push(prefix+'-inicial.png');
  await page.screenshot({path:prefix+'-completa.png',fullPage:true,animations:'disabled'});files.push(prefix+'-completa.png');
  const dialogs=page.locator('[role="dialog"]:visible'); const dialog=dialogs.last();
  if(await dialog.count()){
   await dialog.screenshot({path:prefix+'-componente.png',animations:'disabled'}).then(()=>files.push(prefix+'-componente.png')).catch(()=>{});
   const scrolls=await dialog.locator('*').evaluateAll(els=>els.map((el,i)=>({i,client:el.clientHeight,total:el.scrollHeight,style:getComputedStyle(el).overflowY})).filter(v=>v.client>100&&v.total>v.client+20&&['auto','scroll'].includes(v.style)));
   for(const [sindex,scroll]of scrolls.entries()){
    const el=dialog.locator('*').nth(scroll.i); let index=1;
    for(let pos=scroll.client*.8;pos<scroll.total;pos+=scroll.client*.8){
     await el.evaluate((node,pos)=>node.scrollTo(0,pos),pos);
     const file=prefix+`-conteudo-${sindex+1}-${index++}.png`;await page.screenshot({path:file,animations:'disabled'});files.push(file);
    }
    await el.evaluate(node=>node.scrollTo(0,0));
   }
  }
  const record={id,name,category,route,device,kind,path,status:'captured',screenshots:files,dialogTitle:await dialog.locator('h1,h2,h3,[class*="dialog-title"]').allTextContents().catch(()=>[]),availableControls:await page.locator('button:visible,[role="tab"]:visible,summary:visible').evaluateAll(els=>[...new Set(els.map(el=>el.getAttribute('aria-label')??el.getAttribute('title')??el.textContent.trim()))].filter(Boolean))};
  page.__audit.interactions.push(record);return record;
 };
 return {ready:true};
}
