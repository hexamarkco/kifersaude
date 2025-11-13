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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const profileId = getUserManagementId(user);

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: 'Perfil não encontrado' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', profileId)
      .maybeSingle();

    if (profileError) {
      console.error('Erro ao buscar perfil:', profileError);
      return new Response(
        JSON.stringify({ error: 'Erro ao validar permissões' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!profile || profile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Permissões insuficientes' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { action, userId, updates } = await req.json();

    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'ID do usuário inválido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'updateUser') {
      const authUpdates: { email?: string; password?: string } = {};

      if (updates && typeof updates === 'object') {
        if (typeof updates.email === 'string' && updates.email.trim() !== '') {
          authUpdates.email = updates.email.trim();
        }
        if (typeof updates.password === 'string' && updates.password.trim() !== '') {
          authUpdates.password = updates.password;
        }
      }

      if (Object.keys(authUpdates).length === 0) {
        return new Response(
          JSON.stringify({ error: 'Nenhuma atualização válida informada' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, authUpdates);

      if (updateError) {
        console.error('Erro ao atualizar usuário:', updateError);
        return new Response(
          JSON.stringify({ error: updateError.message || 'Erro ao atualizar usuário' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'deleteUser') {
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);

      if (deleteError) {
        console.error('Erro ao excluir usuário:', deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message || 'Erro ao excluir usuário' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro inesperado na função manage-users:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno no servidor' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
