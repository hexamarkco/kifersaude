async(page)=>({result:await page.evaluate(()=>fetch('/audit-backend/rest/v1/ai_sandbox_conversations?select=*').then(r=>r.json()))})
