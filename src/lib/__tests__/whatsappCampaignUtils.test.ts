import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  analyzeCsvAudience,
  canRequeueCampaignTarget,
  clampCompletedCampaignStepIndex,
  getCampaignIdsReadyToAutoStart,
  isCampaignTargetReadyForProcessing,
  normalizePhoneForCampaign,
  parseCampaignCsvText,
  resolveCampaignTemplateText,
} from '../whatsappCampaignUtils';

test('parses CSV with BOM, semicolon, quotes and multiline fields', () => {
  const csv = '\uFEFFnome;telefone;plano\n"Ana";"21999999999";"Premium"\n"Bruno";"21988888888";"Linha 1\nLinha 2"';
  const parsed = parseCampaignCsvText(csv);

  assert.equal(parsed.delimiter, ';');
  assert.deepEqual(parsed.normalizedHeaders, ['nome', 'telefone', 'plano']);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[1]?.values.plano, 'Linha 1\nLinha 2');
});

test('resolves built-in and CSV variables while preserving unknown tokens', () => {
  const resolved = resolveCampaignTemplateText('Oi {{nome}}, plano {{plano}}. Falar com {{responsavel}} e {{token_inexistente}}.', {
    payload: { nome: 'Ana Souza', plano: 'Premium' },
    lead: { nome_completo: 'Outro Nome', responsavel: 'Nick' },
    now: new Date('2026-03-12T13:00:00Z'),
  });

  assert.equal(resolved, 'Oi Ana Souza, plano Premium. Falar com Nick e {{token_inexistente}}.');
});

test('resolves empty known variables to empty string', () => {
  const resolved = resolveCampaignTemplateText('Plano: {{plano}} / Status: {{status}}', {
    payload: { plano: '' },
    lead: { status: null },
  });

  assert.equal(resolved, 'Plano:  / Status: ');
});

test('analyzes CSV audience with deduplication, existing leads and missing name for new leads', () => {
  const parsed = parseCampaignCsvText('nome,telefone,plano\nAna,21999999999,Premium\n,21988888888,Basico\nAna 2,21999999999,Plus');
  const analysis = analyzeCsvAudience({
    rows: parsed.rows,
    phoneColumnKey: 'telefone',
    nameColumnKey: 'nome',
    existingLeads: [{ id: 'lead-1', nome_completo: 'Contato Existente', telefone: '(21) 99999-9999' }],
  });

  assert.equal(analysis.summary.validRows, 1);
  assert.equal(analysis.summary.existingLeadRows, 1);
  assert.equal(analysis.summary.newLeadRows, 0);
  assert.equal(analysis.summary.missingNameRows, 1);
  assert.equal(analysis.summary.duplicateRows, 1);
});

test('collects campaigns ready to auto start and exposes requeue status helper', () => {
  const readyIds = getCampaignIdsReadyToAutoStart(
    [
      { id: '1', status: 'draft', scheduled_at: '2026-03-12T09:00:00.000Z' },
      { id: '2', status: 'draft', scheduled_at: '2026-03-13T09:00:00.000Z' },
      { id: '3', status: 'running', scheduled_at: '2026-03-11T09:00:00.000Z' },
    ],
    new Date('2026-03-12T12:00:00.000Z'),
  );

  assert.deepEqual(readyIds, ['1']);
  assert.equal(canRequeueCampaignTarget('failed'), true);
  assert.equal(canRequeueCampaignTarget('invalid'), false);
});

test('detects recoverable processing targets and clamps completed step index', () => {
  const now = new Date('2026-03-19T20:00:00.000Z');

  assert.equal(
    isCampaignTargetReadyForProcessing(
      {
        status: 'processing',
        processing_expires_at: '2026-03-19T19:55:00.000Z',
        last_attempt_at: '2026-03-19T19:54:00.000Z',
      },
      now,
    ),
    true,
  );

  assert.equal(
    isCampaignTargetReadyForProcessing(
      {
        status: 'processing',
        processing_expires_at: '2026-03-19T20:05:00.000Z',
        last_attempt_at: '2026-03-19T19:59:00.000Z',
      },
      now,
    ),
    false,
  );

  assert.equal(
    isCampaignTargetReadyForProcessing(
      {
        status: 'processing',
        processing_expires_at: null,
        last_attempt_at: '2026-03-19T19:40:00.000Z',
      },
      now,
    ),
    true,
  );

  assert.equal(clampCompletedCampaignStepIndex(undefined, 3), -1);
  assert.equal(clampCompletedCampaignStepIndex(5, 3), 2);
  assert.equal(clampCompletedCampaignStepIndex(-4, 3), -1);
});

test('normalizes campaign phones before dedupe and target creation', () => {
  assert.equal(normalizePhoneForCampaign('(11) 99876-5432'), '5511998765432');
  assert.equal(normalizePhoneForCampaign('551198765432'), '551198765432');
  assert.equal(normalizePhoneForCampaign('invalid'), '');
});
