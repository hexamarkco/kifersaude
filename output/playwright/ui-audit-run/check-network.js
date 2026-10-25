async(page)=>({requests:page.__audit.requests.filter(r=>/whatsapp.*(list|state|channel)/.test(r.path)).slice(0,12),unknown:[...new Set(page.__audit.unknown)],errors:page.__audit.errors.slice(-8)})
