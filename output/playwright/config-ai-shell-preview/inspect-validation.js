async (page) => await page.evaluate(() => {
 const body=document.querySelector('.kds-drawer-body'); const field=document.querySelector('.kds-ai-editor-drawer .kds-field:has(textarea[placeholder="Descreva como a IA deve agir nesta tarefa..."])'); const error=document.querySelector('.kds-ai-editor-drawer [role="alert"]');
 return {body:body?.getBoundingClientRect().toJSON(), bodyScroll:body?.scrollTop, field:field?.getBoundingClientRect().toJSON(), error:error?.getBoundingClientRect().toJSON(), footer:document.querySelector('.kds-ai-editor-footer')?.getBoundingClientRect().toJSON(), fieldOverflow:getComputedStyle(field).overflow, bodyOverflow:getComputedStyle(body).overflow, scrollIntoView:typeof field?.scrollIntoView};
})
