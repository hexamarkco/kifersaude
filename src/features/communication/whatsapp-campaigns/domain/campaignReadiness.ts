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
  const hasEffectiveImage = (variant: 'A' | 'B') => {
    const exactVariant = firstMessages.find((step) => step.variant_label === variant);
    const sharedStep = firstMessages.find((step) => step.variant_label === 'ANY');
    const fallbackVariant = firstMessages.find((step) => step.variant_label === 'A');
    const effectiveStep = exactVariant || sharedStep || fallbackVariant;
    return effectiveStep?.media_type === 'image' && hasText(effectiveStep.media_url);
  };
  const ready = abTestEnabled === true
    ? hasEffectiveImage('A') && hasEffectiveImage('B')
    : hasEffectiveImage('A');
  return ready ? null : 'Anexe a imagem da promoção à primeira mensagem antes de ativar esta campanha.';
};

export const getCampaignActivationBlocker = (campaign: unknown, steps: unknown): string | null => {
  const value = asRecord(campaign);
  return getCampaignMediaReadinessBlocker(value?.id, steps, value?.ab_test_enabled);
};
