import { useState } from 'react';
import { Star } from 'lucide-react';

import { toggleLeadFavorito } from '../lib/leadFavoriteService';
import { toast } from '../lib/toast';

// Estrela clicavel para favoritar/desfavoritar um lead. Usada só nos lugares
// onde o lead é gerenciado diretamente (Leads, Detalhes do Lead, painel do
// WhatsApp) — em todo outro lugar que só exibe o nome do lead, use
// LeadFavoriteBadge (somente leitura).
export function LeadFavoriteToggle({
  leadId,
  favorito,
  onToggled,
  size = 'md',
  className,
}: {
  leadId: string;
  favorito: boolean;
  onToggled?: (nextFavorito: boolean) => void;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (pending) return;

    const next = !favorito;
    setPending(true);
    try {
      await toggleLeadFavorito(leadId, next);
      onToggled?.(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar o favorito do lead.');
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(event) => void handleClick(event)}
      disabled={pending}
      aria-pressed={favorito}
      title={favorito ? 'Remover dos favoritos' : 'Marcar como favorito'}
      className={`inline-flex shrink-0 items-center justify-center rounded-full p-1 transition hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ''}`}
      style={{ color: favorito ? 'var(--accent-gold)' : 'var(--text-muted)' }}
    >
      <Star className={iconSize} fill={favorito ? 'currentColor' : 'none'} />
    </button>
  );
}

// Indicador somente-leitura: so renderiza algo quando o lead e favorito, pra
// nao poluir visualmente cada nome de lead que aparece na tela. Use em
// qualquer lugar que so exibe o nome do lead sem gerencia-lo diretamente
// (agenda, gerar follow-up, follow-ups em lote, dashboard, contratos etc.).
export function LeadFavoriteBadge({ favorito, className }: { favorito?: boolean | null; className?: string }) {
  if (!favorito) return null;

  return (
    <span title="Lead favorito" className="inline-flex shrink-0">
      <Star
        className={`h-3.5 w-3.5 shrink-0 ${className ?? ''}`}
        style={{ color: 'var(--accent-gold)' }}
        fill="currentColor"
        aria-label="Lead favorito"
      />
    </span>
  );
}
