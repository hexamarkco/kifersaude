import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  getCampaignMarketingReviewBlocker,
  isCampaignMarketingContactEvidenceReady,
  isCampaignMarketingReviewReady,
} from '../campaign-marketing-eligibility';

const campaignId = 'campaign-amil-october-2026';

test('campaign readiness requires explicit legal-purpose and promotion reviews with references', () => {
  assert.equal(isCampaignMarketingReviewReady({}), false);
  assert.equal(isCampaignMarketingReviewReady({ marketing_review: {
    legal_basis_reviewed: true,
    legal_basis_reference: 'LGPD review ticket',
    promotion_reviewed: true,
    promotion_reference: 'Amil terms confirmation',
  } }), true);
  assert.match(getCampaignMarketingReviewBlocker({ marketing_review: {
    legal_basis_reviewed: true,
    legal_basis_reference: 'LGPD review ticket',
    promotion_reviewed: false,
    promotion_reference: '',
  } }) ?? '', /Amil/);
});

test('a valid WhatsApp endpoint with unknown permission is not marketing eligible', () => {
  assert.equal(isCampaignMarketingContactEvidenceReady('unknown', {}, campaignId), false);
  assert.equal(isCampaignMarketingContactEvidenceReady('allowed', {}, campaignId), false);
  assert.equal(isCampaignMarketingContactEvidenceReady('allowed', {
    campaign_marketing_eligibility: {
      [campaignId]: {
        status: 'approved',
        purpose: 'marketing',
        legal_basis: 'documented basis',
        evidence_reference: 'review-42',
      },
    },
  }, campaignId), true);
});

test('campaign-specific evidence cannot be reused for a different campaign or purpose', () => {
  const evidence = {
    campaign_marketing_eligibility: {
      [campaignId]: {
        status: 'approved',
        purpose: 'service_reply',
        legal_basis: 'documented basis',
        evidence_reference: 'review-42',
      },
    },
  };
  assert.equal(isCampaignMarketingContactEvidenceReady('allowed', evidence, 'another-campaign'), false);
  assert.equal(isCampaignMarketingContactEvidenceReady('allowed', evidence, campaignId), false);
});
