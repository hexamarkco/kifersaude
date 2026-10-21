const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

const AMIL_OCTOBER_CAMPAIGN_IDS = new Set([
  '96da372c-b76d-4e12-a4e5-a93b6c60c084',
  '663279e5-739c-4efc-916e-cdf13142a458',
]);

export const getCampaignMarketingReviewBlocker = (audienceConfig: unknown): string | null => {
  const config = asRecord(audienceConfig);
  const review = asRecord(config?.marketing_review);
  if (review?.legal_basis_reviewed !== true || !hasText(review.legal_basis_reference)) {
    return 'Revise a finalidade e registre a referência da base legal antes de ativar.';
  }
  if (review.promotion_reviewed !== true || !hasText(review.promotion_reference)) {
    return 'Confirme os termos e a abrangência da promoção com a Amil antes de ativar.';
  }
  return null;
};

export const isCampaignMarketingReviewReady = (audienceConfig: unknown): boolean => (
  getCampaignMarketingReviewBlocker(audienceConfig) === null
);

export const getCampaignMediaReadinessBlocker = (
  campaignId: unknown,
  steps: unknown,
  abTestEnabled: unknown = false,
): string | null => {
  if (typeof campaignId !== 'string' || !AMIL_OCTOBER_CAMPAIGN_IDS.has(campaignId)) return null;
  const firstMessages = Array.isArray(steps)
    ? steps.filter((value) => {
        const step = asRecord(value);
        return step?.step_index === 0 && step.step_kind === 'message';
      }).map(asRecord).filter((step): step is Record<string, unknown> => step !== null)
    : [];
  const hasImage = (variant: string) => firstMessages.some((step) => (
    (step.variant_label === variant || step.variant_label === 'ANY')
    && step.media_type === 'image'
    && hasText(step.media_url)
  ));
  const ready = abTestEnabled === true
    ? hasImage('A') && hasImage('B')
    : hasImage('A');
  return ready ? null : 'Anexe a imagem da promoção à primeira mensagem antes de ativar esta campanha.';
};

export const getCampaignActivationBlocker = (campaign: unknown, steps: unknown): string | null => {
  const value = asRecord(campaign);
  const reviewBlocker = getCampaignMarketingReviewBlocker(value?.audience_config);
  if (reviewBlocker) return reviewBlocker;
  return getCampaignMediaReadinessBlocker(value?.id, steps, value?.ab_test_enabled);
};
