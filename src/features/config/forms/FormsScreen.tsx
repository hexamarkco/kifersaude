import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, FileText, Plus, Trash2 } from "lucide-react";

import { useConfirmationModal } from "../../../hooks/useConfirmationModal";
import { formsService } from "../../../lib/formsService";
import type { PublicForm } from "../../../lib/supabase";
import { toast } from "../../../lib/toast";
import {
  Badge,
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
  Switch,
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
  const [forms, setForms] = useState<PublicForm[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const loadForms = useCallback(async () => {
    setLoading(true);
    const data = await formsService.getForms();
    setForms(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadForms();
  }, [loadForms]);

  const handleCreate = async () => {
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
    const { data: form, error } = await formsService.createForm({ slug, title, is_published: false });

    if (error || !form) {
      toast.error(
        error?.code === "23505" ? "Já existe um formulário com esse endereço." : "Erro ao criar o formulário.",
      );
      setCreating(false);
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
      toast.error("Formulário criado, mas houve um erro ao preparar a etapa de contato.");
    }

    setCreating(false);
    setIsCreateModalOpen(false);
    setCreateTitle("");
    setCreateSlug("");
    setSlugTouched(false);
    await loadForms();
    setSelectedFormId(form.id);
    toast.success("Formulário criado. Agora monte as perguntas.");
  };

  const handleTogglePublish = async (form: PublicForm) => {
    setBusyId(form.id);
    const { error } = await formsService.updateForm(form.id, { is_published: !form.is_published });
    if (error) {
      toast.error("Erro ao atualizar o formulário.");
    } else {
      await loadForms();
    }
    setBusyId(null);
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

    setBusyId(form.id);
    const { error } = await formsService.deleteForm(form.id);
    if (error) {
      toast.error("Erro ao excluir o formulário.");
    } else {
      await loadForms();
      toast.success("Formulário excluído.");
    }
    setBusyId(null);
  };

  if (loading) {
    return <LoadingState label="Carregando formulários..." />;
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

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Página pública"
        title="Formulários de captação"
        description="Crie formulários multi-etapas em /forms/xyz para captar leads com perguntas de múltipla escolha, texto e geolocalização opcional."
      />

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="kds-card-title">Seus formulários</h3>
            <p className="kds-card-subtitle">Cada formulário publicado cria um lead automaticamente ao ser enviado.</p>
          </div>
          <Button
            onClick={() => {
              setCreateTitle("");
              setCreateSlug("");
              setSlugTouched(false);
              setIsCreateModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            <span>Novo formulário</span>
          </Button>
        </div>

        {forms.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Nenhum formulário cadastrado ainda. Clique em "Novo formulário" para começar.
          </p>
        ) : (
          <div className="space-y-3">
            {forms.map((form) => {
              const isBusy = busyId === form.id;
              const publicUrl = `${window.location.origin}/forms/${form.slug}`;

              return (
                <Card
                  key={form.id}
                  variant="muted"
                  padding="sm"
                  className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--kds-radius-sm)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{form.title}</p>
                        <Badge tone={form.is_published ? "success" : "neutral"} size="sm">
                          {form.is_published ? "Publicado" : "Rascunho"}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-[var(--text-secondary)]" title={publicUrl}>
                        /forms/{form.slug}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        {form.submission_count} envio{form.submission_count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Switch
                      checked={form.is_published}
                      onChange={() => void handleTogglePublish(form)}
                      disabled={isBusy}
                      label={form.is_published ? "Publicado" : "Rascunho"}
                    />
                    <Button variant="secondary" size="icon" className="h-9 w-9" onClick={() => void handleCopyLink(form)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setSelectedFormId(form.id)}>
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="icon"
                      className="h-9 w-9"
                      disabled={isBusy}
                      onClick={() => void handleDelete(form)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
          if (!open) setIsCreateModalOpen(false);
        }}
        size="sm"
      >
        <DialogHeader onClose={() => setIsCreateModalOpen(false)}>
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
          <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="form-create-form" disabled={creating}>
            <Plus className="h-4 w-4" />
            <span>{creating ? "Criando" : "Criar"}</span>
          </Button>
        </DialogFooter>
      </Dialog>
      {ConfirmationDialog}
    </div>
  );
}
