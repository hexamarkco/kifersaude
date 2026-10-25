async(page)=>{
 await page.context().route('**/audit-backend/rest/v1/rpc/comm_whatsapp_get_operational_state',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(page.__audit.db.comm_whatsapp_channels.map(c=>({...c,config_enabled:true,connected_user_name:'Canal Demonstração',last_webhook_received_at:'2026-10-25T12:00:00Z'})))}));
 page.__audit.failTables=[];page.__audit.slowTables=[];
 await page.context().route('**/audit-backend/rest/v1/**',async route=>{
  const table=new URL(route.request().url()).pathname.split('/rest/v1/')[1];
  if(page.__audit.failTables.includes(table))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Falha de demonstração: serviço indisponível.',code:'DEMO_ERROR'})});
  if(page.__audit.slowTables.includes(table))await new Promise(r=>setTimeout(r,3000));
  return route.fallback();
 });
 return {ready:true};
}
