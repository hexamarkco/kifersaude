import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  buildWhatsAppCampaignConditionFieldDefinitions,
  createWhatsAppCampaignCondition,
  formatWhatsAppCampaignStepDelay,
  getWhatsAppCampaignStepDelayMs,
  matchesWhatsAppCampaignConditionGroup,
  normalizeWhatsAppCampaignFlowSteps,
} from '../whatsappCampaignFlow';

test('normalizes WhatsApp flow steps with delay and conditions', () => {
  const steps = normalizeWhatsAppCampaignFlowSteps(
    [
      {
        type: 'text',
        text: 'Oi {{nome}}',
        delayValue: 2,
        delayUnit: 'days',
        conditionLogic: 'any',
        conditions: [
          {
            field: 'lead.status',
            operator: 'equals',
            value: 'Novo',
          },
        ],
      },
    ],
    'fallback',
    () => 'step-normalized',
    () => 'condition-normalized',
  );

  assert.equal(steps.length, 1);
  assert.equal(steps[0]?.id, 'step-normalized');
  assert.equal(steps[0]?.delayValue, 2);
  assert.equal(steps[0]?.delayUnit, 'days');
  assert.equal(steps[0]?.conditionLogic, 'any');
  assert.equal(steps[0]?.conditions?.[0]?.id, 'condition-normalized');
});

test('evaluates lead, payload and reply-aware conversation conditions', () => {
  const matches = matchesWhatsAppCampaignConditionGroup(
    [
      { id: '1', field: 'lead.status', operator: 'equals', value: 'Novo' },
      { id: '2', field: 'payload.plano', operator: 'equals', value: 'Premium' },
      { id: '3', field: 'conversation.has_inbound_since_last_step', operator: 'equals', value: 'false' },
    ],
    'all',
    {
      lead: { status: 'novo' },
      payload: { plano: 'premium' },
      conversation: { hasInboundSinceLastStep: false },
    },
  );

  assert.equal(matches, true);
});

test('fails reply-aware condition when contact already answered', () => {
  const matches = matchesWhatsAppCampaignConditionGroup(
    [{ id: '1', field: 'conversation.has_inbound_since_last_step', operator: 'equals', value: 'false' }],
    'all',
    {
      conversation: { hasInboundSinceLastStep: true },
    },
  );

  assert.equal(matches, false);
});

test('builds dynamic payload field catalog and step delay labels', () => {
  const definitions = buildWhatsAppCampaignConditionFieldDefinitions({
    payloadKeys: ['plano', 'cidade_preferida'],
    canalOptions: ['WhatsApp'],
  });
  const payloadDefinition = definitions.find((definition) => definition.key === 'payload.cidade_preferida');
  const created = createWhatsAppCampaignCondition(definitions, 'conversation.has_inbound_since_last_step', () => 'condition-1');

  assert.equal(payloadDefinition?.label, 'CSV: Cidade Preferida');
  assert.equal(created.field, 'conversation.has_inbound_since_last_step');
  assert.equal(created.value, 'false');
  assert.equal(getWhatsAppCampaignStepDelayMs({ delayValue: 2, delayUnit: 'days' }), 2 * 24 * 60 * 60 * 1000);
  assert.equal(formatWhatsAppCampaignStepDelay({ delayValue: 2, delayUnit: 'days' }), '2 dias');
});
