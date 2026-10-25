async(page)=>{
 await page.bringToFront();await page.goto('http://127.0.0.1:5174/design-system#components');await page.getByRole('tab',{name:'Aplicação',exact:true}).waitFor();await page.getByRole('tab',{name:'Aplicação',exact:true}).click();await page.locator('.ql-editor').waitFor();return {editor:await page.locator('.ql-editor').innerText(),nodes:await page.locator('.react-flow__node').count()};
}
