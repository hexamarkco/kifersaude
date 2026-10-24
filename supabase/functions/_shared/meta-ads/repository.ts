import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { MetaError, isRecord, type MetaConfig } from './domain.ts';

export function createMetaRepository(client: SupabaseClient, graphVersion: string) {
  async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await client.rpc(name, args);
    if (error) {
      const known = ['LEASE_LOST','ORIGIN_MISMATCH','MISSING_CONTACT_FIELDS','AMBIGUOUS_CONTACT','LEAD_DEFAULTS_MISSING'];
      const code = known.find((item) => error.message === item);
      throw new MetaError(code ?? 'DATABASE_UNAVAILABLE', !code);
    }
    return data as T;
  }
  async function config(): Promise<MetaConfig> {
    const { data, error } = await client.from('integration_settings').select('settings').eq('slug','facebook_ads_manager').single();
    if (error || !isRecord(data?.settings)) throw new MetaError('CONFIG_UNAVAILABLE', true);
    const settings = data.settings;
    return {
      enabled: settings.enabled === true,
      pageId: typeof settings.pageId === 'string' ? settings.pageId : '',
      formId: typeof settings.formId === 'string' ? settings.formId : '',
      commercialField: typeof settings.commercialField === 'string' ? settings.commercialField : '',
      graphVersion,
    };
  }
  return { rpc, config };
}
