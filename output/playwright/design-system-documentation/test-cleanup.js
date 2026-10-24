async(page)=>{
 await page.setViewportSize({width:1920,height:1080});
 await page.goto('https://www.kifersaude.com.br/design-system#components',{waitUntil:'networkidle'});
 await page.getByRole('tab',{name:'Interações',exact:true}).click();
 await page.getByRole('button',{name:'Criar contato no modal',exact:true}).click();
 const before=await page.getByRole('tooltip').allTextContents();
 await page.evaluate(()=>document.querySelectorAll('.ds-topbar-actions .kds-tooltip-anchor').forEach(el=>{
  el.dispatchEvent(new MouseEvent('mouseout',{bubbles:true,relatedTarget:document.body}));
  el.dispatchEvent(new FocusEvent('focusout',{bubbles:true,relatedTarget:document.body}));
 }));
 await page.waitForTimeout(400);
 const after=await page.getByRole('tooltip').allTextContents();
 await page.screenshot({path:'output/playwright/design-system-documentation/modal-clean-check.png',fullPage:false,animations:'disabled',caret:'hide'});
 return {before,after,modals:await page.getByRole('dialog').count()};
}
