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
  Search,
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
  CardIcon,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  OperationalMetricChip,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
  const [searchTerm, setSearchTerm] = useState("");
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

  const filteredUsers = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedTerm) return users;

    return users.filter((userProfile) => {
      const profile = profileBySlug.get(userProfile.role);
      const profileLabel = formatProfileLabel(userProfile.role, profile?.name);
      return [userProfile.username, userProfile.email, userProfile.role, profileLabel]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedTerm));
    });
  }, [profileBySlug, searchTerm, users]);

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
      <div className="space-y-5">
        <SectionHeader
          eyebrow="Equipe e acessos"
          title="Usuários"
          description="Gerencie contas e os perfis de acesso da equipe."
          action={
            <Button onClick={() => setShowAddUser(true)} variant="primary">
              <Plus className="h-4 w-4" />
              <span>Novo Usuário</span>
            </Button>
          }
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              leftIcon={Search}
              placeholder="Buscar por usuário, e-mail ou perfil"
            />
          </div>
          <OperationalMetricChip value={filteredUsers.length} label={filteredUsers.length === 1 ? "usuário" : "usuários"} />
        </div>

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

        <div className="space-y-3">

          <div className="hidden lg:block">
            <Table size="sm" stickyHeader className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Perfil de acesso</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead align="right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-[var(--text-muted)]">
                      Nenhum usuário cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((userProfile) => {
                    const profile = profileBySlug.get(userProfile.role);
                    const profileLabel = formatProfileLabel(userProfile.role, profile?.name);
                    const isCurrentUser = userProfile.id === currentUserManagementId;

                    return (
                      <TableRow key={userProfile.id} className="align-middle">
                        <TableCell className="min-w-64">
                          <div className="flex items-center gap-3">
                            <CardIcon className="h-8 w-8"><UserIcon className="h-4 w-4" /></CardIcon>
                            <div className="min-w-0">
                              <span className="block truncate font-semibold text-[var(--text-primary)]">@{userProfile.username}</span>
                              <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{userProfile.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge tone={isCurrentUser ? "gold" : "neutral"}>{profileLabel || userProfile.role}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(userProfile.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell align="right">
                          <div className="flex justify-end gap-1">
                            <Button type="button" onClick={() => startEditingUser(userProfile)} disabled={actionLoading} variant="icon" size="icon" title="Editar usuário" aria-label={`Editar ${userProfile.username}`}><Pencil className="h-4 w-4" /></Button>
                            {!isCurrentUser && <Button type="button" onClick={() => void handleDeleteUser(userProfile.id)} disabled={actionLoading} variant="danger" size="icon" title="Excluir usuário" aria-label={`Excluir ${userProfile.username}`}><Trash2 className="h-4 w-4" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {filteredUsers.length === 0 ? (
              <Card variant="muted" padding="md" className="py-12 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-[color:var(--text-tertiary)] opacity-40" />
                <p className="text-[color:var(--text-tertiary)]">
                  Nenhum usuário cadastrado
                </p>
              </Card>
            ) : (
              filteredUsers.map((userProfile) => {
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
                      <CardIcon>
                        <UserIcon className="h-5 w-5" />
                      </CardIcon>
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
        </div>

        <Dialog open={showAddUser} onOpenChange={(open) => !open && resetCreateForm()} size="lg">
          <DialogHeader onClose={resetCreateForm}>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie um novo usuário e associe a um perfil dinâmico de acesso.</DialogDescription>
          </DialogHeader>
          <DialogBody>
          <form onSubmit={handleCreateUser} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Usuário">
                <Input
                  type="text"
                  value={newUserUsername}
                  onChange={(e) => setNewUserUsername(e.target.value)}
                  required
                  placeholder="nome.usuario"
                />
              </Field>

              <Field label="Email">
                <Input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  placeholder="usuario@email.com"
                />
              </Field>

              <Field label="Senha">
                <Input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Digite uma senha temporária"
                />
              </Field>

              <Field label="Perfil">
                <FilterSingleSelect
                  icon={Shield}
                  value={newUserRole}
                  onChange={setNewUserRole}
                  placeholder="Selecione um perfil"
                  includePlaceholderOption={false}
                  options={profileOptions}
                />
              </Field>
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
              <Field label="Usuário">
                <Input
                  type="text"
                  value={editUserUsername}
                  onChange={(e) => setEditUserUsername(e.target.value)}
                  required
                  placeholder="nome.usuario"
                />
              </Field>

              <Field label="Email">
                <Input
                  type="email"
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  required
                  placeholder="usuario@email.com"
                />
              </Field>

              <Field
                label="Nova senha"
                description="Deixe em branco para manter a senha atual."
              >
                <Input
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  minLength={6}
                  placeholder="Deixe em branco para manter"
                />
              </Field>

              <Field label="Perfil">
                <FilterSingleSelect
                  icon={Shield}
                  value={editUserRole}
                  onChange={setEditUserRole}
                  placeholder="Selecione um perfil"
                  includePlaceholderOption={false}
                  options={profileOptions}
                />
              </Field>
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
