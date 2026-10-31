export const deduplicateBirthdayPeople = <T,>(people: T[]) => people;
export const loadNotificationSummarySource = async () => ({
  reminders: [],
  contracts: [],
  holders: [],
  dependents: [],
  failedSources: [],
});
export const subscribeToReminderChanges = () => () => undefined;
export const getLeadPendingReminderDate = async () => null;
export const createReminder = async () => {
  throw new Error('Escritas bloqueadas nesta prévia sintética.');
};
export const FOLLOW_UP_REMINDER_TYPE = 'follow_up';
export const MANUAL_REMINDER_TYPES: string[] = [];
