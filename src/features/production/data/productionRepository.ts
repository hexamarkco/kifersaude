import { databaseClient } from '../../../infrastructure/supabase';
import type { ProductionOperator, ProductionReport } from '../domain/types';

export async function loadProductionOperators(): Promise<ProductionOperator[]> {
  const { data, error } = await databaseClient.from('production_operators').select('user_id,display_name,active').eq('active', true).order('display_name');
  if (error) throw error;
  return data ?? [];
}

export async function loadProductionReport(start: string, end: string, operator: string, offset: number): Promise<ProductionReport> {
  const { data, error } = await databaseClient.rpc('team_production_report', { p_start: start, p_end: end, p_operator: operator || undefined, p_offset: offset });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !('summary' in data)) throw new Error('Relatório de produção indisponível.');
  return data as unknown as ProductionReport;
}

export async function activateProduction() {
  const { error } = await databaseClient.rpc('activate_team_production');
  if (error) throw error;
}
