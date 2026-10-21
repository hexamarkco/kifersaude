export type CampaignMarketingReview = {
  legal_basis_reviewed?: unknown;
  legal_basis_reference?: unknown;
  promotion_reviewed?: unknown;
  promotion_reference?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const nonEmptyText = (value: unknown): boolean => (
  typeof value === 'string' && value.trim().length > 0
);

export const isCampaignMarketingReviewReady = (audienceConfig: unknown): boolean => {
  const config = asRecord(audienceConfig);
  const review = asRecord(config?.marketing_review) as CampaignMarketingReview | null;
  return review?.legal_basis_reviewed === true
    && nonEmptyText(review.legal_basis_reference)
    && review.promotion_reviewed === true
    && nonEmptyText(review.promotion_reference);
};

export const getCampaignMarketingReviewBlocker = (audienceConfig: unknown): string | null => {
  const config = asRecord(audienceConfig);
  const review = asRecord(config?.marketing_review) as CampaignMarketingReview | null;
  if (review?.legal_basis_reviewed !== true || !nonEmptyText(review.legal_basis_reference)) {
    return 'Revise a finalidade e registre a referência da base legal antes de ativar.';
  }
  if (review.promotion_reviewed !== true || !nonEmptyText(review.promotion_reference)) {
    return 'Confirme os termos e a abrangência da promoção com a Amil antes de ativar.';
  }
  return null;
};

export type CampaignMarketingContactEvidence = {
  status?: unknown;
  purpose?: unknown;
  legal_basis?: unknown;
  evidence_reference?: unknown;
};

export const isCampaignMarketingContactEvidenceReady = (
  permissionState: unknown,
  evidence: unknown,
  campaignId: string,
): boolean => {
  if (permissionState !== 'allowed' || !campaignId) return false;
  const root = asRecord(evidence);
  const byCampaign = asRecord(root?.campaign_marketing_eligibility);
  const campaignEvidence = asRecord(byCampaign?.[campaignId]) as CampaignMarketingContactEvidence | null;
  return campaignEvidence?.status === 'approved'
    && campaignEvidence.purpose === 'marketing'
    && nonEmptyText(campaignEvidence.legal_basis)
    && nonEmptyText(campaignEvidence.evidence_reference);
};
