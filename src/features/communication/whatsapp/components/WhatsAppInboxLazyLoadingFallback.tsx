import { LoadingState } from '../../../../design-system';

export function WhatsAppInboxLazyLoadingFallback() {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] rounded-[var(--kds-radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 shadow-lg">
      <LoadingState compact label="Abrindo janela" />
    </div>
  );
}
