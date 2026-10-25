async(page)=>{
 const original=page.__audit.db.user_profiles[0].role,profiles=page.__audit.db.access_profiles,permissions=page.__audit.db.profile_permissions;
 const records=[];
 try{
  page.__audit.db.user_profiles[0].role='observer';
  page.__audit.db.access_profiles=[...profiles,{id:'demo-observer',slug:'observer',name:'Observador',is_system:true,is_admin:false}];
  page.__audit.db.profile_permissions=[...permissions,...['dashboard','leads','contracts','reminders','financeiro-agenda'].map(module=>({id:'demo-permission-'+module,role:'observer',module,can_view:true,can_edit:false}))];
  for(const [id,category,route]of [['leads','leads','/painel/leads'],['contratos','contratos','/painel/contratos'],['dashboard','dashboard','/painel/dashboard']])for(const [device,width,height]of [['desktop',1920,1080],['tablet',768,1024],['mobile',390,844]]){
   await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5177'+route);await page.locator('main h1').first().waitFor();await page.waitForLoadState('networkidle',{timeout:1500}).catch(()=>{});
   const r=await page.__audit.captureState({id:id+'-observador',name:id+' — perfil observador',category,route,device,kind:'permission'});records.push({id:r.id,device,status:r.status});
  }
 }finally{page.__audit.db.user_profiles[0].role=original;page.__audit.db.access_profiles=profiles;page.__audit.db.profile_permissions=permissions;}
 return records;
}
