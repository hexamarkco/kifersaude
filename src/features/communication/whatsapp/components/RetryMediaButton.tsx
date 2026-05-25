import { memo } from 'react';
import { Loader2, SendHorizontal } from 'lucide-react';
import Button from '../../../../components/ui/Button';

function RetryMediaButtonBase({ loading, onRetry }: { loading: boolean; onRetry: () => void }) {
  return (
    <Button type="button" onClick={onRetry} disabled={loading} variant="soft" size="sm" className="whatsapp-inbox-retry-button h-8 rounded-xl px-3 text-[11px]">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SendHorizontal className="h-3.5 w-3.5" />}
      Reenviar
    </Button>
  );
}

export const RetryMediaButton = memo(RetryMediaButtonBase);
