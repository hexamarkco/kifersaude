async(page)=>{
 await page.locator('img[loading="lazy"]').evaluateAll(els=>els.forEach(el=>{el.loading='eager';}));
 return {images:await page.locator('img').count()};
}
