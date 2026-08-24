import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { useConfirmationModal } from "../../../hooks/useConfirmationModal";
import { getLinkIcon, LINK_ICON_OPTIONS } from "../../../lib/linkIcons";
import { linksService } from "../../../lib/linksService";
import type { PublicLinkItem, PublicLinkPageSettings } from "../../../lib/supabase";
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  LoadingState,
  SectionHeader,
  Select,
  Switch,
  Textarea,
} from "../../../design-system";

type Message = { type: "success" | "error"; text: string } | null;

type LinkFormState = {
  title: string;
  url: string;
  icon: string;
};

const EMPTY_LINK_FORM: LinkFormState = { title: "", url: "", icon: "link" };

const PUBLIC_LINKS_PATH = "/links";

export default function LinksScreen() {
  const [loading, setLoading] = useState(true);
  const [pageSettings, setPageSettings] = useState<PublicLinkPageSettings | null>(null);
  const [links, setLinks] = useState<PublicLinkItem[]>([]);

  const [profileForm, setProfileForm] = useState({
    title: "",
    bio: "",
    avatar_url: "",
    is_published: true,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<Message>(null);
  const [copyLabel, setCopyLabel] = useState("Copiar link");

  const [linksMessage, setLinksMessage] = useState<Message>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<LinkFormState>(EMPTY_LINK_FORM);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<LinkFormState>(EMPTY_LINK_FORM);
  const [creating, setCreating] = useState(false);

  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const publicUrl = `${window.location.origin}${PUBLIC_LINKS_PATH}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [settings, items] = await Promise.all([
      linksService.getLinkPageSettings(),
      linksService.getLinkItems(),
    ]);

    setPageSettings(settings);
    setProfileForm({
      title: settings?.title ?? "Kifer Saúde",
      bio: settings?.bio ?? "",
      avatar_url: settings?.avatar_url ?? "",
      is_published: settings?.is_published ?? true,
    });
    setLinks(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!profileMessage) return undefined;
    const timeout = window.setTimeout(() => setProfileMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [profileMessage]);

  useEffect(() => {
    if (!linksMessage) return undefined;
    const timeout = window.setTimeout(() => setLinksMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [linksMessage]);

  const handleCopyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyLabel("Copiado!");
      window.setTimeout(() => setCopyLabel("Copiar link"), 2000);
    } catch {
      setCopyLabel("Não foi possível copiar");
      window.setTimeout(() => setCopyLabel("Copiar link"), 2000);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileForm.title.trim()) {
      setProfileMessage({ type: "error", text: "Informe um título para a página." });
      return;
    }

    setSavingProfile(true);
    const { data, error } = await linksService.saveLinkPageSettings(
      {
        title: profileForm.title.trim(),
        bio: profileForm.bio.trim() || null,
        avatar_url: profileForm.avatar_url.trim() || null,
        is_published: profileForm.is_published,
      },
      pageSettings?.id,
    );

    if (error) {
      setProfileMessage({ type: "error", text: "Erro ao salvar as configurações da página." });
    } else {
      setPageSettings(data ?? pageSettings);
      setProfileMessage({ type: "success", text: "Página de links atualizada com sucesso." });
    }
    setSavingProfile(false);
  };

  const handleCreateLink = async () => {
    if (!createForm.title.trim() || !createForm.url.trim()) {
      setLinksMessage({ type: "error", text: "Informe o título e a URL do link." });
      return;
    }

    setCreating(true);
    const { error } = await linksService.createLinkItem({
      title: createForm.title.trim(),
      url: createForm.url.trim(),
      icon: createForm.icon,
      is_active: true,
      position: links.length,
    });

    if (error) {
      setLinksMessage({ type: "error", text: "Erro ao adicionar o link." });
    } else {
      setIsCreateModalOpen(false);
      setCreateForm(EMPTY_LINK_FORM);
      await loadData();
      setLinksMessage({ type: "success", text: "Link adicionado com sucesso." });
    }
    setCreating(false);
  };

  const startEditing = (link: PublicLinkItem) => {
    setEditingId(link.id);
    setEditingForm({ title: link.title, url: link.url, icon: link.icon });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingForm(EMPTY_LINK_FORM);
  };

  const confirmEditing = async () => {
    if (!editingId) return;

    if (!editingForm.title.trim() || !editingForm.url.trim()) {
      setLinksMessage({ type: "error", text: "Informe o título e a URL do link." });
      return;
    }

    setBusyId(editingId);
    const { error } = await linksService.updateLinkItem(editingId, {
      title: editingForm.title.trim(),
      url: editingForm.url.trim(),
      icon: editingForm.icon,
    });

    if (error) {
      setLinksMessage({ type: "error", text: "Erro ao atualizar o link." });
    } else {
      await loadData();
      cancelEditing();
      setLinksMessage({ type: "success", text: "Link atualizado com sucesso." });
    }
    setBusyId(null);
  };

  const handleToggleActive = async (link: PublicLinkItem) => {
    setBusyId(link.id);
    const { error } = await linksService.updateLinkItem(link.id, { is_active: !link.is_active });
    if (error) {
      setLinksMessage({ type: "error", text: "Erro ao atualizar o link." });
    } else {
      await loadData();
    }
    setBusyId(null);
  };

  const handleDelete = async (link: PublicLinkItem) => {
    const confirmed = await requestConfirmation({
      title: "Excluir link",
      description: `Deseja remover "${link.title}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    setBusyId(link.id);
    const { error } = await linksService.deleteLinkItem(link.id);
    if (error) {
      setLinksMessage({ type: "error", text: "Erro ao remover o link." });
    } else {
      await loadData();
      setLinksMessage({ type: "success", text: "Link removido com sucesso." });
    }
    setBusyId(null);
  };

  const moveLink = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= links.length) return;

    const reordered = [...links];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setLinks(reordered);
    setBusyId(moved.id);
    const { error } = await linksService.reorderLinkItems(reordered.map((item) => item.id));
    if (error) {
      setLinksMessage({ type: "error", text: "Erro ao reordenar os links." });
      await loadData();
    }
    setBusyId(null);
  };

  if (loading) {
    return <LoadingState label="Carregando página de links..." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Página pública"
        title="Página de Links"
        description="Configure a página estilo linktree em /links: perfil, redes sociais, WhatsApp e qualquer outro link que quiser divulgar."
      />

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="kds-card-title">Perfil da página</h3>
            <p className="kds-card-subtitle">Título, biografia e foto exibidos no topo de {PUBLIC_LINKS_PATH}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void handleCopyPublicUrl()}>
              <Copy className="h-4 w-4" />
              <span>{copyLabel}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" />
              <span>Abrir página</span>
            </Button>
          </div>
        </div>

        {profileMessage && (
          <Alert tone={profileMessage.type === "success" ? "success" : "danger"} className="mb-4">
            {profileMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{profileMessage.text}</span>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Título da página">
            <Input
              value={profileForm.title}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Ex: Kifer Saúde"
            />
          </Field>

          <Field label="Foto (URL da imagem)">
            <Input
              value={profileForm.avatar_url}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, avatar_url: event.target.value }))}
              placeholder="https://..."
            />
          </Field>

          <Field label="Biografia" className="md:col-span-2">
            <Textarea
              rows={3}
              value={profileForm.bio}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, bio: event.target.value }))}
              placeholder="Um resumo curto sobre você ou a Kifer Saúde."
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
          <Switch
            checked={profileForm.is_published}
            onChange={(event) => setProfileForm((prev) => ({ ...prev, is_published: event.target.checked }))}
            label={profileForm.is_published ? "Página publicada" : "Página despublicada"}
          />
          <Button onClick={() => void handleSaveProfile()} loading={savingProfile}>
            {!savingProfile && <Save className="h-4 w-4" />}
            <span>{savingProfile ? "Salvando..." : "Salvar perfil"}</span>
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="kds-card-title">Links</h3>
            <p className="kds-card-subtitle">
              Adicione WhatsApp, redes sociais ou qualquer outra URL. Use as setas para reordenar.
            </p>
          </div>
          <Button
            onClick={() => {
              setCreateForm(EMPTY_LINK_FORM);
              setIsCreateModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Novo link</span>
          </Button>
        </div>

        {linksMessage && (
          <Alert tone={linksMessage.type === "success" ? "success" : "danger"} className="mb-4">
            {linksMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{linksMessage.text}</span>
          </Alert>
        )}

        {links.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum link cadastrado ainda. Clique em "Novo link" para começar.
          </p>
        ) : (
          <div className="space-y-3">
            {links.map((link, index) => {
              const isBusy = busyId === link.id;
              const isEditing = editingId === link.id;
              const Icon = getLinkIcon(link.icon);

              return (
                <Card
                  key={link.id}
                  variant="muted"
                  padding="sm"
                  className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex flex-1 items-start gap-3">
                    <div className="flex flex-col items-center gap-0.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => void moveLink(index, -1)}
                        disabled={index === 0 || isBusy}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                        aria-label="Mover para cima"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void moveLink(index, 1)}
                        disabled={index === links.length - 1 || isBusy}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                        aria-label="Mover para baixo"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--kds-radius-sm)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <Input
                            value={editingForm.title}
                            onChange={(event) =>
                              setEditingForm((prev) => ({ ...prev, title: event.target.value }))
                            }
                            placeholder="Título"
                            disabled={isBusy}
                          />
                          <Input
                            value={editingForm.url}
                            onChange={(event) => setEditingForm((prev) => ({ ...prev, url: event.target.value }))}
                            placeholder="https://..."
                            disabled={isBusy}
                          />
                          <Select
                            value={editingForm.icon}
                            onChange={(event) =>
                              setEditingForm((prev) => ({ ...prev, icon: event.target.value }))
                            }
                            options={LINK_ICON_OPTIONS.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                            disabled={isBusy}
                          />
                        </div>
                      ) : (
                        <>
                          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{link.title}</p>
                          <p className="truncate text-xs text-[var(--text-secondary)]">{link.url}</p>
                          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            {link.is_active ? "Ativo" : "Inativo"} · {link.click_count} clique
                            {link.click_count === 1 ? "" : "s"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isEditing && (
                      <Switch
                        checked={link.is_active}
                        onChange={() => void handleToggleActive(link)}
                        disabled={isBusy}
                        label="Ativo"
                      />
                    )}

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => void confirmEditing()}
                          variant="success"
                          size="icon"
                          className="h-9 w-9"
                          disabled={isBusy}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={cancelEditing}
                          variant="secondary"
                          size="icon"
                          className="h-9 w-9"
                          disabled={isBusy}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button onClick={() => startEditing(link)} variant="secondary" size="sm" disabled={isBusy}>
                          Editar
                        </Button>
                        <Button
                          onClick={() => void handleDelete(link)}
                          variant="danger"
                          size="icon"
                          className="h-9 w-9"
                          disabled={isBusy}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog
        open={isCreateModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateModalOpen(false);
            setCreateForm(EMPTY_LINK_FORM);
          }
        }}
        size="sm"
      >
        <DialogHeader
          onClose={() => {
            setIsCreateModalOpen(false);
            setCreateForm(EMPTY_LINK_FORM);
          }}
        >
          <DialogTitle>Novo link</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form
            id="link-create-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateLink();
            }}
          >
            <Field label="Título">
              <Input
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Ex: WhatsApp, Instagram, Site..."
              />
            </Field>
            <Field label="URL">
              <Input
                value={createForm.url}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://wa.me/55..."
              />
            </Field>
            <Field label="Ícone">
              <Select
                value={createForm.icon}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, icon: event.target.value }))}
                options={LINK_ICON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setIsCreateModalOpen(false);
              setCreateForm(EMPTY_LINK_FORM);
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" form="link-create-form" disabled={creating}>
            <Plus className="h-4 w-4" />
            <span>{creating ? "Salvando" : "Adicionar"}</span>
          </Button>
        </DialogFooter>
      </Dialog>
      {ConfirmationDialog}
    </div>
  );
}
