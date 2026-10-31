async (page) => {
 await page.getByRole('button', { name: 'Criar versão e ativar' }).click();
 return await page.evaluate(() => {
 const el=document.querySelector('.kds-toast-viewport'); const out=[];
 const walk=(rules,condition='')=>{for(const r of rules){if(r.cssRules) walk(r.cssRules, condition + (r.conditionText||'')+' '); if(r.cssText?.includes('kds-toast-viewport')) out.push({css:r.cssText, selector:r.selectorText, bottom:r.style?.getPropertyValue('bottom'), condition});}};
 for(const s of document.styleSheets){try{walk(s.cssRules)}catch{}}
 return {vh:innerHeight, styleSheets:[...document.styleSheets].map(s=>s.href||'inline'), el:el?.className, computed:el&&getComputedStyle(el).bottom, out:out.slice(-20)};
 });
}
