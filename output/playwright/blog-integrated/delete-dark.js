async (page) => {
 await page.evaluate(()=>document.querySelector('.painel-theme:not(.modal-theme-host)')?.classList.add('theme-dark'));
 await page.setViewportSize({width:320,height:640});
 await page.getByRole('button',{name:'Mais ações de guia de planos de saúde'}).click();
 await page.getByRole('menuitem',{name:'Excluir'}).click();
 await page.getByRole('dialog').waitFor();
 await page.waitForTimeout(500);
 await page.screenshot({path:'output/playwright/blog-confirm-dark-320.png'});
 await page.keyboard.press('Escape');
 return {closed:await page.getByRole('dialog').count(),focus:await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'))};
}
