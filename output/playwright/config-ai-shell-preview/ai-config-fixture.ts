const stamp = '2026-10-30T12:00:00.000Z';

function makeConfig(id: string, featureId: string, version: number, active: boolean) {
  return {
    id,
    feature_id: featureId,
    version,
    feature_prompt: 'Use o contexto da conversa para produzir uma resposta clara e acolhedora.',
    output_instructions: 'Responda em português brasileiro, com objetividade e cordialidade.',
    temperature: 0.4,
    max_output_tokens: 700,
    provider: 'openai' as const,
    model: 'gpt-4o-mini',
    model_override_enabled: true,
    reasoning_effort: 'low' as const,
    is_active: active,
    created_by: 'operator-demo',
    created_at: stamp,
  };
}

const rawFeatures = [
  { id: 'feature-rewrite', key: 'message.rewrite', name: 'Reescrita de mensagem', category: 'messaging', description: 'Sugere versões mais claras antes do envio.', enabled: true, task_type: 'text' as const, available_variables: ['mensagem'], default_feature_prompt: 'Reescreva a mensagem com clareza.', default_output_instructions: '', default_temperature: 0.4, default_max_output_tokens: 700 },
  { id: 'feature-suggest', key: 'message.suggest', name: 'Sugestão de resposta', category: 'messaging', description: 'Sugere respostas a partir do contexto da conversa.', enabled: true, task_type: 'text' as const, available_variables: ['conversa'], default_feature_prompt: 'Sugira uma resposta com base no contexto.', default_output_instructions: '', default_temperature: 0.4, default_max_output_tokens: 700 },
  { id: 'feature-transcribe', key: 'audio.transcribe', name: 'Transcrição de áudio', category: 'transcription', description: 'Converte áudios recebidos em texto.', enabled: true, task_type: 'transcription' as const, available_variables: ['audio'], default_feature_prompt: 'Transcreva o áudio fielmente.', default_output_instructions: '', default_temperature: 0, default_max_output_tokens: 1200 },
  { id: 'feature-campaign', key: 'campaign.intent', name: 'Classificação de intenção', category: 'campaign', description: 'Identifica o interesse demonstrado na conversa.', enabled: true, task_type: 'structured_output' as const, available_variables: ['mensagem'], default_feature_prompt: 'Classifique a intenção com base na mensagem.', default_output_instructions: 'Retorne somente os campos previstos.', default_temperature: 0.2, default_max_output_tokens: 500 },
  { id: 'feature-followup', key: 'followup.generate', name: 'Gerar follow-up', category: 'followup', description: 'Prepara uma sugestão de acompanhamento comercial.', enabled: true, task_type: 'text' as const, available_variables: ['lead'], default_feature_prompt: 'Sugira um follow-up útil.', default_output_instructions: '', default_temperature: 0.4, default_max_output_tokens: 700 },
  { id: 'feature-autonomous', key: 'autonomous.reply', name: 'Resposta autônoma', category: 'autonomous', description: 'Responde somente quando a automação autorizada estiver ativa.', enabled: true, task_type: 'text' as const, available_variables: ['conversa'], default_feature_prompt: 'Responda de forma segura.', default_output_instructions: '', default_temperature: 0.3, default_max_output_tokens: 600 },
  { id: 'feature-contract', key: 'contract.document_extract', name: 'Leitura de documentos de contrato', category: 'contratos', description: 'Extrai dados de documentos enviados à operação.', enabled: false, task_type: 'structured_output' as const, available_variables: ['documento'], default_feature_prompt: 'Extraia os campos solicitados.', default_output_instructions: '', default_temperature: 0, default_max_output_tokens: 1200 },
].map((feature) => ({
  ...feature,
  created_at: stamp,
  active_config: feature.id === 'feature-followup' ? null : makeConfig(`${feature.id}-config`, feature.id, 2, feature.enabled),
  latest_config: feature.id === 'feature-followup' ? makeConfig(`${feature.id}-config`, feature.id, 1, false) : makeConfig(`${feature.id}-config`, feature.id, 2, feature.enabled),
  config_count: feature.id === 'feature-followup' ? 1 : 2,
}));

const globalConfigs = [
  { id: 'global-instructions', key: 'global_instructions', value: 'Respeite o contexto da conversa e use linguagem clara.', description: 'Diretrizes gerais', updated_by: null, updated_at: stamp },
  { id: 'global-style', key: 'global_style', value: 'Tom cordial, objetivo e acolhedor.', description: 'Estilo padrão', updated_by: null, updated_at: stamp },
];

const modelCatalog = [
  { id: 'model-mini', provider: 'openai' as const, model: 'gpt-4o-mini', display_name: 'GPT-4o mini', capabilities: ['text', 'structured_output', 'reasoning', 'multimodal'] as const, active: true, deprecated_at: null, created_at: stamp, updated_at: stamp, has_pricing: true, input_per_million: 0.15, output_per_million: 0.6 },
  { id: 'model-transcribe', provider: 'openai' as const, model: 'gpt-4o-mini-transcribe', display_name: 'GPT-4o mini transcribe', capabilities: ['transcription'] as const, active: true, deprecated_at: null, created_at: stamp, updated_at: stamp, has_pricing: true, input_per_million: null, output_per_million: null },
];

function blockedWrite(operation: string): never {
  throw new Error(`Ação de gravação bloqueada na prévia local: ${operation}`);
}

function shouldFail(scope: string) {
  return window.localStorage.getItem('config-ai-failure') === scope || window.localStorage.getItem('config-ai-failure') === 'all';
}

async function waitForFixture() {
  const delay = Number(window.localStorage.getItem('config-ai-delay') ?? 0);
  if (Number.isFinite(delay) && delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));
}

export const aiConfigService = {
  async fetchFeaturesWithConfigs() { await waitForFixture(); return shouldFail('features') ? { data: null, error: 'Falha sintética de consulta.' } : { data: rawFeatures, error: null }; },
  async fetchGlobalConfigs() { await waitForFixture(); return shouldFail('global') ? { data: null, error: 'Falha sintética de consulta.' } : { data: globalConfigs, error: null }; },
  async fetchModelCatalog() { return { data: modelCatalog, error: null }; },
  async fetchAvailableModels() { return { data: modelCatalog.filter((model) => model.active), error: null }; },
  async fetchRoutingSettings() { return { data: { rewrite_message: { provider: 'openai', model: 'gpt-4o-mini' } }, error: null }; },
  async fetchProviderModels() { return { data: [{ value: 'gpt-4o-mini', label: 'GPT-4o mini', reasoningEfforts: ['low', 'medium', 'high'] }, { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o mini transcribe', reasoningEfforts: [] }], error: null }; },
  async fetchEffectiveModel() { return { data: { provider: 'openai', model: 'gpt-4o-mini', source: 'ai_routing', sourceLabel: 'Modelo escolhido para a tarefa' }, error: null }; },
  async fetchConfigHistory(featureId: string) { return { data: [makeConfig(`${featureId}-v2`, featureId, 2, true), makeConfig(`${featureId}-v1`, featureId, 1, false)], error: null }; },
  async validateModelOverride() { return { valid: true }; },
  async deactivateConfig() { return blockedWrite('desativar versão'); },
  async activateConfig() { return blockedWrite('ativar versão'); },
  async updateGlobalConfig() { return blockedWrite('salvar configuração global'); },
  async createConfig() { return blockedWrite('criar versão'); },
};
