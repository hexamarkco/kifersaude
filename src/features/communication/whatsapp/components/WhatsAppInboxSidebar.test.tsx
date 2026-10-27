import assert from 'node:assert/strict';
import { act, createRef, useState, type ComponentProps } from 'react';
import { test } from 'vitest';
import { render } from '../../../../testing-library/react';
import { WhatsAppInboxSidebar } from './WhatsAppInboxSidebar';

const noop = () => undefined;
const sidebarProps = {
  leadStatuses: [], archivedSectionOpen: false, archivedChatsCount: 0,
  archivedChatsLoading: false, archivedChatsLoadingMore: false, archivedChatsHasMore: false,
  onSwitchArchivedSection: noop, onLoadMoreArchivedChats: noop, onOpenAgenda: noop,
  onOpenScheduledMessages: noop, onOpenDashboard: noop, onStartChat: noop, canViewAgenda: true,
  allScheduledMessagesPanelOpen: false, searchDraft: '', onSearchDraftChange: noop,
  hasActiveChatFilters: false, activeChatFiltersCount: 0, onClearFilters: noop,
  chatRefreshError: null, chatLoadError: false, loading: false, onRetryChatLoad: noop,
  sidebarChats: [], filteredMessageSearchResults: [], search: '', searchingChats: false,
  searchingMessages: false, chatSearchError: null, messageSearchError: null, onRetrySearch: noop,
  selectedChatId: null, connectedUserName: null, composerDraftsByChatId: {},
  favoritedLeadIds: new Set<string>(), onSelectChat: noop, onSelectMessageSearchResult: noop,
  openChatMenuChatId: null, updatingChatStateId: null, onToggleChatMenu: noop,
  onOpenChatMenuFromContext: noop, chatMenuTriggerRefs: { current: {} },
} satisfies Omit<ComponentProps<typeof WhatsAppInboxSidebar>, 'advancedFiltersOpen' | 'advancedFiltersTriggerRef' | 'onToggleAdvancedFilters'>;

test('filters trigger registers its positioning anchor and exposes the open state', () => {
  const triggerRef = createRef<HTMLButtonElement>();
  function Harness() {
    const [open, setOpen] = useState(false);
    return <WhatsAppInboxSidebar {...sidebarProps} advancedFiltersOpen={open}
      advancedFiltersTriggerRef={triggerRef}
      onToggleAdvancedFilters={() => setOpen(current => !current)} />;
  }
  const view = render(<Harness />);
  try {
    const button = [...view.container.querySelectorAll('button')].find(node => node.textContent?.trim() === 'Filtros');
    assert.ok(button);
    assert.equal(triggerRef.current, button);
    assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
    act(() => button.click());
    assert.equal(button.getAttribute('aria-expanded'), 'true');
    act(() => button.click());
    assert.equal(button.getAttribute('aria-expanded'), 'false');
  } finally { view.unmount(); }
  assert.equal(triggerRef.current, null);
});
