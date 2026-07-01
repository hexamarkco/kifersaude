import { Calendar } from 'lucide-react';

import { Alert, Button } from '../../../design-system';

type DashboardAlertsProps = {
  error: string | null;
  loading: boolean;
  isCustomPeriodValid: boolean;
  onRetry: () => void;
};

export function DashboardAlerts({
  error,
  loading,
  isCustomPeriodValid,
  onRetry,
}: DashboardAlertsProps) {
  return (
    <>
      {error && (
        <Alert
          tone="danger"
          action={(
            <Button type="button" onClick={onRetry} variant="danger" disabled={loading}>
              Tentar novamente
            </Button>
          )}
        >
          <div className="flex items-start space-x-3">
            <div
              className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--danger-text)]"
            />
            <p className="text-sm text-[var(--danger-text)]">
              {error}
            </p>
          </div>
        </Alert>
      )}

      {!isCustomPeriodValid && (
        <Alert tone="warning" className="items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 flex-shrink-0 text-[var(--accent-gold-hover)]" />
            <p className="text-sm text-[var(--accent-gold-hover)]">
              Por favor, preencha as datas de inicio e fim no formato DD/MM/AAAA para visualizar o periodo personalizado.
            </p>
          </div>
        </Alert>
      )}
    </>
  );
}
