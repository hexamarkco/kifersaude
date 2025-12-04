export type WhatsAppFollowUpStep = {
  id: string;
  message: string;
  delayMinutes: number;
  active: boolean;
};

export type WhatsAppFollowUpFlow = {
  id: string;
  name: string;
  monitoredStatuses: string[];
  stopStatuses: string[];
  stopOnAnyStatusChange: boolean;
  maxMessages: number;
  active: boolean;
  steps: WhatsAppFollowUpStep[];
};

export type WhatsAppFollowUpSettings = {
  enabled: boolean;
  defaultStopStatuses: string[];
  flows: WhatsAppFollowUpFlow[];
};
