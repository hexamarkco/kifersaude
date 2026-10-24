async (page) => {
 await page.setViewportSize({width:1440,height:1000});
 await page.goto('http://127.0.0.1:5173/design-system#responsive');
 const reports=[];
 for (const [device,expected] of [['desktop',1024],['tablet',768],['mobile',390]]) {
  await page.getByRole('button',{name:'Visualizar em '+device,exact:true}).click();
  await page.frameLocator('iframe').getByRole('heading',{name:'Contatos',exact:true}).waitFor();
  const actual=await page.locator('iframe').evaluate(el=>el.contentWindow.innerWidth);
  if (device !== 'desktop' && actual !== expected) throw new Error(device+' has width '+actual);
  if (device === 'desktop' && actual < expected) throw new Error('Desktop below 1024px');
  reports.push({device,actual});
 }
 await page.getByRole('button',{name:'Visualizar em tablet',exact:true}).click();
 const navVisible=await page.frameLocator('iframe').getByRole('button',{name:'Abrir navegação do exemplo'}).isVisible();
 await page.screenshot({path:'output/playwright/design-system-responsive.png'});
 await page.goto('http://127.0.0.1:5173/design-system#overview');
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:'output/playwright/design-system-desktop.png'});
 return {reports,tabletNavigationCollapsed:navVisible};
}
