async(page)=>{
 const reports=[];await page.bringToFront();
 for(const width of [320,390,768,1920])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:width===1920?1080:844});await page.goto('http://127.0.0.1:5174/design-system?preview=1&pattern=list&theme='+theme);await page.locator('h1').waitFor();
  const result=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,table:document.querySelector('.kds-table').getBoundingClientRect().width,selectionColumn:document.querySelector('th').getBoundingClientRect().width}));if(result.width>result.viewport)throw new Error('List overflow');reports.push({theme,...result});
 }
 return reports;
}
