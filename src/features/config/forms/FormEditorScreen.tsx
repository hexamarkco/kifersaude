import { ButtonGroup, Heading, Text, TextLink } from '../../../design-system';
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  ListChecks,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
} from "lucide-react";

import { useConfirmationModal } from "../../../hooks/useConfirmationModal";
import { formsService } from "../../../lib/formsService";
import type { PublicForm, PublicFormStep, PublicFormSubmission } from "../../public-content";
import { toast } from "../../../lib/toast";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  LoadingState,
  PageActions,
  SectionHeader,
  Switch,
  Textarea,
  IconButton,
} from "../../../design-system";
import StepEditorDialog, { type StepEditorPayload } from "./StepEditorDialog";

const STEP_TYPE_LABELS: Record<PublicFormStep["step_type"], string> = {
  single_choice: "Escolha única",
  multi_choice: "Múltipla escolha",
  short_text: "Texto curto",
  contact: "Contato",
};

const FIELD_KEY_LABELS: Record<string, string> = {
  cidade: "→ Cidade",
  tipo_contratacao: "→ Tipo de contratação",
};

type FormEditorScreenProps = {
  form: PublicForm;
  onBack: () => void;
  onFormUpdated: (form: PublicForm) => void;
};

export default function FormEditorScreen({ form, onBack, onFormUpdated }: FormEditorScreenProps) {
  const [settings, setSettings] = useState({
    title: form.title,
    slug: form.slug,
    description: form.description ?? "",
    success_headline: form.success_headline,
    success_message: form.success_message,
    request_geolocation: form.request_geolocation,
    whatsapp_redirect: form.whatsapp_redirect,
    whatsapp_message_template: form.whatsapp_message_template ?? "",
    is_published: form.is_published,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsErrors, setSettingsErrors] = useState<{ title?: string; slug?: string }>({});
  const [settingsSaveError, setSettingsSaveError] = useState("");
  const settingsSaveInFlightRef = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  const [steps, setSteps] = useState<PublicFormStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(true);
  const [stepsLoadError, setStepsLoadError] = useState(false);
  const [stepMutationInFlight, setStepMutationInFlight] = useState(false);
  const [stepDialog, setStepDialog] = useState<{ step: PublicFormStep | null } | null>(null);
  const [savingStep, setSavingStep] = useState(false);

  const [submissions, setSubmissions] = useState<PublicFormSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [submissionsLoadError, setSubmissionsLoadError] = useState(false);
  const stepsLoadRequestIdRef = useRef(0);
  const submissionsLoadRequestIdRef = useRef(0);
  const stepMutationInFlightRef = useRef(false);

  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();

  const publicUrl = `${window.location.origin}/forms/${form.slug}`;

  const loadSteps = useCallback(async () => {
    const requestId = ++stepsLoadRequestIdRef.current;
    setLoadingSteps(true);
    setStepsLoadError(false);
    try {
      const data = await formsService.getFormSteps(form.id);
      if (requestId !== stepsLoadRequestIdRef.current) return;
      setSteps(data);
    } catch (loadStepsError) {
      if (requestId !== stepsLoadRequestIdRef.current) return;
      console.error("Erro ao carregar etapas do formulário:", loadStepsError);
      setStepsLoadError(true);
    } finally {
      if (requestId === stepsLoadRequestIdRef.current) {
        setLoadingSteps(false);
      }
    }
  }, [form.id]);

  const loadSubmissions = useCallback(async () => {
    const requestId = ++submissionsLoadRequestIdRef.current;
    setLoadingSubmissions(true);
    setSubmissionsLoadError(false);
    try {
      const data = await formsService.getFormSubmissions(form.id);
      if (requestId !== submissionsLoadRequestIdRef.current) return;
      setSubmissions(data);
    } catch (loadSubmissionsError) {
      if (requestId !== submissionsLoadRequestIdRef.current) return;
      console.error("Erro ao carregar respostas do formulário:", loadSubmissionsError);
      setSubmissionsLoadError(true);
    } finally {
      if (requestId === submissionsLoadRequestIdRef.current) {
        setLoadingSubmissions(false);
      }
    }
  }, [form.id]);

  useEffect(() => {
    setSettings({
      title: form.title,
      slug: form.slug,
      description: form.description ?? "",
      success_headline: form.success_headline,
      success_message: form.success_message,
      request_geolocation: form.request_geolocation,
      whatsapp_redirect: form.whatsapp_redirect,
      whatsapp_message_template: form.whatsapp_message_template ?? "",
      is_published: form.is_published,
    });
  }, [form]);

  useEffect(() => {
    setSteps([]);
    setSubmissions([]);
    void loadSteps();
    void loadSubmissions();
    return () => {
      stepsLoadRequestIdRef.current += 1;
      submissionsLoadRequestIdRef.current += 1;
    };
  }, [loadSteps, loadSubmissions]);

  const questionSteps = steps.filter((step) => step.step_type !== "contact");
  const contactStep = steps.find((step) => step.step_type === "contact") ?? null;

  const handleSaveSettings = async () => {
    if (settingsSaveInFlightRef.current) return;
    const title = settings.title.trim();
    const slug = settings.slug.trim();

    const errors = {
      title: !title ? "Informe um título para o formulário." : undefined,
      slug: !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 2 ? "Use pelo menos dois caracteres: letras minúsculas, números e hífens." : undefined,
    };
    setSettingsErrors(errors);
    setSettingsSaveError("");
    if (errors.title || errors.slug) {
      (errors.title ? titleRef : slugRef).current?.focus();
      return;
    }

    settingsSaveInFlightRef.current = true;
    setSavingSettings(true);
    try {
      const { data, error } = await formsService.updateForm(form.id, {
        title,
        slug,
        description: settings.description.trim() || null,
        success_headline: settings.success_headline.trim() || "Recebemos sua solicitação!",
        success_message: settings.success_message.trim() || "Nossa equipe vai entrar em contato em breve.",
        request_geolocation: settings.request_geolocation,
        whatsapp_redirect: settings.whatsapp_redirect,
        whatsapp_message_template: settings.whatsapp_redirect ? settings.whatsapp_message_template.trim() || null : null,
        is_published: settings.is_published,
      });

      if (error || !data) {
        if (error?.code === "23505") {
          setSettingsErrors({ slug: "Já existe um formulário com esse endereço." });
          requestAnimationFrame(() => slugRef.current?.focus());
        } else {
          setSettingsSaveError("Não foi possível salvar as configurações. Confira sua conexão e tente novamente.");
        }
      } else {
        onFormUpdated(data);
        toast.success("Configurações salvas.");
      }
    } catch {
      setSettingsSaveError("Não foi possível salvar as configurações. Confira sua conexão e tente novamente.");
    } finally {
      settingsSaveInFlightRef.current = false;
      setSavingSettings(false);
    }
  };

  const startStepMutation = () => {
    if (stepMutationInFlightRef.current) return false;
    stepMutationInFlightRef.current = true;
    setStepMutationInFlight(true);
    return true;
  };

  const finishStepMutation = () => {
    stepMutationInFlightRef.current = false;
    setStepMutationInFlight(false);
  };

  const handleSaveContactStep = async (title: string, description: string) => {
    if (!contactStep || !startStepMutation()) return;
    try {
      const { error } = await formsService.updateStep(contactStep.id, {
        title: title.trim() || contactStep.title,
        description: description.trim() || null,
      });
      if (error) {
        toast.error("Não foi possível salvar a etapa de contato.");
      } else {
        await loadSteps();
      }
    } catch {
      toast.error("Não foi possível salvar a etapa de contato.");
    } finally {
      finishStepMutation();
    }
  };

  const persistOrder = async (orderedQuestionIds: string[]) => {
    const ids = contactStep ? [...orderedQuestionIds, contactStep.id] : orderedQuestionIds;
    return formsService.reorderSteps(ids);
  };

  const moveStep = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questionSteps.length) return;

    const reordered = [...questionSteps];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    if (!startStepMutation()) return;
    try {
      const { error } = await persistOrder(reordered.map((step) => step.id));
      if (error) {
        toast.error("Não foi possível atualizar a ordem das perguntas.");
        return;
      }
      await loadSteps();
    } catch {
      toast.error("Não foi possível atualizar a ordem das perguntas.");
    } finally {
      finishStepMutation();
    }
  };

  const handleSaveStep = async (payload: StepEditorPayload) => {
    if (!startStepMutation()) return;
    setSavingStep(true);
    try {
      const currentStep = stepDialog?.step;
      if (currentStep) {
        const { error } = await formsService.updateStep(currentStep.id, payload);
        if (error) {
          toast.error("Não foi possível salvar a pergunta.");
        } else {
          await loadSteps();
          setStepDialog(null);
          toast.success("Pergunta atualizada.");
        }
      } else {
        const { data: created, error } = await formsService.createStep({
          form_id: form.id,
          position: questionSteps.length,
          ...payload,
        });
        if (error || !created) {
          toast.error("Não foi possível adicionar a pergunta.");
        } else {
          const { error: orderError } = await persistOrder([...questionSteps.map((step) => step.id), created.id]);
          await loadSteps();
          setStepDialog(null);
          if (orderError) {
            toast.error("A pergunta foi adicionada, mas não foi possível concluir a ordem.");
          } else {
            toast.success("Pergunta adicionada.");
          }
        }
      }
    } catch {
      toast.error("Não foi possível salvar a pergunta.");
    } finally {
      setSavingStep(false);
      finishStepMutation();
    }
  };

  const handleDeleteStep = async (step: PublicFormStep) => {
    const confirmed = await requestConfirmation({
      title: "Excluir pergunta",
      description: `Deseja remover "${step.title}"? Esta ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
    });
    if (!confirmed) return;

    if (!startStepMutation()) return;
    try {
      const { error } = await formsService.deleteStep(step.id);
      if (error) {
        toast.error("Não foi possível excluir a pergunta.");
        return;
      }

      const { error: orderError } = await persistOrder(questionSteps.filter((item) => item.id !== step.id).map((item) => item.id));
      await loadSteps();
      if (orderError) {
        toast.error("A pergunta foi removida, mas não foi possível concluir a ordem.");
      } else {
        toast.success("Pergunta removida.");
      }
    } catch {
      toast.error("Não foi possível excluir a pergunta.");
    } finally {
      finishStepMutation();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <IconButton variant="secondary" onClick={onBack} disabled={stepMutationInFlight || savingSettings} size="sm" aria-label="Voltar para formulários" title="Voltar">
          <ArrowLeft aria-hidden="true" />
        </IconButton>
        <SectionHeader eyebrow="Editor de formulário" title={form.title} description={`/forms/${form.slug}`} className="flex-1" action={<PageActions primary={{ label: savingSettings ? "Salvando..." : "Salvar configurações", icon: Save, loading: savingSettings, onClick: () => void handleSaveSettings() }} />} />
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><Heading level={3} className="kds-card-title">Dados e publicação</Heading><Text className="kds-card-subtitle">Configure o endereço, a mensagem de confirmação e o acesso público.</Text></div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => void handleCopyLink()}>
              <Copy className="kds-control-icon" />
              <span>Copiar link</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(publicUrl, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="kds-control-icon" />
              <span>Abrir</span>
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" required error={settingsErrors.title}>
              <Input ref={titleRef} disabled={savingSettings} value={settings.title} onChange={(event) => { setSettingsErrors(prev => ({ ...prev, title: undefined })); setSettings((prev) => ({ ...prev, title: event.target.value })); }} />
            </Field>
            <Field label="Endereço público" required error={settingsErrors.slug} descriptionPlacement="tooltip" description={`kifersaude.com.br/forms/${settings.slug || "..."}`}>
              <Input ref={slugRef} disabled={savingSettings} value={settings.slug} onChange={(event) => { setSettingsErrors(prev => ({ ...prev, slug: undefined })); setSettings((prev) => ({ ...prev, slug: event.target.value })); }} />
            </Field>
          </div>

          <Field label="Descrição (SEO, opcional)">
            <Textarea rows={2} disabled={savingSettings} value={settings.description} onChange={(event) => setSettings((prev) => ({ ...prev, description: event.target.value }))} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título da tela de sucesso">
              <Input disabled={savingSettings} value={settings.success_headline} onChange={(event) => setSettings((prev) => ({ ...prev, success_headline: event.target.value }))} />
            </Field>
            <Field label="Mensagem da tela de sucesso">
              <Input disabled={savingSettings} value={settings.success_message} onChange={(event) => setSettings((prev) => ({ ...prev, success_message: event.target.value }))} />
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Switch
              checked={settings.request_geolocation}
              disabled={savingSettings}
              onChange={(event) => setSettings((prev) => ({ ...prev, request_geolocation: event.target.checked }))}
              label="Pedir localização (GPS) antes do contato"
            />
            <Switch
              checked={settings.whatsapp_redirect}
              disabled={savingSettings}
              onChange={(event) => setSettings((prev) => ({ ...prev, whatsapp_redirect: event.target.checked }))}
              label="Redirecionar para o WhatsApp após enviar"
            />
          </div>

          {settings.whatsapp_redirect && (
            <Field label="Mensagem pré-preenchida no WhatsApp" description="Use {{nome}} para inserir o nome informado no formulário.">
              <Textarea
                rows={2}
                disabled={savingSettings}
                value={settings.whatsapp_message_template}
                onChange={(event) => setSettings((prev) => ({ ...prev, whatsapp_message_template: event.target.value }))}
                placeholder="Olá! Sou {{nome}} e acabei de preencher o formulário no site."
              />
            </Field>
          )}

          <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Switch
              checked={settings.is_published}
              disabled={savingSettings}
              onChange={(event) => setSettings((prev) => ({ ...prev, is_published: event.target.checked }))}
              label={settings.is_published ? "Publicado" : "Rascunho (não acessível publicamente)"}
            />
            <PageActions placement="form" primary={{ label: savingSettings ? "Salvando..." : "Salvar configurações", icon: Save, loading: savingSettings, onClick: () => void handleSaveSettings() }} />
          </div>
          {settingsSaveError && <Alert tone="danger" role="alert" title="Não foi possível salvar">{settingsSaveError}</Alert>}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Heading level={3} className="kds-card-title">Perguntas</Heading>
            <Text className="kds-card-subtitle">Uma pergunta por tela. A última etapa (contato) é sempre fixa.</Text>
          </div>
          <Button onClick={() => setStepDialog({ step: null })} disabled={stepMutationInFlight}>
            <Plus className="kds-control-icon" />
            <span>Nova pergunta</span>
          </Button>
        </div>

        {loadingSteps ? (
          <LoadingState compact label="Carregando perguntas..." />
        ) : stepsLoadError && steps.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[var(--kds-radius-md)] border border-dashed border-[var(--danger)] p-5 text-center" role="alert">
            <Text className="text-sm font-medium text-[var(--text-primary)]">Não foi possível carregar as perguntas.</Text>
            <Text className="text-sm text-[var(--text-secondary)]">Verifique sua conexão ou sessão e tente novamente.</Text>
            <Button variant="secondary" size="sm" onClick={() => void loadSteps()}>
              <RefreshCw className="kds-control-icon" />
              <span>Tentar novamente</span>
            </Button>
          </div>
        ) : questionSteps.length === 0 ? (
          <Text className="text-sm text-[var(--text-muted)]">Nenhuma pergunta ainda. Adicione a primeira acima.</Text>
        ) : (
          <div className="space-y-3">
            {questionSteps.map((step, index) => {
              return (
                <Card key={step.id} variant="muted" padding="sm" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <ButtonGroup size="sm" aria-label="Ordenar etapa" orientation="vertical">
                      <IconButton type="button" size="sm" variant="ghost" onClick={() => void moveStep(index, -1)} disabled={index === 0 || stepMutationInFlight} aria-label="Mover para cima">
                        <ChevronUp />
                      </IconButton>
                      <IconButton type="button" size="sm" variant="ghost" onClick={() => void moveStep(index, 1)} disabled={index === questionSteps.length - 1 || stepMutationInFlight} aria-label="Mover para baixo">
                        <ChevronDown />
                      </IconButton>
                    </ButtonGroup>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--kds-radius-sm)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                      <ListChecks className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Text className="truncate text-sm font-medium text-[var(--text-primary)]">{step.title}</Text>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral" size="sm">{STEP_TYPE_LABELS[step.step_type]}</Badge>
                        {step.is_required && <Badge tone="gold" size="sm">Obrigatória</Badge>}
                        {step.field_key && <Badge tone="accent" size="sm">{FIELD_KEY_LABELS[step.field_key]}</Badge>}
                      </div>
                    </div>
                  </div>
                  <ButtonGroup size="md" aria-label="Ações da etapa">
                    <Button variant="secondary" size="sm" disabled={stepMutationInFlight} onClick={() => setStepDialog({ step })}>
                      <Pencil className="kds-control-icon" />
                      <span>Editar</span>
                    </Button>
                    <IconButton variant="danger" disabled={stepMutationInFlight} size="sm" onClick={() => void handleDeleteStep(step)} aria-label={`Excluir etapa ${step.title}`} title="Excluir etapa">
                      <Trash2 aria-hidden="true" />
                    </IconButton>
                  </ButtonGroup>
                </Card>
              );
            })}
          </div>
        )}

        {contactStep && (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Etapa final (fixa)</Text>
            <ContactStepEditor step={contactStep} busy={stepMutationInFlight} onSave={handleSaveContactStep} />
            {form.request_geolocation && (
              <Text className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <MapPin className="h-3.5 w-3.5" />
                A etapa de localização aparece automaticamente antes desta.
              </Text>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <Heading level={3} className="kds-card-title">Respostas recentes</Heading>
            <Text className="kds-card-subtitle">{form.submission_count} envio{form.submission_count === 1 ? "" : "s"} no total. Cada envio já criou um lead.</Text>
          </div>
          <Users className="h-5 w-5 text-[var(--text-muted)]" />
        </div>

        {loadingSubmissions ? (
          <LoadingState compact label="Carregando respostas..." />
        ) : submissionsLoadError && submissions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[var(--kds-radius-md)] border border-dashed border-[var(--danger)] p-5 text-center" role="alert">
            <Text className="text-sm font-medium text-[var(--text-primary)]">Não foi possível carregar as respostas.</Text>
            <Text className="text-sm text-[var(--text-secondary)]">Verifique sua conexão ou sessão e tente novamente.</Text>
            <Button variant="secondary" size="sm" onClick={() => void loadSubmissions()}>
              <RefreshCw className="kds-control-icon" />
              <span>Tentar novamente</span>
            </Button>
          </div>
        ) : submissions.length === 0 ? (
          <Text className="text-sm text-[var(--text-muted)]">Nenhuma resposta recebida ainda.</Text>
        ) : (
          <div className="space-y-2">
            {submissions.map((submission) => (
              <Card key={submission.id} variant="muted" padding="sm" className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Text className="truncate text-sm font-medium text-[var(--text-primary)]">{submission.contact_name}</Text>
                  <Text className="text-xs text-[var(--text-secondary)]">
                    {submission.contact_phone} · {new Date(submission.created_at).toLocaleString("pt-BR")}
                  </Text>
                </div>
                <div className="flex items-center gap-1.5">
                  {submission.geo_permission === "granted" && (
                    <TextLink
                      href={`https://maps.google.com/?q=${submission.latitude},${submission.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-[var(--kds-radius-sm)] border border-[var(--border-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--brand-primary)]"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Localização
                    </TextLink>
                  )}
                  {submission.lead_id && (
                    <Badge tone="success" size="sm">
                      Lead criado
                    </Badge>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <StepEditorDialog
        open={Boolean(stepDialog)}
        initialStep={stepDialog?.step ?? null}
        saving={savingStep}
        onClose={() => { if (!stepMutationInFlight) setStepDialog(null); }}
        onSave={(payload) => void handleSaveStep(payload)}
      />
      {ConfirmationDialog}
    </div>
  );
}

type ContactStepEditorProps = {
  step: PublicFormStep;
  busy: boolean;
  onSave: (title: string, description: string) => void;
};

function ContactStepEditor({ step, busy, onSave }: ContactStepEditorProps) {
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description ?? "");

  useEffect(() => {
    setTitle(step.title);
    setDescription(step.description ?? "");
  }, [step]);

  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="Título da tela de contato">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="Descrição (opcional)">
        <Input value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => onSave(title, description)}>
        <MessageCircle className="kds-control-icon" />
        <span>Salvar</span>
      </Button>
    </div>
  );
}
