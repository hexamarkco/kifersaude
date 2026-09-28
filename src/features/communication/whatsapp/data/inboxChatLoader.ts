import type { ChatActivityFilter } from '../domain/chatFilters';
import type { ChatSection } from '../domain/chatLoadState';
import type { CommWhatsAppChat } from '../domain/types';

export const EMPTY_ACTIVE_CHAT_RETRY_DELAYS_MS = [700, 1500] as const;

type InboxChatListPageParams = {
  activityFilter: ChatActivityFilter;
  leadStatusFilters: string[];
  leadResponsavelFilters: string[];
  archivedFilter: ChatSection;
  limit: number;
  offset: number;
};

type LoadInboxChatSectionOptions = {
  section: ChatSection;
  listPage: (params: InboxChatListPageParams) => Promise<CommWhatsAppChat[]>;
  activityFilter: ChatActivityFilter;
  leadStatusFilters: string[];
  leadResponsavelFilters: string[];
  hasLoadFilters: boolean;
  partialArchived: boolean;
  archivedPage: number;
  pageSize: number;
  retryDelaysMs?: readonly number[];
  isRequestCurrent: () => boolean;
  waitBeforeRetry: (delayMs: number) => Promise<unknown>;
};

export type LoadedInboxChatSection = {
  chats: CommWhatsAppChat[];
  pagesFetched: number;
  hasMore: boolean;
};

export const loadInboxChatSection = async ({
  section,
  listPage,
  activityFilter,
  leadStatusFilters,
  leadResponsavelFilters,
  hasLoadFilters,
  partialArchived,
  archivedPage,
  pageSize,
  retryDelaysMs = EMPTY_ACTIVE_CHAT_RETRY_DELAYS_MS,
  isRequestCurrent,
  waitBeforeRetry,
}: LoadInboxChatSectionOptions): Promise<LoadedInboxChatSection> => {
  const chats: CommWhatsAppChat[] = [];
  let offset = 0;
  const isArchivedPartial = partialArchived && section === 'archived';
  const maxPages = isArchivedPartial ? Math.max(1, archivedPage) : Number.POSITIVE_INFINITY;
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    if (!isRequestCurrent()) break;

    let page: CommWhatsAppChat[] = [];
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      page = await listPage({
        activityFilter,
        leadStatusFilters,
        leadResponsavelFilters,
        archivedFilter: section,
        limit: pageSize,
        offset,
      });

      if (!isRequestCurrent()) break;

      const shouldRetryEmptyFirstPage = page.length === 0
        && offset === 0
        && !hasLoadFilters
        && section === 'active'
        && attempt < retryDelaysMs.length;

      if (!shouldRetryEmptyFirstPage) break;

      const delayMs = retryDelaysMs[attempt];
      if (delayMs === undefined) break;

      console.debug('[WhatsAppInbox] lista ativa veio vazia; tentando novamente antes de aceitar estado vazio', {
        attempt: attempt + 1,
        delayMs,
      });
      await waitBeforeRetry(delayMs);

      if (!isRequestCurrent()) break;
    }

    if (!isRequestCurrent()) break;

    chats.push(...page);
    pagesFetched += 1;

    if (page.length < pageSize) break;
    offset += page.length;
  }

  return {
    chats,
    pagesFetched,
    hasMore: isArchivedPartial && offset > 0 && chats.length >= pageSize,
  };
};
