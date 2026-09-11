import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

import { sha256 } from './pdf.ts';
import type { ContractDocumentExtraction } from './domain.ts';
import type { DocumentClassification, TextQuality } from './engine/types.ts';

export const CONTRACT_PARSER_VERSION = '2.0.1';
export const CONTRACT_PROMPT_VERSION = '2.0.1';

export const buildExtractionCacheKey = async (params: {
  hashes: string[];
  profile: string;
  model: string;
}) => sha256(new TextEncoder().encode(JSON.stringify({
  hashes: [...params.hashes].sort(),
  profile: params.profile,
  parser: CONTRACT_PARSER_VERSION,
  prompt: CONTRACT_PROMPT_VERSION,
  model: params.model,
})));

export const readCachedExtraction = async (
  supabaseAdmin: SupabaseClient,
  cacheKey: string,
): Promise<ContractDocumentExtraction | null> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('contract_document_extraction_cache')
      .select('extraction')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data?.extraction || typeof data.extraction !== 'object') return null;
    return data.extraction as ContractDocumentExtraction;
  } catch {
    return null;
  }
};

export const writeCachedExtraction = async (params: {
  supabaseAdmin: SupabaseClient;
  cacheKey: string;
  model: string;
  extraction: ContractDocumentExtraction;
}) => {
  try {
    const now = new Date();
    await params.supabaseAdmin
      .from('contract_document_extraction_cache')
      .delete()
      .lt('expires_at', now.toISOString());
    await params.supabaseAdmin
      .from('contract_document_extraction_cache')
      .upsert({
        cache_key: params.cacheKey,
        parser_version: CONTRACT_PARSER_VERSION,
        prompt_version: CONTRACT_PROMPT_VERSION,
        model: params.model,
        extraction: params.extraction,
        metadata: params.extraction.metadata,
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: 'cache_key' });
  } catch {
    // Cache is an optimization and must not break extraction during staged rollout.
  }
};

const worstTextQuality = (classifications: DocumentClassification[]): TextQuality => {
  const rank: Record<TextQuality, number> = { good: 3, partial: 2, poor: 1, none: 0 };
  return classifications.reduce<TextQuality>((worst, item) => (
    rank[item.document.textQuality] < rank[worst] ? item.document.textQuality : worst
  ), 'good');
};

export const logExtractionRun = async (params: {
  supabaseAdmin: SupabaseClient;
  classifications: DocumentClassification[];
  candidatePagesCount: number;
  pagesSentToLlm: number;
  extraction: ContractDocumentExtraction;
  fallbackReason: string | null;
  usage: {
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
    reasoningTokens: number | null;
    totalTokens: number | null;
  };
  durationMs: number;
  provider: string | null;
  model: string | null;
  estimatedCostUsd: number | null;
  retryCount: number;
}) => {
  try {
    const metadata = params.extraction.metadata;
    const states = Object.values(params.extraction.fieldStates);
    await params.supabaseAdmin.from('contract_document_extraction_runs').insert({
      document_family: metadata.documentFamily,
      document_type: metadata.documentType,
      document_roles: metadata.documentRoles,
      operator: metadata.operator,
      administrator: metadata.administrator,
      support_status: metadata.supportStatus,
      number_of_files: params.classifications.length,
      total_pages: params.classifications.reduce((sum, item) => sum + item.document.pages.length, 0),
      candidate_pages_count: params.candidatePagesCount,
      pages_sent_to_llm: params.pagesSentToLlm,
      text_extraction_success: params.classifications.every((item) => !item.document.extractionError),
      text_quality: worstTextQuality(params.classifications),
      bundle_complete: metadata.bundleComplete,
      used_llm: metadata.usedLlm,
      used_vision: metadata.usedVision,
      fallback_reason: params.fallbackReason,
      input_tokens: params.usage.inputTokens,
      cached_tokens: params.usage.cachedInputTokens,
      output_tokens: params.usage.outputTokens,
      reasoning_tokens: params.usage.reasoningTokens,
      total_tokens: params.usage.totalTokens,
      estimated_cost_usd: params.estimatedCostUsd,
      retry_count: params.retryCount,
      duration_ms: params.durationMs,
      fields_resolved: states.filter((state) => state === 'resolved').length,
      fields_missing: states.filter((state) => state === 'missing').length,
      fields_ambiguous: states.filter((state) => state === 'ambiguous').length,
      fields_conflicting: states.filter((state) => state === 'conflicting').length,
      cache_hit: metadata.cacheHit,
      parser_version: CONTRACT_PARSER_VERSION,
      prompt_version: CONTRACT_PROMPT_VERSION,
      provider: params.provider,
      model: params.model,
    });
  } catch {
    // Telemetry is intentionally best effort and contains no extracted values.
  }
};
