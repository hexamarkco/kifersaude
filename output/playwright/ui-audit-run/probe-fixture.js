async(page)=>{
 const result=await page.evaluate(()=>fetch('/audit-backend/rest/v1/rpc/comm_whatsapp_list_chats_with_presence',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(r=>r.json()));
 return {type:typeof result,isArray:Array.isArray(result),length:result?.length,first:result?.[0]?.display_name};
}
