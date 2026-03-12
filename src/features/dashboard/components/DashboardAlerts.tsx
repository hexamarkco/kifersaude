import { Calendar } from 'lucide-react';

import Button from '../../../components/ui/Button';

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
        <div
          className="flex flex-col gap-3 rounded-[1.6rem] border p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{
            borderColor: 'var(--panel-accent-red-border,#d79a8f)',
            background: 'var(--panel-accent-red-bg,#faecea)',
          }}
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
          <Button type="button" onClick={onRetry} variant="danger" disabled={loading}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!isCustomPeriodValid && (
        <div
          className="flex items-center space-x-2 rounded-[1.4rem] border p-3"
          style={{
            borderColor: 'var(--panel-accent-border,#d5a25c)',
            background: 'var(--panel-accent-soft,#f6e4c7)',
          }}
        >
          <Calendar className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--panel-accent-ink,#6f3f16)' }} />
          <p className="text-sm" style={{ color: 'var(--panel-accent-ink,#6f3f16)' }}>
            Por favor, preencha as datas de inicio e fim no formato DD/MM/AAAA para visualizar o periodo personalizado.
          </p>
        </div>
      )}
    </>
  );
}
