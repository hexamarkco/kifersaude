async(page)=>{
 await page.bringToFront();await page.goto('http://127.0.0.1:5175/local-artifacts/ux-review-20261023/index.html?mode=catalogs');await page.getByRole('heading',{name:'Etapas do funil',exact:true}).waitFor();return {title:await page.title(),buttons:await page.getByRole('button').allTextContents(),heading:await page.getByRole('heading').allTextContents()};
}
