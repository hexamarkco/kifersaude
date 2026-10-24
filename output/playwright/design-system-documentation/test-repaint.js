async(page)=>{
 await page.setViewportSize({width:1921,height:1080});
 await page.setViewportSize({width:1920,height:1080});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.screenshot({path:'output/playwright/design-system-documentation/modal-repaint.png',fullPage:false,animations:'disabled',caret:'hide'});
 return {viewport:page.viewportSize()};
}
