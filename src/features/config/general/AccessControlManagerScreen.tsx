import { Heading, Text, FieldLabel } from '../../../design-system';
import { ActionSurface } from '../../../design-system';
import { useMemo, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useConfig } from "../../../contexts/ConfigContext";
import { configService } from "../data/configService";
import { countUsersByRole } from "../users/data/usersRepository";
import { ACCESS_MODULES, buildProfileSlug, formatProfileLabel } from "../../../lib/accessControl";
import { useConfirmationModal } from "../../../hooks/useConfirmationModal";
import { toast } from "../../../lib/toast";
import {
  Alert, Badge, Button, Card, Checkbox, Combobox,
  Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, Field, Input, LoadingState, SectionHeader, Select, Textarea,
} from "../../../design-system";
import { createEmptyPermission } from "./shared/accessControlUtils";

const moduleGroups = [
  { id: "workspace", label: "Operação diária" },
  { id: "config", label: "Configurações do sistema" },
] as const;

const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

export default function AccessControlManagerScreen({ hideSectionTitle = false }: { hideSectionTitle?: boolean } = {}) {
  const {
    accessProfiles, profilePermissions, refreshAccessProfiles, refreshProfilePermissions,
    loading, loadError, retryLoad,
  } = useConfig();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileSearch, setProfileSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profileDescription, setProfileDescription] = useState("");
  const [profileIsAdmin, setProfileIsAdmin] = useState(false);
  const [profileNameError, setProfileNameError] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState(false);
  const [permissionErrors, setPermissionErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const profiles = useMemo(() => [...accessProfiles].sort((left, right) =>
    formatProfileLabel(left.slug, left.name).localeCompare(formatProfileLabel(right.slug, right.name), "pt-BR", { numeric: true, sensitivity: "base" }),
  ), [accessProfiles]);
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? profiles[0] ?? null;
  const visibleProfiles = profiles.filter((profile) => normalizeSearch(`${profile.name} ${profile.description ?? ""}`).includes(normalizeSearch(profileSearch)));
  const visibleModules = ACCESS_MODULES.filter((module) => normalizeSearch(`${module.label} ${module.description}`).includes(normalizeSearch(moduleSearch)));

  const resetProfileForm = () => {
    setCreatingProfile(false);
    setEditingProfileId(null);
    setProfileName("");
    setProfileDescription("");
    setProfileIsAdmin(false);
    setProfileNameError(null);
    setProfileSaveError(false);
  };

  const startCreatingProfile = () => {
    resetProfileForm();
    setCreatingProfile(true);
  };

  const selectProfile = (id: string) => {
    setSelectedProfileId(id);
    setModuleSearch("");
  };

  const getPermission = (role: string, module: string, isAdmin: boolean) => {
    if (isAdmin) return { can_view: true, can_edit: true };
    return profilePermissions.find((item) => item.role === role && item.module === module) ?? createEmptyPermission(role, module);
  };

  const updatePermission = async (role: string, module: string, level: string) => {
    if (updatingKey) return;
    const permissionKey = `${role}:${module}`;
    setUpdatingKey(permissionKey);
    setPermissionErrors((current) => {
      const next = { ...current };
      delete next[permissionKey];
      return next;
    });
    try {
      const { data, error } = await configService.upsertProfilePermission(role, module, {
        can_view: level !== "none",
        can_edit: level === "edit",
      });
      if (error) throw error;
      if (!data) throw new Error("O salvamento da permissão não foi confirmado.");
      await refreshProfilePermissions();
      toast.success("Permissão atualizada.");
    } catch {
      setPermissionErrors((current) => ({
        ...current,
        [permissionKey]: "Não foi possível salvar esta permissão. Tente novamente.",
      }));
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleStartEdit = () => {
    if (!selectedProfile || selectedProfile.is_system) return;
    setCreatingProfile(false);
    setEditingProfileId(selectedProfile.id);
    setProfileName(selectedProfile.name);
    setProfileDescription(selectedProfile.description ?? "");
    setProfileIsAdmin(selectedProfile.is_admin);
  };

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (savingProfile) return;
    const name = profileName.trim();
    setProfileSaveError(false);
    if (!name) {
      setProfileNameError("Informe um nome para o perfil.");
      return;
    }
    const slug = buildProfileSlug(name);
    if (!editingProfileId && !slug) {
      setProfileNameError("Use letras ou números no nome do perfil.");
      return;
    }
    setSavingProfile(true);
    try {
      const updates = { name, description: profileDescription.trim() || null, is_admin: profileIsAdmin };
      const { data, error } = editingProfileId
        ? await configService.updateAccessProfile(editingProfileId, updates)
        : await configService.createAccessProfile({ ...updates, slug });
      if (error) throw error;
      if (!data) throw new Error("O salvamento do perfil não foi confirmado.");
      await refreshAccessProfiles();
      selectProfile(data.id);
      setProfileSearch("");
      toast.success(editingProfileId ? "Perfil atualizado." : profileIsAdmin ? "Perfil criado com acesso total." : "Perfil criado. Defina as permissões de acesso abaixo.");
      resetProfileForm();
    } catch {
      setProfileSaveError(true);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteProfile = async () => {
    const profile = selectedProfile;
    if (!profile || profile.is_system || deletingProfileId) return;
    const confirmed = await requestConfirmation({
      title: "Excluir perfil",
      description: `Deseja excluir o perfil "${profile.name}"? Perfis vinculados a usuários não podem ser excluídos.`,
      confirmLabel: "Excluir perfil", cancelLabel: "Cancelar", tone: "danger",
      dialogClassName: "kds-access-profile-confirmation",
    });
    if (!confirmed) return;
    setDeletingProfileId(profile.id);
    try {
      let userCount: number;
      try {
        userCount = await countUsersByRole(profile.slug);
      } catch {
        toast.error("Não foi possível verificar se o perfil está vinculado a usuários. Tente novamente.");
        return;
      }
      if (userCount > 0) {
        toast.error("Este perfil está vinculado a usuários e não pode ser excluído.");
        return;
      }
      const { error } = await configService.deleteAccessProfile(profile.id);
      if (error) throw error;
      await Promise.all([refreshAccessProfiles(), refreshProfilePermissions()]);
      setSelectedProfileId(null);
      resetProfileForm();
      toast.success("Perfil excluído.");
    } catch {
      toast.error("Não foi possível excluir o perfil. Tente novamente.");
    } finally {
      setDeletingProfileId(null);
    }
  };

  const visibleAreaCount = selectedProfile ? ACCESS_MODULES.filter((module) => getPermission(selectedProfile.slug, module.id, selectedProfile.is_admin).can_view).length : 0;
  const profileOptions = profiles.map((profile) => ({ value: profile.id, label: formatProfileLabel(profile.slug, profile.name) }));

  const createProfileAction = <Button onClick={startCreatingProfile} disabled={loading || loadError}><Plus className="kds-control-icon" aria-hidden="true" />Novo perfil</Button>;

  return (
    <div className="space-y-6">
      {hideSectionTitle
        ? <div className="flex justify-end lg:hidden">{createProfileAction}</div>
        : <SectionHeader as="h3" title="Perfis e acessos" description="Escolha um perfil para definir o que seus usuários podem visualizar e editar." action={createProfileAction} />}

      {loadError && <Alert tone="warning" title="Não foi possível carregar todos os acessos">
        Atualize os dados antes de alterar as permissões.
        <Button variant="secondary" size="sm" className="ml-3" onClick={retryLoad} disabled={loading}>Tentar novamente</Button>
      </Alert>}

      {loading && profiles.length === 0 ? <LoadingState label="Carregando perfis e acessos…" /> : selectedProfile ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
          <Card padding="md" className="sticky top-4 hidden min-w-0 lg:block">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Heading level={4} className="font-semibold text-[var(--text-primary)]">Perfis</Heading>
                <Badge tone="neutral" size="sm">{profiles.length}</Badge>
              </div>
              {createProfileAction}
            </div>
            <Input leftIcon={Search} value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} placeholder="Buscar perfil" aria-label="Buscar perfil" />
            <nav aria-label="Perfis de acesso" className="mt-3 max-h-[32rem] space-y-1 overflow-y-auto pr-1">
              {visibleProfiles.map((profile) => {
                const selected = profile.id === selectedProfile.id;
                return <ActionSurface variant="plain" padding="sm" key={profile.id} type="button" aria-pressed={selected} onClick={() => selectProfile(profile.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${selected ? "border-[var(--border-accent)] bg-[var(--brand-primary-soft)]" : "border-transparent hover:bg-[var(--surface-secondary)]"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold text-[var(--text-primary)]">{formatProfileLabel(profile.slug, profile.name)}</span>
                    <span className="mt-1 block text-xs text-[var(--text-muted)]">{profile.is_admin ? "Acesso total" : profile.is_system ? "Perfil padrão" : "Acesso personalizado"}</span>
                  </span>
                  {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />}
                </ActionSurface>;
              })}
              {visibleProfiles.length === 0 && <Text role="status" className="px-3 py-6 text-sm text-[var(--text-muted)]">Nenhum perfil encontrado. Tente outro nome.</Text>}
            </nav>
          </Card>

          <div className="min-w-0 space-y-4">
            <div className="lg:hidden">
              <Field label={`Escolha um perfil (${profiles.length})`}>
                <Combobox value={selectedProfile.id} options={profileOptions} onChange={selectProfile} aria-label="Escolha um perfil" searchPlaceholder="Buscar perfil" emptyMessage="Nenhum perfil encontrado." />
              </Field>
            </div>

            <Card padding="md" className="min-w-0 space-y-5" aria-labelledby="selected-profile-title">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {selectedProfile.is_system && <Badge tone="neutral" size="sm">Perfil padrão</Badge>}
                    <Badge tone={selectedProfile.is_admin ? "gold" : "neutral"} size="sm">{selectedProfile.is_admin ? "Acesso total" : "Acesso personalizado"}</Badge>
                  </div>
                  <Heading level={4} id="selected-profile-title" className="break-words font-[var(--font-sans)] text-lg font-semibold text-[var(--text-primary)]">{formatProfileLabel(selectedProfile.slug, selectedProfile.name)}</Heading>
                  {selectedProfile.description && <Text className="mt-2 break-words text-sm leading-6 text-[var(--text-secondary)]">{selectedProfile.description}</Text>}
                </div>
                {!selectedProfile.is_system && <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={handleStartEdit} disabled={Boolean(updatingKey || deletingProfileId) || loading || loadError}><Pencil className="kds-control-icon" aria-hidden="true" />Editar perfil</Button>
                  <Button variant="danger" size="sm" onClick={() => void handleDeleteProfile()} disabled={Boolean(updatingKey || deletingProfileId) || loading || loadError}><Trash2 className="kds-control-icon" aria-hidden="true" />{deletingProfileId === selectedProfile.id ? "Excluindo…" : "Excluir"}</Button>
                </div>}
              </div>

              {selectedProfile.is_admin && <Alert tone="info" title="Este perfil tem acesso total">
                {selectedProfile.is_system ? "Seus usuários podem visualizar e editar todas as áreas do sistema. Esse acesso é fixo para este perfil padrão." : "Seus usuários podem visualizar e editar todas as áreas. Para escolher permissões por área, edite o perfil e desative o acesso total."}
              </Alert>}

              <div className="border-t border-[var(--border-subtle)] pt-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Heading level={5} className="font-semibold text-[var(--text-primary)]">Acesso por área</Heading>
                    <Text className="mt-1 text-sm text-[var(--text-muted)]">{visibleAreaCount} de {ACCESS_MODULES.length} áreas com acesso · alterações salvas automaticamente.</Text>
                  </div>
                  <div className="w-full sm:w-64"><Input leftIcon={Search} value={moduleSearch} onChange={(event) => setModuleSearch(event.target.value)} placeholder="Buscar área" aria-label="Buscar área" /></div>
                </div>

                <div className="space-y-6">
                  {moduleGroups.map((group) => {
                    const modules = visibleModules.filter((module) => module.group === group.id);
                    if (modules.length === 0) return null;
                    const splitIndex = Math.ceil(modules.length / 2);
                    const columns = [modules.slice(0, splitIndex), modules.slice(splitIndex)];
                    return <section key={group.id} aria-labelledby={`access-group-${group.id}`}>
                      <Heading level={6} id={`access-group-${group.id}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{group.label}</Heading>
                      <div className="grid gap-x-8 2xl:grid-cols-2">
                        {columns.map((column, columnIndex) => <ul key={`${group.id}-column-${columnIndex}`} className="divide-y divide-[var(--border-subtle)]">
                          {column.map((module) => {
                            const permission = getPermission(selectedProfile.slug, module.id, selectedProfile.is_admin);
                            const level = !permission.can_view ? "none" : permission.can_edit ? "edit" : "view";
                            const permissionKey = `${selectedProfile.slug}:${module.id}`;
                            const isUpdating = updatingKey === permissionKey;
                            const error = permissionErrors[permissionKey];
                            return <li key={module.id} className="flex min-w-0 flex-col gap-3 py-3 xl:flex-row xl:items-center xl:justify-between xl:gap-4" aria-busy={isUpdating}>
                              <div className="min-w-0 flex-1">
                                <Text className="text-sm font-medium text-[var(--text-primary)]">{module.label}</Text>
                                <Text className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{module.description}</Text>
                              </div>
                              <div className="w-full min-w-0 shrink-0 xl:w-48">
                                <Field
                                  label={<span className="sr-only">Acesso a {module.label}</span>}
                                  error={error ?? undefined}
                                >
                                  <Select aria-label={`Acesso a ${module.label}`} value={level} invalid={Boolean(error)} disabled={selectedProfile.is_admin || Boolean(updatingKey || deletingProfileId) || loading || loadError}
                                    onChange={(event) => void updatePermission(selectedProfile.slug, module.id, event.target.value)}>
                                    <option value="none">Sem acesso</option>
                                    <option value="view">Visualizar</option>
                                    <option value="edit">Visualizar e editar</option>
                                  </Select>
                                </Field>
                                {isUpdating && <span role="status" className="mt-1 block text-xs text-[var(--text-muted)]">Salvando permissão…</span>}
                              </div>
                            </li>;
                          })}
                        </ul>)}
                      </div>
                    </section>;
                  })}
                  {visibleModules.length === 0 && <EmptyState title="Nenhuma área encontrada" description="Tente outro nome para encontrar a área desejada." action={<Button variant="secondary" size="sm" onClick={() => setModuleSearch("")}>Limpar busca</Button>} />}
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : !loadError && <EmptyState icon={<ShieldCheck aria-hidden="true" />} title="Nenhum perfil cadastrado" description="Crie um perfil para definir as áreas que seus usuários poderão acessar." action={<Button onClick={startCreatingProfile}>Criar primeiro perfil</Button>} />}

      <Dialog open={creatingProfile || Boolean(editingProfileId)} onOpenChange={(open) => { if (!open && !savingProfile) resetProfileForm(); }} size="sm" initialFocus="first-content" closeOnEscape={!savingProfile} closeOnOverlay={!savingProfile} className="kds-access-profile-dialog">
        <DialogHeader onClose={savingProfile ? undefined : resetProfileForm}>
          <DialogTitle>{editingProfileId ? "Editar perfil" : "Novo perfil"}</DialogTitle>
          <DialogDescription>{editingProfileId ? "Atualize o nome, a descrição e o tipo de acesso." : "Depois de criar, escolha as áreas que este perfil poderá acessar."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSaveProfile}>
          <DialogBody className="space-y-4">
            {profileSaveError && <Alert tone="danger" title="Não foi possível salvar o perfil.">Confira os dados e tente novamente.</Alert>}
            <Field label={<>Nome do perfil<span className="kds-field-required" aria-hidden="true"> *</span></>} error={profileNameError ?? undefined}><Input aria-required="true" value={profileName} onChange={(event) => { setProfileName(event.target.value); setProfileNameError(null); }} placeholder="Ex.: Equipe comercial" disabled={savingProfile} /></Field>
            <Field label="Descrição (opcional)"><Textarea value={profileDescription} onChange={(event) => setProfileDescription(event.target.value)} placeholder="Para quem é este perfil?" rows={3} disabled={savingProfile} /></Field>
            <FieldLabel className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] p-4">
              <Checkbox checked={profileIsAdmin} onChange={(event) => setProfileIsAdmin(event.target.checked)} disabled={savingProfile} />
              <span className="text-sm text-[var(--text-primary)]">Conceder acesso total<span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">Permite visualizar e editar todas as áreas, incluindo usuários e permissões.</span></span>
            </FieldLabel>
          </DialogBody>
          <DialogFooter><Button type="button" variant="secondary" onClick={resetProfileForm} disabled={savingProfile}>Cancelar</Button><Button type="submit" disabled={savingProfile}>{savingProfile ? "Salvando…" : editingProfileId ? "Salvar perfil" : "Criar perfil"}</Button></DialogFooter>
        </form>
      </Dialog>
      {ConfirmationDialog}
    </div>
  );
}
