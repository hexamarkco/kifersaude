import type { BatchFollowUpFinalStatus, BatchFollowUpOpportunityRecommendation } from './batchFollowUpOutcome';

export type BatchFollowUpSendItem = {
  chatId: string;
  externalChatId: string | null;
  textSegments: string[];
  reminderId: string;
  leadId: string;
  phone: string | null;
  currentAction: 'send' | 'wait';
  generationId: string | null;
  approvedScheduleAction: 'schedule' | 'no_schedule';
  approvedScheduleDate: string | null;
  scheduleReason: string | null;
  opportunityRecommendation: BatchFollowUpOpportunityRecommendation;
};

export type BatchFollowUpSendProgress = {
  reminderId: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  sentSegments: number;
  totalSegments: number;
  finalStatus?: BatchFollowUpFinalStatus | null;
  errorMessage?: string;
};

export type BatchFollowUpSendOptions = {
  onProgress?: (progress: BatchFollowUpSendProgress) => void;
};

export type BatchFollowUpSendSummary = {
  sentCount: number;
  scheduledCount: number;
  failedCount: number;
  errorMessage?: string;
};
