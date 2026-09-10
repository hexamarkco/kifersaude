export type BatchFollowUpOpportunityRecommendation =
  | 'continue'
  | 'pause'
  | 'mark_lost_recommended';

export type BatchFollowUpFinalStatus = 'Reativação' | 'Perdido';

const FINAL_LEAD_STATUSES = new Set(['perdido', 'convertido', 'fechado', 'duplicado']);

const normalizeStatus = (status: string | null | undefined) =>
  status?.trim().toLocaleLowerCase('pt-BR') ?? '';

export const resolveBatchFollowUpFinalStatus = (params: {
  approvedScheduleAction: 'schedule' | 'no_schedule';
  approvedScheduleDate: string | null;
  opportunityRecommendation: BatchFollowUpOpportunityRecommendation;
  currentLeadStatus?: string | null;
}): BatchFollowUpFinalStatus | null => {
  const currentStatus = normalizeStatus(params.currentLeadStatus);

  if (FINAL_LEAD_STATUSES.has(currentStatus)) {
    return null;
  }

  if (params.approvedScheduleAction === 'schedule' && params.approvedScheduleDate) {
    return null;
  }

  return params.opportunityRecommendation === 'mark_lost_recommended'
    ? 'Perdido'
    : 'Reativação';
};
