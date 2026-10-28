async (page) => {
 await page.goto('http://127.0.0.1:5173/output/playwright/blog-editor-preview.html');
 await page.locator('input[type=file]').first().focus();
 return await page.evaluate(() => ({focus:document.activeElement?.getAttribute('type'), labelFocused:document.activeElement?.closest('label')?.matches(':focus-within')}));
}
