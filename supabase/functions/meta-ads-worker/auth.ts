import { isServiceRoleRequest } from '../_shared/service-role-auth.ts';

export function isAuthorizedMetaWorker(req: Request, serviceKey: string, workerSecret: string): boolean {
  if (isServiceRoleRequest(req,serviceKey)) return true;
  const supplied=req.headers.get('x-meta-worker-secret') ?? '';
  if (!/^[a-f0-9]{64}$/.test(workerSecret) || supplied.length!==workerSecret.length) return false;
  let difference=0;
  for(let index=0;index<workerSecret.length;index++) difference|=supplied.charCodeAt(index)^workerSecret.charCodeAt(index);
  return difference===0;
}
