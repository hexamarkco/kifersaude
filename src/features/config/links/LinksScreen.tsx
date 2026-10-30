import {
  ButtonGroup,
  Card,
  Field,
  FieldLabel,
  FileInput,
  Heading,
  IconButton,
  Image,
  InfoTooltip,
  Input,
  LoadingState,
  PageActions,
  PageHeader,
  RecordActions,
  ResponsiveCollection,
  SearchInput,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  Textarea,
  Toolbar,
  ToolbarSearch,
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DisclosureTrigger,
} from '../../../design-system';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  ImageIcon,
  Loader,
  Plus,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { useConfirmationModal } from "../../../hooks/useConfirmationModal";
import { uploadLinkPageImage } from "../../../lib/imageUploadService";
import { getLinkIcon, LINK_ICON_OPTIONS } from "../../../lib/linkIcons";
import { linksService } from "../../../lib/linksService";
import type { PublicLinkItem, PublicLinkPageSettings } from "../../public-content";
import { toast } from "../../../lib/toast";
type LinkFormState = {
  title: string;
  url: string;
  icon: string;
};

const EMPTY_LINK_FORM: LinkFormState = { title: "", url: "", icon: "link" };

const PUBLIC_LINKS_PATH = "/links";

export default function LinksScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [pageSettings, setPageSettings] = useState<PublicLinkPageSettings | null>(null);
  const [links, setLinks] = useState<PublicLinkItem[]>([]);

  const [profileForm, setProfileForm] = useState({
    title: "",
    subtitle: "",
    bio: "",
    avatar_url: "",
    is_verified: false,
    is_published: true,
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copiar link");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<LinkFormState>(EMPTY_LINK_FORM);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<LinkFormState>(EMPTY_LINK_FORM);
  const [creating, setCreating] = useState(false);
  const loadRequestIdRef = useRef(0);
  const busyIdRef = useRef<string | null>(null);

  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const publicUrl = `${window.location.origin}${PUBLIC_LINKS_PATH}`;

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const [settings, items] = await Promise.all([
        linksService.getLinkPageSettings(),
        linksService.getLinkItems(),
      ]);

      if (requestId !== loadRequestIdRef.current) return;

      setPageSettings(settings);
      setProfileForm({
        title: settings?.title ?? "Kifer Saúde",
        subtitle: settings?.subtitle ?? "",
        bio: settings?.bio ?? "",
        avatar_url: settings?.avatar_url ?? "",
        is_verified: settings?.is_verified ?? false,
        is_published: settings?.is_published ?? true,
      });
      setLinks(items);
    } catch (loadDataError) {
      if (requestId !== loadRequestIdRef.current) return;
      console.error("Erro ao carregar a página de links:", loadDataError);
      setLoadError(true);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData();
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [loadData]);

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

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const result = await uploadLinkPageImage(file);

      if (!result.success || !result.url) {
        toast.error(result.error ?? "Não foi possível fazer upload da imagem.");
      } else {
        setProfileForm((prev) => ({ ...prev, avatar_url: result.url! }));
      }
    } catch (error) {
      console.error("Erro ao enviar a imagem da página de links:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível fazer upload da imagem.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profileForm.title.trim()) {
      toast.error("Informe um título para a página.");
      return;
    }

    setSavingProfile(true);
    try {
      const { data, error } = await linksService.saveLinkPageSettings(
        {
          title: profileForm.title.trim(),
          subtitle: profileForm.subtitle.trim() || null,
          bio: profileForm.bio.trim() || null,
          avatar_url: profileForm.avatar_url.trim() || null,
          is_verified: profileForm.is_verified,
          is_published: profileForm.is_published,
        },
        pageSettings?.id,
      );

      if (error) {
        toast.error("Não foi possível salvar as configurações da página.");
      } else {
        setPageSettings(data ?? pageSettings);
        toast.success("Página de links atualizada com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao salvar a página de links:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as configurações da página.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCreateLink = async () => {
    if (!createForm.title.trim() || !createForm.url.trim()) {
      toast.error("Informe o título e a URL do link.");
      return;
    }

    setCreating(true);
    try {
      const { error } = await linksService.createLinkItem({
        title: createForm.title.trim(),
        url: createForm.url.trim(),
        icon: createForm.icon,
        is_active: true,
        position: links.length,
      });

      if (error) {
        toast.error("Não foi possível adicionar o link.");
      } else {
        setIsCreateModalOpen(false);
        setCreateForm(EMPTY_LINK_FORM);
        await loadData();
        toast.success("Link adicionado com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao adicionar link:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar o link.");
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (link: PublicLinkItem) => {
    setEditingId(link.id);
    setEditingForm({ title: link.title, url: link.url, icon: link.icon });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingForm(EMPTY_LINK_FORM);
  };

  const beginLinkMutation = (linkId: string) => {
    if (busyIdRef.current) {
      return false;
    }

    busyIdRef.current = linkId;
    setBusyId(linkId);
    return true;
  };

  const finishLinkMutation = () => {
    busyIdRef.current = null;
    setBusyId(null);
  };

  const openCreateModal = () => {
    setCreateForm(EMPTY_LINK_FORM);
    setIsCreateModalOpen(true);
  };

  const normalizedLinkSearch = linkSearch.trim().toLocaleLowerCase('pt-BR');
  const visibleLinks = normalizedLinkSearch
    ? links.filter((link) => `${link.title} ${link.url}`.toLocaleLowerCase('pt-BR').includes(normalizedLinkSearch))
    : links;

  const renderLinkReordering = (link: PublicLinkItem) => {
    const index = links.findIndex((item) => item.id === link.id);
    const hasBusyMutation = busyId !== null;
    return (
      <ButtonGroup size="sm" aria-label={`Ordenar ${link.title}`}>
        <IconButton
          type="button"
          size="sm"
          variant="tertiary"
          onClick={() => void moveLink(index, -1)}
          disabled={index <= 0 || hasBusyMutation}
          aria-label={`Mover ${link.title} para cima`}
          title="Mover para cima"
        >
          <ChevronUp aria-hidden="true" />
        </IconButton>
        <IconButton
          type="button"
          size="sm"
          variant="tertiary"
          onClick={() => void moveLink(index, 1)}
          disabled={index < 0 || index >= links.length - 1 || hasBusyMutation}
          aria-label={`Mover ${link.title} para baixo`}
          title="Mover para baixo"
        >
          <ChevronDown aria-hidden="true" />
        </IconButton>
      </ButtonGroup>
    );
  };

  const renderLinkActions = (link: PublicLinkItem) => {
    const isBusy = busyId === link.id;
    const hasBusyMutation = busyId !== null;
    const isEditing = editingId === link.id;

    if (isEditing) {
      return (
        <ButtonGroup size="sm" aria-label={`Ações da edição de ${link.title}`}>
          <IconButton
            type="button"
            onClick={() => void confirmEditing()}
            variant="primary"
            disabled={hasBusyMutation}
            loading={isBusy}
            size="sm"
            aria-label={`Salvar alterações em ${link.title}`}
            title="Salvar alterações"
          >
            <Check aria-hidden="true" />
          </IconButton>
          <IconButton
            type="button"
            onClick={cancelEditing}
            variant="secondary"
            disabled={isBusy}
            size="sm"
            aria-label={`Cancelar edição de ${link.title}`}
            title="Cancelar edição"
          >
            <X aria-hidden="true" />
          </IconButton>
        </ButtonGroup>
      );
    }

    return (
      <RecordActions
        label={`Ações de ${link.title}`}
        visibleCount={1}
        actions={[
          {
            label: `Editar ${link.title}`,
            icon: Pencil,
            onClick: () => startEditing(link),
            disabled: hasBusyMutation,
          },
          {
            label: `Excluir ${link.title}`,
            icon: Trash2,
            onClick: () => void handleDelete(link),
            destructive: true,
            disabled: hasBusyMutation,
            loading: isBusy,
          },
        ]}
      />
    );
  };

  const confirmEditing = async () => {
    const targetId = editingId;
    if (!targetId) return;

    if (!editingForm.title.trim() || !editingForm.url.trim()) {
      toast.error("Informe o título e a URL do link.");
      return;
    }

    if (!beginLinkMutation(targetId)) return;

    try {
      const { error } = await linksService.updateLinkItem(targetId, {
        title: editingForm.title.trim(),
        url: editingForm.url.trim(),
        icon: editingForm.icon,
      });

      if (error) {
        toast.error("Não foi possível atualizar o link.");
      } else {
        await loadData();
        if (editingId === targetId) {
          cancelEditing();
        }
        toast.success("Link atualizado com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao atualizar link:", error);
      toast.error("Não foi possível atualizar o link.");
    } finally {
      finishLinkMutation();
    }
  };

  const handleToggleActive = async (link: PublicLinkItem) => {
    if (!beginLinkMutation(link.id)) return;

    try {
      const { error } = await linksService.updateLinkItem(link.id, { is_active: !link.is_active });
      if (error) {
        toast.error("Não foi possível atualizar o link.");
      } else {
        await loadData();
      }
    } catch (error) {
      console.error("Erro ao atualizar status do link:", error);
      toast.error("Não foi possível atualizar o link.");
    } finally {
      finishLinkMutation();
    }
  };

  const handleDelete = async (link: PublicLinkItem) => {
    if (busyIdRef.current) return;

    const confirmed = await requestConfirmation({
      title: "Excluir link",
      description: `Deseja remover "${link.title}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    if (!beginLinkMutation(link.id)) return;

    try {
      const { error } = await linksService.deleteLinkItem(link.id);
      if (error) {
        toast.error("Não foi possível remover o link.");
      } else {
        await loadData();
        toast.success("Link removido com sucesso.");
      }
    } catch (error) {
      console.error("Erro ao remover link:", error);
      toast.error("Não foi possível remover o link.");
    } finally {
      finishLinkMutation();
    }
  };

  const moveLink = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= links.length) return;

    const reordered = [...links];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    if (!beginLinkMutation(moved.id)) return;

    setLinks(reordered);
    try {
      const { error } = await linksService.reorderLinkItems(reordered.map((item) => item.id));
      if (error) {
        toast.error("Não foi possível reordenar os links.");
        await loadData().catch((reloadError) => {
          console.error("Erro ao recarregar links após falha na reordenação:", reloadError);
        });
      }
    } catch (error) {
      console.error("Erro ao reordenar links:", error);
      toast.error("Não foi possível reordenar os links.");
      await loadData().catch((reloadError) => {
        console.error("Erro ao recarregar links após falha na reordenação:", reloadError);
      });
    } finally {
      finishLinkMutation();
    }
  };

  if (loading) {
    return <LoadingState label="Carregando página de links..." />;
  }

  const pageHeader = (
    <PageHeader
      eyebrow="Configurações"
      title="Links públicos"
      description="Gerencie o perfil público e os links exibidos em /links."
      descriptionPlacement="visible"
      actions={(
        <PageActions
          primary={{ label: 'Novo link', icon: Plus, onClick: openCreateModal }}
        />
      )}
    />
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <Card>
          <Alert
            tone="danger"
            title="Não foi possível carregar a página de links."
            action={
              <Button onClick={() => void loadData()}>
                <RefreshCw className="kds-control-icon" />
                <span>Tentar novamente</span>
              </Button>
            }
          >
            Verifique sua conexão ou sessão e tente novamente. Nenhuma configuração foi apagada.
          </Alert>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      <details className="min-w-0">
        <DisclosureTrigger icon={ImageIcon} size="sm">
          {profileForm.is_published ? 'Editar perfil público · Publicado' : 'Editar perfil público · Despublicado'}
        </DisclosureTrigger>
        <Card className="mt-3">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="kds-card-title-row">
                <Heading level={3} className="kds-card-title">Perfil público</Heading>
                <InfoTooltip content={`Título, biografia e foto exibidos no topo de ${PUBLIC_LINKS_PATH}.`} label="Informações sobre o perfil da página" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void handleCopyPublicUrl()}>
                <Copy className="kds-control-icon" />
                <span>{copyLabel}</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="kds-control-icon" />
                <span>Abrir página</span>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
          <Field label="Foto">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0">
                {profileForm.avatar_url ? (
                  <Image
                    src={profileForm.avatar_url}
                    alt="Preview da foto"
                    className="h-20 w-20 rounded-full border border-[var(--border-subtle)] object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[var(--border-subtle)] bg-[var(--bg-hover)] text-[var(--text-muted)]">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}

                <FieldLabel className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--brand-primary)] shadow-sm transition-colors hover:bg-[var(--bg-hover)]">
                  <FileInput

                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    onChange={(event) => void handleAvatarUpload(event)}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                  {uploadingAvatar ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </FieldLabel>
              </div>

              <div className="flex-1 space-y-1.5">
                <Input
                  value={profileForm.avatar_url}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, avatar_url: event.target.value }))}
                  placeholder="Cole a URL de uma imagem ou envie um arquivo"
                  size="md"
                />
                <Text className="text-xs text-[var(--text-muted)]">JPG, PNG, WEBP ou GIF — máx 5MB.</Text>
              </div>
            </div>
          </Field>

          <Field label="Título da página">
            <Input
              value={profileForm.title}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Ex: Kifer Saúde"
            />
          </Field>

          <Field label="Subtítulo">
            <Input
              value={profileForm.subtitle}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, subtitle: event.target.value }))}
              placeholder="Ex: Planos de saúde no RJ"
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

          <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
            <Switch
              checked={profileForm.is_published}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, is_published: event.target.checked }))}
              label={profileForm.is_published ? "Página publicada" : "Página despublicada"}
            />
            <Switch
              checked={profileForm.is_verified}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, is_verified: event.target.checked }))}
              label="Selo de verificado na foto"
            />
            </div>
            <PageActions
            placement="header"
            busy={savingProfile}
            primary={{
              label: savingProfile ? 'Salvando perfil…' : 'Salvar perfil',
              icon: Save,
              loading: savingProfile,
              onClick: () => void handleSaveProfile(),
            }}
            />
          </div>
        </Card>
      </details>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="kds-card-title-row">
              <Heading level={3} className="kds-card-title">Links cadastrados</Heading>
              <InfoTooltip content="Adicione WhatsApp, redes sociais ou qualquer outra URL. Use as setas para reordenar." label="Informações sobre a lista de links" />
            </div>
            <Text className="mt-1 text-sm text-[var(--text-secondary)]">
              A ordem define como os links aparecem na página pública.
            </Text>
          </div>
        </div>

        {links.length === 0 ? (
          <Text className="text-sm text-[var(--text-muted)]">
            Nenhum link cadastrado ainda. Use “Novo link” para adicionar o primeiro.
          </Text>
        ) : (
          <>
            <Toolbar>
              <ToolbarSearch>
                <SearchInput
                  value={linkSearch}
                  onChange={(event) => setLinkSearch(event.target.value)}
                  placeholder="Buscar por nome ou endereço"
                  aria-label="Buscar links públicos por nome ou endereço"
                />
              </ToolbarSearch>
            </Toolbar>

            {visibleLinks.length === 0 ? (
              <Text role="status" className="py-4 text-sm text-[var(--text-muted)]">
                Nenhum link corresponde a “{linkSearch.trim()}”. Revise a busca.
              </Text>
            ) : (
              <ResponsiveCollection
                table={(
                  <Table aria-label="Links públicos" size="md" columnWidths={['42%', '18%', '16%', '14%', '10%']}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Ordem</TableHead>
                        <TableHead>Atualização</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead align="right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleLinks.map((link) => {
                        const index = links.findIndex((item) => item.id === link.id);
                        const Icon = getLinkIcon(link.icon);
                        const isEditing = editingId === link.id;
                        const isBusy = busyId === link.id;
                        const hasBusyMutation = busyId !== null;

                        return isEditing ? (
                          <TableRow key={link.id}>
                            <TableCell colSpan={5}>
                              <div className="grid min-w-0 gap-3 lg:grid-cols-[1fr_1fr_14rem_auto] lg:items-end">
                                <Field label="Nome do link">
                                  <Input
                                    value={editingForm.title}
                                    onChange={(event) => setEditingForm((prev) => ({ ...prev, title: event.target.value }))}
                                    placeholder="Título"
                                    disabled={hasBusyMutation}
                                  />
                                </Field>
                                <Field label="Endereço">
                                  <Input
                                    value={editingForm.url}
                                    onChange={(event) => setEditingForm((prev) => ({ ...prev, url: event.target.value }))}
                                    placeholder="https://..."
                                    disabled={isBusy}
                                  />
                                </Field>
                                <Field label="Ícone">
                                  <Select
                                    value={editingForm.icon}
                                    onChange={(event) => setEditingForm((prev) => ({ ...prev, icon: event.target.value }))}
                                    options={LINK_ICON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                                    disabled={isBusy}
                                  />
                                </Field>
                                {renderLinkActions(link)}
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <TableRow key={link.id}>
                            <TableCell>
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--kds-radius-sm)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                                  <Icon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                  <Text className="truncate text-sm font-medium text-[var(--text-primary)]">{link.title}</Text>
                                  <Text className="truncate text-xs text-[var(--text-secondary)]" title={link.url}>{link.url}</Text>
                                  <Text className="mt-1 text-[11px] text-[var(--text-muted)]">
                                    {link.click_count} clique{link.click_count === 1 ? '' : 's'}
                                  </Text>
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Text className="min-w-5 text-sm tabular-nums">{index + 1}</Text>
                                {renderLinkReordering(link)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Text className="text-sm">{new Date(link.updated_at).toLocaleDateString('pt-BR')}</Text>
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={link.is_active}
                                onChange={() => void handleToggleActive(link)}
                                disabled={hasBusyMutation}
                                label={link.is_active ? 'Ativo' : 'Inativo'}
                              />
                            </TableCell>
                            <TableCell align="right">{renderLinkActions(link)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
                cards={(
                  <div className="space-y-3">
                    {visibleLinks.map((link) => {
                      const index = links.findIndex((item) => item.id === link.id);
                      const isBusy = busyId === link.id;
                      const hasBusyMutation = busyId !== null;
                      const isEditing = editingId === link.id;
                      const Icon = getLinkIcon(link.icon);

                      return (
                        <Card
                          key={link.id}
                          variant="muted"
                          padding="sm"
                          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <ButtonGroup size="sm" aria-label={`Ordenar ${link.title}`} orientation="vertical">
                              <IconButton
                                type="button"
                                size="sm"
                                variant="tertiary"
                                onClick={() => void moveLink(index, -1)}
                                disabled={index === 0 || hasBusyMutation}
                                aria-label={`Mover ${link.title} para cima`}
                              >
                                <ChevronUp aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                type="button"
                                size="sm"
                                variant="tertiary"
                                onClick={() => void moveLink(index, 1)}
                                disabled={index === links.length - 1 || hasBusyMutation}
                                aria-label={`Mover ${link.title} para baixo`}
                              >
                                <ChevronDown aria-hidden="true" />
                              </IconButton>
                            </ButtonGroup>

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--kds-radius-sm)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            </div>

                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="grid gap-3">
                                  <Field label="Nome do link">
                                    <Input
                                      value={editingForm.title}
                                      onChange={(event) => setEditingForm((prev) => ({ ...prev, title: event.target.value }))}
                                      placeholder="Título"
                                      disabled={hasBusyMutation}
                                    />
                                  </Field>
                                  <Field label="Endereço">
                                    <Input
                                      value={editingForm.url}
                                      onChange={(event) => setEditingForm((prev) => ({ ...prev, url: event.target.value }))}
                                      placeholder="https://..."
                                      disabled={isBusy}
                                    />
                                  </Field>
                                  <Field label="Ícone">
                                    <Select
                                      value={editingForm.icon}
                                      onChange={(event) => setEditingForm((prev) => ({ ...prev, icon: event.target.value }))}
                                      options={LINK_ICON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                                      disabled={isBusy}
                                    />
                                  </Field>
                                </div>
                              ) : (
                                <>
                                  <Text className="truncate text-sm font-medium text-[var(--text-primary)]">{link.title}</Text>
                                  <Text className="truncate text-xs text-[var(--text-secondary)]" title={link.url}>{link.url}</Text>
                                  <Text className="mt-1 text-[11px] text-[var(--text-muted)]">
                                    {link.is_active ? 'Ativo' : 'Inativo'} · {link.click_count} clique{link.click_count === 1 ? '' : 's'}
                                  </Text>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {!isEditing && (
                              <Switch
                                checked={link.is_active}
                                onChange={() => void handleToggleActive(link)}
                                disabled={hasBusyMutation}
                                label={link.is_active ? 'Ativo' : 'Inativo'}
                              />
                            )}
                            {renderLinkActions(link)}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              />
            )}
          </>
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
            <Plus className="kds-control-icon" />
            <span>{creating ? "Salvando" : "Adicionar"}</span>
          </Button>
        </DialogFooter>
      </Dialog>
      {ConfirmationDialog}
    </div>
  );
}
