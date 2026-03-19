import { ExternalLink, Loader2, Search } from 'lucide-react';
import ModalShell from '../../../../components/ui/ModalShell';
import type { GiphyGifItem } from '../types';

type GiphyPickerModalProps = {
  isOpen: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  results: GiphyGifItem[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSelect: (item: GiphyGifItem) => void;
};

const isMp4Asset = (value: string) => /\.mp4(?:[?#].*)?$/i.test(value);

const resolvePreviewSource = (item: GiphyGifItem) => item.previewUrl || item.stillUrl || item.gifUrl || item.mp4Url;

export function GiphyPickerModal({
  isOpen,
  search,
  onSearchChange,
  results,
  loading,
  error,
  onClose,
  onSelect,
}: GiphyPickerModalProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Biblioteca de GIFs"
      description="Busca em tempo real no Giphy para enviar direto no chat."
      size="xl"
      bodyClassName="space-y-4"
    >
      <label className="comm-card flex items-center gap-3 rounded-2xl px-4 py-3">
        <Search className="h-4 w-4 text-[var(--panel-text-muted,#876f5c)]" />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Busque por assunto, humor ou situacao"
          className="w-full border-0 bg-transparent text-sm text-[var(--panel-text,#1a120d)] outline-none placeholder:text-[var(--panel-text-muted,#876f5c)]"
          autoFocus
        />
      </label>

      <div className="flex flex-col gap-2 rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[linear-gradient(180deg,rgba(255,253,250,0.96)_0%,rgba(247,240,231,0.96)_100%)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="comm-title text-sm font-semibold">{search.trim() ? `Resultados para "${search.trim()}"` : 'Em alta agora'}</div>
          <div className="comm-muted text-xs">
            {loading ? 'Atualizando biblioteca...' : `${results.length} GIF${results.length === 1 ? '' : 's'} prontos para enviar.`}
          </div>
        </div>
        <a
          href={search.trim() ? `https://giphy.com/search/${encodeURIComponent(search.trim().replace(/\s+/g, '-'))}` : 'https://giphy.com/explore/trending-gifs'}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)] px-3 py-1.5 text-xs font-medium text-[var(--panel-accent-ink,#6f3f16)] transition hover:border-[var(--panel-accent-border,#a96428)] hover:text-[var(--panel-accent-ink-strong,#4a2411)]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir no Giphy
        </a>
      </div>

      {error ? (
        <div className="comm-card comm-card-danger px-4 py-3 text-sm">{error}</div>
      ) : null}

      {loading && results.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={`giphy-skeleton-${index}`}
              className="panel-skeleton aspect-[4/5] rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)]"
            />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="comm-card flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl px-6 py-8 text-center">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--panel-border,#d4c0a7)] bg-[var(--panel-surface,#fffdfa)]">
            <Search className="h-5 w-5 text-[var(--panel-accent-ink,#6f3f16)]" />
          </div>
          <div>
            <div className="comm-title text-sm font-semibold">Nada encontrado</div>
            <div className="comm-muted mt-1 text-xs">Tente outro termo ou deixe a busca vazia para ver os GIFs em alta.</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((item) => {
            const previewSource = resolvePreviewSource(item);
            const shouldRenderVideo = item.mp4Url && isMp4Asset(item.mp4Url);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="group relative overflow-hidden rounded-2xl border border-[var(--panel-border-subtle,#e7dac8)] bg-[var(--panel-surface,#fffdfa)] text-left shadow-[0_16px_32px_-28px_rgba(74,36,17,0.34)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--panel-accent-border,#a96428)] hover:shadow-[0_22px_44px_-28px_rgba(111,63,22,0.38)]"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(180deg,rgba(74,36,17,0.08)_0%,rgba(26,18,13,0.16)_100%)]">
                  {previewSource ? (
                    shouldRenderVideo ? (
                      <video
                        src={item.mp4Url}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={previewSource}
                        alt={item.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm font-medium text-[var(--panel-text-soft,#5b4635)]">
                      Preview indisponivel
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(26,18,13,0)_0%,rgba(26,18,13,0.82)_100%)] px-3 pb-3 pt-8">
                    <div className="line-clamp-2 text-sm font-semibold text-white">{item.title}</div>
                    <div className="mt-1 inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm">
                      Selecionar GIF
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {loading && results.length > 0 ? (
        <div className="comm-muted inline-flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Carregando mais resultados para sua busca...
        </div>
      ) : null}
    </ModalShell>
  );
}
