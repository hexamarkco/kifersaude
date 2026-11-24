import type { AutoContactFlow } from '../../../lib/autoContactService';

export const automationTriggerLabels: Record<AutoContactFlow['triggerType'], string> = {
  lead_created: 'Novo lead',
  status_changed: 'Mudança de status',
  status_duration: 'Tempo no status',
  inactivity_duration: 'Tempo sem contato',
};
