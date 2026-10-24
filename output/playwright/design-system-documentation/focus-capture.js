async(page)=>{await page.bringToFront();return {visibility:await page.evaluate(()=>document.visibilityState),url:page.url()};}
