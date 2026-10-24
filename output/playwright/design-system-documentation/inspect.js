async (page) => {
 await page.waitForLoadState('networkidle');
 await page.evaluate(()=>document.fonts.ready);
 return await page.evaluate(()=>({url:location.href,title:document.title,sections:[...document.querySelectorAll('section[id]')].map(s=>({id:s.id,title:s.querySelector('h2')?.textContent,cards:[...s.querySelectorAll('.ds-item-card')].map(c=>({title:c.querySelector('p')?.textContent,buttons:[...c.querySelectorAll('button')].map(b=>({text:b.textContent,aria:b.getAttribute('aria-label')})),inputs:[...c.querySelectorAll('input')].map(i=>({type:i.type,placeholder:i.placeholder,aria:i.getAttribute('aria-label')}))}))})),images:[...document.images].map(i=>({src:i.currentSrc,complete:i.complete,width:i.naturalWidth})),fonts:document.fonts.status,dimensions:{width:innerWidth,height:innerHeight,fullHeight:document.documentElement.scrollHeight}}));
}
