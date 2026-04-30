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
              className="mt-1 h-2.5 w-2.5 rounded-full"
              style={{ background: 'var(--panel-accent-red-text,#8a3128)' }}
            />
            <p className="text-sm" style={{ color: 'var(--panel-accent-red-text,#8a3128)' }}>
              {error}
            </p>
          </div>
        </Alert>
      )}

      {!isCustomPeriodValid && (
        <Alert tone="warning" className="items-start sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--panel-accent-ink,#6f3f16)' }} />
            <p className="text-sm" style={{ color: 'var(--panel-accent-ink,#6f3f16)' }}>
              Por favor, preencha as datas de inicio e fim no formato DD/MM/AAAA para visualizar o periodo personalizado.
            </p>
          </div>
        </Alert>
      )}
    </>
  );
}
