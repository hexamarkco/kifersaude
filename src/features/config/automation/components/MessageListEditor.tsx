import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, RefreshCcw, Sparkles, Trash2 } from "lucide-react";

import {
  type AutoContactFlowCustomMessage,
  type AutoContactFlowMessageItem,
  type AutoContactFlowStep,
  type AutoContactTemplate,
} from "../../../../lib/autoContactService";
import { AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS } from "../../../../lib/templateVariableSuggestions";
import VariableAutocompleteTextarea from "../../../../components/ui/VariableAutocompleteTextarea";
import {
  Button,
  FilterSelect,
  IconButton,
} from "../../../../design-system";

export type MessageListItem = AutoContactFlowMessageItem;

type MessageListEditorProps = {
  step: AutoContactFlowStep;
  messageTemplates: AutoContactTemplate[];
  onUpdate: (messages: MessageListItem[]) => void;
  onPreviewAiMessage?: (instruction: string, itemIndex: number) => Promise<string>;
};

export function MessageListEditor({
  step,
  messageTemplates,
  onUpdate,
  onPreviewAiMessage,
}: MessageListEditorProps) {
  const [preview, setPreview] = useState<{ index: number; text: string } | null>(null);
  const [previewingIndex, setPreviewingIndex] = useState<number | null>(null);
  const currentMessages = useMemo<MessageListItem[]>(() => {
    if (Array.isArray(step.messages) && step.messages.length > 0) {
      return step.messages.map((item) => ({ ...item }));
    }
    if (step.messageSource === "custom" || step.customMessage?.text || step.customMessage?.mediaUrl) {
      return [{ custom: { ...(step.customMessage as AutoContactFlowCustomMessage) } }];
    }
    if (step.templateId) {
      return [{ templateId: step.templateId }];
    }
    return [{ templateId: "" }];
  }, [step.messages, step.messageSource, step.customMessage, step.templateId]);

  const updateItem = (index: number, item: MessageListItem) => {
    const next = currentMessages.map((entry, i) => (i === index ? item : entry));
    onUpdate(next);
  };

  const removeItem = (index: number) => {
    onUpdate(currentMessages.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= currentMessages.length) return;
    const next = [...currentMessages];
    [next[index], next[target]] = [next[target], next[index]];
    onUpdate(next);
  };

  const addItem = () => {
    onUpdate([...currentMessages, { templateId: "" }]);
  };

  return (
    <div className="space-y-2">
      {currentMessages.map((item, index) => {
        const isTemplate = "templateId" in item;
        const isAi = "ai" in item;
        return (
          <div
            key={`msg-${index}`}
            className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2"
          >
            <div className="mb-1 flex items-center justify-between gap-1">
              <span className="text-[10px] font-medium text-[var(--text-muted)]">
                Mensagem {index + 1}
              </span>
              <div className="flex items-center gap-0.5">
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  aria-label="Mover para cima"
                >
                  <ChevronUp />
                </IconButton>
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === currentMessages.length - 1}
                  aria-label="Mover para baixo"
                >
                  <ChevronDown />
                </IconButton>
                <IconButton
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => removeItem(index)}
                  disabled={currentMessages.length === 1}
                  aria-label="Remover mensagem"
                >
                  <Trash2 />
                </IconButton>
              </div>
            </div>

            <div className="mb-1 flex items-center gap-1">
              <FilterSelect
                icon={RefreshCcw}
                size="sm"
                value={isAi ? "ai" : isTemplate ? "template" : "custom"}
                onChange={(value) =>
                  updateItem(
                    index,
                    value === "custom"
                      ? { custom: { type: "text", text: "" } }
                      : value === "ai"
                        ? { ai: { instruction: "" } }
                        : { templateId: "" },
                  )
                }
                placeholder="Origem"
                includePlaceholderOption={false}
                options={[
                  { value: "template", label: "Template" },
                  { value: "custom", label: "Texto custom" },
                  { value: "ai", label: "IA" },
                ]}
              />
            </div>

            {isTemplate ? (
              <FilterSelect
                icon={RefreshCcw}
                size="sm"
                value={item.templateId ?? ""}
                onChange={(value) => updateItem(index, { templateId: value })}
                placeholder="Selecione"
                includePlaceholderOption={false}
                options={[
                  { value: "", label: "Selecione" },
                  ...messageTemplates.map((template) => ({
                    value: template.id,
                    label: template.name,
                  })),
                ]}
              />
            ) : isAi ? (
              <div>
                <VariableAutocompleteTextarea
                  value={item.ai?.instruction ?? ""}
                  onChange={(value) =>
                    updateItem(index, { ai: { instruction: value } })
                  }
                  rows={3}
                  size="sm"
                  placeholder="Ex.: retome o orçamento e faça uma pergunta objetiva"
                  suggestions={AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS}
                />
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] text-[var(--text-subtle)]">
                    Instrução obrigatória. A IA gera uma única mensagem no momento do envio.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!item.ai?.instruction.trim() || !onPreviewAiMessage}
                    loading={previewingIndex === index}
                    onClick={async () => {
                      if (!onPreviewAiMessage || !item.ai?.instruction.trim()) return;
                      setPreviewingIndex(index);
                      try {
                        const text = await onPreviewAiMessage(item.ai.instruction, index);
                        setPreview({ index, text });
                      } finally {
                        setPreviewingIndex(null);
                      }
                    }}
                  >
                    {previewingIndex !== index ? <Sparkles /> : null}
                    Gerar prévia
                  </Button>
                </div>
                {preview?.index === index && (
                  <div className="mt-2 rounded-md border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] p-2 text-xs text-[var(--text-primary)]">
                    {preview.text}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <VariableAutocompleteTextarea
                  value={item.custom?.text ?? ""}
                  onChange={(value) =>
                    updateItem(index, {
                      custom: { type: "text", text: value },
                    })
                  }
                  rows={3}
                  size="sm"
                  suggestions={AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS}
                />
                <div className="mt-1 text-[10px] text-[var(--text-subtle)]">
                  Use variáveis como {"{{primeiro_nome}}"} ou fórmulas com
                  {"{{= ... }}"}.
                </div>
              </div>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        size="sm"
        variant="text"
        onClick={addItem}
      >
        <Plus /> Adicionar mensagem
      </Button>

      <div className="text-[10px] text-[var(--text-subtle)]">
        As mensagens desta etapa são enviadas em ordem, cada uma como uma
        mensagem própria do WhatsApp.
      </div>
    </div>
  );
}
