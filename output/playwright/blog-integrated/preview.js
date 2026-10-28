async (page) => {
 const shots=[];
 for(const [width,height] of [[768,1024],[390,844]]) {
  await page.setViewportSize({width,height});
  await page.screenshot({path:`output/playwright/blog-integrated-preview-${width}.png`,fullPage:true});
  shots.push(await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth})));
 }
 await page.keyboard.press('Escape');
 await page.setViewportSize({width:320,height:640});
 await page.getByRole('button',{name:'Mais ações de guia de planos de saúde'}).click();
 await page.getByRole('menuitem',{name:'Visualizar'}).click();
 await page.getByRole('dialog',{name:'Prévia do artigo'}).waitFor();
 await page.evaluate(()=>document.querySelector('.painel-theme:not(.modal-theme-host)')?.classList.add('theme-dark'));
 // Reopen so the dialog portal receives the simulated theme.
 await page.keyboard.press('Escape');
 const focus=await page.evaluate(()=>document.activeElement?.getAttribute('aria-label'));
 await page.getByRole('button',{name:'Mais ações de guia de planos de saúde'}).click();
 await page.getByRole('menuitem',{name:'Visualizar'}).click();
 await page.waitForTimeout(500);
 await page.screenshot({path:'output/playwright/blog-integrated-preview-dark-320.png',fullPage:true});
 return {shots,focus};
}
