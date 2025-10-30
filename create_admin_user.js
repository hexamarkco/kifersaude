import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eaxvvhamkmovkoqssahj.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não encontrada nas variáveis de ambiente');
  console.log('Por favor, execute: export SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminUser() {
  const email = 'admin@kifersaude.com.br';
  const password = 'Kifer@2025';

  console.log('🔐 Criando usuário administrador...');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Senha: ${password}`);
  console.log('');

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true
    });

    if (authError) {
      throw authError;
    }

    console.log('✅ Usuário criado com sucesso no Auth!');
    console.log(`👤 User ID: ${authData.user.id}`);
    console.log('');

    console.log('🔧 Criando perfil de administrador...');

    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: email,
        role: 'admin'
      });

    if (profileError) {
      throw profileError;
    }

    console.log('✅ Perfil de administrador criado!');
    console.log('');
    console.log('🎉 Pronto! Você já pode fazer login com:');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Senha: ${password}`);
    console.log('');
    console.log('🚀 Acesse: /login');

  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    process.exit(1);
  }
}

createAdminUser();
