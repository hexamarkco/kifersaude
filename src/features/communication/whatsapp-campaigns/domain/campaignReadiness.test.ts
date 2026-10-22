import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  getCampaignActivationBlocker,
  getCampaignMediaReadinessBlocker,
} from './campaignReadiness';

test('campaign activation does not require marketing authorization review', () => {
  assert.equal(getCampaignActivationBlocker({ id: 'other-campaign', audience_config: {} }, []), null);
});

test('keeps the Amil October image pending until attached to message one', () => {
  const campaignId = '96da372c-b76d-4e12-a4e5-a93b6c60c084';
  assert.match(getCampaignMediaReadinessBlocker(campaignId, []) || '', /Anexe a imagem/);
  assert.equal(getCampaignMediaReadinessBlocker('another-campaign', []), null);
  assert.equal(getCampaignMediaReadinessBlocker(campaignId, [{
    step_index: 0,
    step_kind: 'message',
    variant_label: 'ANY',
    media_type: 'image',
    media_url: 'storage://whatsapp-campaign-media/test/placeholder.png',
  }]), null);
});

test('requires the effective first-message image for every A/B variant', () => {
  const campaignId = '96da372c-b76d-4e12-a4e5-a93b6c60c084';
  const sharedImage = {
    step_index: 0,
    step_kind: 'message',
    variant_label: 'ANY',
    media_type: 'image',
    media_url: 'storage://whatsapp-campaign-media/test/placeholder.png',
  };
  const variantText = (variant_label: 'A' | 'B') => ({
    step_index: 0,
    step_kind: 'message',
    variant_label,
    media_type: null,
    media_url: null,
  });

  assert.match(getCampaignMediaReadinessBlocker(campaignId, [sharedImage, variantText('A')]) || '', /Anexe a imagem/);
  assert.match(getCampaignMediaReadinessBlocker(campaignId, [sharedImage, variantText('B')], true) || '', /Anexe a imagem/);
  assert.equal(getCampaignMediaReadinessBlocker(campaignId, [
    { ...sharedImage, variant_label: 'A' },
    { ...sharedImage, variant_label: 'B' },
  ], true), null);
});

test('keeps the first-message image as the Amil activation gate', () => {
  assert.match(getCampaignActivationBlocker({
    id: '96da372c-b76d-4e12-a4e5-a93b6c60c084',
    audience_config: {},
  }, []) || '', /Anexe a imagem/);
});
