import { ConfirmationSummary } from '../../../design-system';

export function LeadDeletionSummary({ leadName }: { leadName: string }) {
  return (
    <ConfirmationSummary
      warning="A exclusão é permanente e não pode ser desfeita."
      items={[
        { label: 'Registro', value: leadName },
        { label: 'Consequência', value: 'Exclusão permanente' },
      ]}
    />
  );
}
