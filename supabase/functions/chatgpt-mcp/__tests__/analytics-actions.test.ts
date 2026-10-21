import { describe, expect, it, vi } from 'vitest';
import {
  buildMcpCommissionCalendar,
  executeMcpAnalyticsReadAction,
  executeMcpAnalyticsWriteAction,
  MCP_ANALYTICS_READ_TOOL_NAMES,
  MCP_ANALYTICS_TOOLS,
} from '../analytics-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';

describe('MCP analytics capabilities', () => {
  it('publishes read tools for production and commission views and one audited activation action', () => {
    expect(MCP_ANALYTICS_READ_TOOL_NAMES).toEqual([
      'kifer_get_team_production_report',
      'kifer_get_commission_calendar',
      'kifer_list_commission_contracts',
    ]);
    expect(MCP_ANALYTICS_TOOLS.find((tool) => tool.name === 'kifer_activate_team_production')?.annotations?.readOnlyHint).toBe(false);
  });

  it('validates the production report range and returns the stored RPC projection', async () => {
    const report = { started_at: '2026-10-01T10:00:00Z', summary: [], events: [], total_events: 0 };
    const rpc = vi.fn().mockResolvedValue({ data: report, error: null });
    const supabase = { rpc } as never;
    const result = await executeMcpAnalyticsReadAction({
      supabase,
      toolName: 'kifer_get_team_production_report',
      arguments: { start_date: '2026-10-20', end_date: '2026-10-21', offset: 50 },
    });

    expect(result).toEqual({ success: true, report });
    expect(rpc).toHaveBeenCalledWith('team_production_report', {
      p_start: '2026-10-20', p_end: '2026-10-21', p_operator: null, p_offset: 50,
    });
    const invalid = await executeMcpAnalyticsReadAction({
      supabase,
      toolName: 'kifer_get_team_production_report',
      arguments: { start_date: '2026-02-30', end_date: '2026-10-21' },
    });
    expect(invalid).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('matches the CRM commission calendar rules for installments, bonuses and date windows', async () => {
    const calendar = await buildMcpCommissionCalendar([
      {
        id: 'contract-1', codigo_contrato: 'KFS-1', operadora: 'Plano A',
        previsao_recebimento_comissao: '2026-10-20', comissao_prevista: 1000,
        comissao_recebimento_adiantado: false,
        comissao_parcelas: [{ percentual: 40, valor: null, data_pagamento: '2026-10-20' }, { percentual: 60, valor: null, data_pagamento: '2026-11-20' }],
        bonus_por_vida_configuracoes: [{ quantidade: 2, valor: 25 }], previsao_pagamento_bonificacao: '2026-10-21',
      },
    ], '2026-10-20', '2026-10-31');

    expect(calendar).toMatchObject({
      totals: { commission: 400, bonus: 50 },
      event_count: 2,
      events: [
        { date: '2026-10-20', type: 'comissao', value: 400, installment_index: 1, installment_count: 2 },
        { date: '2026-10-21', type: 'bonificacao', value: 50 },
      ],
    });
  });

  it('activates production through the actor-bound RPC and records only the safe result', async () => {
    const insertAudit = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert: insertAudit });
    const rpc = vi.fn().mockResolvedValue({ data: '2026-10-21T12:00:00Z', error: null });
    const result = await executeMcpAnalyticsWriteAction({
      supabase: { rpc, from } as never,
      toolName: 'kifer_activate_team_production',
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
    });

    expect(result).toEqual({ success: true, started_at: '2026-10-21T12:00:00Z' });
    expect(rpc).toHaveBeenCalledWith('mcp_activate_team_production', { p_actor_user_id: actorId });
    expect(insertAudit.mock.calls[0]?.[0]).toMatchObject({ tool_name: 'kifer_activate_team_production', success: true, actor_id: actorId });
  });
});
