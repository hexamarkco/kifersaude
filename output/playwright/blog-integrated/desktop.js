async (page) => {
 await page.keyboard.press('Escape');
 await page.evaluate(()=>document.querySelector('.painel-theme:not(.modal-theme-host)')?.classList.remove('theme-dark'));
 await page.setViewportSize({width:1920,height:1080});
 await page.getByRole('button',{name:'Visualizar',exact:true}).click();
 await page.locator('[role=dialog] .ql-editor').waitFor();
 await page.screenshot({path:'output/playwright/blog-integrated-preview-1920.png',fullPage:true});
 return {content:await page.locator('[role=dialog] .ql-editor').innerText()};
}
