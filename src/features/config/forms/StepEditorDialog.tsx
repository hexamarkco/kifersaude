import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { PublicFormFieldKey, PublicFormStep, PublicFormStepOption, PublicFormStepType } from "../../../lib/supabase";
import { toast } from "../../../lib/toast";
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
} from "../../../design-system";

export type StepEditorPayload = {
  step_type: PublicFormStepType;
  title: string;
  description: string | null;
  placeholder: string | null;
  is_required: boolean;
  field_key: PublicFormFieldKey | null;
  options: PublicFormStepOption[];
};

type StepEditorDialogProps = {
  open: boolean;
  initialStep: PublicFormStep | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: StepEditorPayload) => void;
};

const QUESTION_TYPE_OPTIONS = [
  { value: "single_choice", label: "Escolha única" },
  { value: "multi_choice", label: "Múltipla escolha" },
  { value: "short_text", label: "Texto curto" },
];

const CONTRACT_TYPE_OPTIONS = [
  { value: "PF", label: "PF (individual/familiar)" },
  { value: "MEI", label: "MEI" },
  { value: "CNPJ", label: "CNPJ / Empresarial" },
];

const fieldKeyOptionsFor = (stepType: PublicFormStepType) => {
  const base = [{ value: "none", label: "Nenhum (só entra na observação do lead)" }];
  if (stepType === "short_text") return [...base, { value: "cidade", label: "Cidade do lead" }];
  if (stepType === "single_choice") {
    return [
      ...base,
      { value: "cidade", label: "Cidade do lead" },
      { value: "tipo_contratacao", label: "Tipo de contratação (PF/MEI/CNPJ)" },
    ];
  }
  return base;
};

const emptyOption = (): PublicFormStepOption => ({ id: crypto.randomUUID(), label: "" });

export default function StepEditorDialog({ open, initialStep, saving, onClose, onSave }: StepEditorDialogProps) {
  const [stepType, setStepType] = useState<PublicFormStepType>("single_choice");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [placeholder, setPlaceholder] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [fieldKey, setFieldKey] = useState<"none" | PublicFormFieldKey>("none");
  const [options, setOptions] = useState<PublicFormStepOption[]>([emptyOption(), emptyOption()]);

  useEffect(() => {
    if (!open) return;

    if (initialStep) {
      setStepType(initialStep.step_type === "contact" ? "single_choice" : initialStep.step_type);
      setTitle(initialStep.title);
      setDescription(initialStep.description ?? "");
      setPlaceholder(initialStep.placeholder ?? "");
      setIsRequired(initialStep.is_required);
      setFieldKey(initialStep.field_key ?? "none");
      setOptions(initialStep.options.length > 0 ? initialStep.options : [emptyOption(), emptyOption()]);
    } else {
      setStepType("single_choice");
      setTitle("");
      setDescription("");
      setPlaceholder("");
      setIsRequired(true);
      setFieldKey("none");
      setOptions([emptyOption(), emptyOption()]);
    }
  }, [open, initialStep]);

  const handleTypeChange = (nextType: PublicFormStepType) => {
    setStepType(nextType);
    const allowed = fieldKeyOptionsFor(nextType).map((option) => option.value);
    if (!allowed.includes(fieldKey)) setFieldKey("none");
  };

  const updateOptionLabel = (id: string, label: string) => {
    setOptions((prev) => prev.map((option) => (option.id === id ? { ...option, label } : option)));
  };

  const updateOptionValue = (id: string, value: string) => {
    setOptions((prev) => prev.map((option) => (option.id === id ? { ...option, value } : option)));
  };

  const addOption = () => setOptions((prev) => [...prev, emptyOption()]);

  const removeOption = (id: string) => {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((option) => option.id !== id)));
  };

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Informe o título da pergunta.");
      return;
    }

    const isChoiceType = stepType === "single_choice" || stepType === "multi_choice";
    let finalOptions: PublicFormStepOption[] = [];

    if (isChoiceType) {
      const cleanedOptions = options
        .map((option) => ({ ...option, label: option.label.trim() }))
        .filter((option) => option.label.length > 0);

      if (cleanedOptions.length < 2) {
        toast.error("Adicione ao menos 2 opções.");
        return;
      }

      if (fieldKey === "tipo_contratacao") {
        const missingValue = cleanedOptions.some((option) => !option.value);
        if (missingValue) {
          toast.error("Defina o tipo de contratação (PF/MEI/CNPJ) de cada opção.");
          return;
        }
        finalOptions = cleanedOptions.map((option) => ({ id: option.id, label: option.label, value: option.value }));
      } else {
        finalOptions = cleanedOptions.map((option) => ({ id: option.id, label: option.label }));
      }
    }

    onSave({
      step_type: stepType,
      title: trimmedTitle,
      description: description.trim() || null,
      placeholder: stepType === "short_text" ? placeholder.trim() || null : null,
      is_required: isRequired,
      field_key: fieldKey === "none" ? null : fieldKey,
      options: finalOptions,
    });
  };

  const isChoiceType = stepType === "single_choice" || stepType === "multi_choice";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} size="md">
      <DialogHeader onClose={onClose}>
        <DialogTitle>{initialStep ? "Editar pergunta" : "Nova pergunta"}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <div className="space-y-4">
          <Field label="Tipo de pergunta">
            <Select value={stepType} onChange={(event) => handleTypeChange(event.target.value as PublicFormStepType)} options={QUESTION_TYPE_OPTIONS} />
          </Field>

          <Field label="Título">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Você já tem plano de saúde?" />
          </Field>

          <Field label="Descrição (opcional)">
            <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Texto de apoio exibido abaixo do título" />
          </Field>

          {stepType === "short_text" && (
            <Field label="Placeholder do campo (opcional)">
              <Input value={placeholder} onChange={(event) => setPlaceholder(event.target.value)} placeholder="Ex: Digite sua cidade" />
            </Field>
          )}

          <Field label="Mapear resposta para">
            <Select
              value={fieldKey}
              onChange={(event) => setFieldKey(event.target.value as "none" | PublicFormFieldKey)}
              options={fieldKeyOptionsFor(stepType)}
            />
          </Field>

          {isChoiceType && (
            <Field label="Opções">
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <Input
                      value={option.label}
                      onChange={(event) => updateOptionLabel(option.id, event.target.value)}
                      placeholder={`Opção ${index + 1}`}
                      className="flex-1"
                    />
                    {fieldKey === "tipo_contratacao" && (
                      <Select
                        value={option.value ?? ""}
                        onChange={(event) => updateOptionValue(option.id, event.target.value)}
                        options={[{ value: "", label: "Tipo..." }, ...CONTRACT_TYPE_OPTIONS]}
                        className="w-40"
                      />
                    )}
                    <Button
                      type="button"
                      variant="danger"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={options.length <= 2}
                      onClick={() => removeOption(option.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="secondary" size="sm" onClick={addOption}>
                  <Plus className="h-4 w-4" />
                  <span>Adicionar opção</span>
                </Button>
              </div>
            </Field>
          )}

          <Switch checked={isRequired} onChange={(event) => setIsRequired(event.target.checked)} label="Resposta obrigatória" />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={saving}>
          {saving ? "Salvando" : "Salvar"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
