import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useConfig } from "../../../contexts/ConfigContext";
import { configService } from "../../../lib/configService";
import { supabase } from "../../../lib/supabase";
import {
  ACCESS_MODULES,
  buildProfileSlug,
  formatProfileLabel,
} from "../../../lib/accessControl";
import { useConfirmationModal } from "../../../hooks/useConfirmationModal";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { createEmptyPermission } from "./shared/accessControlUtils";

type FeedbackMessage = { type: "success" | "error"; text: string };

export default function AccessControlManagerScreen() {
  const {
    accessProfiles,
    profilePermissions,
    refreshAccessProfiles,
    refreshProfilePermissions,
  } = useConfig();
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileIsAdmin, setProfileIsAdmin] = useState(false);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const profileById = useMemo(
    () => new Map(accessProfiles.map((profile) => [profile.id, profile])),
    [accessProfiles],
  );

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const showMessage = (type: FeedbackMessage["type"], text: string) => {
    setMessage({ type, text });
  };

  const resetProfileForm = () => {
    setCreatingProfile(false);
    setEditingProfileId(null);
    setProfileName("");
    setProfileDescription("");
    setProfileIsAdmin(false);
  };

  const getPermission = (role: string, module: string, isAdmin: boolean) => {
    if (isAdmin) {
      return {
        id: "",
        role,
        module,
        can_view: true,
        can_edit: true,
        created_at: "",
        updated_at: "",
      };
    }

    const rule = profilePermissions.find(
      (item) => item.role === role && item.module === module,
    );
    return rule ?? createEmptyPermission(role, module);
  };

  const updatePermission = async (
    role: string,
    module: string,
    updates: Record<string, boolean>,
  ) => {
    const key = `${role}:${module}`;
    setUpdatingKey(key);

    const { error } = await configService.upsertProfilePermission(
      role,
      module,
      updates,
    );
    if (error) {
      showMessage("error", "Erro ao atualizar permissao.");
      setUpdatingKey(null);
      return;
    }

    await refreshProfilePermissions();
    setUpdatingKey(null);
    showMessage("success", "Permissao atualizada.");
  };

  const handleToggleView = async (
    role: string,
    module: string,
    current: boolean,
  ) => {
    const updates: Record<string, boolean> = { can_view: !current };
    if (current) {
      updates.can_edit = false;
    }

    await updatePermission(role, module, updates);
  };

  const handleToggleEdit = async (
    role: string,
    module: string,
    current: boolean,
  ) => {
    const updates: Record<string, boolean> = { can_edit: !current };
    if (!current) {
      updates.can_view = true;
    }

    await updatePermission(role, module, updates);
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = profileName.trim();
    if (!trimmedName) {
      showMessage("error", "Informe um nome para o perfil.");
      return;
    }

    const slug = buildProfileSlug(trimmedName);
    if (!slug) {
      showMessage(
        "error",
        "Não foi possível gerar um identificador válido para o perfil.",
      );
      return;
    }

    const { error } = await configService.createAccessProfile({
      slug,
      name: trimmedName,
      description: profileDescription.trim() || null,
      is_admin: profileIsAdmin,
    });

    if (error) {
      showMessage("error", error.message || "Erro ao criar perfil.");
      return;
    }

    await refreshAccessProfiles();
    resetProfileForm();
    showMessage("success", "Perfil criado com sucesso.");
  };

  const handleStartEdit = (profileId: string) => {
    const profile = profileById.get(profileId);
    if (!profile) {
      return;
    }

    setCreatingProfile(false);
    setEditingProfileId(profileId);
    setProfileName(profile.name);
    setProfileDescription(profile.description ?? "");
    setProfileIsAdmin(profile.is_admin);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingProfileId) {
      return;
    }

    const { error } = await configService.updateAccessProfile(
      editingProfileId,
      {
        name: profileName.trim(),
        description: profileDescription.trim() || null,
        is_admin: profileIsAdmin,
      },
    );

    if (error) {
      showMessage("error", error.message || "Erro ao atualizar perfil.");
      return;
    }

    await refreshAccessProfiles();
    resetProfileForm();
    showMessage("success", "Perfil atualizado com sucesso.");
  };

  const handleDeleteProfileConfirmed = async (profileId: string) => {
    const profile = profileById.get(profileId);
    if (!profile) {
      return;
    }

    const { count, error: countError } = await supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", profile.slug);

    if (countError) {
      showMessage("error", "Não foi possível validar se o perfil está em uso.");
      return;
    }

    if ((count ?? 0) > 0) {
      showMessage(
        "error",
        "Este perfil está vinculado a usuários e não pode ser excluído.",
      );
      return;
    }

    const { error } = await configService.deleteAccessProfile(profileId);
    if (error) {
      showMessage("error", error.message || "Erro ao excluir perfil.");
      return;
    }

    await Promise.all([refreshAccessProfiles(), refreshProfilePermissions()]);
    resetProfileForm();
    showMessage("success", "Perfil excluido com sucesso.");
  };

  const profileFormTitle = editingProfileId
    ? "Editar perfil"
    : "Criar novo perfil";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] p-6 shadow-sm">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--panel-accent-blue-bg)] text-[var(--panel-accent-blue-text)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[color:var(--panel-text)]">
              Perfis e permissoes dinamicas
            </h3>
            <p className="text-sm text-[color:var(--panel-text-soft)]">
              Crie perfis pelo sistema, marque perfis administrativos e controle
              visualização ou edição módulo a módulo.
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => {
              resetProfileForm();
              setCreatingProfile(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Novo perfil</span>
          </Button>
          {(creatingProfile || editingProfileId) && (
            <Button
              type="button"
              variant="secondary"
              onClick={resetProfileForm}
            >
              Cancelar
            </Button>
          )}
        </div>

        {(creatingProfile || editingProfileId) && (
          <form
            onSubmit={
              editingProfileId ? handleUpdateProfile : handleCreateProfile
            }
            className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"
          >
            <h4 className="mb-4 text-base font-semibold text-slate-900">
              {profileFormTitle}
            </h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nome do perfil
                </label>
                <Input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Ex: Comercial Senior"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Slug gerado
                </label>
                <Input
                  value={buildProfileSlug(profileName)}
                  readOnly
                  placeholder="comercial-senior"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Descricao
                </label>
                <Input
                  value={profileDescription}
                  onChange={(event) =>
                    setProfileDescription(event.target.value)
                  }
                  placeholder="Resumo rapido do escopo deste perfil"
                />
              </div>
            </div>

            <label className="mt-4 flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={profileIsAdmin}
                onChange={(event) => setProfileIsAdmin(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Perfil administrativo (acesso total ao sistema)</span>
            </label>

            <div className="mt-4 flex gap-3">
              <Button type="submit">
                {editingProfileId ? "Salvar perfil" : "Criar perfil"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={resetProfileForm}
              >
                Fechar
              </Button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {accessProfiles.map((profile) => (
            <div
              key={profile.id}
              className="rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[color:var(--panel-text)]">
                      {formatProfileLabel(profile.slug, profile.name)}
                    </h4>
                    {profile.is_system && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Sistema
                      </span>
                    )}
                    {profile.is_admin && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Admin total
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[color:var(--panel-text-muted)]">
                    {profile.slug}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--panel-text-soft)]">
                    {profile.description || "Sem descricao cadastrada."}
                  </p>
                </div>

                <div className="flex gap-2">
                  {!profile.is_system && (
                    <>
                      <Button
                        type="button"
                        variant="icon"
                        size="icon"
                        className="h-8 w-8 text-slate-600 hover:bg-slate-200"
                        title="Editar perfil"
                        onClick={() => handleStartEdit(profile.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="icon"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:bg-red-50"
                        title="Excluir perfil"
                        onClick={async () => {
                          const confirmed = await requestConfirmation({
                            title: "Excluir perfil",
                            description: `Tem certeza que deseja excluir o perfil "${profile.name}"?`,
                            confirmLabel: "Excluir perfil",
                            cancelLabel: "Cancelar",
                            tone: "danger",
                          });

                          if (confirmed) {
                            await handleDeleteProfileConfirmed(profile.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] shadow-sm">
        <table className="min-w-full divide-y divide-[color:var(--panel-border-subtle)]">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[color:var(--panel-text-muted)]">
                Módulo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[color:var(--panel-text-muted)]">
                Descricao
              </th>
              {accessProfiles.map((profile) => (
                <th
                  key={profile.id}
                  className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[color:var(--panel-text-muted)]"
                >
                  {formatProfileLabel(profile.slug, profile.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)]">
            {ACCESS_MODULES.map((module) => (
              <tr key={module.id}>
                <td className="px-4 py-3 text-sm font-medium text-[color:var(--panel-text)]">
                  {module.label}
                </td>
                <td className="px-4 py-3 text-sm text-[color:var(--panel-text-soft)]">
                  {module.description}
                </td>
                {accessProfiles.map((profile) => {
                  const permission = getPermission(
                    profile.slug,
                    module.id,
                    profile.is_admin,
                  );
                  const canEdit = permission.can_edit;
                  const canView = permission.can_view;
                  const isUpdating =
                    updatingKey === `${profile.slug}:${module.id}`;

                  return (
                    <td
                      key={`${profile.id}-${module.id}`}
                      className="px-4 py-3"
                    >
                      <div className="flex items-center justify-center space-x-3">
                        <label className="inline-flex items-center space-x-2 text-xs text-[color:var(--panel-text-soft)]">
                          <input
                            type="checkbox"
                            checked={canView}
                            onChange={() =>
                              void handleToggleView(
                                profile.slug,
                                module.id,
                                canView,
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            disabled={profile.is_admin || isUpdating}
                          />
                          <span>Ver</span>
                        </label>
                        <label className="inline-flex items-center space-x-2 text-xs text-[color:var(--panel-text-soft)]">
                          <input
                            type="checkbox"
                            checked={canEdit}
                            onChange={() =>
                              void handleToggleEdit(
                                profile.slug,
                                module.id,
                                canEdit,
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            disabled={
                              profile.is_admin || !canView || isUpdating
                            }
                          />
                          <span>Editar</span>
                        </label>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ConfirmationDialog}
    </div>
  );
}
