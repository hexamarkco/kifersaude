import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, X } from "lucide-react";

import {
  Button,
  Field,
  Input,
  Textarea,
} from "../../../../design-system";
import { toast } from "../../../../lib/toast";
import { aiConfigService } from "../aiConfigService";
import type {
  AiFeatureWithConfig,
  AiProviderSlug,
  AiModelResolutionSource,
} from "../aiConfigTypes";
import {
  AI_FEATURE_LABELS,
  AI_PROVIDER_OPTIONS,
  AI_MODEL_LABELS,
  AI_MODEL_RESOLUTION_SOURCE_LABELS,
} from "../aiConfigTypes";

type Props = {
  feature: AiFeatureWithConfig;
  onClose: () => void;
  onSaved: () => void;
};

type EffectiveModel = {
  provider: string;
  model: string;
  source: AiModelResolutionSource;
  sourceLabel: string;
};

const SOURCE_BADGE_CLASSES: Record<AiModelResolutionSource, string> = {
  feature: "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]",
  ai_routing: "bg-[var(--color-info)]/10 text-[var(--color-info)]",
  provider_default: "bg-[var(--text-muted)]/10 text-[var(--text-muted)]",
  fallback: "bg-[var(--color-warning)]/10 text-[var(--color-warning)]",
};

export default function FeatureEditorDrawer({ feature, onClose, onSaved }: Props) {
  const [prompt, setPrompt] = useState("");
  const [outputInstructions, setOutputInstructions] = useState("");
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(500);
  const [modelOverrideEnabled, setModelOverrideEnabled] = useState(false);
  const [provider, setProvider] = useState<AiProviderSlug>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [effectiveModel, setEffectiveModel] = useState<EffectiveModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Array<{ version: number; is_active: boolean; created_at: string }>>([]);
  const [availableModels, setAvailableModels] = useState<Array<{ provider: string; model: string; label: string }>>([]);

  const loadHistory = useCallback(() => {
    aiConfigService.fetchConfigHistory(feature.id).then(({ data }) => {
      setHistory(data ?? []);
    });
  }, [feature.id]);

  const loadEffectiveModel = useCallback(async () => {
    const aiTaskMap: Record<string, string> = {
      "followup.generate": "follow_up_generation",
      "followup.analysis": "follow_up_analysis",
      "followup.refine": "follow_up_generation",
      "message.rewrite": "rewrite_message",
      "message.suggest": "follow_up_generation",
      "attendance.critique": "attendance_critique",
      "audio.transcribe": "whatsapp_audio_transcription",
      "autonomous.reply": "autonomous_attendance",
      "sandbox.chat": "autonomous_attendance",
      "sandbox.scenario": "autonomous_attendance",
      "campaign.intent": "follow_up_generation",
      "agenda.organize": "follow_up_agenda_organization",
    };
    const task = aiTaskMap[feature.key];
    if (!task) return;

    const { data } = await aiConfigService.fetchEffectiveModel(feature.key, task);
    if (data) {
      setEffectiveModel({
        ...data,
        source: data.source as AiModelResolutionSource,
      });
    }
  }, [feature.key]);

  useEffect(() => {
    if (feature.active_config) {
      setPrompt(feature.active_config.feature_prompt);
      setOutputInstructions(feature.active_config.output_instructions);
      setTemperature(feature.active_config.temperature);
      setMaxTokens(feature.active_config.max_output_tokens);
      setModelOverrideEnabled(feature.active_config.model_override_enabled);
      setProvider(feature.active_config.provider ?? "openai");
      setModel(feature.active_config.model ?? "gpt-4o-mini");
    } else {
      setPrompt(feature.default_feature_prompt);
      setOutputInstructions(feature.default_output_instructions);
      setTemperature(feature.default_temperature);
      setMaxTokens(feature.default_max_output_tokens);
      setModelOverrideEnabled(false);
      setProvider("openai");
      setModel("gpt-4o-mini");
    }

    loadHistory();
    loadEffectiveModel();

    aiConfigService.fetchAvailableModels().then(({ data }) => {
      if (data) setAvailableModels(data);
    });
  }, [feature, loadHistory, loadEffectiveModel]);

  const modelsForProvider = useMemo(
    () => availableModels.filter((m) => m.provider === provider),
    [availableModels, provider],
  );

  const handleProviderChange = useCallback((newProvider: AiProviderSlug) => {
    setProvider(newProvider);
    const models = availableModels.filter((m) => m.provider === newProvider);
    if (models.length > 0) {
      setModel(models[0].model);
    }
  }, [availableModels]);

  const handleSave = useCallback(async () => {
    if (!prompt.trim()) return toast.error("O prompt não pode estar vazio");

    setSaving(true);
    const { error } = await aiConfigService.createConfig(feature.id, {
      feature_prompt: prompt,
      output_instructions: outputInstructions,
      temperature,
      max_output_tokens: maxTokens,
      provider: modelOverrideEnabled ? provider : undefined,
      model: modelOverrideEnabled ? model : undefined,
      model_override_enabled: modelOverrideEnabled,
    });
    setSaving(false);

    if (error) return toast.error(error);
    toast.success("Nova versão criada e ativada");
    loadHistory();
    loadEffectiveModel();
    onSaved();
  }, [feature.id, prompt, outputInstructions, temperature, maxTokens, modelOverrideEnabled, provider, model, onSaved, loadHistory, loadEffectiveModel]);

  const handleResetToDefaults = useCallback(() => {
    setPrompt(feature.default_feature_prompt);
    setOutputInstructions(feature.default_output_instructions);
    setTemperature(feature.default_temperature);
    setMaxTokens(feature.default_max_output_tokens);
    setModelOverrideEnabled(false);
    setProvider("openai");
    setModel("gpt-4o-mini");
    toast.info("Valores restaurados para os padrões do sistema");
  }, [feature]);

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

          {/* Model Configuration */}
          <div className="rounded-lg border border-[var(--border-subtle)] p-4 space-y-3">
            <p className="text-sm font-medium text-[var(--text-primary)]">Modelo</p>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`model-mode-${feature.key}`}
                  checked={!modelOverrideEnabled}
                  onChange={() => setModelOverrideEnabled(false)}
                  className="accent-[var(--brand-primary)]"
                />
                <span className="text-sm text-[var(--text-primary)]">Usar roteamento padrão</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`model-mode-${feature.key}`}
                  checked={modelOverrideEnabled}
                  onChange={() => setModelOverrideEnabled(true)}
                  className="accent-[var(--brand-primary)]"
                />
                <span className="text-sm text-[var(--text-primary)]">Personalizado</span>
              </label>
            </div>

            {modelOverrideEnabled && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Field label="Provider">
                  <select
                    value={provider}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      handleProviderChange(e.target.value as AiProviderSlug)
                    }
                    className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    {AI_PROVIDER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Modelo">
                  <select
                    value={model}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setModel(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    {modelsForProvider.map((opt) => (
                      <option key={opt.model} value={opt.model}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            {/* Effective model display */}
            {effectiveModel && (
              <div className="rounded bg-[var(--bg-subtle)] p-2.5 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted)]">Modelo efetivo:</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {AI_MODEL_LABELS[effectiveModel.model] ?? effectiveModel.model}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted)]">Origem:</span>
                  <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${SOURCE_BADGE_CLASSES[effectiveModel.source]}`}>
                    {AI_MODEL_RESOLUTION_SOURCE_LABELS[effectiveModel.source]}
                  </span>
                </div>
                {effectiveModel.source === "ai_routing" && (
                  <p className="text-[var(--text-muted)]">
                    Task: {feature.key.replace(".", "_")}
                  </p>
                )}
              </div>
            )}
          </div>

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
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-5 py-3">
          <Button variant="ghost" size="sm" onClick={handleResetToDefaults}>
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar Padrão
          </Button>
          <div className="flex items-center gap-2">
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
    </div>
  );
}
