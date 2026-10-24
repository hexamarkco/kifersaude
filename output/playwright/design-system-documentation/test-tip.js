async(page)=>{
 return await page.evaluate(()=>({pseudos:[...document.querySelectorAll('.ds-topbar-actions button,.ds-topbar-actions .kds-tooltip-anchor')].map(el=>({after:getComputedStyle(el,'::after').content,before:getComputedStyle(el,'::before').content})),texts:[...document.querySelectorAll('*')].filter(el=>el.children.length===0&&el.textContent==='Ativar tema escuro').map(el=>({tag:el.tagName,html:el.outerHTML,parent:el.parentElement.outerHTML.slice(0,2000)}))}));
}
