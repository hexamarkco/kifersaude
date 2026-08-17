import { useMemo } from "react";
import { ChevronDown, ChevronUp, Plus, RefreshCcw, Trash2 } from "lucide-react";

import {
  type AutoContactFlowCustomMessage,
  type AutoContactFlowStep,
  type AutoContactTemplate,
} from "../../../../lib/autoContactService";
import { AUTO_CONTACT_TEMPLATE_VARIABLE_SUGGESTIONS } from "../../../../lib/templateVariableSuggestions";
import FilterSingleSelect from "../../../../components/FilterSingleSelect";
import VariableAutocompleteTextarea from "../../../../components/ui/VariableAutocompleteTextarea";

export type MessageListItem = {
  templateId?: string;
  custom?: AutoContactFlowCustomMessage;
};

type MessageListEditorProps = {
  step: AutoContactFlowStep;
  messageTemplates: AutoContactTemplate[];
  onUpdate: (messages: MessageListItem[]) => void;
};

export function MessageListEditor({
  step,
  messageTemplates,
  onUpdate,
}: MessageListEditorProps) {
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
        const isTemplate = Boolean(item.templateId);
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
                <button
                  type="button"
                  className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--bg-hover)] disabled:opacity-30"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  aria-label="Mover para cima"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="rounded-full p-1 text-[var(--text-subtle)] hover:bg-[var(--bg-hover)] disabled:opacity-30"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === currentMessages.length - 1}
                  aria-label="Mover para baixo"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="rounded-full p-1 text-[var(--danger-text)] hover:bg-[var(--bg-hover)] disabled:opacity-30"
                  onClick={() => removeItem(index)}
                  disabled={currentMessages.length === 1}
                  aria-label="Remover mensagem"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="mb-1 flex items-center gap-1">
              <FilterSingleSelect
                icon={RefreshCcw}
                size="compact"
                value={isTemplate ? "template" : "custom"}
                onChange={(value) =>
                  updateItem(
                    index,
                    value === "custom"
                      ? { custom: { type: "text", text: "" } }
                      : { templateId: "" },
                  )
                }
                placeholder="Origem"
                includePlaceholderOption={false}
                options={[
                  { value: "template", label: "Template" },
                  { value: "custom", label: "Texto custom" },
                ]}
              />
            </div>

            {isTemplate ? (
              <FilterSingleSelect
                icon={RefreshCcw}
                size="compact"
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
                  size="compact"
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

      <button
        type="button"
        className="flex items-center gap-1 text-[11px] text-[var(--brand-primary)] hover:underline"
        onClick={addItem}
      >
        <Plus className="h-3 w-3" /> Adicionar mensagem
      </button>

      <div className="text-[10px] text-[var(--text-subtle)]">
        As mensagens desta etapa são enviadas em ordem, cada uma como uma
        mensagem própria do WhatsApp.
      </div>
    </div>
  );
}
