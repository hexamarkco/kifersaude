import { useMinimumLoading, LoadingState, RecordListSkeleton, LoadingMonogram, Text } from '../../../../design-system';
import { Archive, Calendar, CalendarClock, BarChart3, MessageCircle, MoreHorizontal, SquarePen, Search, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { useState, type MutableRefObject } from 'react';
import type { LeadStatusConfig } from '../../../leads';

import {
  Alert,
  Button,
  DropdownOption,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
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
  leadStatuses: LeadStatusConfig[];
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
  onStartChat?: () => void;
  canViewAgenda: boolean;
  allScheduledMessagesPanelOpen: boolean;
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  hasActiveChatFilters: boolean;
  activeChatFiltersCount: number;
  advancedFiltersOpen: boolean;
  advancedFiltersTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  onToggleAdvancedFilters: () => void;
  onClearFilters: () => void;
  unreadOnly: boolean;
  onShowUnread: () => void;
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
  leadStatuses,
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
  advancedFiltersTriggerRef,
  onToggleAdvancedFilters,
  onClearFilters,
  unreadOnly,
  onShowUnread,
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
  const [actionsOpen, setActionsOpen] = useState(false);
  const selectAction = (action: () => void) => {
    setActionsOpen(false);
    action();
  };
  const showChatSearch = useMinimumLoading(searchingChats && sidebarChats.length === 0);
  const showMessageSearch = useMinimumLoading(searchingMessages);
  const showArchiveLoading = useMinimumLoading(archivedSectionOpen && archivedChatsLoading && sidebarChats.length === 0);
  const renderChat = (chat: CommWhatsAppChat) => (
    <InboxChatListItem
      key={chat.id}
      chat={chat}
      leadStatusColor={leadStatuses.find((status) => status.nome === chat.lead_status)?.cor}
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
    <div className={`whatsapp-inbox-panel whatsapp-inbox-sidebar min-h-0 flex-col ${selectedChatId ? 'has-selection' : ''}`}>
      <header className="whatsapp-inbox-sidebar-header shrink-0">
        <div className="flex flex-col gap-3">
          <div className="whatsapp-inbox-sidebar-title flex items-center justify-between gap-2">
            <span>Conversas <small>{sidebarChats.length}</small></span>
            {onStartChat ? (
              <IconButton variant="ghost" size="sm" aria-label="Nova conversa" title="Nova conversa" onClick={onStartChat}><SquarePen aria-hidden="true" /></IconButton>
            ) : null}
          </div>

          <SearchInput
            value={searchDraft}
            onChange={(event) => onSearchDraftChange(event.target.value)}
            placeholder="Buscar conversas"
            className="whatsapp-inbox-search-input"
          />

          <div className="whatsapp-inbox-sidebar-tools">
            <div className="whatsapp-inbox-quick-filters">
              <InboxFilterChip active={!hasActiveChatFilters} label="Todas" onClick={onClearFilters} />
              <InboxFilterChip active={unreadOnly} label="Não lidas" onClick={onShowUnread} />
            </div>
            <div className="whatsapp-inbox-sidebar-actions">
              <Button
                ref={advancedFiltersTriggerRef}
                type="button"
                onClick={onToggleAdvancedFilters}
                aria-expanded={advancedFiltersOpen}
                aria-haspopup="dialog"
                aria-label={activeChatFiltersCount > 0 ? `Filtrar conversas (${activeChatFiltersCount})` : 'Filtrar conversas'}
                variant={advancedFiltersOpen || activeChatFiltersCount > 0 ? 'soft' : 'secondary'}
                size="sm"
              >
                <SlidersHorizontal className="kds-control-icon" aria-hidden="true" />
                Filtros{activeChatFiltersCount > 0 ? ` (${activeChatFiltersCount})` : ''}
              </Button>
              <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
                <PopoverTrigger><IconButton variant="ghost" size="sm" aria-label="Ações das conversas"><MoreHorizontal aria-hidden="true" /></IconButton></PopoverTrigger>
                <PopoverContent align="end" className="kds-workspace-action-menu" aria-label="Ações das conversas">
                  <DropdownOption role="button" aria-pressed={archivedSectionOpen} onClick={() => selectAction(() => onSwitchArchivedSection(!archivedSectionOpen))}><Archive className="kds-control-icon" aria-hidden="true" />{archivedSectionOpen ? 'Voltar às conversas' : 'Conversas arquivadas'}{archivedChatsCount > 0 && <small>{archivedChatsCount}</small>}</DropdownOption>
                  <DropdownOption role="button" disabled={!canViewAgenda} onClick={() => selectAction(onOpenAgenda)}><Calendar className="kds-control-icon" aria-hidden="true" />Agenda do WhatsApp</DropdownOption>
                  <DropdownOption role="button" aria-pressed={allScheduledMessagesPanelOpen} onClick={() => selectAction(onOpenScheduledMessages)}><CalendarClock className="kds-control-icon" aria-hidden="true" />Mensagens agendadas</DropdownOption>
                  <DropdownOption role="button" onClick={() => selectAction(onOpenDashboard)}><BarChart3 className="kds-control-icon" aria-hidden="true" />Painel WhatsApp</DropdownOption>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </header>

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
        {chatRefreshError && !chatLoadError && !(archivedSectionOpen && sidebarChats.length === 0) ? (
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
        {<LoadingState active={loading} placeholder={<RecordListSkeleton rows={7} />} label="Carregando conversas..." fallback={() => chatLoadError ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[var(--kds-radius-lg)] border border-dashed border-[var(--danger)] p-6 text-center" role="alert">
            <AlertTriangle className="h-8 w-8 text-[var(--danger)]" />
            <div className="space-y-1">
              <Text className="whatsapp-inbox-heading text-sm font-medium text-[var(--text-primary)]">Não foi possível carregar as conversas</Text>
              <Text className="text-sm text-[var(--text-secondary)]">Verifique sua conexão ou sessão e tente novamente. Seus chats não foram apagados.</Text>
            </div>
            <Button variant="secondary" size="sm" onClick={onRetryChatLoad}>Tentar novamente</Button>
          </div>
        ) : search ? (
          sidebarChats.length === 0 && filteredMessageSearchResults.length === 0 && !searchingChats && !searchingMessages && !chatSearchError && !messageSearchError ? (
            <div className="whatsapp-inbox-empty-state flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[var(--kds-radius-lg)] border border-dashed p-6 text-center">
              <Search className="h-8 w-8 whatsapp-inbox-empty-icon" />
              <div className="space-y-1">
                <Text className="whatsapp-inbox-heading text-sm font-medium text-[var(--text-primary)]">Nenhum resultado encontrado</Text>
                <Text className="text-sm text-[var(--text-secondary)]">Busque pelo nome do contato, telefone ou trecho de mensagem.</Text>
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
              {showChatSearch ? (
                <div className="flex items-center justify-center px-4 py-3"><LoadingMonogram label="Buscando conversas" /></div>
              ) : null}
              {sidebarChats.map(renderChat)}
              {filteredMessageSearchResults.length > 0 || searchingMessages ? <div className="px-4 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Mensagens</div> : null}
              {showMessageSearch ? <div className="flex items-center justify-center px-4 py-3"><LoadingMonogram label="Buscando mensagens" /></div> : null}
              {filteredMessageSearchResults.map((result) => (
                <InboxMessageSearchListItem
                  key={result.message.id}
                  result={result}
                  leadStatusColor={leadStatuses.find((status) => status.nome === result.chat.lead_status)?.cor}
                  selected={result.chat.id === selectedChatId}
                  connectedUserName={connectedUserName}
                  favorito={result.chat.lead_id ? favoritedLeadIds.has(result.chat.lead_id) : false}
                  onSelect={() => onSelectMessageSearchResult(result)}
                />
              ))}
            </>
          )
        ) : showArchiveLoading ? (
          <LoadingState label="Carregando conversas arquivadas" placeholder={<RecordListSkeleton />} />
        ) : archivedSectionOpen && chatRefreshError && sidebarChats.length === 0 ? (
          <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[var(--kds-radius-lg)] border border-dashed p-6 text-center" role="alert">
            <AlertTriangle className="h-8 w-8 text-[var(--warning)]" />
            <div className="space-y-1">
              <Text className="whatsapp-inbox-heading text-sm font-medium text-[var(--text-primary)]">Não foi possível carregar os arquivados</Text>
              <Text className="text-sm text-[var(--text-secondary)]">A lista não foi atualizada. Tente novamente.</Text>
            </div>
            <Button variant="secondary" size="sm" onClick={onRetryChatLoad} loading={loading}>Tentar novamente</Button>
          </div>
        ) : sidebarChats.length === 0 ? (
          <div className="whatsapp-inbox-empty-state flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[var(--kds-radius-lg)] border border-dashed p-6 text-center">
            {archivedSectionOpen ? <Archive className="h-8 w-8 whatsapp-inbox-empty-icon" /> : <MessageCircle className="h-8 w-8 whatsapp-inbox-empty-icon" />}
            <div className="space-y-1">
              <Text className="whatsapp-inbox-heading text-sm font-medium text-[var(--text-primary)]">{archivedSectionOpen ? 'Nenhum chat arquivado' : 'Nenhuma conversa ainda'}</Text>
              <Text className="text-sm text-[var(--text-secondary)]">{archivedSectionOpen ? 'Arquive uma conversa para ela aparecer nesta lista separada.' : 'As mensagens recebidas no WhatsApp aparecerão aqui automaticamente.'}</Text>
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
        )} />}
      </div>
    </div>
  );
}
