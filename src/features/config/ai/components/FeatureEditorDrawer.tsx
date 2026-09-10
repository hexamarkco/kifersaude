import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw, Save, X } from "lucide-react";

import {
  Button,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  Field,
  Input,
  Select,
  Textarea,
} from "../../../../design-system";
import { toast } from "../../../../lib/toast";
import { aiConfigService } from "../aiConfigService";
import type {
  AiFeatureWithConfig,
  AiProviderSlug,
  AiModelResolutionSource,
  AiModelCatalogCapability,
  AiModelCatalogWithPricing,
  AiReasoningEffort,
} from "../aiConfigTypes";
import {
  AI_REASONING_EFFORT_LABELS,
  AI_FEATURE_LABELS,
  AI_FEATURE_AI_TASK,
  AI_MODEL_RESOLUTION_SOURCE_LABELS,
  TASK_TYPE_REQUIRED_CAPABILITIES,
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

type ProviderModelOption = {
  value: string;
  label: string;
  reasoningEfforts?: AiReasoningEffort[];
};

const isProviderSlug = (value: string | undefined): value is AiProviderSlug =>
  value === "openai";

const SOURCE_BADGE_CLASSES: Record<AiModelResolutionSource, string> = {
  feature: "bg-[var(--brand-primary-soft)] text-[var(--brand-primary-active)]",
  ai_routing: "bg-[var(--info-soft)] text-[var(--info-text)]",
  provider_default: "bg-[var(--text-muted)]/10 text-[var(--text-muted)]",
  fallback: "bg-[var(--warning-soft)] text-[var(--warning-text)]",
};

/**
 * Infers capability from model ID when ai_models doesn't have metadata.
 * Mirrors the logic in sync-ai-models for consistency.
 */
function inferCapabilityFromModelId(modelId: string): AiModelCatalogCapability[] {
  const lower = modelId.toLowerCase();
  if (lower.includes("transcribe") || lower.includes("whisper")) return ["transcription"];
  if (lower.startsWith("gpt-") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("o4")) {
    const caps: AiModelCatalogCapability[] = ["text"];
    if (lower.includes("mini") || lower.includes("nano")) return caps;
    caps.push("structured_output");
    if (lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("o4")) caps.push("reasoning");
    if (!lower.includes("mini")) caps.push("multimodal");
    return caps;
  }
  return ["text"];
}

function hasAllCapabilities(modelCaps: AiModelCatalogCapability[], required: AiModelCatalogCapability[]): boolean {
  return required.every((c) => modelCaps.includes(c));
}

export default function FeatureEditorDrawer({ feature, onClose, onSaved }: Props) {
  const [prompt, setPrompt] = useState("");
  const [outputInstructions, setOutputInstructions] = useState("");
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(500);
  const [modelOverrideEnabled, setModelOverrideEnabled] = useState(false);
  const [provider, setProvider] = useState<AiProviderSlug>("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [reasoningEffort, setReasoningEffort] = useState<AiReasoningEffort | null>(null);
  const [effectiveModel, setEffectiveModel] = useState<EffectiveModel | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Array<{ version: number; is_active: boolean; created_at: string }>>([]);

  const [providerModels, setProviderModels] = useState<ProviderModelOption[]>([]);
  const [loadedProvider, setLoadedProvider] = useState<AiProviderSlug | null>(null);
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  const [catalogMeta, setCatalogMeta] = useState<Map<string, AiModelCatalogWithPricing>>(new Map());

  const taskType = feature.task_type ?? "text";
  const requiredCapabilities = useMemo(
    () => TASK_TYPE_REQUIRED_CAPABILITIES[taskType] ?? ["text"],
    [taskType],
  );

  const loadHistory = useCallback(() => {
    aiConfigService.fetchConfigHistory(feature.id).then(({ data }) => {
      setHistory(data ?? []);
    });
  }, [feature.id]);

  const loadEffectiveModel = useCallback(async () => {
    const task = AI_FEATURE_AI_TASK[feature.key];
    if (!task) return;
    const { data } = await aiConfigService.fetchEffectiveModel(feature.key, task);
    if (data) {
      setEffectiveModel({ ...data, source: data.source as AiModelResolutionSource });
    }
  }, [feature.key]);

  const loadProviderModels = useCallback(async (providerSlug: AiProviderSlug) => {
    setProviderLoading(true);
    setProviderError(null);
    setLoadedProvider(null);
    const { data, error } = await aiConfigService.fetchProviderModels(providerSlug);
    setProviderLoading(false);
    setLoadedProvider(providerSlug);
    if (error) {
      setProviderError(error);
      setProviderModels([]);
    } else {
      setProviderModels(data ?? []);
    }
  }, []);

  useEffect(() => {
    const currentConfig = feature.active_config ?? feature.latest_config;
    if (currentConfig) {
      setPrompt(currentConfig.feature_prompt);
      setOutputInstructions(currentConfig.output_instructions);
      setTemperature(currentConfig.temperature);
      setMaxTokens(currentConfig.max_output_tokens);
      setModelOverrideEnabled(currentConfig.model_override_enabled);
      setProvider(currentConfig.provider ?? "openai");
      setModel(currentConfig.model ?? "gpt-4o-mini");
      setReasoningEffort(currentConfig.reasoning_effort);
    } else {
      setPrompt(feature.default_feature_prompt);
      setOutputInstructions(feature.default_output_instructions);
      setTemperature(feature.default_temperature);
      setMaxTokens(feature.default_max_output_tokens);
      setModelOverrideEnabled(false);
      setProvider("openai");
      setModel("gpt-4o-mini");
      setReasoningEffort(null);
    }

    loadHistory();
    loadEffectiveModel();

    aiConfigService.fetchAvailableModels().then(({ data }) => {
      if (data) {
        const map = new Map<string, AiModelCatalogWithPricing>();
        for (const m of data) map.set(`${m.provider}:${m.model}`, m);
        setCatalogMeta(map);
      }
    });
  }, [feature, loadHistory, loadEffectiveModel]);

  const effectiveProvider = isProviderSlug(effectiveModel?.provider) ? effectiveModel.provider : null;
  const effectiveDefaultIsKnown = effectiveModel?.source !== "feature";
  const reasoningProvider = modelOverrideEnabled
    ? provider
    : (effectiveDefaultIsKnown ? effectiveProvider : null);
  const reasoningModel = modelOverrideEnabled
    ? model
    : (effectiveDefaultIsKnown ? effectiveModel?.model ?? "" : "");

  useEffect(() => {
    if (reasoningProvider) loadProviderModels(reasoningProvider);
  }, [reasoningProvider, loadProviderModels]);

  /** Models from provider API, enriched with catalog metadata, filtered by taskType */
  const compatibleModels = useMemo(() => {
    return providerModels
      .map((pm) => {
        const meta = catalogMeta.get(`${provider}:${pm.value}`);
        const capabilities = meta?.capabilities ?? inferCapabilityFromModelId(pm.value);
        const compatible = hasAllCapabilities(capabilities, requiredCapabilities);
        return { ...pm, meta, capabilities, compatible };
      })
      .filter((m) => m.compatible)
      .map((m) => ({
        value: m.value,
        label: m.meta?.display_name ?? m.label,
        hasPricing: m.meta?.has_pricing ?? false,
        deprecated: m.meta?.deprecated_at != null,
        reasoningEfforts: m.reasoningEfforts ?? [],
      }));
  }, [providerModels, catalogMeta, provider, requiredCapabilities]);

  const selectedModelData = useMemo(() => {
    return catalogMeta.get(`${provider}:${model}`) ?? null;
  }, [catalogMeta, provider, model]);

  const isSelectedModelDeprecated = selectedModelData?.deprecated_at != null;
  const isSelectedModelWithoutPricing = selectedModelData != null && !selectedModelData.has_pricing;
  const supportedReasoningEfforts = useMemo(() => (
    loadedProvider === reasoningProvider
      ? providerModels.find((item) => item.value === reasoningModel)?.reasoningEfforts ?? []
      : []
  ), [loadedProvider, reasoningProvider, providerModels, reasoningModel]);

  useEffect(() => {
    if (
      loadedProvider === reasoningProvider &&
      !providerError &&
      reasoningEffort &&
      !supportedReasoningEfforts.includes(reasoningEffort)
    ) {
      setReasoningEffort(null);
    }
  }, [loadedProvider, reasoningProvider, providerError, reasoningEffort, supportedReasoningEfforts]);

  const handleSave = useCallback(async () => {
    if (!prompt.trim()) return toast.error("O prompt não pode estar vazio");

    if (modelOverrideEnabled) {
      const validation = await aiConfigService.validateModelOverride(provider, model, taskType);
      if (!validation.valid) {
        return toast.error(validation.error ?? "Modelo inválido");
      }
    }

    setSaving(true);
    const { error } = await aiConfigService.createConfig(feature.id, {
      feature_prompt: prompt,
      output_instructions: outputInstructions,
      temperature,
      max_output_tokens: maxTokens,
      provider: modelOverrideEnabled ? provider : undefined,
      model: modelOverrideEnabled ? model : undefined,
      model_override_enabled: modelOverrideEnabled,
      reasoning_effort: reasoningEffort,
    });
    setSaving(false);

    if (error) return toast.error(error);
    toast.success("Nova versão criada e ativada");
    loadHistory();
    loadEffectiveModel();
    onSaved();
  }, [feature.id, prompt, outputInstructions, temperature, maxTokens, modelOverrideEnabled, provider, model, reasoningEffort, taskType, onSaved, loadHistory, loadEffectiveModel]);

  const handleResetToDefaults = useCallback(() => {
    setPrompt(feature.default_feature_prompt);
    setOutputInstructions(feature.default_output_instructions);
    setTemperature(feature.default_temperature);
    setMaxTokens(feature.default_max_output_tokens);
    setModelOverrideEnabled(false);
    setProvider("openai");
    setModel("gpt-4o-mini");
    setReasoningEffort(null);
    toast.info("Valores restaurados para os padrões do sistema");
  }, [feature]);

  const label = AI_FEATURE_LABELS[feature.key] ?? feature.name;

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="w-full max-w-2xl"
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <DrawerHeader className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {label}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {feature.key}
              {(feature.active_config ?? feature.latest_config) && ` · v${(feature.active_config ?? feature.latest_config)!.version}`}
            </p>
          </div>
          <Button variant="icon" size="icon" onClick={onClose} aria-label="Fechar painel">
            <X className="h-4 w-4" />
          </Button>
        </DrawerHeader>

        {/* Body */}
        <DrawerBody className="space-y-5">
          {/* Variables info */}
          {feature.available_variables && feature.available_variables.length > 0 && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--bg-surface-muted)] p-3">
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
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--text-primary)]">Modelo</p>
              <span className="text-xs text-[var(--text-muted)]">
                Tipo: {taskType}
              </span>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`model-mode-${feature.key}`}
                  checked={!modelOverrideEnabled}
                  onChange={() => {
                    setModelOverrideEnabled(false);
                    if (effectiveModel?.source === "feature") setReasoningEffort(null);
                  }}
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
                <Field label="Provedor">
                  <div className="flex h-10 items-center rounded-[var(--radius-full)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]">
                    OpenAI
                  </div>
                </Field>
                <Field label="Modelo">
                  {providerLoading ? (
                    <div className="flex h-10 items-center gap-2 rounded-[var(--radius-full)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-muted)]">
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--brand-primary)] border-t-transparent" />
                      Carregando modelos...
                    </div>
                  ) : providerError ? (
                    <div className="rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger-text)]">
                      {providerError}
                    </div>
                  ) : (
                    <Select
                      value={model}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setModel(e.target.value);
                        setReasoningEffort(null);
                      }}
                      disabled={compatibleModels.length === 0}
                      placeholder={compatibleModels.length === 0 ? "Nenhum modelo compatível" : "Selecione..."}
                      options={compatibleModels.map((modelOption) => ({
                        value: modelOption.value,
                        label: `${modelOption.label}${!modelOption.hasPricing ? " (sem preço)" : ""}${modelOption.deprecated ? " (descontinuado)" : ""}`,
                      }))}
                    />
                  )}
                </Field>
              </div>
            )}

            {taskType !== "transcription" && reasoningProvider && reasoningModel && (
              <Field
                label="Esforço de raciocínio"
                description={supportedReasoningEfforts.length > 0
                  ? "Automático usa o nível seguro definido para o modelo e a tarefa."
                  : "Este modelo não oferece controle de esforço neste provider."}
              >
                <Select
                  value={reasoningEffort ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setReasoningEffort((e.target.value || null) as AiReasoningEffort | null);
                  }}
                  disabled={providerLoading || supportedReasoningEfforts.length === 0}
                  options={[
                    {
                      value: "",
                      label: supportedReasoningEfforts.length > 0 ? "Automático (recomendado)" : "Não disponível",
                    },
                    ...supportedReasoningEfforts.map((effort) => ({
                      value: effort,
                      label: AI_REASONING_EFFORT_LABELS[effort],
                    })),
                  ]}
                />
              </Field>
            )}

            {/* Warnings for deprecated / no-pricing models */}
            {modelOverrideEnabled && isSelectedModelDeprecated && (
              <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning-border)] bg-[var(--warning-soft)] p-2.5 text-xs text-[var(--warning-text)]">
                <AlertTriangle className="mt-0.3 h-3.5 w-3.5 shrink-0" />
                <p>Este modelo foi descontinuado pelo provedor. Considere trocar para uma versão mais recente.</p>
              </div>
            )}
            {modelOverrideEnabled && isSelectedModelWithoutPricing && !isSelectedModelDeprecated && (
              <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--info-border)] bg-[var(--info-soft)] p-2.5 text-xs text-[var(--info-text)]">
                <AlertTriangle className="mt-0.3 h-3.5 w-3.5 shrink-0" />
                <p>Preço não cadastrado para este modelo. A telemetria registrará tokens, mas o custo estimado ficará indeterminado até o preço ser configurado.</p>
              </div>
            )}

            {/* Effective model display */}
            {effectiveModel && (
              <div className="space-y-1 rounded-[var(--radius-md)] bg-[var(--bg-surface-muted)] p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted)]">Modelo efetivo</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {effectiveModel.model}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--text-muted)]">Origem</span>
                  <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${SOURCE_BADGE_CLASSES[effectiveModel.source]}`}>
                    {AI_MODEL_RESOLUTION_SOURCE_LABELS[effectiveModel.source]}
                  </span>
                </div>
                {effectiveModel.source === "ai_routing" && (
                  <p className="text-[var(--text-muted)]">
                    Funcionalidade: {feature.key.replace(".", "_")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Prompt */}
          <Field label="Prompt da funcionalidade" description="Instrução principal enviada para a IA.">
            <Textarea
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
              rows={10}
              className="font-mono text-sm"
              placeholder="Digite o prompt..."
            />
          </Field>

          {/* Output Instructions */}
          <Field label="Instruções de saída" description="Formato e regras de resposta.">
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
            <Field
              label="Temperatura"
              description={reasoningEffort && reasoningEffort !== "none"
                ? "Ignorada por este modelo enquanto o raciocínio estiver ativo."
                : `Padrão: ${feature.default_temperature}. Pode ser ignorada no modo de raciocínio automático.`}
            >
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTemperature(Number(e.target.value))}
              />
            </Field>
            <Field label="Máximo de tokens" description={`Padrão: ${feature.default_max_output_tokens}`}>
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
                    className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-surface-muted)] px-2.5 py-1.5 text-xs text-[var(--text-muted)]"
                  >
                    <span className="font-mono">v{h.version}</span>
                    {h.is_active && (
                      <span className="rounded-full bg-[var(--success-soft)] px-1.5 py-0.5 font-medium text-[var(--success-text)]">
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
              Valores padrão do sistema:
            </p>
            <div className="text-xs text-[var(--text-muted)] space-y-0.5">
              <p>Temperatura: {feature.default_temperature}</p>
              <p>Máximo de tokens: {feature.default_max_output_tokens}</p>
            </div>
          </div>
        </DrawerBody>

        {/* Footer */}
        <DrawerFooter className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleResetToDefaults}>
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {!saving && <Save className="h-4 w-4" />}
              {saving ? "Salvando..." : "Criar versão e ativar"}
            </Button>
          </div>
        </DrawerFooter>
      </div>
    </Drawer>
  );
}
