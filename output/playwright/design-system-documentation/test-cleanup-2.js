async(page)=>{
 const buttons=await page.locator('.ds-topbar-actions').evaluate(el=>el.outerHTML);
 const tips=await page.locator('[role=tooltip],.kds-tooltip').count();
 await page.mouse.move(500,50);
 await page.waitForTimeout(1000);
 await page.screenshot({path:'output/playwright/design-system-documentation/modal-clean-check-2.png',fullPage:false,animations:'disabled',caret:'hide'});
 return {buttons,tips};
}
