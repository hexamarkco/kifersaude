const PRIVATE_CONTACT_LABEL = 'Contato privado';

export const formatDashboardRecentChatMeta = (phoneLabel: string, dateLabel: string) => {
  const normalizedPhoneLabel = phoneLabel.trim();
  const normalizedDateLabel = dateLabel.trim();
  const parts = normalizedPhoneLabel && normalizedPhoneLabel !== PRIVATE_CONTACT_LABEL
    ? [normalizedPhoneLabel]
    : [];

  if (normalizedDateLabel) {
    parts.push(normalizedDateLabel);
  }

  return parts.join(' · ');
};
