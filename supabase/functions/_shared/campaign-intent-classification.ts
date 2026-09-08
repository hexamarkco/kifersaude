export type CampaignIntentClassification = {
  contact_permission: 'OPT_OUT_EXPLICITO' | 'NUMERO_ERRADO' | 'DESTINATARIO_INCORRETO' | 'RECLAMACAO_CONTATO' | 'AMBIGUO' | 'NENHUM_SINAL';
  commercial_intent: 'JA_POSSUI_PLANO' | 'INTERESSADO' | 'SEM_INTERESSE' | 'QUER_SABER_MAIS' | 'ADIAR_CONTATO' | 'OUTRO';
  confidence: number;
  recommended_action: 'suggest_block_whatsapp_campaigns' | 'keep_active' | 'review';
  reason: string;
  evidence: string;
};

const CONTACT_PERMISSIONS = new Set<CampaignIntentClassification['contact_permission']>([
  'OPT_OUT_EXPLICITO',
  'NUMERO_ERRADO',
  'DESTINATARIO_INCORRETO',
  'RECLAMACAO_CONTATO',
  'AMBIGUO',
  'NENHUM_SINAL',
]);

const COMMERCIAL_INTENTS = new Set<CampaignIntentClassification['commercial_intent']>([
  'JA_POSSUI_PLANO',
  'INTERESSADO',
  'SEM_INTERESSE',
  'QUER_SABER_MAIS',
  'ADIAR_CONTATO',
  'OUTRO',
]);

const toTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export function deriveCampaignRecommendedAction(
  contactPermission: CampaignIntentClassification['contact_permission'],
): CampaignIntentClassification['recommended_action'] {
  switch (contactPermission) {
    case 'OPT_OUT_EXPLICITO':
    case 'NUMERO_ERRADO':
    case 'DESTINATARIO_INCORRETO':
    case 'RECLAMACAO_CONTATO':
      return 'suggest_block_whatsapp_campaigns';
    case 'AMBIGUO':
      return 'review';
    case 'NENHUM_SINAL':
    default:
      return 'keep_active';
  }
}

export function mapCampaignPermissionToLegacyIntent(
  contactPermission: CampaignIntentClassification['contact_permission'],
  commercialIntent: CampaignIntentClassification['commercial_intent'],
): string {
  if (contactPermission === 'OPT_OUT_EXPLICITO') return 'opt_out';
  if (contactPermission === 'NUMERO_ERRADO' || contactPermission === 'DESTINATARIO_INCORRETO') return 'wrong_number';
  if (contactPermission === 'RECLAMACAO_CONTATO') return 'angry_or_complaint';
  if (contactPermission === 'AMBIGUO') return 'unclear';
  if (commercialIntent === 'SEM_INTERESSE') return 'negative_interest';
  return 'continue_conversation';
}

export function normalizeCampaignIntentClassification(
  value: Record<string, unknown>,
): CampaignIntentClassification {
  const rawContactPermission = toTrimmedString(value.contact_permission);
  const rawCommercialIntent = toTrimmedString(value.commercial_intent);
  const contactPermission = CONTACT_PERMISSIONS.has(rawContactPermission as CampaignIntentClassification['contact_permission'])
    ? rawContactPermission as CampaignIntentClassification['contact_permission']
    : 'NENHUM_SINAL';
  const commercialIntent = COMMERCIAL_INTENTS.has(rawCommercialIntent as CampaignIntentClassification['commercial_intent'])
    ? rawCommercialIntent as CampaignIntentClassification['commercial_intent']
    : 'OUTRO';
  const rawConfidence = Number(value.confidence);

  return {
    contact_permission: contactPermission,
    commercial_intent: commercialIntent,
    confidence: Number.isFinite(rawConfidence) ? Math.min(Math.max(rawConfidence, 0), 1) : 0,
    recommended_action: deriveCampaignRecommendedAction(contactPermission),
    reason: toTrimmedString(value.reason).slice(0, 900),
    evidence: toTrimmedString(value.evidence).slice(0, 500),
  };
}
