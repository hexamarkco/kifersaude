import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { isServiceRoleRequest } from './dashboard-auth.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function resolveMcpServiceActor(req: Request, supabaseAdmin: SupabaseClient, serviceRoleKey: string) {
  if (!isServiceRoleRequest(req, serviceRoleKey)) return { isServiceRole: false, actorId: null, authorized: false } as const;
  const actorId = req.headers.get('X-Kifer-MCP-Actor-Id')?.trim() || '';
  if (!UUID.test(actorId)) return { isServiceRole: true, actorId: null, authorized: false } as const;
  const { data: profile, error: profileError } = await supabaseAdmin.from('user_profiles').select('role').eq('id', actorId).maybeSingle();
  if (profileError || !profile || typeof profile.role !== 'string') return { isServiceRole: true, actorId, authorized: false } as const;
  const { data: accessProfile, error: accessError } = await supabaseAdmin.from('access_profiles').select('is_admin').eq('slug', profile.role).maybeSingle();
  const isAdmin = !accessError && (accessProfile?.is_admin === true || profile.role === 'admin');
  return { isServiceRole: true, actorId, authorized: isAdmin } as const;
}
