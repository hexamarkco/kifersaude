async(page)=>{
 const eager=()=>{
  const load=()=>document.querySelectorAll('img[loading="lazy"]').forEach(im=>{im.loading='eager';});
  new MutationObserver(load).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['loading']});load();
 };
 await page.context().addInitScript(eager);await page.evaluate(eager);return {ready:true};
}
