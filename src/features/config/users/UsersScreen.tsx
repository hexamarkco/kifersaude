import { useState, useEffect, useMemo } from "react";
import {
  supabase,
  UserProfile,
  getUserManagementId,
} from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useConfig } from "../../../contexts/ConfigContext";
import {
  Users,
  Shield,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle,
  User as UserIcon,
  Pencil,
} from "lucide-react";
import { useConfirmationModal } from "../../../hooks/useConfirmationModal";
import { formatProfileLabel } from "../../../lib/accessControl";
import FilterSingleSelect from "../../../components/FilterSingleSelect";
import { UsersSkeleton } from "../../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from "../../../components/ui/panelLoading";
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Surface,
} from "../../../design-system";
import { FALLBACK_PROFILES } from "./shared/usersSettingsConstants";

export default function UsersScreen() {
  const { user, refreshProfile, role: currentRole } = useAuth();
  const { accessProfiles, getRoleModulePermission } = useConfig();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("observer");
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserUsername, setEditUserUsername] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserRole, setEditUserRole] = useState("observer");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const loadingUi = useAdaptiveLoading(loading);
  const canManageUsers = getRoleModulePermission(
    currentRole,
    "config-users",
  ).can_edit;

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
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      showMessage("error", "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 5000);
  };

  const resetCreateForm = () => {
    setNewUserUsername("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserRole(profileOptions[0]?.value ?? "observer");
    setShowAddUser(false);
  };

  const resetEditForm = () => {
    setEditingUser(null);
    setEditUserPassword("");
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);

    try {
      const trimmedUsername = newUserUsername.trim();
      const trimmedEmail = newUserEmail.trim();

      if (!trimmedUsername) {
          showMessage("error", "Informe um nome de usuário");
        return;
      }

      if (!trimmedEmail) {
        showMessage("error", "Informe um e-mail válido");
        return;
      }

      if (newUserPassword.length < 6) {
        showMessage("error", "A senha deve ter pelo menos 6 caracteres");
        return;
      }

      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "createUser",
          email: trimmedEmail,
          password: newUserPassword,
          username: trimmedUsername,
          role: newUserRole,
        },
      });

      if (error) {
        throw new Error(error.message || "Erro ao criar usuário");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      showMessage("success", "Usuário criado com sucesso");
      resetCreateForm();
      await loadUsers();
    } catch (error: unknown) {
      console.error("Erro ao criar usuário:", error);
      showMessage(
        "error",
        error instanceof Error ? error.message : "Erro ao criar usuário",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const startEditingUser = (userProfile: UserProfile) => {
    setShowAddUser(false);
    setEditingUser(userProfile);
    setEditUserUsername(userProfile.username);
    setEditUserEmail(userProfile.email);
    setEditUserPassword("");
    setEditUserRole(userProfile.role);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const trimmedUsername = editUserUsername.trim();
    const trimmedEmail = editUserEmail.trim();

    if (!trimmedUsername) {
      showMessage("error", "Informe um nome de usuário");
      return;
    }

    if (!trimmedEmail) {
      showMessage("error", "Informe um e-mail válido");
      return;
    }

    if (editUserPassword && editUserPassword.length < 6) {
      showMessage("error", "A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setActionLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "updateUser",
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
        throw new Error(error.message || "Erro ao atualizar usuário");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      showMessage("success", "Usuário atualizado com sucesso");
      setEditingUser(null);
      setEditUserPassword("");

      const currentProfileId = getUserManagementId(user) ?? user?.id;
      if (currentProfileId && editingUser.id === currentProfileId) {
        await refreshProfile();
      }

      await loadUsers();
    } catch (error: unknown) {
      console.error("Erro ao atualizar usuário:", error);
      showMessage(
        "error",
        error instanceof Error ? error.message : "Erro ao atualizar usuário",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmed = await requestConfirmation({
      title: "Excluir usuário",
      description:
        "Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir usuário",
      cancelLabel: "Cancelar",
      tone: "danger",
    });

    if (!confirmed) return;

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "deleteUser",
          userId,
        },
      });

      if (error) {
        throw new Error(error.message || "Erro ao excluir usuário");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      showMessage("success", "Usuário excluído com sucesso");
      await loadUsers();
    } catch (error: unknown) {
      console.error("Erro ao excluir usuário:", error);
      showMessage(
        "error",
        error instanceof Error ? error.message : "Erro ao excluir usuário",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const hasUsersSnapshot = users.length > 0;
  const currentUserManagementId = getUserManagementId(user) ?? user?.id ?? null;

  if (!canManageUsers) {
    return (
      <Alert tone="danger" className="p-6 text-center">
        <AlertCircle className="mx-auto mb-3 h-10 w-10" />
        <h3 className="text-lg font-semibold">Acesso restrito</h3>
        <p className="mt-2 text-sm">
          Seu perfil não possui permissão para gerenciar usuários do sistema.
        </p>
      </Alert>
    );
  }

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={hasUsersSnapshot}
      skeleton={<UsersSkeleton />}
      stageLabel="Carregando usuários..."
      overlayLabel="Atualizando usuários..."
      stageClassName="min-h-[420px]"
    >
      <div className="panel-page-shell space-y-6">
        <Surface padding="lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <Badge tone="gold"><Shield className="h-3.5 w-3.5" />Usuários</Badge>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[var(--kds-radius-lg)] bg-[color:var(--brand-primary-soft)] text-[color:var(--brand-primary)]">
                  <Users className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[color:var(--text-primary)]">
                    Usuários do sistema
                  </h2>
                  <p className="max-w-3xl text-sm leading-6 text-[color:var(--text-secondary)]">
                    Associe cada usuário a um perfil dinâmico de acesso,
                    mantendo a administração centralizada no mesmo padrão visual
                    de configurações gerais.
                  </p>
                </div>
              </div>
            </div>

            <Button onClick={() => setShowAddUser(true)} variant="primary">
              <Plus className="h-4 w-4" />
              <span>Novo Usuário</span>
            </Button>
          </div>
        </Surface>

        {message && (
          <Alert tone={message.type === "success" ? "success" : "danger"}>
            <div className="flex items-center space-x-3">
              {message.type === "success" ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <p>{message.text}</p>
            </div>
          </Alert>
        )}

        <Card padding="lg">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Users className="h-6 w-6 text-[color:var(--brand-primary)]" />
              <div>
                <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">
                  Carteira de usuários
                </h3>
                <p className="text-sm text-[color:var(--text-tertiary)]">
                  Revise perfis, dados de acesso e manutenção da equipe em um
                  único lugar.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {users.length === 0 ? (
              <Card variant="muted" padding="md" className="py-12 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-[color:var(--text-tertiary)] opacity-40" />
                <p className="text-[color:var(--text-tertiary)]">
                  Nenhum usuário cadastrado
                </p>
              </Card>
            ) : (
              users.map((userProfile) => {
                const profile = profileBySlug.get(userProfile.role);
                const profileLabel = formatProfileLabel(
                  userProfile.role,
                  profile?.name,
                );
                return (
                  <Card
                    key={userProfile.id}
                    className="flex items-center justify-between gap-4"
                    variant="muted"
                    padding="sm"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--brand-primary)]">
                        <UserIcon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-[color:var(--text-primary)]">
                          @{userProfile.username}
                        </p>
                        <p className="text-sm text-[color:var(--text-tertiary)]">
                          {userProfile.email}
                        </p>
                        <div className="mt-1 flex items-center space-x-2">
                          <Shield
                            className="h-4 w-4 text-[color:var(--brand-primary)]"
                          />
                          <span
                            className="text-sm text-[color:var(--brand-primary)]"
                          >
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
                        className="h-8 w-8"
                        title="Editar usuário"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {userProfile.id !== currentUserManagementId ? (
                        <Button
                          onClick={() => void handleDeleteUser(userProfile.id)}
                          disabled={actionLoading}
                          variant="icon"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          title="Excluir usuário"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-sm italic text-[color:var(--text-tertiary)]">
                          Você
                        </span>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </Card>

        <Card variant="muted" padding="lg">
          <div className="flex items-start space-x-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[color:var(--brand-primary)]" />
            <div>
              <h4 className="mb-2 font-semibold text-[color:var(--text-primary)]">
                Como funciona agora
              </h4>
              <ul className="space-y-2 text-sm text-[color:var(--text-tertiary)]">
                <li>
                  Os perfis disponíveis aqui são dinâmicos e podem ser criados
                  na área "Perfis e Acessos".
                </li>
                <li>
                  Perfis marcados como administrativos recebem acesso total ao
                  sistema automaticamente.
                </li>
                <li>
                  Perfis comuns nascem sem acesso e você libera cada módulo de
                  forma granular.
                </li>
              </ul>
            </div>
          </div>
        </Card>

        <Dialog open={showAddUser} onOpenChange={(open) => !open && resetCreateForm()} size="lg">
          <DialogHeader onClose={resetCreateForm}>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie um novo usuário e associe a um perfil dinâmico de acesso.</DialogDescription>
          </DialogHeader>
          <DialogBody>
          <form onSubmit={handleCreateUser} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Usuário
                </label>
                <Input
                  type="text"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  required
                  placeholder="nome.usuario"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  placeholder="usuario@email.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Senha
                </label>
                <Input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Digite uma senha temporária"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Perfil
                </label>
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
                  {actionLoading ? "Criando..." : "Criar Usuário"}
              </Button>
              <Button
                type="button"
                onClick={resetCreateForm}
                variant="secondary"
              >
                Cancelar
              </Button>
            </div>
          </form>
          </DialogBody>
        </Dialog>
        <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && resetEditForm()} size="lg">
          <DialogHeader onClose={resetEditForm}>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize os dados e o perfil de acesso do usuário.</DialogDescription>
          </DialogHeader>
          <DialogBody>
          <form onSubmit={handleUpdateUser} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Usuário
                </label>
                <Input
                  type="text"
                  value={editUserUsername}
                  onChange={(e) => setEditUserUsername(e.target.value)}
                  required
                  placeholder="nome.usuario"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <Input
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  required
                  placeholder="usuario@email.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nova Senha
                </label>
                <Input
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  minLength={6}
                  placeholder="Deixe em branco para manter"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Deixe em branco para manter a senha atual.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Perfil
                </label>
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
                  {actionLoading ? "Salvando..." : "Salvar Alterações"}
              </Button>
              <Button type="button" onClick={resetEditForm} variant="secondary">
                Cancelar
              </Button>
            </div>
          </form>
          </DialogBody>
        </Dialog>
        {ConfirmationDialog}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
