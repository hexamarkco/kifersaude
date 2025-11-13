import { useState, useEffect } from 'react';
import { supabase, UserProfile, getUserManagementId } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Shield, Trash2, Plus, AlertCircle, CheckCircle, User as UserIcon, Pencil } from 'lucide-react';

export default function UsersTab() {
  const { user, refreshProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'observer'>('observer');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState<'admin' | 'observer'>('observer');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      showMessage('error', 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      const trimmedUsername = newUserUsername.trim();
      const trimmedEmail = newUserEmail.trim();

      if (!trimmedUsername) {
        showMessage('error', 'Informe um nome de usuário');
        return;
      }

      if (!trimmedEmail) {
        showMessage('error', 'Informe um email válido');
        return;
      }

      const { data: existingUser, error: existingUserError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .maybeSingle();

      if (existingUserError && existingUserError.code !== 'PGRST116') {
        throw existingUserError;
      }

      if (existingUser) {
        showMessage('error', 'Nome de usuário já está em uso');
        setActionLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: newUserPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        const newProfileId = getUserManagementId(authData.user) ?? authData.user.id;
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            role: newUserRole,
            created_by: getUserManagementId(user) ?? user?.id ?? null,
            username: trimmedUsername,
            email: trimmedEmail,
          })
          .eq('id', newProfileId);

        if (profileError) throw profileError;
      }

      showMessage('success', 'Usuário criado com sucesso');
      setNewUserUsername('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('observer');
      setShowAddUser(false);
      loadUsers();
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      showMessage('error', error.message || 'Erro ao criar usuário');
    } finally {
      setActionLoading(false);
    }
  };

  const startEditingUser = (userProfile: UserProfile) => {
    setShowAddUser(false);
    setEditingUser(userProfile);
    setEditUserUsername(userProfile.username);
    setEditUserEmail(userProfile.email);
    setEditUserPassword('');
    setEditUserRole(userProfile.role);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const trimmedUsername = editUserUsername.trim();
    const trimmedEmail = editUserEmail.trim();

    if (!trimmedUsername) {
      showMessage('error', 'Informe um nome de usuário');
      return;
    }

    if (!trimmedEmail) {
      showMessage('error', 'Informe um email válido');
      return;
    }

    if (editUserPassword && editUserPassword.length < 6) {
      showMessage('error', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setActionLoading(true);

    const previousProfile = {
      username: editingUser.username,
      email: editingUser.email,
      role: editingUser.role,
    };
    let profileUpdated = false;

    try {
      const { data: existingUser, error: existingUserError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('username', trimmedUsername)
        .neq('id', editingUser.id)
        .maybeSingle();

      if (existingUserError && existingUserError.code !== 'PGRST116') {
        throw existingUserError;
      }

      if (existingUser) {
        showMessage('error', 'Nome de usuário já está em uso');
        return;
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          username: trimmedUsername,
          email: trimmedEmail,
          role: editUserRole,
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;
      profileUpdated = true;

      const authUpdates: { email?: string; password?: string } = {};

      if (trimmedEmail !== editingUser.email) {
        authUpdates.email = trimmedEmail;
      }

      if (editUserPassword) {
        authUpdates.password = editUserPassword;
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: functionError } = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'updateUser',
            userId: editingUser.id,
            updates: authUpdates,
          },
        });

        if (functionError) {
          throw new Error(functionError.message || 'Erro ao atualizar credenciais do usuário');
        }
      }

      showMessage('success', 'Usuário atualizado com sucesso');
      setEditingUser(null);
      setEditUserPassword('');

      const currentProfileId = getUserManagementId(user) ?? user?.id;
      if (currentProfileId && editingUser.id === currentProfileId) {
        await refreshProfile();
      }

      await loadUsers();
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      if (profileUpdated) {
        try {
          await supabase
            .from('user_profiles')
            .update(previousProfile)
            .eq('id', editingUser.id);
          setEditUserUsername(previousProfile.username);
          setEditUserEmail(previousProfile.email);
          setEditUserRole(previousProfile.role);
        } catch (revertError) {
          console.error('Erro ao reverter alterações do usuário:', revertError);
        }
      }
      showMessage('error', error.message || 'Erro ao atualizar usuário');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'deleteUser',
          userId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao excluir usuário');
      }

      showMessage('success', 'Usuário excluído com sucesso');
      loadUsers();
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error);
      showMessage('error', 'Erro ao excluir usuário. Você precisa de permissões de admin.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: 'admin' | 'observer') => {
    if (!confirm(`Tem certeza que deseja alterar este usuário para ${newRole === 'admin' ? 'Administrador' : 'Observador'}?`)) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      showMessage('success', 'Permissão alterada com sucesso');

      const currentProfileId = getUserManagementId(user) ?? user?.id;
      if (currentProfileId && userId === currentProfileId) {
        await refreshProfile();
      }

      loadUsers();
    } catch (error: any) {
      console.error('Erro ao alterar permissão:', error);
      showMessage('error', 'Erro ao alterar permissão');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
        <p className="text-slate-600 mt-4">Carregando usuários...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg border flex items-center space-x-3 ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-teal-600" />
            <h3 className="text-xl font-semibold text-slate-900">Usuários do Sistema</h3>
          </div>
          <button
            onClick={() => setShowAddUser(!showAddUser)}
            className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </button>
        </div>

        {showAddUser && (
          <form onSubmit={handleCreateUser} className="bg-slate-50 rounded-lg p-6 mb-6">
            <h4 className="text-lg font-semibold text-slate-900 mb-4">Adicionar Novo Usuário</h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Usuário
                </label>
                <input
                  type="text"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="nome.usuario"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="usuario@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Permissão
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'admin' | 'observer')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="observer">Observador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Criando...' : 'Criar Usuário'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddUser(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {editingUser && (
          <form onSubmit={handleUpdateUser} className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
            <h4 className="text-lg font-semibold text-amber-900 mb-4">Editar Usuário</h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-2">Usuário</label>
                <input
                  type="text"
                  value={editUserUsername}
                  onChange={(e) => setEditUserUsername(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="nome.usuario"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-amber-900 mb-2">Email</label>
                <input
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="usuario@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-amber-900 mb-2">Nova Senha</label>
                <input
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  minLength={6}
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="Deixe em branco para manter"
                />
                <p className="text-xs text-amber-700 mt-1">Deixe em branco para manter a senha atual</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-amber-900 mb-2">Permissão</label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as 'admin' | 'observer')}
                  className="w-full px-3 py-2 border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="observer">Observador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setEditUserPassword('');
                }}
                className="px-4 py-2 text-amber-800 hover:bg-amber-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">Nenhum usuário cadastrado</p>
            </div>
          ) : (
            users.map((userProfile) => (
              <div
                key={userProfile.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">@{userProfile.username}</p>
                    <p className="text-sm text-slate-600">{userProfile.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Shield className={`w-4 h-4 ${userProfile.role === 'admin' ? 'text-amber-600' : 'text-blue-600'}`} />
                      <span className={`text-sm ${userProfile.role === 'admin' ? 'text-amber-700' : 'text-blue-700'}`}>
                        {userProfile.role === 'admin' ? 'Administrador' : 'Observador'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => startEditingUser(userProfile)}
                    disabled={actionLoading}
                    className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    title="Editar usuário"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {userProfile.id !== user?.id && (
                    <>
                      <button
                        onClick={() => handleDeleteUser(userProfile.id)}
                        disabled={actionLoading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Excluir usuário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {userProfile.id === user?.id && (
                    <span className="text-sm text-slate-500 italic">Você</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-2">Sobre as Permissões</h4>
            <ul className="text-sm text-blue-800 space-y-2">
              <li><strong>Administrador:</strong> Acesso completo ao sistema. Pode criar, editar e excluir leads, contratos, lembretes e gerenciar usuários.</li>
              <li><strong>Observador:</strong> Acesso somente-leitura. Pode visualizar dashboard, leads, contratos e lembretes, mas não pode modificar nada.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
