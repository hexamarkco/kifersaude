async (page) => {
  if (new URL(page.url()).hostname !== '127.0.0.1') throw new Error('Use the local comparison preview.');
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:5208/');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1440,height:1000});
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const loaded = () => page.locator('.comparison img').evaluateAll(async images => {
    await Promise.all(images.map(async image=>{
      image.loading='eager';
      if(!image.complete) await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error(`Image failed: ${image.src}`));});
      await image.decode();
    }));
    return images.every(image=>image.complete&&image.naturalWidth>0);
  });
  assert(await page.locator('main>section').count()===10,'Expected ten sections');
  assert(await page.locator('.reference-link').count()===10,'Expected ten references');
  assert(await page.locator('.capture-link').count()===10,'Expected ten real captures');
  const widths=[];
  for(const width of [320,360,375,390,414,430]) {
    await page.locator('#width').selectOption(String(width));
    assert(await loaded(),`Images did not load at ${width}`);
    const pairs=await page.locator('.comparison').evaluateAll(rows=>rows.map(row=>{
      const [reference,capture]=row.querySelectorAll('img');
      const a=reference.getBoundingClientRect(),b=capture.getBoundingClientRect();
      return {referenceWidth:a.width,captureWidth:b.width,topAligned:Math.abs(a.top-b.top)<1,
        referenceRatioError:Math.abs(a.width/a.height-reference.naturalWidth/reference.naturalHeight),
        captureRatioError:Math.abs(b.width/b.height-capture.naturalWidth/capture.naturalHeight),
        source:capture.getAttribute('src'),naturalWidth:capture.naturalWidth};
    }));
    assert(pairs.every(pair=>pair.referenceWidth===width&&pair.captureWidth===width&&pair.topAligned&&pair.referenceRatioError<0.001&&pair.captureRatioError<0.001&&pair.naturalWidth===width&&pair.source.startsWith(`${width}/`)),`Invalid image scale or source: ${JSON.stringify(pairs)}`);
    assert(await page.locator('#full').getAttribute('href')===`${width}/page.png`,'Full page link did not update');
    assert(await page.locator('#viewport').getAttribute('href')===`${width}/viewport.png`,'Viewport link did not update');
    widths.push({width,pairs:pairs.length,images:'loaded',scale:'equal widths; original proportions',links:'passed'});
  }
  await page.locator('#section').selectOption('secao-10');
  assert(await page.locator('#secao-10').evaluate(el=>el.getBoundingClientRect().top>=0&&el.getBoundingClientRect().top<200),'Section navigation failed');
  await page.locator('#width').selectOption('390');
  await loaded();
  for(const selector of ['.reference-link','.capture-link']) {
    const [popup]=await Promise.all([page.waitForEvent('popup'),page.locator(selector).first().click()]);
    await popup.waitForLoadState();
    assert(popup.url().endsWith('.png'),'Original image did not open');
    await popup.close();
  }
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,columns:getComputedStyle(document.querySelector('.comparison')).gridTemplateColumns}));
  assert(mobile.client===390&&mobile.scroll===390,'Comparison page has horizontal overflow on mobile');
  const smallPairs=await page.locator('.comparison').evaluateAll(rows=>rows.every(row=>{
    const [a,b]=[...row.querySelectorAll('img')].map(img=>img.getBoundingClientRect());
    return Math.abs(a.width-b.width)<1&&a.bottom<b.top;
  }));
  assert(smallPairs,'Comparison does not stack correctly on mobile');
  await page.setViewportSize({width:1440,height:1700});
  await page.locator('#section').selectOption('');
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:'output/playwright/home-mobile-comparison/review-desktop.png',animations:'disabled'});
  assert(!errors.length,`Runtime errors: ${JSON.stringify(errors)}`);
  return {sections:10,widths,mobile,originalImageLinks:'passed',sectionNavigation:'passed',errors};
}
