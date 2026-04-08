import { useEffect, useState } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
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
      <div className="min-h-screen bg-[linear-gradient(180deg,#2f1a11_0%,#1f130d_100%)] px-4 py-12">
        <div className="mx-auto flex max-w-3xl items-center justify-center rounded-[32px] border border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)] px-8 py-20 text-[color:#fff8ef] shadow-[0_30px_90px_rgba(0,0,0,0.22)]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[color:rgba(255,255,255,0.14)] border-t-[color:#f3c892]" />
        </div>
      </div>
    );
  }

  if (!share) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#2f1a11_0%,#1f130d_100%)] px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-[color:rgba(255,255,255,0.08)] bg-[color:rgba(255,255,255,0.04)] px-8 py-14 text-center text-[color:#fff8ef] shadow-[0_30px_90px_rgba(0,0,0,0.22)]">
          <AlertCircle className="mx-auto h-10 w-10 text-[color:#f3c892]" />
          <h1 className="mt-5 text-2xl font-semibold">Cotação indisponível</h1>
          <p className="mt-3 text-sm text-[color:rgba(255,243,209,0.76)]">{error ?? 'Nao foi possivel abrir esta cotação compartilhada.'}</p>
          <div className="mt-8 flex justify-center">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              <RefreshCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <CotadorQuoteShareView payload={share.payload} includeNetworkComparison={share.includeNetworkComparison} sharedAt={share.updatedAt} />;
}
