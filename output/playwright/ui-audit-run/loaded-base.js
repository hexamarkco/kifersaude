async(page)=>{
 const records=[];
 for(const [id,category,route,label,role]of [['inbox','comunicacao','/painel/inbox','^Contato Demonstração 01','button'],['chat-ia','ia','/chat','Atendimento de demonstração','button']])for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route);await page.getByText(id==='inbox'?'Contato Demonstração 01':label,{exact:true}).filter({visible:true}).first().waitFor({timeout:25000});await page.evaluate(()=>document.fonts.ready);
  const prefix=`docs/ui-audit/${device}/${category}/${id}`;await page.screenshot({path:prefix+'-inicial.png',animations:'disabled'});await page.screenshot({path:prefix+'-completa.png',fullPage:true,animations:'disabled'});
  const r={id,device,route,status:'captured',screenshots:[prefix+'-inicial.png',prefix+'-completa.png'],note:'Recaptura após confirmação de dados demonstrativos carregados.'};page.__audit.captures.push(r);records.push(r);
 }
 return records;
}
