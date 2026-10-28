import { Heading, Text } from '../../../design-system';
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Edit2, ExternalLink, FileText, Filter, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

import { useConfirmationModal } from "../../../hooks/useConfirmationModal";
import { formsService } from "../../../lib/formsService";
import type { PublicForm } from "../../public-content";
import { toast } from "../../../lib/toast";
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
  FilterSelect,
  Input,
  LoadingState,
  Pagination,
  SectionHeader,
  Switch,
  RecordActions, ResponsiveCollection, Surface, EmptyState,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../../design-system";
import FormEditorScreen from "./FormEditorScreen";

const slugify = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

export default function FormsScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [forms, setForms] = useState<PublicForm[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const formsLoadRequestIdRef = useRef(0);

  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const loadForms = useCallback(async () => {
    const requestId = ++formsLoadRequestIdRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await formsService.getForms();
      if (requestId !== formsLoadRequestIdRef.current) return;
      setForms(data);
    } catch (loadFormsError) {
      if (requestId !== formsLoadRequestIdRef.current) return;
      console.error("Erro ao carregar formulários:", loadFormsError);
      setLoadError(true);
    } finally {
      if (requestId === formsLoadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadForms();
    return () => {
      formsLoadRequestIdRef.current += 1;
    };
  }, [loadForms]);

  const setFormBusy = (formId: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) {
        next.add(formId);
      } else {
        next.delete(formId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (creating) {
      return;
    }

    const title = createTitle.trim();
    const slug = slugify(createSlug || createTitle);

    if (!title) {
      toast.error("Informe um título para o formulário.");
      return;
    }
    if (slug.length < 2) {
      toast.error("Informe um endereço (slug) válido, com pelo menos 2 caracteres.");
      return;
    }

    setCreating(true);
    try {
      const { data: form, error } = await formsService.createForm({ slug, title, is_published: false });

      if (error || !form) {
        toast.error(
          error?.code === "23505" ? "Já existe um formulário com esse endereço." : "Não foi possível criar o formulário.",
        );
        return;
      }

      const { error: stepError } = await formsService.createStep({
        form_id: form.id,
        step_type: "contact",
        title: "Quase lá! Como podemos te chamar?",
        is_required: true,
        position: 0,
        options: [],
      });
      if (stepError) {
        toast.error("Formulário criado, mas não foi possível preparar a etapa de contato.");
      }

      setIsCreateModalOpen(false);
      setCreateTitle("");
      setCreateSlug("");
      setSlugTouched(false);
      await loadForms();
      setSelectedFormId(form.id);
      toast.success("Formulário criado. Agora monte as perguntas.");
    } catch (createError) {
      console.error("Erro ao criar formulário:", createError);
      toast.error("Não foi possível criar o formulário.");
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePublish = async (form: PublicForm) => {
    if (busyIds.has(form.id)) {
      return;
    }

    setFormBusy(form.id, true);
    try {
      const { error } = await formsService.updateForm(form.id, { is_published: !form.is_published });
      if (error) {
        toast.error("Não foi possível atualizar o formulário.");
      } else {
        await loadForms();
      }
    } catch (updateError) {
      console.error("Erro ao atualizar publicação do formulário:", updateError);
      toast.error("Não foi possível atualizar o formulário.");
    } finally {
      setFormBusy(form.id, false);
    }
  };

  const handleCopyLink = async (form: PublicForm) => {
    const url = `${window.location.origin}/forms/${form.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const handleDelete = async (form: PublicForm) => {
    const confirmed = await requestConfirmation({
      title: "Excluir formulário",
      description: `Deseja remover "${form.title}"? As respostas já recebidas continuam salvas nos leads, mas o formulário deixa de existir. Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    if (busyIds.has(form.id)) {
      return;
    }

    setFormBusy(form.id, true);
    try {
      const { error } = await formsService.deleteForm(form.id);
      if (error) {
        toast.error("Não foi possível excluir o formulário.");
      } else {
        await loadForms();
        toast.success("Formulário excluído.");
      }
    } catch (deleteError) {
      console.error("Erro ao excluir formulário:", deleteError);
      toast.error("Não foi possível excluir o formulário.");
    } finally {
      setFormBusy(form.id, false);
    }
  };

  if (loading) {
    return <LoadingState label="Carregando formulários..." />;
  }

  const pageHeader = (
    <SectionHeader
      eyebrow="Página pública"
      title="Formulários de captação"
      description="Crie e organize formulários para captar leads no site."
      action={!loadError ? <Button onClick={() => { setCreateTitle(""); setCreateSlug(""); setSlugTouched(false); setIsCreateModalOpen(true); }}><Plus className="kds-control-icon" aria-hidden="true" />Novo formulário</Button> : undefined}
    />
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <Card>
          <Alert
            tone="danger"
            title="Não foi possível carregar os formulários."
            action={
              <Button onClick={() => void loadForms()}>
                <RefreshCw className="kds-control-icon" />
                <span>Tentar novamente</span>
              </Button>
            }
          >
            Verifique sua conexão ou sessão e tente novamente. Seus formulários não foram apagados.
          </Alert>
        </Card>
      </div>
    );
  }

  const selectedForm = forms.find((form) => form.id === selectedFormId) ?? null;

  if (selectedForm) {
    return (
      <FormEditorScreen
        form={selectedForm}
        onBack={() => setSelectedFormId(null)}
        onFormUpdated={(updated) => setForms((prev) => prev.map((form) => (form.id === updated.id ? updated : form)))}
      />
    );
  }

  const filteredForms = forms.filter(form =>
    `${form.title} ${form.slug}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) &&
    (statusFilter === "" || form.is_published === (statusFilter === "published")),
  );
  const totalPages = Math.max(1, Math.ceil(filteredForms.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleForms = filteredForms.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasFilters = Boolean(search.trim() || statusFilter);

  return (
    <div className="space-y-6">
      {pageHeader}

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1"><Input aria-label="Buscar formulários" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por nome ou endereço..." leftIcon={Search} /></div>
          <FilterSelect icon={Filter} placeholder="Todos os status" value={statusFilter} onChange={value => { setStatusFilter(value); setPage(1); }} options={[{ value: "published", label: "Publicado" }, { value: "draft", label: "Rascunho" }]} />
        </div>
      </Card>
      <Card className="space-y-4">
        <div>
          <Heading level={3} className="kds-card-title">Seus formulários</Heading>
          <Text className="kds-card-subtitle">Cada formulário publicado cria um lead automaticamente ao ser enviado.</Text>
        </div>
        {visibleForms.length === 0 ? (
          <EmptyState icon={<FileText aria-hidden="true" />} title={hasFilters ? "Nenhum formulário encontrado" : "Nenhum formulário cadastrado"}
            description={hasFilters ? "Ajuste a busca ou o status para encontrar um formulário." : "Crie um formulário para começar a captar leads."}
            action={hasFilters ? <Button variant="secondary" onClick={() => { setSearch(""); setStatusFilter(""); setPage(1); }}>Limpar filtros</Button> : undefined} />
        ) : (() => {
          const actions = (form: PublicForm) => [
            { label: "Editar", icon: Edit2, onClick: () => setSelectedFormId(form.id) },
            { label: "Copiar link", icon: Copy, onClick: () => void handleCopyLink(form) },
            { label: "Abrir formulário", icon: ExternalLink, onClick: () => window.open(`${window.location.origin}/forms/${form.slug}`, "_blank", "noopener,noreferrer") },
            { label: "Excluir", icon: Trash2, destructive: true, disabled: busyIds.has(form.id), onClick: () => void handleDelete(form) },
          ];
          return <ResponsiveCollection table={<Table aria-label="Formulários de captação" className="min-w-[700px]" columnWidths={['42%', '18%', '25%', '15%']}>
            <TableHeader><TableRow><TableHead>Formulário</TableHead><TableHead>Envios</TableHead><TableHead>Publicação</TableHead><TableHead align="right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>{visibleForms.map(form => <TableRow key={form.id}>
              <TableCell><Text className="font-semibold">{form.title}</Text><Text size="sm" tone="muted">/forms/{form.slug}</Text></TableCell>
              <TableCell>{form.submission_count}</TableCell>
              <TableCell><Switch checked={form.is_published} onChange={() => void handleTogglePublish(form)} disabled={busyIds.has(form.id)} label={form.is_published ? "Publicado" : "Rascunho"} /></TableCell>
              <TableCell align="right"><RecordActions label={`Ações de ${form.title}`} actions={actions(form)} /></TableCell>
            </TableRow>)}</TableBody>
          </Table>} cards={<div className="grid gap-3">{visibleForms.map(form => <Surface key={form.id} padding="sm" className="space-y-3">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Text className="break-words font-semibold">{form.title}</Text><Text size="sm" tone="muted" className="break-all">/forms/{form.slug}</Text></div><RecordActions label={`Ações de ${form.title}`} visibleCount={0} actions={actions(form)} /></div>
            <div className="flex flex-wrap items-center justify-between gap-3"><Text size="sm" tone="muted">{form.submission_count} envio{form.submission_count === 1 ? "" : "s"}</Text><Switch checked={form.is_published} onChange={() => void handleTogglePublish(form)} disabled={busyIds.has(form.id)} label={form.is_published ? "Publicado" : "Rascunho"} /></div>
          </Surface>)}</div>} />;
        })()}
        {filteredForms.length > 0 && <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredForms.length} itemsPerPage={pageSize} onPageChange={setPage} onItemsPerPageChange={value => { setPageSize(value); setPage(1); }} />}
      </Card>

      <Dialog
        open={isCreateModalOpen}
        closeOnOverlay={!creating}
        closeOnEscape={!creating}
        onOpenChange={(open) => {
          if (!open && !creating) setIsCreateModalOpen(false);
        }}
        size="sm"
      >
        <DialogHeader onClose={() => { if (!creating) setIsCreateModalOpen(false); }} showCloseButton={!creating}>
          <DialogTitle>Novo formulário</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form
            id="form-create-form"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreate();
            }}
          >
            <Field label="Título">
              <Input
                value={createTitle}
                disabled={creating}
                onChange={(event) => {
                  const value = event.target.value;
                  setCreateTitle(value);
                  if (!slugTouched) setCreateSlug(slugify(value));
                }}
                placeholder="Ex: Cotação de plano de saúde"
              />
            </Field>
            <Field label="Endereço público" description={`kifersaude.com.br/forms/${createSlug || "seu-formulario"}`}>
              <Input
                value={createSlug}
                disabled={creating}
                onChange={(event) => {
                  setSlugTouched(true);
                  setCreateSlug(slugify(event.target.value));
                }}
                placeholder="seu-formulario"
              />
            </Field>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)} disabled={creating}>
            Cancelar
          </Button>
          <Button type="submit" form="form-create-form" disabled={creating}>
            <Plus className="kds-control-icon" />
            <span>{creating ? "Criando" : "Criar"}</span>
          </Button>
        </DialogFooter>
      </Dialog>
      {ConfirmationDialog}
    </div>
  );
}
