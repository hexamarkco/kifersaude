import { describe, expect, it } from 'vitest';
import { campaignCopyLabels, normalizeMcpCampaignStages, resolveCampaignCopySteps } from '../campaign-sequence-v2';

describe('MCP campaign variation sequences v2', () => {
  it('serializa cada balão individualmente, com tamanhos diferentes por copy e follow-up em dias', () => {
    const sequence = normalizeMcpCampaignStages([
      {
        variations: {
          A: ['A-1', 'A-2', 'A-3'],
          B: ['B-1', 'B-2'],
          C: ['C-1'],
        },
      },
      {
        delay_amount: 3, delay_unit: 'days',
        variations: { A: ['A-retorno'], B: ['B-retorno'], C: ['C-retorno'] },
      },
    ]);
    expect(sequence.ok).toBe(true);
    if (!sequence.ok) return;
    expect(sequence.variants).toEqual(['A', 'B', 'C']);
    expect(sequence.firstMessage).toBe('A-1');
    expect(sequence.steps.map((row) => [row.step_index, row.variant_label, row.message])).toEqual([
      [0, 'A', 'A-1'], [0, 'B', 'B-1'], [0, 'C', 'C-1'],
      [1, 'A', 'A-2'], [1, 'B', 'B-2'],
      [2, 'A', 'A-3'],
      [3, 'A', 'A-retorno'], [3, 'B', 'B-retorno'], [3, 'C', 'C-retorno'],
    ]);
    expect(sequence.steps.filter((row) => row.step_index === 3).map((row) => row.delay_amount)).toEqual([3, 3, 3]);
    const steps = sequence.steps.map((row) => ({ ...row, message_text: row.message }));
    expect(resolveCampaignCopySteps(steps, 'B', true).map((row) => row.message_text))
      .toEqual(['B-1', 'B-2', 'B-retorno']);
    expect(resolveCampaignCopySteps(steps, 'C', true).map((row) => row.message_text))
      .toEqual(['C-1', 'C-retorno']);
  });

  it('converte cada quebra de linha em um balão somente quando solicitado', () => {
    const split = normalizeMcpCampaignStages([{
      split_by_line_breaks: true,
      variations: { A: ['Oi\n\nTudo bem?\nVamos conversar?'], B: ['Bom dia\nPodemos falar?'] },
    }]);
    expect(split.ok).toBe(true);
    if (split.ok) expect(split.steps.map((row) => row.message)).toEqual([
      'Oi', 'Bom dia', 'Tudo bem?', 'Podemos falar?', 'Vamos conversar?',
    ]);
  });

  it('rejeita letras não contíguas, duplicidade de posições e sequências longas', () => {
    expect(normalizeMcpCampaignStages([{ variations: { A: ['a'], C: ['c'] } }]).toMatchObject({ ok: false });
    expect(normalizeMcpCampaignStages([{ variations: { A: ['a'], B: ['b'] } }, { variations: { A: ['a'] } }])).toMatchObject({ ok: false });
    expect(normalizeMcpCampaignStages([{ variations: { A: new Array(30).fill('x'), B: new Array(30).fill('y') } }, { variations: { A: ['a'], B: ['b'] } }])).toMatchObject({ ok: false });
    expect(normalizeMcpCampaignStages([{ variations: { A: [''], B: ['b'] } }])).toMatchObject({ ok: false });
  });

  it('mantém a leitura legada com ANY, mas não herda indevidamente A no modo novo', () => {
    const physical = [
      { step_index: 0, variant_label: 'A', message_text: 'A-1' },
      { step_index: 0, variant_label: 'B', message_text: 'B-1' },
      { step_index: 1, variant_label: 'A', message_text: 'A-2' },
      { step_index: 2, variant_label: 'ANY', message_text: 'Comum' },
    ];
    expect(campaignCopyLabels(physical)).toEqual(['A', 'B']);
    expect(resolveCampaignCopySteps(physical, 'B', true).map((row) => row.message_text)).toEqual(['B-1', 'Comum']);
    expect(resolveCampaignCopySteps(physical, 'B', false).map((row) => row.message_text)).toEqual(['B-1', 'A-2', 'Comum']);
  });
});
