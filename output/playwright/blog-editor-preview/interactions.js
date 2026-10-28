async (page) => {
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-editor-preview.html');
 await page.locator('.ql-editor').waitFor();
 await page.getByPlaceholder('Digite o título do post').focus();
 await page.keyboard.press('Tab');
 const focused=await page.evaluate(()=>({name:document.activeElement?.getAttribute('aria-label'),visible:document.activeElement?.matches(':focus-visible')}));
 await page.locator('.ql-editor').fill('Conteúdo fictício');
 const text=await page.locator('.ql-editor').innerText();
 return {focused,text};
}
