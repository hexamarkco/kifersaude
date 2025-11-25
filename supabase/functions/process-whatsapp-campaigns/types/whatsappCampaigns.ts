import type { WhatsappChat, WhatsappMessage } from './whatsapp.ts';

export type WhatsappCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type WhatsappCampaignStepType = 'message' | 'attachment' | 'wait_condition';

export type WhatsappCampaignStepConfig = {
  message?: {
    body: string;
  };
  attachment?: {
    attachmentType: 'document' | 'image' | 'video' | 'audio';
    payload: string;
    caption?: string;
    fileName?: string;
    mimeType?: string;
  };
  wait?: {
    strategy: 'duration' | 'reply';
    durationSeconds?: number;
    timeoutSeconds?: number;
  };
};

export type WhatsappCampaign = {
  id: string;
  name: string;
  description: string | null;
  status: WhatsappCampaignStatus;
  audience_filter: Record<string, unknown>;
  metrics: Record<string, unknown>;
  starts_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsappCampaignStep = {
  id: string;
  campaign_id: string;
  name: string;
  step_type: WhatsappCampaignStepType;
  order_index: number;
  config: WhatsappCampaignStepConfig;
  created_at: string;
  updated_at: string;
};

export type WhatsappCampaignTargetStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting'
  | 'paused'
  | 'completed'
  | 'failed';

export type WhatsappCampaignTargetConditionState = {
  type: 'duration' | 'reply';
  startedAt: string;
  timeoutSeconds?: number;
  resolvedAt?: string | null;
};

export type WhatsappCampaignTarget = {
  id: string;
  campaign_id: string;
  chat_id: string | null;
  lead_id: string | null;
  phone: string;
  status: WhatsappCampaignTargetStatus;
  current_step_index: number;
  wait_until: string | null;
  condition_state: WhatsappCampaignTargetConditionState | null;
  metadata: Record<string, unknown>;
  last_execution_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsappCampaignMetricsSummary = {
  pending: number;
  in_progress: number;
  waiting: number;
  paused: number;
  completed: number;
  failed: number;
};

export type WhatsappCampaignWithRelations = WhatsappCampaign & {
  steps?: WhatsappCampaignStep[];
  targets?: WhatsappCampaignTarget[];
};

export type CampaignSendResult = {
  targetId: string;
  status: 'sent' | 'waiting' | 'skipped' | 'failed';
  error?: string;
  message?: WhatsappMessage;
  chat?: WhatsappChat;
};
