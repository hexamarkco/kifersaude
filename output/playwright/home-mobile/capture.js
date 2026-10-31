async (page) => {
  page.setDefaultTimeout(15000);
  await page.context().route('**/_vercel/speed-insights/script.js',route=>route.fulfill({contentType:'application/javascript',body:''}));
  const widths=[320,360,375,390,414,430,768,1024,1440,1536,1920];
  const sections=['#topo','#prova-social','#para-quem','#como-funciona','#depoimentos','#quem-somos','#faq','#cotacao','#fale-agora','.home-footer'];
  const originals=new Map();
  const originalStyles=new Map();
  const results=[];
  for(const version of ['before','after']) {
    for(const width of widths) {
      await page.setViewportSize({width,height:width===1536?760:900});
      await page.goto(`http://127.0.0.1:${version==='before'?5193:5194}/`);
      await page.locator('.home-footer').waitFor();
      await page.evaluate(()=>document.fonts.ready);
      for(const selector of sections) {
        const section=page.locator(selector);
        await section.scrollIntoViewIfNeeded();
        await section.evaluate(el=>new Promise(resolve=>{
          const check=()=>el.dataset.homeMotion==='played'?resolve():requestAnimationFrame(check);
          check();
        }));
        for(const img of await section.locator('img:visible').all()) await img.evaluate(el=>new Promise(resolve=>{
          if(el.complete)el.decode().catch(()=>{}).then(resolve);else {el.addEventListener('load',resolve,{once:true});el.addEventListener('error',resolve,{once:true});}
        }));
      }
      await page.locator('.home-message:nth-child(3)').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>document.querySelector('.home-phone').dataset.homeMotion==='played',undefined,{polling:50});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>!document.querySelector('.home-motion-entering'),undefined,{polling:50});
      await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.getTiming().iterations!==Infinity),undefined,{polling:50});
      const styles=width>=640?await page.evaluate(()=>{
        const properties=['display','position','visibility','opacity','transform','font-family','font-size','font-weight','font-style','line-height','letter-spacing','color','background-color','border-width','border-color','border-radius','box-shadow','object-fit','object-position','padding','margin','gap','grid-template-columns','grid-template-rows','align-items','justify-content','text-align','overflow','clip-path'];
        return JSON.stringify([...document.querySelectorAll('.kifer-home,.kifer-home *')].map(el=>{
          const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
          return [el.tagName,rect.x,rect.y,rect.width,rect.height,...properties.map(name=>style.getPropertyValue(name))];
        }));
      }):null;
      const metrics=await page.evaluate(()=>({
        client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
        blocks:[...document.querySelectorAll('.kifer-home main>section,.home-footer')].map(el=>({id:el.id||'footer',height:el.getBoundingClientRect().height,text:el.textContent.replace(/\s+/g,' ').trim()})),
        clipped:[...document.querySelectorAll('.kifer-home h1,.kifer-home h2,.kifer-home h3,.kifer-home p')].filter(el=>!el.closest('[aria-hidden="true"]')&&el.clientWidth>0&&el.scrollWidth>el.clientWidth+1).map(el=>({text:el.textContent.slice(0,80),width:el.clientWidth,scroll:el.scrollWidth})),
      }));
      const buffer=await page.screenshot({path:`output/playwright/home-mobile/${width}-full-${version}.png`,fullPage:true,animations:'disabled',style:`.kifer-home{width:${metrics.client}px!important;}`});
      let identical=null;
      let unchanged=null;
      let pixelDifference=0;
      if(width>=640) {
        if(version==='before') {originals.set(width,buffer);originalStyles.set(width,styles);}
        else {
          unchanged=styles===originalStyles.get(width);
          if(!unchanged) throw new Error(`Approved geometry or computed styles changed: ${width}`);
          identical=buffer.equals(originals.get(width));
          if(!identical) {
            const pixels=await page.evaluate(async({before,after})=>{
              const load=data=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.src='data:image/png;base64,'+data;});
              const [a,b]=await Promise.all([load(before),load(after)]);
              if(a.width!==b.width||a.height!==b.height)return {changed:-1,a:[a.width,a.height],b:[b.width,b.height]};
              const read=img=>{const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,img.width,img.height).data;};
              const x=read(a),y=read(b);let changed=0,left=a.width,top=a.height,right=0,bottom=0;
              for(let i=0;i<x.length;i+=4)if(x[i]!==y[i]||x[i+1]!==y[i+1]||x[i+2]!==y[i+2]||x[i+3]!==y[i+3]){changed++;const px=i/4%a.width,py=Math.floor(i/4/a.width);left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);}
              return {changed,bounds:[left,top,right,bottom]};
            },{before:originals.get(width).toString('base64'),after:buffer.toString('base64')});
            identical=pixels.changed===0;
            pixelDifference=pixels.changed;
            if(pixels.changed<0||pixels.changed/(width*await page.locator('body').evaluate(el=>el.scrollHeight))>.001) throw new Error(`Approved viewport changed: ${width} ${JSON.stringify(pixels)}`);
          }
        }
      }
      if(version==='after'&&(metrics.scroll>metrics.client+1||metrics.clipped.length)) throw new Error(`Overflow or clipped text: ${JSON.stringify({width,...metrics})}`);
      results.push({version,width,identical,unchanged,pixelDifference,...metrics});
    }
  }
  await page.setViewportSize({width:390,height:2400});
  await page.goto('http://127.0.0.1:5194/');
  await page.evaluate(()=>document.fonts.ready);
  for(const selector of sections) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    for(const img of await page.locator(`${selector} img:visible`).all()) await img.evaluate(el=>new Promise(resolve=>{if(el.complete)resolve();else el.addEventListener('load',resolve,{once:true});}));
    await page.waitForFunction(()=>!document.querySelector('.home-motion-entering'),undefined,{polling:50});
    const client=await page.evaluate(()=>document.documentElement.clientWidth);
    await page.locator(selector).screenshot({path:`output/playwright/home-mobile/390-${selector.replace(/[.#]/g,'')}.png`,animations:'disabled',style:`.kifer-home{width:${client}px!important;}header{visibility:hidden!important;}`});
  }
  return {results};
}
