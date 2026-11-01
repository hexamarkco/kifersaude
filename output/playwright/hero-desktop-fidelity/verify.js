async (page) => {
  await page.context().route('**/functions/v1/**', route => route.abort());
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('http://127.0.0.1:5220/',{waitUntil:'domcontentloaded'});
  await page.locator('#topo').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const layout=[];
  for(const width of [1024,1280,1440,1536,1672,1920]) {
    await page.setViewportSize({width,height:width===1536?740:Math.round(width*941/1672)});
    const result=await page.evaluate(()=>{
      const rect=s=>document.querySelector(s).getBoundingClientRect();
      const title=document.querySelector('.home-hero-title');
      const links=[...document.querySelectorAll('.home-hero-actions a')];
      const nav=rect('.kds-public-header-navigation'), brand=rect('.kds-public-header-brand'), actions=rect('.kds-public-header-actions');
      return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,titleOverflow:title.scrollWidth>title.clientWidth,navOverlaps:nav.left<brand.right||nav.right>actions.left,buttons:[...document.querySelectorAll('.home-hero-actions .kds-button')].map(e=>({width:e.clientWidth,height:e.clientHeight,overflow:e.scrollWidth>e.clientWidth})),whatsapp:links.length>0&&links.every(a=>a.href.startsWith('https://wa.me/'))};
    });
    if(result.overflow||result.titleOverflow||result.navOverlaps||result.buttons.some(b=>b.overflow)||!result.whatsapp) throw Error(JSON.stringify(result));
    layout.push(result);
  }
  await page.setViewportSize({width:1672,height:941});
  await page.waitForFunction(()=>!document.querySelector('#topo').getAnimations({subtree:true}).some(a=>a.playState==='running'));
  await page.locator('.home-luiza-photo').evaluate(el=>el.decode());
  await page.locator('.home-hero-photo-mask').evaluate(async el=>{const img=new Image();img.src=getComputedStyle(el).maskImage.slice(5,-2);await img.decode();});
  await page.screenshot({path:'output/playwright/hero-desktop-fidelity/normal-motion.png'});
  await page.locator('#topo').getByRole('button',{name:'Quero minha cotação gratuita',exact:true}).click();
  await page.waitForFunction(()=>{const r=document.querySelector('#cotacao').getBoundingClientRect();return r.top>=0&&r.top<innerHeight/2});
  const opacity=await page.locator('.home-hero-photo-mask').evaluate(el=>getComputedStyle(el).opacity);
  await page.goto('http://127.0.0.1:5220/output/playwright/hero-desktop-fidelity/index.html');
  await page.locator('h1').waitFor();
  await page.locator('#width').selectOption('1440');
  await page.locator('#final').evaluate(el=>el.decode());
  const reportWorks=await page.locator('#final').evaluate(el=>el.naturalWidth===1440);
  if(!reportWorks||opacity!=='1') throw Error('Report or motion check failed');
  await page.locator('#width').selectOption('1672');
  return {layout,quoteNavigation:true,normalMotionPhotoOpacity:opacity,reportWorks};
}
