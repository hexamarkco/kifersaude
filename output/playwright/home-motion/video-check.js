async (page) => {
  const output=[];
  for(const kind of ['desktop','mobile']) {
    await page.goto(`file:///C:/Users/Nick%20Martins/Documents/GitHub/kifersaude/output/playwright/home-motion/${kind}.webm`);
    const video=page.locator('video');
    await video.waitFor();
    await video.evaluate((el,time)=>new Promise(resolve=>{
      el.pause();
      el.addEventListener('seeked',resolve,{once:true});
      el.currentTime=time;
    }),kind==='desktop'?10:12);
    const result=await video.evaluate(el=>({duration:el.duration,width:el.videoWidth,height:el.videoHeight,ready:el.readyState,error:el.error?.message||null}));
    await video.screenshot({path:`output/playwright/home-motion/video-${kind}-frame.png`});
    output.push({kind,...result});
  }
  return output;
}
