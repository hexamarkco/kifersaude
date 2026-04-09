import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ExternalLink } from 'lucide-react';
import Checkbox from '../../../components/ui/Checkbox';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import ModalShell from '../../../components/ui/ModalShell';
import { toast } from '../../../lib/toast';
import { getSupabaseErrorMessage } from '../../../lib/supabase';
import { cotadorService } from '../services/cotadorService';
import { exportCotadorQuotePdf } from '../services/cotadorSharePdf';
import { buildCotadorQuoteSharePayload } from '../shared/cotadorUtils';
import type { CotadorQuote, CotadorQuoteItem } from '../shared/cotadorTypes';

type CotadorShareModalProps = {
  isOpen: boolean;
  quote: CotadorQuote;
  selectedItems: CotadorQuoteItem[];
  onClose: () => void;
};

const buildPdfFileName = (quoteName: string) => {
  const base = quoteName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${base || 'cotacao'}-${new Date().toISOString().slice(0, 10)}.pdf`;
};

export default function CotadorShareModal({
  isOpen,
  quote,
  selectedItems,
  onClose,
}: CotadorShareModalProps) {
  const [includeNetworkComparison, setIncludeNetworkComparison] = useState(true);
  const [shareLink, setShareLink] = useState('');
  const [creatingShareLink, setCreatingShareLink] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const hasNetworkComparison = selectedItems.some((item) => item.redeHospitalar.length > 0);

  const sharePayload = useMemo(() => buildCotadorQuoteSharePayload({
    ...quote,
    selectedItems,
  }, selectedItems), [quote, selectedItems]);

  const effectiveIncludeNetworkComparison = includeNetworkComparison && hasNetworkComparison;

  useEffect(() => {
    if (!isOpen) {
      setShareLink('');
      return;
    }

    setIncludeNetworkComparison(hasNetworkComparison);
  }, [hasNetworkComparison, isOpen, quote.id]);

  useEffect(() => {
    if (!isOpen || selectedItems.length === 0) {
      return;
    }

    let cancelled = false;

    const ensureShareLink = async () => {
      setCreatingShareLink(true);

      try {
        const { data, error } = await cotadorService.upsertQuoteShare({
          ...quote,
          selectedItems,
        }, effectiveIncludeNetworkComparison);

        if (cancelled) {
          return;
        }

        if (error || !data) {
          throw error ?? new Error('Nao foi possivel preparar o link da cotacao.');
        }

        setShareLink(`${window.location.origin}/cotador/compartilhar/${data.token}`);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setShareLink('');
        toast.error(getSupabaseErrorMessage(error, 'Nao foi possivel preparar o link da cotacao.'));
      } finally {
        if (!cancelled) {
          setCreatingShareLink(false);
        }
      }
    };

    void ensureShareLink();

    return () => {
      cancelled = true;
    };
  }, [effectiveIncludeNetworkComparison, isOpen, quote, selectedItems]);

  const handleRefreshLink = async () => {
    setCreatingShareLink(true);

    try {
      const { data, error } = await cotadorService.upsertQuoteShare({
        ...quote,
        selectedItems,
      }, effectiveIncludeNetworkComparison);

      if (error || !data) {
        throw error ?? new Error('Nao foi possivel gerar o link da cotacao.');
      }

      const nextLink = `${window.location.origin}/cotador/compartilhar/${data.token}`;
      setShareLink(nextLink);
      toast.success('Link da cotação atualizado com sucesso.');
    } catch (error) {
      toast.error(getSupabaseErrorMessage(error, 'Nao foi possivel gerar o link da cotacao.'));
    } finally {
      setCreatingShareLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success('Link copiado para a área de transferência.');
    } catch {
      toast.error('Nao foi possivel copiar o link agora.');
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);

    try {
      await exportCotadorQuotePdf({
        payload: sharePayload,
        includeNetworkComparison: includeNetworkComparison && hasNetworkComparison,
        fileName: buildPdfFileName(quote.name),
      });
      toast.success('PDF da cotação gerado com sucesso.');
    } catch (error) {
      console.error('[Cotador] erro ao gerar PDF da cotação', error);
      toast.error('Nao foi possivel gerar o PDF da cotação.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <>
      <ModalShell
        isOpen={isOpen}
        onClose={onClose}
        title="Compartilhar cotação"
        description="Gere um PDF bonito para enviar ao cliente ou crie um link público com os planos cotados."
        size="lg"
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={creatingShareLink || exportingPdf}>
              Fechar
            </Button>
            <Button variant="secondary" onClick={handleExportPdf} loading={exportingPdf} disabled={creatingShareLink || selectedItems.length === 0}>
              {!exportingPdf && <Download className="h-4 w-4" />}
              Gerar PDF
            </Button>
          </div>
        )}
      >
        <div className="space-y-5">
          <div className="rounded-3xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] p-4">
            <label className="flex items-start gap-3">
              <Checkbox
                checked={includeNetworkComparison && hasNetworkComparison}
                onChange={(event) => setIncludeNetworkComparison(event.target.checked)}
                disabled={!hasNetworkComparison}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--panel-text,#1a120d)]">Incluir comparativo de rede</span>
                <span className="mt-1 block text-sm text-[var(--panel-text-soft,#5b4635)]">
                  {hasNetworkComparison
                    ? 'Inclui a matriz com os prestadores compartilhados e diferenciais entre os planos.'
                    : 'Nenhum dos planos selecionados possui rede hospitalar cadastrada para comparação.'}
                </span>
              </span>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--panel-text-muted,#876f5c)]">Link público</p>
              <div className="mt-2">
                <Input
                  value={shareLink}
                  onChange={() => undefined}
                  readOnly
                  placeholder={creatingShareLink ? 'Preparando link público da cotação...' : 'O link público será exibido automaticamente aqui.'}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleCopyLink} disabled={!shareLink || creatingShareLink}>
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
              <Button variant="secondary" onClick={() => window.open(shareLink, '_blank', 'noopener,noreferrer')} disabled={!shareLink || creatingShareLink}>
                <ExternalLink className="h-4 w-4" />
                Abrir
              </Button>
              <Button variant="secondary" onClick={handleRefreshLink} loading={creatingShareLink} disabled={exportingPdf || selectedItems.length === 0}>
                Atualizar link
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--panel-text-muted,#876f5c)]">Prévia do compartilhamento</p>
            <p className="mt-2 text-sm text-[var(--panel-text-soft,#5b4635)]">
              O cliente recebe os {selectedItems.length} plano(s) atualmente selecionados na cotação, com visual pronto para apresentação.
            </p>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
