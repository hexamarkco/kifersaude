import { useState, useEffect, useMemo } from 'react';
import { supabase, UserProfile, getUserManagementId } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useConfig } from '../../contexts/ConfigContext';
import { Users, Shield, Trash2, Plus, AlertCircle, CheckCircle, User as UserIcon, Pencil } from 'lucide-react';
import { useConfirmationModal } from '../../hooks/useConfirmationModal';
import { formatProfileLabel } from '../../lib/accessControl';
import FilterSingleSelect from '../FilterSingleSelect';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ModalShell from '../ui/ModalShell';
import { UsersSkeleton } from '../ui/panelSkeletons';
import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import { PanelAdaptiveLoadingFrame } from '../ui/panelLoading';

const FALLBACK_PROFILES = [
  { value: 'observer', label: 'Observador' },
  { value: 'admin', label: 'Administrador' },
];

export default function UsersTab() {
  const { user, refreshProfile, role: currentRole } = useAuth();
  const { accessProfiles, getRoleModulePermission } = useConfig();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('observer');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserUsername, setEditUserUsername] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRole, setEditUserRole] = useState('observer');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const loadingUi = useAdaptiveLoading(loading);
  const canManageUsers = getRoleModulePermission(currentRole, 'config-users').can_edit;

  const profileOptions = useMemo(
    () =>
      accessProfiles.length > 0
        ? accessProfiles.map((profile) => ({
            value: profile.slug,
            label: formatProfileLabel(profile.slug, profile.name),
          }))
        : FALLBACK_PROFILES,
    [accessProfiles],
  );

  const profileBySlug = useMemo(
    () => new Map(accessProfiles.map((profile) => [profile.slug, profile])),
    [accessProfiles],
  );

  useEffect(() => {
    void loadUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      console.error('Erro ao carregar usuarios:', error);
      showMessage('error', 'Erro ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 5000);
  };

  const resetCreateForm = () => {
    setNewUserUsername('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRole(profileOptions[0]?.value ?? 'observer');
    setShowAddUser(false);
  };

  const resetEditForm = () => {
    setEditingUser(null);
    setEditUserPassword('');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      const trimmedUsername = newUserUsername.trim();
      const trimmedEmail = newUserEmail.trim();

      if (!trimmedUsername) {
        showMessage('error', 'Informe um nome de usuario');
        return;
      }

      if (!trimmedEmail) {
        showMessage('error', 'Informe um email valido');
        return;
      }

      if (newUserPassword.length < 6) {
        showMessage('error', 'A senha deve ter pelo menos 6 caracteres');
        return;
      }

      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'createUser',
          email: trimmedEmail,
          password: newUserPassword,
          username: trimmedUsername,
          role: newUserRole,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar usuario');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      showMessage('success', 'Usuario criado com sucesso');
      resetCreateForm();
      await loadUsers();
    } catch (error: unknown) {
      console.error('Erro ao criar usuario:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao criar usuario');
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
      showMessage('error', 'Informe um nome de usuario');
      return;
    }

    if (!trimmedEmail) {
      showMessage('error', 'Informe um email valido');
      return;
    }

    if (editUserPassword && editUserPassword.length < 6) {
      showMessage('error', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setActionLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'updateUser',
          userId: editingUser.id,
          updates: {
            username: trimmedUsername,
            email: trimmedEmail,
            role: editUserRole,
            password: editUserPassword || undefined,
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao atualizar usuario');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      showMessage('success', 'Usuario atualizado com sucesso');
      setEditingUser(null);
      setEditUserPassword('');

      const currentProfileId = getUserManagementId(user) ?? user?.id;
      if (currentProfileId && editingUser.id === currentProfileId) {
        await refreshProfile();
      }

      await loadUsers();
    } catch (error: unknown) {
      console.error('Erro ao atualizar usuario:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao atualizar usuario');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await requestConfirmation({
      title: 'Excluir usuario',
      description: 'Tem certeza que deseja excluir este usuario? Esta acao nao pode ser desfeita.',
      confirmLabel: 'Excluir usuario',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'deleteUser',
          userId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao excluir usuario');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      showMessage('success', 'Usuario excluido com sucesso');
      await loadUsers();
    } catch (error: unknown) {
      console.error('Erro ao excluir usuario:', error);
      showMessage('error', error instanceof Error ? error.message : 'Erro ao excluir usuario');
    } finally {
      setActionLoading(false);
    }
  };

  const hasUsersSnapshot = users.length > 0;
  const currentUserManagementId = getUserManagementId(user) ?? user?.id ?? null;

  if (!canManageUsers) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-600" />
        <h3 className="text-lg font-semibold text-red-900">Acesso restrito</h3>
        <p className="mt-2 text-sm text-red-700">
          Seu perfil nao possui permissao para gerenciar usuarios do sistema.
        </p>
      </div>
    );
  }

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasUsersSnapshot}
      skeleton={<UsersSkeleton />}
      stageLabel="Carregando usuarios..."
      overlayLabel="Atualizando usuarios..."
      stageClassName="min-h-[420px]"
    >
      <div className="panel-page-shell space-y-6">
        {message && (
          <div
            className={`rounded-lg border p-4 ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}
          >
            <div className="flex items-center space-x-3">
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <p>{message.text}</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="h-6 w-6 text-amber-600" />
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Usuarios do Sistema</h3>
                <p className="text-sm text-slate-500">Associe cada usuario a um perfil dinamico de acesso.</p>
              </div>
            </div>
            <Button onClick={() => setShowAddUser(true)} variant="primary">
              <Plus className="h-4 w-4" />
              <span>Novo Usuario</span>
            </Button>
          </div>

          <div className="space-y-3">
            {users.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-slate-300" />
                <p className="text-slate-600">Nenhum usuario cadastrado</p>
              </div>
            ) : (
              users.map((userProfile) => {
                const profile = profileBySlug.get(userProfile.role);
                const profileLabel = formatProfileLabel(userProfile.role, profile?.name);
                const isAdminProfile = profile?.is_admin || userProfile.role === 'admin';

                return (
                  <div
                    key={userProfile.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-yellow-600">
                        <UserIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">@{userProfile.username}</p>
                        <p className="text-sm text-slate-600">{userProfile.email}</p>
                        <div className="mt-1 flex items-center space-x-2">
                          <Shield className={`h-4 w-4 ${isAdminProfile ? 'text-amber-600' : 'text-blue-600'}`} />
                          <span className={`text-sm ${isAdminProfile ? 'text-amber-700' : 'text-blue-700'}`}>
                            {profileLabel || userProfile.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        onClick={() => startEditingUser(userProfile)}
                        disabled={actionLoading}
                        variant="icon"
                        size="icon"
                        className="h-8 w-8 text-slate-600 hover:bg-slate-200"
                        title="Editar usuario"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {userProfile.id !== currentUserManagementId ? (
                        <Button
                          onClick={() => void handleDeleteUser(userProfile.id)}
                          disabled={actionLoading}
                          variant="icon"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50"
                          title="Excluir usuario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-sm italic text-slate-500">Voce</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <h4 className="mb-2 font-semibold text-blue-900">Como funciona agora</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>Os perfis disponiveis aqui sao dinamicos e podem ser criados na area "Perfis e Acessos".</li>
                <li>Perfis marcados como administrativos recebem acesso total ao sistema automaticamente.</li>
                <li>Perfis comuns nascem sem acesso e voce libera cada modulo de forma granular.</li>
              </ul>
            </div>
          </div>
        </div>

        <ModalShell
          isOpen={showAddUser}
          onClose={resetCreateForm}
          title="Novo Usuario"
          description="Crie um novo usuario e associe a um perfil dinamico de acesso."
          size="lg"
        >
          <form onSubmit={handleCreateUser} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Usuario</label>
                <Input
                  type="text"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  required
                  placeholder="nome.usuario"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  placeholder="usuario@email.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Senha</label>
                <Input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Digite uma senha temporaria"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Perfil</label>
                <FilterSingleSelect
                  icon={Shield}
                  value={newUserRole}
                  onChange={setNewUserRole}
                  placeholder="Selecione um perfil"
                  includePlaceholderOption={false}
                  options={profileOptions}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? 'Criando...' : 'Criar Usuario'}
              </Button>
              <Button type="button" onClick={resetCreateForm} variant="secondary">
                Cancelar
              </Button>
            </div>
          </form>
        </ModalShell>
        <ModalShell
          isOpen={Boolean(editingUser)}
          onClose={resetEditForm}
          title="Editar Usuario"
          description="Atualize os dados e o perfil de acesso do usuario."
          size="lg"
        >
          <form onSubmit={handleUpdateUser} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Usuario</label>
                <Input
                  type="text"
                  value={editUserUsername}
                  onChange={(e) => setEditUserUsername(e.target.value)}
                  required
                  placeholder="nome.usuario"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  required
                  placeholder="usuario@email.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Nova Senha</label>
                <Input
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  minLength={6}
                  placeholder="Deixe em branco para manter"
                />
                <p className="mt-1 text-xs text-slate-500">Deixe em branco para manter a senha atual.</p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Perfil</label>
                <FilterSingleSelect
                  icon={Shield}
                  value={editUserRole}
                  onChange={setEditUserRole}
                  placeholder="Selecione um perfil"
                  includePlaceholderOption={false}
                  options={profileOptions}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={actionLoading} variant="warning">
                {actionLoading ? 'Salvando...' : 'Salvar Alteracoes'}
              </Button>
              <Button type="button" onClick={resetEditForm} variant="secondary">
                Cancelar
              </Button>
            </div>
          </form>
        </ModalShell>
        {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
