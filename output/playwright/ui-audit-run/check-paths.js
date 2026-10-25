async(page)=>({paths:[...new Set(page.__audit.requests.map(r=>r.path))].filter(p=>p.includes('comm_')||p.includes('comm-'))})
