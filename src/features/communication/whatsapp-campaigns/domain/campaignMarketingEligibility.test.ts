import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  getCampaignActivationBlocker,
  getCampaignMarketingReviewBlocker,
  getCampaignMediaReadinessBlocker,
  isCampaignMarketingReviewReady,
} from './campaignMarketingEligibility';

test('blocks campaigns until both human reviews have evidence references', () => {
  assert.equal(isCampaignMarketingReviewReady({}), false);
  assert.match(getCampaignMarketingReviewBlocker({ marketing_review: {
    legal_basis_reviewed: true,
    legal_basis_reference: 'legal-review-42',
    promotion_reviewed: false,
    promotion_reference: '',
  } }) || '', /Amil/);
});

test('accepts only explicit boolean approvals with non-empty references', () => {
  const config = { marketing_review: {
    legal_basis_reviewed: true,
    legal_basis_reference: 'legal-review-42',
    promotion_reviewed: true,
    promotion_reference: 'amil-terms-2026-10',
  } };
  assert.equal(isCampaignMarketingReviewReady(config), true);
  assert.equal(isCampaignMarketingReviewReady({ marketing_review: {
    legal_basis_reviewed: 'true',
    legal_basis_reference: 'legal-review-42',
    promotion_reviewed: true,
    promotion_reference: 'amil-terms-2026-10',
  } }), false);
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

test('combines legal review and first-message media gates for activation', () => {
  assert.match(getCampaignActivationBlocker({
    id: '96da372c-b76d-4e12-a4e5-a93b6c60c084',
    audience_config: {},
  }, []) || '', /base legal/);
});
