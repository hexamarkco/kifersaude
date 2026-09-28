import type { RefObject } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';

import { IconButton, SearchInput } from '../../../../design-system';
import type { CommWhatsAppMessageSearchResult } from '../data';
import { getChatPreviewIconType, getMessageSearchPreviewText } from '../domain/messagePresentation';
import { formatMessageTime } from '../domain/messageTimeline';
import ChatPreviewIcon from './ChatPreviewIcon';

type WhatsAppChatMessageSearchProps = {
  inputRef: RefObject<HTMLInputElement>;
  draft: string;
  query: string;
  searching: boolean;
  error: string | null;
  results: CommWhatsAppMessageSearchResult[];
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (result: CommWhatsAppMessageSearchResult) => void;
};

export function WhatsAppChatMessageSearch({
  inputRef,
  draft,
  query,
  searching,
  error,
  results,
  onDraftChange,
  onClose,
  onRetry,
  onSelect,
}: WhatsAppChatMessageSearchProps) {
  return (
    <div className="border-b bg-[var(--bg-elevated)] px-5 py-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SearchInput
            ref={inputRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Pesquisar mensagens neste chat"
            size="sm"
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                onClose();
              }
            }}
          />
          <IconButton type="button" onClick={onClose} variant="ghost" aria-label="Fechar busca no chat" title="Fechar busca" size="md">
            <X aria-hidden="true" />
          </IconButton>
        </div>

        {query ? (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-muted)]">
              <span>{error ? 'Busca indisponível' : searching ? 'Buscando neste chat...' : `${results.length} resultado${results.length === 1 ? '' : 's'}`}</span>
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </div>
            {error ? (
              <div className="flex items-start gap-2 px-3 py-3 text-sm text-[var(--text-secondary)]" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-warning)]" aria-hidden="true" />
                <div className="min-w-0"><p>{error}</p><button type="button" className="mt-2 font-medium text-[var(--text-link)] hover:underline" onClick={onRetry}>Tentar novamente</button></div>
              </div>
            ) : !searching && results.length === 0 ? (
              <div className="px-3 py-3 text-sm text-[var(--text-secondary)]">Nenhuma mensagem encontrada neste chat.</div>
            ) : (
              <div className="max-h-52 overflow-y-auto py-1">
                {results.map((result) => {
                  const previewText = getMessageSearchPreviewText(result.message);
                  const previewIconType = getChatPreviewIconType(previewText);
                  if (!previewText) {
                    return null;
                  }
                  return (
                    <button key={result.message.id} type="button" onClick={() => onSelect(result)} className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition hover:bg-[var(--bg-hover)] focus:bg-[var(--bg-hover)] focus:outline-none">
                      <span className="min-w-0"><span className="block truncate text-sm font-medium text-[var(--text-primary)]">{previewIconType ? <ChatPreviewIcon type={previewIconType} /> : previewText}</span><span className="mt-0.5 block text-xs text-[var(--text-muted)]">{result.message.direction === 'outbound' ? 'Você' : 'Contato'}</span></span>
                      <span className="shrink-0 pt-0.5 text-[11px] font-medium text-[var(--text-muted)]">{formatMessageTime(result.message.message_at)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Digite um trecho da mensagem, legenda ou transcrição para localizar no histórico deste chat.</p>
        )}
      </div>
    </div>
  );
}
