async(page)=>{
 const results=[];
 const inspect=async(name)=>results.push({name,rounded:await page.evaluate(()=>{const groups=new Map();for(const el of document.querySelectorAll('button,input,select,textarea,[role="tablist"],.kds-button-group,.kds-input-group,.kds-toolbar')){const r=el.getBoundingClientRect();const cs=getComputedStyle(el);if(!r.width||!r.height||Number.parseFloat(cs.borderTopLeftRadius)<24)continue;const key=el.className;groups.set(key,{class:key,tag:el.tagName,text:el.textContent?.trim().slice(0,50),radius:cs.borderRadius,count:(groups.get(key)?.count??0)+1});}return [...groups.values()];})});
 for(const section of ['components','states','patterns']){
  await page.goto('http://127.0.0.1:5174/design-system#'+section);await page.locator('main h1').waitFor();await inspect(section);
  if(section==='components')for(const tab of ['Formulários','Navegação','Dados','Feedback','Interações']){await page.getByRole('tab',{name:tab,exact:true}).click();await inspect(tab);}
 }
 return results;
}
