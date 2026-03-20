import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

export type DashboardModulePermission = 'view' | 'edit';

export type AuthorizedDashboardUser = {
  userId: string;
  profileId: string;
  role: string;
  canViewModule: boolean;
  canEditModule: boolean;
};

type AuthorizationFailure = {
  authorized: false;
  status: number;
  body: { error: string };
};

type AuthorizationSuccess = {
  authorized: true;
  user: AuthorizedDashboardUser;
};

const readTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const getBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const isServiceRoleRequest = (req: Request, serviceRoleKey: string): boolean => {
  const expected = serviceRoleKey.trim();
  if (!expected) {
    return false;
  }

  const bearerToken = getBearerToken(req.headers.get('Authorization'));
  if (bearerToken && bearerToken === expected) {
    return true;
  }

  const apikey = req.headers.get('apikey')?.trim() || req.headers.get('x-api-key')?.trim() || '';
  return apikey === expected;
};

const getUserManagementId = (user: Record<string, unknown> | null | undefined): string | null => {
  if (!user) return null;

  const userMetadata =
    user.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : null;
  const appMetadata =
    user.app_metadata && typeof user.app_metadata === 'object'
      ? (user.app_metadata as Record<string, unknown>)
      : null;

  const candidates: unknown[] = [
    userMetadata?.user_management_id,
    userMetadata?.user_management_user_id,
    userMetadata?.user_id,
    appMetadata?.user_management_id,
    appMetadata?.user_id,
    user.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

export async function authorizeDashboardUser({
  req,
  supabaseUrl,
  supabaseAnonKey,
  supabaseAdmin,
  module,
  requiredPermission,
}: {
  req: Request;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseAdmin: SupabaseClient;
  module?: string;
  requiredPermission?: DashboardModulePermission;
}): Promise<AuthorizationFailure | AuthorizationSuccess> {
  const bearerToken = getBearerToken(req.headers.get('Authorization'));

  if (!bearerToken) {
    return {
      authorized: false,
      status: 401,
      body: { error: 'Nao autenticado' },
    };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return {
      authorized: false,
      status: 401,
      body: { error: 'Token de autenticacao invalido' },
    };
  }

  const profileId = getUserManagementId(user as unknown as Record<string, unknown>);
  if (!profileId) {
    return {
      authorized: false,
      status: 403,
      body: { error: 'Perfil do usuario nao encontrado' },
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError) {
    return {
      authorized: false,
      status: 500,
      body: { error: 'Erro ao validar perfil do usuario' },
    };
  }

  const role = readTrimmedString(profile?.role);
  if (!role) {
    return {
      authorized: false,
      status: 403,
      body: { error: 'Perfil do usuario nao encontrado' },
    };
  }

  let canViewModule = true;
  let canEditModule = role === 'admin';

  if (module) {
    const { data: permission, error: permissionError } = await supabaseAdmin
      .from('profile_permissions')
      .select('can_view, can_edit')
      .eq('role', role)
      .eq('module', module)
      .maybeSingle();

    if (permissionError) {
      return {
        authorized: false,
        status: 500,
        body: { error: 'Erro ao validar permissao de usuario' },
      };
    }

    canViewModule = role === 'admin' ? true : Boolean(permission?.can_view);
    canEditModule = role === 'admin' ? true : Boolean(permission?.can_edit);

    if (!canViewModule) {
      return {
        authorized: false,
        status: 403,
        body: { error: 'Permissao insuficiente' },
      };
    }

    if (requiredPermission === 'edit' && !canEditModule) {
      return {
        authorized: false,
        status: 403,
        body: { error: 'Permissao insuficiente' },
      };
    }
  }

  return {
    authorized: true,
    user: {
      userId: readTrimmedString(user.id),
      profileId,
      role,
      canViewModule,
      canEditModule,
    },
  };
}
