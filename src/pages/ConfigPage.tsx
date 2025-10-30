import { useState, useEffect } from 'react';
import { supabase, UserProfile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Mail, Shield, Trash2, Plus, AlertCircle, CheckCircle } from 'lucide-react';

export default function ConfigPage() {
  const { isAdmin, user, refreshProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'observer'>('observer');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

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
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ role: newUserRole, created_by: user?.id })
          .eq('id', authData.user.id);

        if (profileError) throw profileError;
      }

      showMessage('success', 'Usuário criado com sucesso');
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

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    setActionLoading(true);
    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

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

      // Refresh own profile if we changed our own role
      if (userId === user?.id) {
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

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-900 mb-2">Acesso Negado</h2>
          <p className="text-red-700">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Configurações</h1>
        <p className="text-slate-600">Gerencie usuários e permissões do sistema</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg border flex items-center space-x-3 ${
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Users className="w-6 h-6 text-teal-600" />
            <h2 className="text-xl font-semibold text-slate-900">Usuários do Sistema</h2>
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
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Adicionar Novo Usuário</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

              <div>
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

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
            <p className="text-slate-600 mt-4">Carregando usuários...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((userProfile) => (
              <div
                key={userProfile.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{userProfile.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Shield className={`w-4 h-4 ${userProfile.role === 'admin' ? 'text-amber-600' : 'text-blue-600'}`} />
                      <span className={`text-sm ${userProfile.role === 'admin' ? 'text-amber-700' : 'text-blue-700'}`}>
                        {userProfile.role === 'admin' ? 'Administrador' : 'Observador'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {userProfile.id !== user?.id && (
                    <>
                      <select
                        value={userProfile.role}
                        onChange={(e) => handleChangeRole(userProfile.id, e.target.value as 'admin' | 'observer')}
                        disabled={actionLoading}
                        className="px-3 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      >
                        <option value="observer">Observador</option>
                        <option value="admin">Administrador</option>
                      </select>
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
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Sobre as Permissões</h3>
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
