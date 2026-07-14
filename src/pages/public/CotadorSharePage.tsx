import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button, Surface } from '../../design-system';
import { getSupabaseErrorMessage } from '../../lib/supabase';
import { cotadorService } from '../../features/cotador/services/cotadorService';
import type { CotadorQuoteShare } from '../../features/cotador/shared/cotadorTypes';
import CotadorQuoteShareView from '../../features/cotador/components/CotadorQuoteShareView';
import { useParams } from 'react-router-dom';

export default function CotadorSharePage() {
  const { shareToken } = useParams<{ shareToken?: string }>();
  const [share, setShare] = useState<CotadorQuoteShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadShare = async () => {
      if (!shareToken) {
        if (!active) return;
        setShare(null);
        setError('Link de compartilhamento inválido.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: shareError } = await cotadorService.getPublicQuoteShare(shareToken);
      if (!active) return;

      if (shareError) {
        setShare(null);
        setError(getSupabaseErrorMessage(shareError, 'Nao foi possivel carregar a cotação compartilhada.'));
        setLoading(false);
        return;
      }

      if (!data) {
        setShare(null);
        setError('Esta cotação compartilhada não foi encontrada ou não está mais disponível.');
        setLoading(false);
        return;
      }

      setShare(data);
      setLoading(false);
    };

    void loadShare();

    return () => {
      active = false;
    };
  }, [shareToken]);

  if (loading) {
    return (
      <div className="painel-theme kifer-ds theme-light min-h-screen bg-[var(--bg-canvas)] px-4 py-12">
        <Surface variant="strong" padding="none" className="mx-auto flex max-w-3xl items-center justify-center px-8 py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[color:var(--border-default)] border-t-[color:var(--brand-primary)]" />
        </Surface>
      </div>
    );
  }

  if (!share) {
    return (
      <div className="painel-theme kifer-ds theme-light min-h-screen bg-[var(--bg-canvas)] px-4 py-12">
        <Surface variant="danger" padding="lg" className="mx-auto max-w-3xl px-8 py-14 text-center">
          <AlertCircle className="mx-auto h-10 w-10" />
          <h1 className="mt-5 text-2xl font-semibold">Cotação indisponível</h1>
          <p className="mt-3 text-sm">{error ?? 'Nao foi possivel abrir esta cotação compartilhada.'}</p>
          <div className="mt-8 flex justify-center">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              <RefreshCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </Surface>
      </div>
    );
  }

  return <CotadorQuoteShareView payload={share.payload} includeNetworkComparison={share.includeNetworkComparison} sharedAt={share.updatedAt} />;
}
