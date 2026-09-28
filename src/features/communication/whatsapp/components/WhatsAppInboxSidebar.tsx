import { Archive, Calendar, CalendarClock, Cog, Loader2, MessageCircle, Plus, Search, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import type { MutableRefObject } from 'react';

import {
  Alert,
  Button,
  ButtonGroup,
  IconButton,
  SearchInput,
} from '../../../../design-system';
import type { CommWhatsAppMessageSearchResult } from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { normalizeChatDraftPreview } from '../domain/messagePresentation';
import {
  InboxChatListItem,
  InboxFilterChip,
  InboxMessageSearchListItem,
} from './WhatsAppInboxList';

type PointerAnchor = {
  x: number;
  y: number;
};

type WhatsAppInboxSidebarProps = {
  archivedSectionOpen: boolean;
  archivedChatsCount: number;
  archivedChatsLoading: boolean;
  archivedChatsLoadingMore: boolean;
  archivedChatsHasMore: boolean;
  onSwitchArchivedSection: (nextArchivedSectionOpen: boolean) => void;
  onLoadMoreArchivedChats: () => void;
  onOpenAgenda: () => void;
  onOpenScheduledMessages: () => void;
  onOpenDashboard: () => void;
  onStartChat: () => void;
  canViewAgenda: boolean;
  allScheduledMessagesPanelOpen: boolean;
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  hasActiveChatFilters: boolean;
  activeChatFiltersCount: number;
  advancedFiltersOpen: boolean;
  onToggleAdvancedFilters: () => void;
  onClearFilters: () => void;
  chatRefreshError: string | null;
  chatLoadError: boolean;
  loading: boolean;
  onRetryChatLoad: () => void;
  sidebarChats: CommWhatsAppChat[];
  filteredMessageSearchResults: CommWhatsAppMessageSearchResult[];
  search: string;
  searchingChats: boolean;
  searchingMessages: boolean;
  chatSearchError: string | null;
  messageSearchError: string | null;
  onRetrySearch: () => void;
  selectedChatId: string | null;
  connectedUserName: string | null;
  composerDraftsByChatId: Record<string, string>;
  favoritedLeadIds: ReadonlySet<string>;
  onSelectChat: (chat: CommWhatsAppChat) => void;
  onSelectMessageSearchResult: (result: CommWhatsAppMessageSearchResult) => void;
  openChatMenuChatId: string | null;
  updatingChatStateId: string | null;
  onToggleChatMenu: (chatId: string) => void;
  onOpenChatMenuFromContext: (chatId: string, anchor: PointerAnchor) => void;
  chatMenuTriggerRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
};

export function WhatsAppInboxSidebar({
  archivedSectionOpen,
  archivedChatsCount,
  archivedChatsLoading,
  archivedChatsLoadingMore,
  archivedChatsHasMore,
  onSwitchArchivedSection,
  onLoadMoreArchivedChats,
  onOpenAgenda,
  onOpenScheduledMessages,
  onOpenDashboard,
  onStartChat,
  canViewAgenda,
  allScheduledMessagesPanelOpen,
  searchDraft,
  onSearchDraftChange,
  hasActiveChatFilters,
  activeChatFiltersCount,
  advancedFiltersOpen,
  onToggleAdvancedFilters,
  onClearFilters,
  chatRefreshError,
  chatLoadError,
  loading,
  onRetryChatLoad,
  sidebarChats,
  filteredMessageSearchResults,
  search,
  searchingChats,
  searchingMessages,
  chatSearchError,
  messageSearchError,
  onRetrySearch,
  selectedChatId,
  connectedUserName,
  composerDraftsByChatId,
  favoritedLeadIds,
  onSelectChat,
  onSelectMessageSearchResult,
  openChatMenuChatId,
  updatingChatStateId,
  onToggleChatMenu,
  onOpenChatMenuFromContext,
  chatMenuTriggerRefs,
}: WhatsAppInboxSidebarProps) {
  const renderChat = (chat: CommWhatsAppChat) => (
    <InboxChatListItem
      key={chat.id}
      chat={chat}
      selected={chat.id === selectedChatId}
      connectedUserName={connectedUserName}
      draftPreview={normalizeChatDraftPreview(composerDraftsByChatId[chat.id] ?? '')}
      favorito={chat.lead_id ? favoritedLeadIds.has(chat.lead_id) : false}
      onSelect={() => onSelectChat(chat)}
      menuOpen={openChatMenuChatId === chat.id}
      menuBusy={updatingChatStateId === chat.id}
      onToggleMenu={onToggleChatMenu}
      onOpenContextMenu={onOpenChatMenuFromContext}
      menuTriggerRef={(node) => {
        if (node) {
          chatMenuTriggerRefs.current[chat.id] = node;
        } else {
          delete chatMenuTriggerRefs.current[chat.id];
        }
      }}
    />
  );

  return (
    <div className={`whatsapp-inbox-panel whatsapp-inbox-sidebar h-full min-h-0 flex-col border shadow-sm lg:flex lg:rounded-r-none lg:border-r ${selectedChatId ? 'hidden lg:flex' : 'flex'}`}>
      <div className="whatsapp-inbox-sidebar-header border-b p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {archivedSectionOpen ? 'Arquivadas' : 'Conversas'}
            </p>
            <ButtonGroup className="whatsapp-inbox-action-group shrink-0" role="group" aria-label="Ações das conversas">
              <IconButton
                variant={archivedSectionOpen ? 'soft' : 'ghost'}
                className="relative shrink-0"
                size="md"
                onClick={() => onSwitchArchivedSection(!archivedSectionOpen)}
                aria-label="Chats arquivados"
                title={archivedChatsCount > 0 ? `Chats arquivados (${archivedChatsCount})` : 'Chats arquivados'}
              >
                <span className="relative inline-flex">
                  <Archive className="kds-control-icon" />
                  {archivedChatsCount > 0 ? (
                    <span className="kds-sidebar-badge whatsapp-inbox-count-badge" aria-label={`${archivedChatsCount} chats arquivados`}>
                      {archivedChatsCount > 9 ? '9+' : archivedChatsCount}
                    </span>
                  ) : null}
                </span>
              </IconButton>
              <IconButton
                variant="ghost"
                className="shrink-0"
                size="md"
                onClick={onOpenAgenda}
                aria-label="Agenda do WhatsApp"
                title={canViewAgenda ? 'Agenda do WhatsApp' : 'Sem permissão para acessar a agenda'}
                disabled={!canViewAgenda}
              >
                <Calendar className="kds-control-icon" />
              </IconButton>
              <IconButton
                variant={allScheduledMessagesPanelOpen ? 'soft' : 'ghost'}
                className="shrink-0"
                size="md"
                onClick={onOpenScheduledMessages}
                aria-label="Mensagens agendadas"
                title="Mensagens agendadas"
              >
                <CalendarClock className="kds-control-icon" />
              </IconButton>
              <IconButton
                variant="ghost"
                className="shrink-0"
                size="md"
                onClick={onOpenDashboard}
                aria-label="Painel WhatsApp"
                title="Painel WhatsApp"
              >
                <Cog className="kds-control-icon" />
              </IconButton>
              <IconButton
                variant="ghost"
                className="shrink-0"
                size="md"
                onClick={onStartChat}
                aria-label="Novo chat"
                title="Novo chat"
              >
                <Plus className="kds-control-icon" />
              </IconButton>
            </ButtonGroup>
          </div>

          <SearchInput
            value={searchDraft}
            onChange={(event) => onSearchDraftChange(event.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="whatsapp-inbox-search-input"
          />

          <div className="flex items-center gap-2 overflow-visible pb-1">
            <InboxFilterChip active={!hasActiveChatFilters} label="Todas" onClick={onClearFilters} />
            <div className="relative shrink-0">
              <Button
                type="button"
                onClick={onToggleAdvancedFilters}
                variant={advancedFiltersOpen || activeChatFiltersCount > 0 ? 'soft' : 'secondary'}
                size="sm"
              >
                <SlidersHorizontal className="kds-control-icon" />
                Filtros{activeChatFiltersCount > 0 ? ` (${activeChatFiltersCount})` : ''}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="whatsapp-inbox-sidebar-scroll min-h-0 flex-1 overflow-y-auto p-0">
        {archivedSectionOpen ? (
          <div className="sticky top-0 z-[1] flex items-center gap-2 border-b bg-[var(--bg-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
            <Archive className="h-4 w-4 text-[var(--text-muted)]" />
            <span>Conversas arquivadas</span>
            <span className="ml-auto text-xs font-medium text-[var(--text-muted)]">
              {archivedChatsLoading ? 'Carregando...' : archivedChatsCount > 0 ? `${archivedChatsCount} ${archivedChatsCount === 1 ? 'chat' : 'chats'}` : '0 chats'}
            </span>
          </div>
        ) : null}
        {chatRefreshError && !chatLoadError ? (
          <Alert
            tone="warning"
            title="Conversas não atualizadas"
            action={(
              <Button type="button" variant="secondary" size="sm" onClick={onRetryChatLoad} loading={loading}>
                Atualizar
              </Button>
            )}
            className="m-3"
          >
            {chatRefreshError}
          </Alert>
        ) : null}
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--text-secondary)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando conversas...
          </div>
        ) : chatLoadError ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[var(--kds-radius-lg)] border border-dashed border-[var(--danger)] p-6 text-center" role="alert">
            <AlertTriangle className="h-8 w-8 text-[var(--danger)]" />
            <div className="space-y-1">
              <p className="whatsapp-inbox-heading text-sm font-medium text-[var(--text-primary)]">Não foi possível carregar as conversas</p>
              <p className="text-sm text-[var(--text-secondary)]">Verifique sua conexão ou sessão e tente novamente. Seus chats não foram apagados.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={onRetryChatLoad}>Tentar novamente</Button>
          </div>
        ) : search ? (
          sidebarChats.length === 0 && filteredMessageSearchResults.length === 0 && !searchingChats && !searchingMessages && !chatSearchError && !messageSearchError ? (
            <div className="whatsapp-inbox-empty-state flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[var(--kds-radius-lg)] border border-dashed p-6 text-center">
              <Search className="h-8 w-8 whatsapp-inbox-empty-icon" />
              <div className="space-y-1">
                <p className="whatsapp-inbox-heading text-sm font-medium text-[var(--text-primary)]">Nenhum resultado encontrado</p>
                <p className="text-sm text-[var(--text-secondary)]">Busque pelo nome do contato, telefone ou trecho de mensagem.</p>
              </div>
            </div>
          ) : (
            <>
              {chatSearchError || messageSearchError ? (
                <Alert
                  tone="warning"
                  title="Busca incompleta"
                  action={<Button type="button" variant="secondary" size="sm" onClick={onRetrySearch}>Tentar novamente</Button>}
                  className="m-3"
                >
                  {chatSearchError ?? messageSearchError}
                  {chatSearchError && messageSearchError ? ' Algumas mensagens também não puderam ser consultadas.' : ''}
                </Alert>
              ) : null}
              {sidebarChats.length > 0 ? <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Conversas</div> : null}
              {searchingChats && sidebarChats.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />Buscando conversas...</div>
              ) : null}
              {sidebarChats.map(renderChat)}
              {filteredMessageSearchResults.length > 0 || searchingMessages ? <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Mensagens</div> : null}
              {searchingMessages ? <div className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />Buscando mensagens...</div> : null}
              {filteredMessageSearchResults.map((result) => (
                <InboxMessageSearchListItem
                  key={result.message.id}
                  result={result}
                  selected={result.chat.id === selectedChatId}
                  connectedUserName={connectedUserName}
                  favorito={result.chat.lead_id ? favoritedLeadIds.has(result.chat.lead_id) : false}
                  onSelect={() => onSelectMessageSearchResult(result)}
                />
              ))}
            </>
          )
        ) : archivedSectionOpen && archivedChatsLoading && sidebarChats.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--text-secondary)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando conversas arquivadas...</div>
        ) : sidebarChats.length === 0 ? (
          <div className="whatsapp-inbox-empty-state flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[var(--kds-radius-lg)] border border-dashed p-6 text-center">
            {archivedSectionOpen ? <Archive className="h-8 w-8 whatsapp-inbox-empty-icon" /> : <MessageCircle className="h-8 w-8 whatsapp-inbox-empty-icon" />}
            <div className="space-y-1">
              <p className="whatsapp-inbox-heading text-sm font-medium text-[var(--text-primary)]">{archivedSectionOpen ? 'Nenhum chat arquivado' : 'Nenhuma conversa ainda'}</p>
              <p className="text-sm text-[var(--text-secondary)]">{archivedSectionOpen ? 'Arquive uma conversa para ela aparecer nesta lista separada.' : 'Assim que o webhook da Whapi receber mensagens, elas aparecerão aqui.'}</p>
            </div>
          </div>
        ) : (
          <>
            {sidebarChats.map(renderChat)}
            {archivedSectionOpen && archivedChatsHasMore ? (
              <div className="px-4 py-3">
                <Button variant="secondary" className="w-full" onClick={onLoadMoreArchivedChats} loading={archivedChatsLoadingMore} disabled={archivedChatsLoadingMore}>
                  {archivedChatsLoadingMore ? 'Carregando...' : 'Carregar mais arquivados'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
