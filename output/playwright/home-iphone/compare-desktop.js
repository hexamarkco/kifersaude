async (page) => {
  if (!['127.0.0.1','localhost'].includes(new URL(page.url()).hostname)) throw new Error('Use local previews.');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.context().route('**/_vercel/speed-insights/script.js', route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.context().route('**/servicodados.ibge.gov.br/**', route=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[{"nome":"Rio de Janeiro"}]'}));
  const results=[];
  for(const width of [640,768,1024,1200,1440,1536,1920]) {
    const captures=[];
    await page.setViewportSize({width,height:width===1536?760:900});
    for(const port of [5196,5197]) {
      await page.goto(`http://127.0.0.1:${port}/`);
      await page.locator('.home-footer').waitFor();
      for(const section of await page.locator('.kifer-home main>section,.home-footer').all()) {
        await section.scrollIntoViewIfNeeded();
        for(const img of await section.locator('img:visible').all()) await img.evaluate(el=>el.decode().catch(()=>{}));
      }
      await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const fingerprint=await page.evaluate(()=>{
        // Auto margins can serialize differently for identical boxes; compare their effect through every element's bounds.
        const properties=['display','position','visibility','opacity','transform','font-family','font-size','font-weight','font-style','line-height','letter-spacing','color','background-color','border-width','border-radius','object-fit','object-position','padding','gap','grid-template-columns','grid-template-rows','align-items','justify-content','overflow'];
        return JSON.stringify([...document.querySelectorAll('.kifer-home,.kifer-home *')].map(el=>{
          const r=el.getBoundingClientRect(),s=getComputedStyle(el);
          return [el.tagName,r.x,r.y,r.width,r.height,...properties.map(key=>s.getPropertyValue(key))];
        }));
      });
      const client=await page.evaluate(()=>document.documentElement.clientWidth);
      const png=await page.screenshot({fullPage:true,animations:'disabled',style:`.kifer-home{width:${client}px!important;}header,.home-skip-link{visibility:hidden!important;}`});
      captures.push({fingerprint,png});
    }
    if(captures[0].fingerprint!==captures[1].fingerprint) {
      const before=JSON.parse(captures[0].fingerprint),after=JSON.parse(captures[1].fingerprint);
      const differences=before.flatMap((value,index)=>JSON.stringify(value)===JSON.stringify(after[index])?[]:[{index,before:value,after:after[index]}]).slice(0,3);
      throw new Error(`Desktop/tablet geometry or styles changed at ${width}: ${JSON.stringify(differences)}`);
    }
    const pixels=await page.evaluate(async data=>{
      const load=src=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.src='data:image/png;base64,'+src;});
      const [a,b]=await Promise.all(data.map(load));
      if(a.width!==b.width||a.height!==b.height) throw new Error('Screenshot dimensions changed');
      const read=img=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,img.width,img.height).data;};
      const x=read(a),y=read(b);let changed=0;
      for(let i=0;i<x.length;i+=4) if(x[i]!==y[i]||x[i+1]!==y[i+1]||x[i+2]!==y[i+2]||x[i+3]!==y[i+3]) changed++;
      return {changed,total:a.width*a.height};
    },captures.map(capture=>capture.png.toString('base64')));
    if(pixels.changed/pixels.total>0.001) throw new Error(`Desktop/tablet pixels changed at ${width}: ${JSON.stringify(pixels)}`);
    results.push({width,geometryAndStyles:'identical',...pixels});
  }
  return {results};
}
