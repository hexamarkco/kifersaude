import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type UserMetadata = {
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
  id?: string;
};

type RequestBody = {
  action?: string;
  userId?: string;
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  updates?: {
    username?: string;
    email?: string;
    password?: string;
    role?: string;
  };
};

function getUserManagementId(user: UserMetadata | null | undefined): string | null {
  if (!user) {
    return null;
  }

  const candidates = [
    user.user_metadata?.user_management_id,
    user.user_metadata?.user_management_user_id,
    user.user_metadata?.user_id,
    user.app_metadata?.user_management_id,
    user.app_metadata?.user_id,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return typeof user.id === 'string' && user.id.trim() !== '' ? user.id : null;
}

async function canManageUsers(serviceClient: ReturnType<typeof createClient>, profileId: string) {
  const { data: profile, error: profileError } = await serviceClient
    .from('user_profiles')
    .select('role')
    .eq('id', profileId)
    .maybeSingle();

  if (profileError || !profile?.role) {
    return false;
  }

  const { data: accessProfile } = await serviceClient
    .from('access_profiles')
    .select('is_admin')
    .eq('slug', profile.role)
    .maybeSingle();

  if (accessProfile?.is_admin || profile.role === 'admin') {
    return true;
  }

  const { data: permission } = await serviceClient
    .from('profile_permissions')
    .select('can_edit')
    .eq('role', profile.role)
    .in('module', ['config-users', 'config'])
    .eq('can_edit', true)
    .limit(1)
    .maybeSingle();

  return Boolean(permission?.can_edit);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Metodo nao permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Nao autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuario nao autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profileId = getUserManagementId(user);

    if (!profileId) {
      return new Response(JSON.stringify({ error: 'Perfil nao encontrado' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allowed = await canManageUsers(serviceClient, profileId);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Permissoes insuficientes' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as RequestBody;
    const action = body.action;

    if (action === 'createUser') {
      const username = body.username?.trim();
      const email = body.email?.trim();
      const password = body.password ?? '';
      const role = body.role?.trim() || 'observer';

      if (!username || !email || password.length < 6) {
        return new Response(JSON.stringify({ error: 'Dados invalidos para criacao do usuario' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: existingProfile } = await serviceClient
        .from('user_profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();

      if (existingProfile) {
        return new Response(JSON.stringify({ error: 'Nome de usuario ja esta em uso' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: createdUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          username,
          role,
          email,
        },
      });

      if (createError || !createdUser.user) {
        return new Response(JSON.stringify({ error: createError?.message || 'Erro ao criar usuario' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const managedUserId = getUserManagementId(createdUser.user) ?? createdUser.user.id;
      const { error: profileUpdateError } = await serviceClient
        .from('user_profiles')
        .update({
          username,
          email,
          role,
          created_by: profileId,
        })
        .eq('id', managedUserId);

      if (profileUpdateError) {
        return new Response(JSON.stringify({ error: profileUpdateError.message || 'Erro ao finalizar perfil do usuario' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, userId: managedUserId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!body.userId || typeof body.userId !== 'string') {
      return new Response(JSON.stringify({ error: 'ID do usuario invalido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'updateUser') {
      const updates = body.updates ?? {};
      const profileUpdates: Record<string, string> = {};
      const authUpdates: { email?: string; password?: string } = {};

      if (typeof updates.username === 'string' && updates.username.trim()) {
        const username = updates.username.trim();

        const { data: existingProfile } = await serviceClient
          .from('user_profiles')
          .select('id')
          .eq('username', username)
          .neq('id', body.userId)
          .maybeSingle();

        if (existingProfile) {
          return new Response(JSON.stringify({ error: 'Nome de usuario ja esta em uso' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        profileUpdates.username = username;
      }

      if (typeof updates.role === 'string' && updates.role.trim()) {
        profileUpdates.role = updates.role.trim();
      }

      if (typeof updates.email === 'string' && updates.email.trim()) {
        const email = updates.email.trim();
        profileUpdates.email = email;
        authUpdates.email = email;
      }

      if (typeof updates.password === 'string' && updates.password.trim()) {
        authUpdates.password = updates.password;
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await serviceClient
          .from('user_profiles')
          .update(profileUpdates)
          .eq('id', body.userId);

        if (profileError) {
          return new Response(JSON.stringify({ error: profileError.message || 'Erro ao atualizar perfil do usuario' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: updateError } = await serviceClient.auth.admin.updateUserById(body.userId, authUpdates);

        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message || 'Erro ao atualizar credenciais do usuario' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'deleteUser') {
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(body.userId);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message || 'Erro ao excluir usuario' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Acao invalida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro inesperado na funcao manage-users:', error);
    return new Response(JSON.stringify({ error: 'Erro interno no servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
