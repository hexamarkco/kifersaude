import { useCallback, useEffect, useState } from "react";
import { Save, X } from "lucide-react";

import {
  Button,
  Field,
  Input,
  Textarea,
} from "../../../../design-system";
import { toast } from "../../../../lib/toast";
import { aiConfigService } from "../aiConfigService";
import type { AiFeatureWithConfig } from "../aiConfigTypes";
import { AI_FEATURE_LABELS } from "../aiConfigTypes";

type Props = {
  feature: AiFeatureWithConfig;
  onClose: () => void;
  onSaved: () => void;
};

export default function FeatureEditorDrawer({ feature, onClose, onSaved }: Props) {
  const [prompt, setPrompt] = useState("");
  const [outputInstructions, setOutputInstructions] = useState("");
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(500);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Array<{ version: number; is_active: boolean; created_at: string }>>([]);

  useEffect(() => {
    if (feature.active_config) {
      setPrompt(feature.active_config.feature_prompt);
      setOutputInstructions(feature.active_config.output_instructions);
      setTemperature(feature.active_config.temperature);
      setMaxTokens(feature.active_config.max_output_tokens);
    } else {
      setPrompt(feature.default_feature_prompt);
      setOutputInstructions(feature.default_output_instructions);
      setTemperature(feature.default_temperature);
      setMaxTokens(feature.default_max_output_tokens);
    }

    aiConfigService.fetchConfigHistory(feature.id).then(({ data }) => {
      setHistory(data ?? []);
    });
  }, [feature]);

  const handleSave = useCallback(async () => {
    if (!prompt.trim()) return toast.error("O prompt não pode estar vazio");

    setSaving(true);
    const { error } = await aiConfigService.createConfig(feature.id, {
      feature_prompt: prompt,
      output_instructions: outputInstructions,
      temperature,
      max_output_tokens: maxTokens,
    });
    setSaving(false);

    if (error) return toast.error(error);
    toast.success("Nova versão criada e ativada");
    onSaved();
  }, [feature.id, prompt, outputInstructions, temperature, maxTokens, onSaved]);

  const label = AI_FEATURE_LABELS[feature.key] ?? feature.name;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-2xl flex-col bg-[var(--bg-surface)] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {label}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {feature.key}
              {feature.active_config && ` · v${feature.active_config.version}`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Variables info */}
          {feature.available_variables && feature.available_variables.length > 0 && (
            <div className="rounded-lg bg-[var(--bg-subtle)] p-3">
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                Variáveis disponíveis:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {feature.available_variables.map((v) => (
                  <code
                    key={v}
                    className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-xs text-[var(--brand-primary)] border border-[var(--border-subtle)]"
                  >
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Prompt */}
          <Field label="Prompt da Feature" description="Instrução principal enviada para a IA.">
            <Textarea
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              placeholder="Digite o prompt..."
            />
          </Field>

          {/* Output Instructions */}
          <Field label="Instruções de Saída" description="Formato e regras de resposta.">
            <Textarea
              value={outputInstructions}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOutputInstructions(e.target.value)}
              rows={6}
              className="font-mono text-sm"
              placeholder="Ex: Retorne JSON no formato..."
            />
          </Field>

          {/* Temperature + Max Tokens */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Temperature" description={`Padrão: ${feature.default_temperature}`}>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemperature(Number(e.target.value))}
              />
            </Field>
            <Field label="Max Tokens" description={`Padrão: ${feature.default_max_output_tokens}`}>
              <Input
                type="number"
                min={100}
                max={8000}
                step={50}
                value={maxTokens}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxTokens(Number(e.target.value))}
              />
            </Field>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                Versões anteriores
              </p>
              <div className="space-y-1">
                {history.slice(0, 5).map((h) => (
                  <div
                    key={h.version}
                    className="flex items-center gap-2 rounded px-2.5 py-1.5 text-xs text-[var(--text-muted)] bg-[var(--bg-subtle)]"
                  >
                    <span className="font-mono">v{h.version}</span>
                    {h.is_active && (
                      <span className="rounded bg-[var(--color-success)]/10 px-1.5 py-0.5 text-[var(--color-success)] font-medium">
                        Ativo
                      </span>
                    )}
                    <span className="ml-auto">
                      {new Date(h.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Defaults reference */}
          <div className="rounded-lg border border-[var(--border-subtle)] p-3">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
              Valores padrão (system):
            </p>
            <div className="text-xs text-[var(--text-muted)] space-y-0.5">
              <p>Temperature: {feature.default_temperature}</p>
              <p>Max Tokens: {feature.default_max_output_tokens}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {!saving && <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Criar Versão e Ativar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
