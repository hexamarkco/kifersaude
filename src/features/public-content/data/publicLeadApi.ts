import { databaseClient } from '../../../infrastructure/supabase';

export type PublicLeadSubmission = {
  name: string;
  phone: string;
  city: string;
  contractType: 'PF' | 'MEI' | 'CNPJ';
  totalLives: number;
  ageSummary:
    | { type: 'single'; age: number }
    | { type: 'ranges'; counts: Record<string, number> };
  website: string;
};

export async function loadPublicHomeMetrics(): Promise<unknown[]> {
  const { data, error } = await databaseClient.functions.invoke('public-home-metrics');
  if (error) throw error;

  if (!data || typeof data !== 'object' || !Array.isArray(data.metrics)) {
    return [];
  }

  return data.metrics as unknown[];
}

export async function submitPublicLead(payload: PublicLeadSubmission): Promise<void> {
  const { error } = await databaseClient.functions.invoke('public-lead-submit', {
    body: payload,
  });
  if (error) throw error;
}
