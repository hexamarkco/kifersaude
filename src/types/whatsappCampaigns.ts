export type WhatsAppCampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type WhatsAppCampaignAudienceSource = 'filters' | 'csv';
export type WhatsAppCampaignTargetSourceKind = 'lead_filter' | 'csv_import';

export type WhatsAppCampaignTargetStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'invalid'
  | 'cancelled';

export type WhatsAppCampaignFlowStepType = 'text' | 'image' | 'video' | 'audio' | 'document';

export type WhatsAppCampaignFlowStepDelayUnit = 'minutes' | 'hours' | 'days';

export type WhatsAppCampaignConditionOperator =
  | 'equals'
  | 'contains'
  | 'not_equals'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'in_list'
  | 'not_in_list'
  | 'greater_than'
  | 'greater_or_equal'
  | 'less_than'
  | 'less_or_equal';

export type WhatsAppCampaignConditionLogic = 'all' | 'any';

export type WhatsAppCampaignCondition = {
  id: string;
  field: string;
  operator: WhatsAppCampaignConditionOperator;
  value: string;
};

export type WhatsAppCampaignFlowStep = {
  id: string;
  type: WhatsAppCampaignFlowStepType;
  order?: number;
  text?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  delayValue?: number;
  delayUnit?: WhatsAppCampaignFlowStepDelayUnit;
  conditions?: WhatsAppCampaignCondition[];
  conditionLogic?: WhatsAppCampaignConditionLogic;
};

export type WhatsAppCampaign = {
  id: string;
  name: string;
  message: string;
  flow_steps: WhatsAppCampaignFlowStep[];
  status: WhatsAppCampaignStatus;
  audience_source: WhatsAppCampaignAudienceSource;
  audience_filter: Record<string, unknown>;
  audience_config: Record<string, unknown>;
  total_targets: number;
  pending_targets: number;
  sent_targets: number;
  failed_targets: number;
  invalid_targets: number;
  started_at: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppCampaignTarget = {
  id: string;
  campaign_id: string;
  lead_id: string | null;
  phone: string;
  raw_phone: string | null;
  display_name: string | null;
  chat_id: string | null;
  source_kind: WhatsAppCampaignTargetSourceKind;
  source_payload: Record<string, string>;
  status: WhatsAppCampaignTargetStatus;
  attempts: number;
  error_message: string | null;
  sent_at: string | null;
  last_attempt_at: string | null;
  processing_started_at: string | null;
  processing_expires_at: string | null;
  last_completed_step_index: number;
  last_completed_step_id: string | null;
  last_sent_step_at: string | null;
  next_step_due_at: string | null;
  created_at: string;
  updated_at: string;
};
