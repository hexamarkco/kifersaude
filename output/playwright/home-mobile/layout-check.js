async (page) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[];
  const failures=[];
  for(const width of [320,360,375,390,414,430]) {
    await page.setViewportSize({width,height:900});
    await page.goto('http://127.0.0.1:5194/');
    await page.locator('.home-footer').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    const result=await page.evaluate(()=>{
      const box=selector=>document.querySelector(selector).getBoundingClientRect();
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      const broken=[...document.querySelectorAll('.home-about-benefits h3,.home-quote-benefits h3')].flatMap(el=>{
        const style=getComputedStyle(el);ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return el.textContent.split(/\s+/).filter(Boolean).filter(word=>{
          const value=style.textTransform==='uppercase'?word.toUpperCase():word;
          return ctx.measureText(value).width+(value.length-1)*(parseFloat(style.letterSpacing)||0)>el.clientWidth+1;
        }).map(word=>({word,width:el.clientWidth,font:style.fontSize}));
      });
      return {
        client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
        heroOrder:box('.home-hero-actions').bottom<=box('.home-hero-portrait').top&&box('.home-hero-portrait').bottom<=box('.home-hero-benefits').top,
        quoteOrder:box('.home-quote-form').bottom<=box('.home-quote-benefits').top,
        quoteCopyClear:box('.home-quote-copy > .home-lead').top>=box('.home-quote-background').bottom-1,
        footerOrder:box('[aria-label="Planos por perfil"]').top>=box('[aria-label="Navegação do rodapé"]').bottom,
        primaryTouch:box('.home-hero-actions button').height>=44,
        inputFont:getComputedStyle(document.querySelector('#quote-name')).fontSize,
        broken,
      };
    });
    if(result.scroll>result.client||!result.heroOrder||!result.quoteOrder||!result.quoteCopyClear||!result.footerOrder||!result.primaryTouch||result.inputFont!=='16px'||result.broken.length) failures.push({width,...result});
    results.push({width,...result});
    if(width===320) {
      await page.setViewportSize({width,height:2400});
      await page.locator('.home-whatsapp-visual').scrollIntoViewIfNeeded();
      await page.locator('.home-whatsapp-photo img').evaluate(el=>el.decode());
      await page.locator('#fale-agora').screenshot({path:'output/playwright/home-mobile/320-whatsapp-final.png',animations:'disabled'});
    }
  }
  if(failures.length)throw new Error(JSON.stringify(failures));
  return {results};
}
