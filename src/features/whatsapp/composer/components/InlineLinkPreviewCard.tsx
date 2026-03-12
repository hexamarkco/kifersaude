import { X } from 'lucide-react';

type InlineLinkPreviewCardProps = {
  image?: string;
  title: string;
  description?: string;
  siteName?: string;
  hostname: string;
  loading: boolean;
  error?: string | null;
  onDismiss: () => void;
};

export function InlineLinkPreviewCard({
  image,
  title,
  description,
  siteName,
  hostname,
  loading,
  error,
  onDismiss,
}: InlineLinkPreviewCardProps) {
  return (
    <div className="border-b border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface-soft,#f4ede3)] px-3 py-2">
      <div className="comm-card overflow-hidden bg-[var(--panel-surface,#fffdfa)]">
        {image && (
          <img
            src={image}
            alt={title || 'Link preview'}
            className="h-24 w-full object-cover bg-[var(--panel-surface-soft,#f4ede3)]"
          />
        )}
        <div className="flex items-start justify-between gap-3 px-3 py-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="comm-muted truncate text-[11px]">{siteName || hostname}</div>
            <div className="comm-title line-clamp-2 text-sm">{title || hostname}</div>
            {description && <div className="comm-text line-clamp-2 text-xs">{description}</div>}
            {loading && <div className="comm-muted text-[11px]">Carregando preview do link...</div>}
            {!loading && error && <div className="comm-muted text-[11px]">{error}</div>}
          </div>
          <button
            type="button"
            className="comm-icon-button p-1"
            onClick={onDismiss}
            aria-label="Remover preview do link"
            title="Remover preview do link"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
