import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import type { McpWriteActor, McpWriteResult } from './write-actions.ts';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCESS_MODULES = [
  'dashboard', 'leads', 'contracts', 'reminders', 'financeiro-agenda', 'financeiro-comissoes',
  'whatsapp-inbox', 'whatsapp-campaigns', 'blog', 'config-system', 'config-access', 'config-users',
  'config-automation', 'config-integrations', 'config-ai', 'config-links',
] as const;

const fail = (error_code: string, message: string): McpWriteResult => ({ success: false, error_code, message });
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const validPage = (args: Record<string, unknown>) => {
  const page = Number(args.page ?? 1);
  const pageSize = Number(args.page_size ?? 50);
  return Number.isInteger(page) && page >= 1 && page <= 10000 && Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100
    ? { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 }
    : null;
};
const normalizeSlug = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

const confirmTrue = { type: 'boolean', const: true, description: 'Confirma explicitamente esta ação.' } as const;
const userIdSchema = { type: 'string', format: 'uuid' } as const;
const profileIdSchema = { type: 'string', format: 'uuid' } as const;
const MCP_USER_READ_TOOL_NAMES = ['kifer_list_users', 'kifer_list_access_profiles', 'kifer_list_access_profile_permissions'] as const;
const MCP_USER_WRITE_TOOL_NAMES = [
  'kifer_invite_user', 'kifer_update_user', 'kifer_delete_user', 'kifer_send_user_password_reset',
  'kifer_create_access_profile', 'kifer_update_access_profile', 'kifer_delete_access_profile', 'kifer_set_access_profile_permission',
] as const;

export const MCP_USER_ACCESS_TOOLS: readonly McpToolDescriptor[] = [
  { name: 'kifer_list_users', description: 'Lista usuários do CRM por página, com e-mail, usuário e perfil de acesso. OAuth admin obrigatório.', inputSchema: { type: 'object', additionalProperties: false, properties: { page: { type: 'integer', minimum: 1, maximum: 10000, default: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 100, default: 50 }, role: { type: 'string', maxLength: 50 }, search: { type: 'string', maxLength: 160 } } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_list_access_profiles', description: 'Lista perfis de acesso, incluindo os perfis de sistema e a quantidade de usuários vinculados. OAuth admin obrigatório.', inputSchema: { type: 'object', additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true } },
  { name: 'kifer_list_access_profile_permissions', description: 'Lista permissões dos módulos conhecidos para um perfil. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['role'], additionalProperties: false, properties: { role: { type: 'string', minLength: 1, maxLength: 50 } } }, annotations: { readOnlyHint: true } },
  { name: 'kifer_invite_user', description: 'Convida um novo usuário pelo e-mail, define nome de usuário e perfil; o Supabase envia um e-mail real de convite. Requer confirmação explícita confirm_send_invite=true. Senhas não são recebidas pelo MCP. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['email', 'username', 'role', 'confirm_send_invite'], additionalProperties: false, properties: { email: { type: 'string', format: 'email', maxLength: 320 }, username: { type: 'string', minLength: 1, maxLength: 80 }, role: { type: 'string', minLength: 1, maxLength: 50 }, confirm_send_invite: confirmTrue, confirm_admin_change: confirmTrue } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: 'kifer_update_user', description: 'Atualiza nome de usuário, e-mail ou perfil de uma conta, usando os valores atuais para evitar sobrescrever alterações concorrentes. Não aceita nem retorna senhas. Atribuir o perfil de administrador exige confirm_admin_change=true. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['user_id', 'expected', 'changes'], additionalProperties: false, properties: { user_id: userIdSchema, expected: { type: 'object', required: ['username', 'email', 'role'], additionalProperties: false, properties: { username: { type: 'string', maxLength: 80 }, email: { type: 'string', format: 'email', maxLength: 320 }, role: { type: 'string', maxLength: 50 } } }, changes: { type: 'object', minProperties: 1, additionalProperties: false, properties: { username: { type: 'string', minLength: 1, maxLength: 80 }, email: { type: 'string', format: 'email', maxLength: 320 }, role: { type: 'string', minLength: 1, maxLength: 50 } } }, confirm_admin_change: confirmTrue } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_delete_user', description: 'Exclui permanentemente a conta de autenticação e o perfil do usuário. Não permite excluir a própria conta nem o último administrador. Requer conferência dos valores atuais e confirm_delete=true. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['user_id', 'expected', 'confirm_delete'], additionalProperties: false, properties: { user_id: userIdSchema, expected: { type: 'object', required: ['username', 'email', 'role'], additionalProperties: false, properties: { username: { type: 'string', maxLength: 80 }, email: { type: 'string', format: 'email', maxLength: 320 }, role: { type: 'string', maxLength: 50 } } }, confirm_delete: confirmTrue } }, annotations: { readOnlyHint: false, destructiveHint: true } },
  { name: 'kifer_send_user_password_reset', description: 'Solicita ao Supabase o envio de um e-mail real de redefinição de senha para o usuário selecionado. Não recebe, revela ou registra senha. Requer confirm_send_email=true. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['user_id', 'confirm_send_email'], additionalProperties: false, properties: { user_id: userIdSchema, confirm_send_email: confirmTrue } }, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true } },
  { name: 'kifer_create_access_profile', description: 'Cria perfil de acesso com slug derivado do nome. Conceder is_admin=true dá acesso administrativo total e exige confirm_admin_change=true. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 160 }, description: { type: ['string', 'null'], maxLength: 1000 }, is_admin: { type: 'boolean', default: false }, confirm_admin_change: confirmTrue } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_update_access_profile', description: 'Altera nome, descrição ou status administrativo de um perfil com controle de versão. Conceder ou remover privilégios administrativos exige confirm_admin_change=true. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['profile_id', 'expected_updated_at', 'changes'], additionalProperties: false, properties: { profile_id: profileIdSchema, expected_updated_at: { type: 'string', format: 'date-time' }, changes: { type: 'object', minProperties: 1, additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 160 }, description: { type: ['string', 'null'], maxLength: 1000 }, is_admin: { type: 'boolean' } } }, confirm_admin_change: confirmTrue } }, annotations: { readOnlyHint: false } },
  { name: 'kifer_delete_access_profile', description: 'Exclui perfil não sistêmico sem usuários vinculados; permissões relacionadas também serão removidas pela chave estrangeira. Requer expected_updated_at e confirm_delete=true. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['profile_id', 'expected_updated_at', 'confirm_delete'], additionalProperties: false, properties: { profile_id: profileIdSchema, expected_updated_at: { type: 'string', format: 'date-time' }, confirm_delete: confirmTrue } }, annotations: { readOnlyHint: false, destructiveHint: true } },
  { name: 'kifer_set_access_profile_permission', description: 'Define as permissões de leitura e edição de um módulo conhecido para um perfil não administrativo. Se can_edit=true, can_view também precisa ser true. Envie expected_updated_at da leitura; use null para criar uma regra ausente. OAuth admin obrigatório.', inputSchema: { type: 'object', required: ['role', 'module', 'can_view', 'can_edit', 'expected_updated_at'], additionalProperties: false, properties: { role: { type: 'string', minLength: 1, maxLength: 50 }, module: { type: 'string', enum: [...ACCESS_MODULES] }, can_view: { type: 'boolean' }, can_edit: { type: 'boolean' }, expected_updated_at: { type: ['string', 'null'], format: 'date-time' } } }, annotations: { readOnlyHint: false } },
] as const;

export const MCP_USER_ACCESS_READ_TOOL_NAMES = MCP_USER_READ_TOOL_NAMES;
export const MCP_USER_ACCESS_WRITE_TOOL_NAMES = MCP_USER_WRITE_TOOL_NAMES;

const audit = async (supabase: SupabaseClient, actor: McpWriteActor, toolName: string, result: McpWriteResult, request: Record<string, unknown>) => {
  const { error } = await supabase.from('mcp_action_audit_log').insert({
    tool_name: toolName,
    action_type: toolName.replace(/^kifer_/, '').replaceAll('_', '-'),
    actor: actor.actor,
    actor_id: actor.actorId,
    request_payload: request,
    result_payload: { success: result.success, error_code: result.error_code ?? null },
    success: result.success,
    error_message: result.success ? null : text(result.message) || null,
    source: 'chatgpt_mcp',
  });
  if (error) console.error('[chatgpt-mcp] falha ao auditar gestão de acesso:', error.message);
};

const countAdmins = async (supabase: SupabaseClient) => {
  const { data: profiles, error: profileError } = await supabase.from('access_profiles').select('slug').eq('is_admin', true);
  if (profileError) return { count: null, error: profileError };
  const slugs = Array.isArray(profiles) ? profiles.flatMap((profile) => isRecord(profile) && typeof profile.slug === 'string' ? [profile.slug] : []) : [];
  if (slugs.length === 0) return { count: 0, error: null };
  const { count, error } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).in('role', slugs);
  return { count: error ? null : count ?? 0, error };
};

const currentUser = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase.from('user_profiles').select('id,username,email,role,created_at,created_by').eq('id', userId).maybeSingle();
  return { profile: isRecord(data) ? data : null, error };
};

const currentAccessProfile = async (supabase: SupabaseClient, role: string) => {
  const { data, error } = await supabase.from('access_profiles').select('id,slug,name,description,is_system,is_admin,created_at,updated_at').eq('slug', role).maybeSingle();
  return { profile: isRecord(data) ? data : null, error };
};

const profileById = async (supabase: SupabaseClient, profileId: string) => {
  const { data, error } = await supabase.from('access_profiles').select('id,slug,name,description,is_system,is_admin,created_at,updated_at').eq('id', profileId).maybeSingle();
  return { profile: isRecord(data) ? data : null, error };
};

const sameIdentity = (profile: Record<string, unknown>, expected: unknown) => isRecord(expected)
  && profile.username === text(expected.username)
  && text(profile.email).toLowerCase() === text(expected.email).toLowerCase()
  && profile.role === text(expected.role);

export async function executeMcpUserAccessReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown> }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args } = params;
  if (!MCP_USER_READ_TOOL_NAMES.includes(toolName as (typeof MCP_USER_READ_TOOL_NAMES)[number])) return null;
  if (toolName === 'kifer_list_users') {
    const bounds = validPage(args);
    if (!bounds) return fail('INVALID_INPUT', 'Paginação inválida.');
    let query = supabase.from('user_profiles').select('id,username,email,role,created_at,created_by', { count: 'exact' });
    if (text(args.role)) query = query.eq('role', text(args.role));
    if (text(args.search)) {
      const search = text(args.search).replace(/[\\%_(),]/g, '');
      if (search) query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(bounds.from, bounds.to);
    return error ? fail('DATABASE_ERROR', 'Não foi possível consultar os usuários.') : { success: true, users: data ?? [], page: bounds.page, page_size: bounds.pageSize, total: count ?? 0 };
  }
  if (toolName === 'kifer_list_access_profiles') {
    const { data, error } = await supabase.from('access_profiles').select('id,slug,name,description,is_system,is_admin,created_at,updated_at').order('name');
    if (error) return fail('DATABASE_ERROR', 'Não foi possível consultar os perfis.');
    const profiles = Array.isArray(data) ? data.filter(isRecord) : [];
    const counts = await Promise.all(profiles.map(async (profile) => {
      const { count, error: countError } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', profile.slug);
      return [text(profile.slug), countError ? null : count ?? 0] as const;
    }));
    const userCounts = new Map(counts);
    return { success: true, profiles: profiles.map((profile) => ({ ...profile, assigned_user_count: userCounts.get(text(profile.slug)) ?? null })) };
  }
  const role = text(args.role);
  if (!role) return fail('INVALID_INPUT', 'role é obrigatório.');
  const { profile, error: profileError } = await currentAccessProfile(supabase, role);
  if (profileError) return fail('DATABASE_ERROR', 'Não foi possível consultar o perfil.');
  if (!profile) return fail('NOT_FOUND', 'Perfil não encontrado.');
  const { data, error } = await supabase.from('profile_permissions').select('id,role,module,can_view,can_edit,created_at,updated_at').eq('role', role).in('module', [...ACCESS_MODULES]).order('module');
  return error ? fail('DATABASE_ERROR', 'Não foi possível consultar as permissões.') : { success: true, role, is_admin: profile.is_admin === true, permissions: data ?? [] };
}

export async function executeMcpUserAccessWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!MCP_USER_WRITE_TOOL_NAMES.includes(toolName as (typeof MCP_USER_WRITE_TOOL_NAMES)[number])) return null;
  let result: McpWriteResult;
  const request: Record<string, unknown> = { argument_keys: Object.keys(args).sort() };

  if (toolName === 'kifer_invite_user') {
    const email = text(args.email).toLowerCase();
    const username = text(args.username);
    const role = text(args.role);
    request.role = role || undefined;
    if (args.confirm_send_invite !== true || !EMAIL.test(email) || email.length > 320 || !username || username.length > 80 || !role) {
      result = fail('INVALID_INPUT', 'E-mail, nome de usuário, perfil e confirm_send_invite=true válidos são obrigatórios.');
    } else {
      const { profile: accessProfile, error: roleError } = await currentAccessProfile(supabase, role);
      const { data: existingEmail, error: emailError } = await supabase.from('user_profiles').select('id').eq('email', email).limit(1).maybeSingle();
      const { data: existingUsername, error: usernameError } = await supabase.from('user_profiles').select('id').eq('username', username).limit(1).maybeSingle();
      if (roleError || emailError || usernameError) result = fail('DATABASE_ERROR', 'Não foi possível validar o convite.');
      else if (!accessProfile) result = fail('INVALID_ROLE', 'Perfil de acesso não encontrado.');
      else if (accessProfile.is_admin === true && args.confirm_admin_change !== true) result = fail('CONFIRMATION_REQUIRED', 'Conceder acesso administrativo exige confirm_admin_change=true.');
      else if (existingEmail || existingUsername) result = fail('DUPLICATE', 'Já existe uma conta com esse e-mail ou nome de usuário.');
      else {
        const { data: invitation, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, { data: { username } });
        const invitedUser = isRecord(invitation) && isRecord(invitation.user) ? invitation.user : null;
        if (inviteError || !invitedUser || !UUID.test(text(invitedUser.id))) result = fail('INVITE_FAILED', 'Não foi possível enviar o convite.');
        else {
          const { data: updatedProfile, error: updateError } = await supabase.from('user_profiles').update({ username, email, role, created_by: actor.actorId }).eq('id', text(invitedUser.id)).select('id').maybeSingle();
          if (updateError || !updatedProfile) {
            await supabase.auth.admin.deleteUser(text(invitedUser.id));
            result = fail('PROFILE_SETUP_FAILED', 'O convite foi iniciado, mas não foi possível configurar o perfil. A conta temporária foi removida; confirme o estado antes de repetir.');
          } else result = { success: true, user_id: text(invitedUser.id), invited: true };
        }
      }
    }
  } else if (toolName === 'kifer_update_user') {
    const userId = text(args.user_id);
    const changes = args.changes;
    request.user_id = UUID.test(userId) ? userId : undefined;
    request.changed_fields = isRecord(changes) ? Object.keys(changes).sort() : undefined;
    if (!UUID.test(userId) || !isRecord(args.expected) || !isRecord(changes) || Object.keys(changes).length === 0 || Object.keys(changes).some((key) => !['username', 'email', 'role'].includes(key))) {
      result = fail('INVALID_INPUT', 'user_id, expected e changes com campos permitidos são obrigatórios.');
    } else {
      const { profile, error } = await currentUser(supabase, userId);
      if (error) result = fail('DATABASE_ERROR', 'Não foi possível consultar o usuário.');
      else if (!profile) result = fail('NOT_FOUND', 'Usuário não encontrado.');
      else if (!sameIdentity(profile, args.expected)) result = fail('CONFLICT', 'O usuário mudou desde a consulta. Consulte novamente.');
      else if (userId === actor.actorId && 'role' in changes) result = fail('SELF_ROLE_CHANGE', 'A própria função do usuário conectado não pode ser alterada pelo MCP.');
      else if (('username' in changes && (!text(changes.username) || text(changes.username).length > 80)) || ('email' in changes && (!EMAIL.test(text(changes.email)) || text(changes.email).length > 320)) || ('role' in changes && !text(changes.role))) result = fail('INVALID_INPUT', 'Os novos campos de usuário são inválidos.');
      else {
        const nextRole = 'role' in changes ? text(changes.role) : text(profile.role);
        const { profile: nextAccessProfile, error: roleError } = 'role' in changes ? await currentAccessProfile(supabase, nextRole) : { profile: { is_admin: false }, error: null };
        const nextAdmin = nextAccessProfile?.is_admin === true;
        if (roleError) result = fail('DATABASE_ERROR', 'Não foi possível validar o novo perfil.');
        else if ('role' in changes && !nextAccessProfile) result = fail('INVALID_ROLE', 'Perfil de acesso não encontrado.');
        else if (nextAdmin && args.confirm_admin_change !== true) result = fail('CONFIRMATION_REQUIRED', 'Atribuir acesso administrativo exige confirm_admin_change=true.');
        else if ('username' in changes || 'email' in changes || 'role' in changes) {
          const next = { username: 'username' in changes ? text(changes.username) : text(profile.username), email: 'email' in changes ? text(changes.email).toLowerCase() : text(profile.email), role: nextRole };
          const { data: duplicateEmail, error: duplicateEmailError } = await supabase.from('user_profiles').select('id').eq('email', next.email).neq('id', userId).limit(1).maybeSingle();
          const { data: duplicateUsername, error: duplicateUsernameError } = await supabase.from('user_profiles').select('id').eq('username', next.username).neq('id', userId).limit(1).maybeSingle();
          if (duplicateEmailError || duplicateUsernameError) result = fail('DATABASE_ERROR', 'Não foi possível validar os dados atualizados.');
          else if (duplicateEmail || duplicateUsername) result = fail('DUPLICATE', 'Já existe uma conta com esse e-mail ou nome de usuário.');
          else if (profile.role !== next.role) {
            const { count, error: countError } = await countAdmins(supabase);
            const wasAdmin = (await currentAccessProfile(supabase, text(profile.role))).profile?.is_admin === true;
            if (countError || count === null) result = fail('DATABASE_ERROR', 'Não foi possível validar os administradores ativos.');
            else if (wasAdmin && !nextAdmin && count <= 1) result = fail('LAST_ADMIN', 'Não é possível remover o último administrador.');
            else result = await applyUserUpdate(supabase, profile, next, userId);
          } else result = await applyUserUpdate(supabase, profile, next, userId);
        } else result = fail('INVALID_INPUT', 'Nenhum campo permitido foi informado.');
      }
    }
  } else if (toolName === 'kifer_delete_user') {
    const userId = text(args.user_id);
    request.user_id = UUID.test(userId) ? userId : undefined;
    if (!UUID.test(userId) || args.confirm_delete !== true) result = fail('CONFIRMATION_REQUIRED', 'user_id válido e confirm_delete=true são obrigatórios.');
    else if (userId === actor.actorId) result = fail('SELF_DELETE', 'A própria conta conectada não pode ser excluída pelo MCP.');
    else {
      const { profile, error } = await currentUser(supabase, userId);
      if (error) result = fail('DATABASE_ERROR', 'Não foi possível consultar o usuário.');
      else if (!profile) result = fail('NOT_FOUND', 'Usuário não encontrado.');
      else if (!sameIdentity(profile, args.expected)) result = fail('CONFLICT', 'O usuário mudou desde a consulta. Consulte novamente.');
      else {
        const access = await currentAccessProfile(supabase, text(profile.role));
        if (access.error) result = fail('DATABASE_ERROR', 'Não foi possível validar o perfil do usuário.');
        else if (access.profile?.is_admin === true) {
          const { count, error: countError } = await countAdmins(supabase);
          if (countError || count === null) result = fail('DATABASE_ERROR', 'Não foi possível validar os administradores ativos.');
          else if (count <= 1) result = fail('LAST_ADMIN', 'Não é possível excluir o último administrador.');
          else result = await deleteUser(supabase, userId);
        } else result = await deleteUser(supabase, userId);
      }
    }
  } else if (toolName === 'kifer_send_user_password_reset') {
    const userId = text(args.user_id);
    request.user_id = UUID.test(userId) ? userId : undefined;
    if (!UUID.test(userId) || args.confirm_send_email !== true) result = fail('CONFIRMATION_REQUIRED', 'user_id válido e confirm_send_email=true são obrigatórios.');
    else {
      const { profile, error } = await currentUser(supabase, userId);
      if (error) result = fail('DATABASE_ERROR', 'Não foi possível consultar o usuário.');
      else if (!profile || !EMAIL.test(text(profile.email))) result = fail('NOT_FOUND', 'Usuário ou e-mail válido não encontrado.');
      else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(text(profile.email));
        result = resetError ? fail('PASSWORD_RESET_FAILED', 'Não foi possível solicitar o e-mail de redefinição de senha.') : { success: true, email_sent: true };
      }
    }
  } else if (toolName === 'kifer_create_access_profile') {
    const name = text(args.name);
    const slug = normalizeSlug(name);
    request.profile_slug = slug || undefined;
    if (!name || name.length > 160 || !slug) result = fail('INVALID_INPUT', 'name não gera um identificador válido de perfil.');
    else if (args.is_admin === true && args.confirm_admin_change !== true) result = fail('CONFIRMATION_REQUIRED', 'Conceder acesso administrativo exige confirm_admin_change=true.');
    else if (args.description !== undefined && args.description !== null && (typeof args.description !== 'string' || args.description.length > 1000)) result = fail('INVALID_INPUT', 'description inválida.');
    else {
      const { data, error } = await supabase.from('access_profiles').insert({ slug, name, description: typeof args.description === 'string' && args.description.trim() ? args.description.trim() : null, is_admin: args.is_admin === true, is_system: false }).select('id,slug,name,description,is_system,is_admin,created_at,updated_at').single();
      result = error ? fail(error.code === '23505' ? 'DUPLICATE' : 'DATABASE_ERROR', error.code === '23505' ? 'Já existe um perfil com esse identificador.' : 'Não foi possível criar o perfil.') : { success: true, profile: data };
    }
  } else if (toolName === 'kifer_update_access_profile') {
    const profileId = text(args.profile_id);
    const changes = args.changes;
    request.profile_id = UUID.test(profileId) ? profileId : undefined;
    request.changed_fields = isRecord(changes) ? Object.keys(changes).sort() : undefined;
    if (!UUID.test(profileId) || !Number.isFinite(Date.parse(text(args.expected_updated_at))) || !isRecord(changes) || Object.keys(changes).length === 0 || Object.keys(changes).some((key) => !['name', 'description', 'is_admin'].includes(key))) result = fail('INVALID_INPUT', 'profile_id, expected_updated_at e changes válidos são obrigatórios.');
    else {
      const { profile, error } = await profileById(supabase, profileId);
      if (error) result = fail('DATABASE_ERROR', 'Não foi possível consultar o perfil.');
      else if (!profile) result = fail('NOT_FOUND', 'Perfil não encontrado.');
      else if (profile.updated_at !== args.expected_updated_at) result = fail('CONFLICT', 'O perfil mudou desde a consulta. Consulte novamente.');
      else if (profile.is_system === true && 'is_admin' in changes) result = fail('SYSTEM_PROFILE', 'O nível administrativo de perfis de sistema é protegido.');
      else if ('is_admin' in changes && typeof changes.is_admin !== 'boolean') result = fail('INVALID_INPUT', 'is_admin deve ser booleano.');
      else if ('is_admin' in changes && changes.is_admin !== profile.is_admin && args.confirm_admin_change !== true) result = fail('CONFIRMATION_REQUIRED', 'Alterar privilégios administrativos exige confirm_admin_change=true.');
      else if ('name' in changes && (!text(changes.name) || text(changes.name).length > 160)) result = fail('INVALID_INPUT', 'name inválido.');
      else if ('description' in changes && changes.description !== null && (typeof changes.description !== 'string' || changes.description.length > 1000)) result = fail('INVALID_INPUT', 'description inválida.');
      else if (profile.is_admin === true && changes.is_admin === false) {
        const { count, error: countError } = await countAdmins(supabase);
        if (countError || count === null) result = fail('DATABASE_ERROR', 'Não foi possível validar os administradores ativos.');
        else if (count <= 1) result = fail('LAST_ADMIN', 'Não é possível remover o último administrador.');
        else result = await updateAccessProfile(supabase, profileId, text(args.expected_updated_at), changes);
      } else result = await updateAccessProfile(supabase, profileId, text(args.expected_updated_at), changes);
    }
  } else if (toolName === 'kifer_delete_access_profile') {
    const profileId = text(args.profile_id);
    request.profile_id = UUID.test(profileId) ? profileId : undefined;
    if (!UUID.test(profileId) || !Number.isFinite(Date.parse(text(args.expected_updated_at))) || args.confirm_delete !== true) result = fail('CONFIRMATION_REQUIRED', 'profile_id, expected_updated_at e confirm_delete=true são obrigatórios.');
    else {
      const { profile, error } = await profileById(supabase, profileId);
      if (error) result = fail('DATABASE_ERROR', 'Não foi possível consultar o perfil.');
      else if (!profile) result = fail('NOT_FOUND', 'Perfil não encontrado.');
      else if (profile.updated_at !== args.expected_updated_at) result = fail('CONFLICT', 'O perfil mudou desde a consulta. Consulte novamente.');
      else if (profile.is_system === true) result = fail('SYSTEM_PROFILE', 'Perfis de sistema não podem ser excluídos.');
      else {
        const { count, error: countError } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', profile.slug);
        if (countError) result = fail('DATABASE_ERROR', 'Não foi possível validar usuários vinculados.');
        else if ((count ?? 0) > 0) result = fail('PROFILE_IN_USE', 'O perfil ainda está atribuído a usuários.');
        else {
          const { data, error: deleteError } = await supabase.from('access_profiles').delete().eq('id', profileId).eq('updated_at', text(args.expected_updated_at)).eq('is_system', false).select('id').maybeSingle();
          result = deleteError ? fail('DATABASE_ERROR', 'Não foi possível excluir o perfil.') : data ? { success: true, profile_id: profileId, deleted: true } : fail('CONFLICT', 'O perfil mudou durante a exclusão.');
        }
      }
    }
  } else {
    const role = text(args.role);
    const module = text(args.module);
    request.role = role || undefined;
    request.module = ACCESS_MODULES.includes(module as (typeof ACCESS_MODULES)[number]) ? module : undefined;
    request.can_view = typeof args.can_view === 'boolean' ? args.can_view : undefined;
    request.can_edit = typeof args.can_edit === 'boolean' ? args.can_edit : undefined;
    if (!role || !ACCESS_MODULES.includes(module as (typeof ACCESS_MODULES)[number]) || typeof args.can_view !== 'boolean' || typeof args.can_edit !== 'boolean' || (args.can_edit && !args.can_view)) result = fail('INVALID_INPUT', 'role, módulo conhecido e permissões coerentes são obrigatórios.');
    else {
      const { profile, error: profileError } = await currentAccessProfile(supabase, role);
      if (profileError) result = fail('DATABASE_ERROR', 'Não foi possível consultar o perfil.');
      else if (!profile) result = fail('NOT_FOUND', 'Perfil não encontrado.');
      else if (profile.is_admin === true) result = fail('ADMIN_PROFILE', 'Permissões individuais não se aplicam a perfis administrativos.');
      else {
        const expected = args.expected_updated_at;
        if (expected !== null && (typeof expected !== 'string' || !Number.isFinite(Date.parse(expected)))) result = fail('INVALID_INPUT', 'expected_updated_at deve ser data ISO ou null.');
        else {
          const { data: current, error: readError } = await supabase.from('profile_permissions').select('id,role,module,can_view,can_edit,created_at,updated_at').eq('role', role).eq('module', module).maybeSingle();
          if (readError) result = fail('DATABASE_ERROR', 'Não foi possível consultar a permissão atual.');
          else if (expected === null && current) result = fail('CONFLICT', 'A permissão já existe. Consulte novamente.');
          else if (typeof expected === 'string' && (!isRecord(current) || current.updated_at !== expected)) result = fail('CONFLICT', 'A permissão mudou desde a consulta. Consulte novamente.');
          else if (typeof expected === 'string') {
            const { data, error: updateError } = await supabase.from('profile_permissions').update({ can_view: args.can_view, can_edit: args.can_edit, updated_at: new Date().toISOString() }).eq('role', role).eq('module', module).eq('updated_at', expected).select('id,role,module,can_view,can_edit,created_at,updated_at').maybeSingle();
            result = updateError ? fail('DATABASE_ERROR', 'Não foi possível atualizar a permissão.') : data ? { success: true, permission: data } : fail('CONFLICT', 'A permissão mudou durante a atualização.');
          } else {
            const { data, error: insertError } = await supabase.from('profile_permissions').insert({ role, module, can_view: args.can_view, can_edit: args.can_edit }).select('id,role,module,can_view,can_edit,created_at,updated_at').maybeSingle();
            result = insertError ? fail(insertError.code === '23505' ? 'CONFLICT' : 'DATABASE_ERROR', insertError.code === '23505' ? 'A permissão já existe. Consulte novamente.' : 'Não foi possível criar a permissão.') : data ? { success: true, permission: data } : fail('DATABASE_ERROR', 'Não foi possível criar a permissão.');
          }
        }
      }
    }
  }

  await audit(supabase, actor, toolName, result, request);
  return result;
}

async function applyUserUpdate(supabase: SupabaseClient, profile: Record<string, unknown>, next: { username: string; email: string; role: string }, userId: string): Promise<McpWriteResult> {
  const oldEmail = text(profile.email);
  if (next.email !== oldEmail) {
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, { email: next.email });
    if (authError) return fail('AUTH_UPDATE_FAILED', 'Não foi possível atualizar o e-mail da conta.');
  }
  const { data, error } = await supabase.from('user_profiles').update({ ...next }).eq('id', userId).eq('username', text(profile.username)).eq('email', oldEmail).eq('role', text(profile.role)).select('id').maybeSingle();
  if (error || !data) {
    if (next.email !== oldEmail) await supabase.auth.admin.updateUserById(userId, { email: oldEmail });
    return error ? fail(error.code === '23505' ? 'DUPLICATE' : 'DATABASE_ERROR', error.code === '23505' ? 'O nome ou e-mail já está em uso.' : 'Não foi possível atualizar o perfil do usuário.') : fail('CONFLICT', 'O usuário mudou durante a atualização. Consulte novamente.');
  }
  return { success: true, user_id: userId, changed_fields: Object.keys(next).filter((key) => next[key as keyof typeof next] !== profile[key]).sort() };
}

async function deleteUser(supabase: SupabaseClient, userId: string): Promise<McpWriteResult> {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  return error ? fail('DELETE_FAILED', 'Não foi possível excluir a conta.') : { success: true, user_id: userId, deleted: true };
}

async function updateAccessProfile(supabase: SupabaseClient, profileId: string, expectedUpdatedAt: string, changes: Record<string, unknown>): Promise<McpWriteResult> {
  const updates: Record<string, unknown> = {};
  if ('name' in changes) updates.name = text(changes.name);
  if ('description' in changes) updates.description = typeof changes.description === 'string' && changes.description.trim() ? changes.description.trim() : null;
  if ('is_admin' in changes) updates.is_admin = changes.is_admin;
  const { data, error } = await supabase.from('access_profiles').update(updates).eq('id', profileId).eq('updated_at', expectedUpdatedAt).select('id,slug,name,description,is_system,is_admin,created_at,updated_at').maybeSingle();
  return error ? fail('DATABASE_ERROR', 'Não foi possível atualizar o perfil.') : data ? { success: true, profile: data } : fail('CONFLICT', 'O perfil mudou durante a atualização.');
}
