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

export default function AccessControlManagerScreen() {
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
    setUpdatingKey(`${role}:${module}`);
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
      toast.error("Não foi possível atualizar a permissão. Tente novamente.");
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
    if (!name) {
      toast.error("Informe um nome para o perfil.");
      return;
    }
    const slug = buildProfileSlug(name);
    if (!editingProfileId && !slug) {
      toast.error("Use letras ou números no nome do perfil.");
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
      toast.error("Não foi possível salvar o perfil. Confira o nome e tente novamente.");
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

  return (
    <div className="space-y-6">
      <SectionHeader as="h3" title="Perfis e acessos" description="Escolha um perfil para definir o que seus usuários podem visualizar e editar."
        action={<Button onClick={startCreatingProfile} disabled={loading || loadError}><Plus className="kds-control-icon" aria-hidden="true" />Novo perfil</Button>}
      />

      {loadError && <Alert tone="warning" title="Não foi possível carregar todos os acessos">
        Atualize os dados antes de alterar as permissões.
        <Button variant="secondary" size="sm" className="ml-3" onClick={retryLoad} disabled={loading}>Tentar novamente</Button>
      </Alert>}

      {loading && profiles.length === 0 ? <LoadingState label="Carregando perfis e acessos…" /> : selectedProfile ? (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
          <Card padding="md" className="hidden min-w-0 lg:block">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h4 className="font-semibold text-[var(--text-primary)]">Perfis</h4>
              <Badge tone="neutral" size="sm">{profiles.length}</Badge>
            </div>
            <Input leftIcon={Search} value={profileSearch} onChange={(event) => setProfileSearch(event.target.value)} placeholder="Buscar perfil" aria-label="Buscar perfil" />
            <nav aria-label="Perfis de acesso" className="mt-3 max-h-[32rem] space-y-1 overflow-y-auto pr-1">
              {visibleProfiles.map((profile) => {
                const selected = profile.id === selectedProfile.id;
                return <button key={profile.id} type="button" aria-pressed={selected} onClick={() => selectProfile(profile.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${selected ? "border-[var(--border-accent)] bg-[var(--brand-primary-soft)]" : "border-transparent hover:bg-[var(--surface-secondary)]"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold text-[var(--text-primary)]">{formatProfileLabel(profile.slug, profile.name)}</span>
                    <span className="mt-1 block text-xs text-[var(--text-muted)]">{profile.is_admin ? "Acesso total" : profile.is_system ? "Perfil padrão" : "Acesso personalizado"}</span>
                  </span>
                  {selected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />}
                </button>;
              })}
              {visibleProfiles.length === 0 && <p role="status" className="px-3 py-6 text-sm text-[var(--text-muted)]">Nenhum perfil encontrado. Tente outro nome.</p>}
            </nav>
          </Card>

          <div className="min-w-0 space-y-4">
            <div className="lg:hidden">
              <Field label={`Escolha um perfil (${profiles.length})`}>
                <Combobox value={selectedProfile.id} options={profileOptions} onChange={selectProfile} aria-label="Escolha um perfil" searchPlaceholder="Buscar perfil" emptyMessage="Nenhum perfil encontrado." />
              </Field>
            </div>

            <Card padding="lg" className="min-w-0 space-y-5" aria-labelledby="selected-profile-title">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    {selectedProfile.is_system && <Badge tone="neutral" size="sm">Perfil padrão</Badge>}
                    <Badge tone={selectedProfile.is_admin ? "gold" : "neutral"} size="sm">{selectedProfile.is_admin ? "Acesso total" : "Acesso personalizado"}</Badge>
                  </div>
                  <h4 id="selected-profile-title" className="break-words font-[var(--font-display)] text-xl text-[var(--text-primary)]">{formatProfileLabel(selectedProfile.slug, selectedProfile.name)}</h4>
                  {selectedProfile.description && <p className="mt-2 break-words text-sm leading-6 text-[var(--text-secondary)]">{selectedProfile.description}</p>}
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
                    <h5 className="font-semibold text-[var(--text-primary)]">Acesso por área</h5>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{visibleAreaCount} de {ACCESS_MODULES.length} áreas com acesso · alterações salvas automaticamente.</p>
                  </div>
                  <div className="w-full sm:w-64"><Input leftIcon={Search} value={moduleSearch} onChange={(event) => setModuleSearch(event.target.value)} placeholder="Buscar área" aria-label="Buscar área" /></div>
                </div>

                <div className="space-y-6">
                  {moduleGroups.map((group) => {
                    const modules = visibleModules.filter((module) => module.group === group.id);
                    if (modules.length === 0) return null;
                    return <section key={group.id} aria-labelledby={`access-group-${group.id}`}>
                      <h6 id={`access-group-${group.id}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{group.label}</h6>
                      <ul className="divide-y divide-[var(--border-subtle)]">
                        {modules.map((module) => {
                          const permission = getPermission(selectedProfile.slug, module.id, selectedProfile.is_admin);
                          const level = !permission.can_view ? "none" : permission.can_edit ? "edit" : "view";
                          const isUpdating = updatingKey === `${selectedProfile.slug}:${module.id}`;
                          return <li key={module.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6" aria-busy={isUpdating}>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[var(--text-primary)]">{module.label}</p>
                              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{module.description}</p>
                            </div>
                            <div className="w-full shrink-0 sm:w-52">
                              <Select aria-label={`Acesso a ${module.label}`} value={level} disabled={selectedProfile.is_admin || Boolean(updatingKey || deletingProfileId) || loading || loadError}
                                onChange={(event) => void updatePermission(selectedProfile.slug, module.id, event.target.value)}>
                                <option value="none">Sem acesso</option>
                                <option value="view">Visualizar</option>
                                <option value="edit">Visualizar e editar</option>
                              </Select>
                              {isUpdating && <span role="status" className="mt-1 block text-xs text-[var(--text-muted)]">Salvando permissão…</span>}
                            </div>
                          </li>;
                        })}
                      </ul>
                    </section>;
                  })}
                  {visibleModules.length === 0 && <EmptyState title="Nenhuma área encontrada" description="Tente outro nome para encontrar a área desejada." action={<Button variant="secondary" size="sm" onClick={() => setModuleSearch("")}>Limpar busca</Button>} />}
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : !loadError && <EmptyState icon={<ShieldCheck aria-hidden="true" />} title="Nenhum perfil cadastrado" description="Crie um perfil para definir as áreas que seus usuários poderão acessar." action={<Button onClick={startCreatingProfile}>Criar primeiro perfil</Button>} />}

      <Dialog open={creatingProfile || Boolean(editingProfileId)} onOpenChange={(open) => { if (!open && !savingProfile) resetProfileForm(); }} size="sm" closeOnEscape={!savingProfile} closeOnOverlay={!savingProfile}>
        <DialogHeader onClose={savingProfile ? undefined : resetProfileForm}>
          <DialogTitle>{editingProfileId ? "Editar perfil" : "Novo perfil"}</DialogTitle>
          <DialogDescription>{editingProfileId ? "Atualize o nome, a descrição e o tipo de acesso." : "Depois de criar, escolha as áreas que este perfil poderá acessar."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSaveProfile}>
          <DialogBody className="space-y-4">
            <Field label="Nome do perfil"><Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Ex.: Equipe comercial" required disabled={savingProfile} /></Field>
            <Field label="Descrição (opcional)"><Textarea value={profileDescription} onChange={(event) => setProfileDescription(event.target.value)} placeholder="Para quem é este perfil?" rows={3} disabled={savingProfile} /></Field>
            <label className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] p-4">
              <Checkbox checked={profileIsAdmin} onChange={(event) => setProfileIsAdmin(event.target.checked)} disabled={savingProfile} />
              <span className="text-sm text-[var(--text-primary)]">Conceder acesso total<span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">Permite visualizar e editar todas as áreas, incluindo usuários e permissões.</span></span>
            </label>
          </DialogBody>
          <DialogFooter><Button type="button" variant="secondary" onClick={resetProfileForm} disabled={savingProfile}>Cancelar</Button><Button type="submit" disabled={savingProfile}>{savingProfile ? "Salvando…" : editingProfileId ? "Salvar perfil" : "Criar perfil"}</Button></DialogFooter>
        </form>
      </Dialog>
      {ConfirmationDialog}
    </div>
  );
}
