import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { useInboxChatLoader } from '../useInboxChatLoader';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValue: (value: unknown) => MockFunction;
  mockImplementation: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mockImplementationOnce: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => {
  const createMock = () => vi.fn() as unknown as MockFunction;
  return {
    list: createMock(),
    toastError: createMock(),
  };
});

vi.mock('../../data/conversationsRepository', () => ({
  whatsappConversationsRepository: { list: mocks.list },
}));

vi.mock('../../../../../infrastructure/supabase', () => ({
  isSupabaseConnectivityError: (error: unknown) => error instanceof Error && error.message === 'offline',
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError },
}));

type Loader = ReturnType<typeof useInboxChatLoader>;
type LoaderOptions = Parameters<typeof useInboxChatLoader>[0];

const Harness = ({ options, capture }: { options: LoaderOptions; capture: (loader: Loader) => void }) => {
  capture(useInboxChatLoader(options));
  return null;
};

const createChat = (id: string, isArchived = false): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: id,
  saved_contact_name: null,
  push_name: null,
  lead_id: null,
  lead_name: null,
  lead_status: null,
  lead_responsavel_id: null,
  lead_responsavel: null,
  merged_into_chat_id: null,
  lead_link_source: null,
  lead_linked_at: null,
  lead_linked_by: null,
  auto_link_blocked: false,
  identity_conflict: false,
  is_archived: isArchived,
  archived_at: null,
  is_muted: false,
  muted_at: null,
  is_pinned: false,
  pinned_at: null,
  manual_unread: false,
  manual_unread_at: null,
  last_message_text: null,
  last_message_direction: 'inbound',
  last_message_at: null,
  last_message_delivery_status: null,
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  last_read_at: null,
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const applyUpdate = <Value,>(update: Value | ((previous: Value) => Value), previous: Value): Value => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

const createOptions = (previousChats: CommWhatsAppChat[] = []) => {
  const selectedChat = previousChats.find((chat) => chat.is_archived) ?? previousChats[0] ?? null;
  const state: {
    chats: CommWhatsAppChat[];
    selectedChatId: string | null;
    chatLoadError: boolean;
    chatRefreshError: string | null;
    archivedChatsLoadingMore: boolean;
    archivedChatsHasMore: boolean;
    archivedChatsPage: number;
    archivedSectionOpen: boolean;
    archivedChatsLoading: boolean;
  } = {
    chats: previousChats,
    selectedChatId: selectedChat?.id ?? null,
    chatLoadError: false,
    chatRefreshError: null as string | null,
    archivedChatsLoadingMore: false,
    archivedChatsHasMore: false,
    archivedChatsPage: 0,
    archivedSectionOpen: false,
    archivedChatsLoading: false,
  };
  const archivedCountRefreshes = { current: 0 };
  const refs: LoaderOptions['refs'] = {
    archivedSectionOpenRef: { current: false },
    archivedChatsPageRef: { current: 1 },
    chatsRequestIdRef: { current: 0 },
    chatsLoadPromiseRef: { current: null },
    chatsLoadKeyRef: { current: null },
    latestChatsRef: { current: previousChats },
    selectedChatIdRef: { current: selectedChat?.id ?? null },
    chatIdFromUrlRef: { current: null },
    suppressAutoChatSelectionRef: { current: false },
    pendingChatInboxStateRef: { current: new Map() },
    savedContactNameByPhoneRef: { current: new Map() },
    savedContactNameOverrideByPhoneRef: { current: new Map() },
    chatsSignatureRef: { current: '' },
    chatPollIdleCyclesRef: { current: 0 },
    chatPollBackoffRef: { current: 0 },
    latestChatsLoadedAtRef: { current: 0 },
  };
  const options: LoaderOptions = {
    chatActivityFilter: 'all',
    leadStatusFilters: [],
    leadResponsavelFilters: [],
    pageSize: 250,
    archivedChatsLoading: false,
    archivedChatsLoadingMore: state.archivedChatsLoadingMore,
    archivedChatsHasMore: state.archivedChatsHasMore,
    archivedChatsPage: state.archivedChatsPage,
    refs,
    setArchivedChatsLoadingMore: (value) => {
      state.archivedChatsLoadingMore = applyUpdate(value, state.archivedChatsLoadingMore);
    },
    setArchivedChatsLoading: (value) => {
      state.archivedChatsLoading = applyUpdate(value, state.archivedChatsLoading);
    },
    setArchivedChatsHasMore: (value) => {
      state.archivedChatsHasMore = applyUpdate(value, state.archivedChatsHasMore);
    },
    setArchivedChatsPage: (value) => {
      state.archivedChatsPage = applyUpdate(value, state.archivedChatsPage);
    },
    setChatLoadError: (value) => { state.chatLoadError = applyUpdate(value, state.chatLoadError); },
    setChatRefreshError: (value) => { state.chatRefreshError = applyUpdate(value, state.chatRefreshError); },
    setChats: (value) => { state.chats = applyUpdate(value, state.chats); },
    setArchivedSectionOpen: (value) => { state.archivedSectionOpen = applyUpdate(value, state.archivedSectionOpen); },
    setSelectedChatId: (value) => {
      state.selectedChatId = applyUpdate<string | null>(value, state.selectedChatId);
    },
    applyFrontendSavedContactNames: (chats) => chats,
    applyPrefetchedLeadNames: (chats) => chats,
    buildChatsSignature: (chats) => chats.map((chat) => chat.id).join('|'),
    chatMatchesActiveFilters: () => true,
    refreshArchivedChatsCount: async () => { archivedCountRefreshes.current += 1; },
  };

  return { options, refs, state, archivedCountRefreshes };
};

const resetMocks = () => {
  mocks.list.mockReset();
  mocks.toastError.mockReset();
};

const stubDesktopMatchMedia = () => {
  const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({ matches: false, media } as MediaQueryList),
  });
  return () => {
    if (original) {
      Object.defineProperty(window, 'matchMedia', original);
    } else {
      Reflect.deleteProperty(window, 'matchMedia');
    }
  };
};

test('refresh da seção visível preserva a seleção arquivada em cache e substitui só a seção ativa', async () => {
  resetMocks();
  const oldActive = createChat('old-active');
  const selectedArchived = createChat('selected-archived', true);
  const freshActive = createChat('fresh-active');
  const state = createOptions([oldActive, selectedArchived]);
  const restoreMatchMedia = stubDesktopMatchMedia();
  mocks.list.mockResolvedValue([freshActive]);
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    await act(async () => { await loader?.loadChats(); });

    assert.deepEqual(mocks.list.mock.calls[0]?.[0], {
      activityFilter: 'all',
      leadStatusFilters: [],
      leadResponsavelFilters: [],
      archivedFilter: 'active',
      limit: 250,
      offset: 0,
    });
    assert.deepEqual(state.state.chats.map((chat) => chat.id).sort(), ['fresh-active', 'selected-archived']);
    assert.equal(state.state.selectedChatId, 'selected-archived');
    assert.equal(state.state.archivedChatsLoadingMore, false);
    assert.equal(state.state.chatLoadError, false);
    assert.equal(state.state.chatRefreshError, null);
    assert.ok(state.refs.latestChatsLoadedAtRef.current > 0);
  } finally {
    view.unmount();
    restoreMatchMedia();
  }
});

test('trocar para arquivados seleciona chat compatível, carrega as duas seções e atualiza a contagem', async () => {
  resetMocks();
  const currentActive = createChat('current-active');
  const nextArchived = createChat('next-archived', true);
  const state = createOptions([currentActive, nextArchived]);
  state.state.selectedChatId = currentActive.id;
  state.refs.selectedChatIdRef.current = currentActive.id;
  const restoreMatchMedia = stubDesktopMatchMedia();
  mocks.list.mockImplementation(async (params) => {
    const query = params as { archivedFilter: string };
    return query.archivedFilter === 'archived' ? [nextArchived] : [currentActive];
  });
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    let loadPromise: Promise<void> | null = null;
    await act(async () => {
      loader?.handleSwitchArchivedSection(true);
      loadPromise = state.refs.chatsLoadPromiseRef.current;
      await loadPromise;
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(state.state.archivedSectionOpen, true);
    assert.equal(state.state.selectedChatId, nextArchived.id);
    assert.equal(state.refs.chatIdFromUrlRef.current, nextArchived.id);
    assert.equal(state.archivedCountRefreshes.current, 1);
    assert.deepEqual(
      mocks.list.mock.calls.map(([params]) => (params as { archivedFilter: string }).archivedFilter).sort(),
      ['active', 'archived'],
    );
    assert.equal(state.state.archivedChatsLoading, false);
  } finally {
    view.unmount();
    restoreMatchMedia();
  }
});

test('falha de uma seção mantém o cache dela enquanto aplica a seção que carregou', async () => {
  resetMocks();
  const oldActive = createChat('old-active');
  const oldArchived = createChat('old-archived', true);
  const freshActive = createChat('fresh-active');
  const state = createOptions([oldActive, oldArchived]);
  const restoreMatchMedia = stubDesktopMatchMedia();
  mocks.list.mockImplementation(async (params) => {
    const query = params as { archivedFilter: string };
    if (query.archivedFilter === 'archived') {
      throw new Error('seção arquivada indisponível');
    }
    return [freshActive];
  });
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    await act(async () => {
      await loader?.loadChats({ sections: ['active', 'archived'], partialArchived: false });
    });

    assert.deepEqual(state.state.chats.map((chat) => chat.id).sort(), ['fresh-active', 'old-archived']);
    assert.equal(state.state.selectedChatId, 'old-archived');
    assert.equal(state.state.chatLoadError, false);
    assert.equal(
      state.state.chatRefreshError,
      'Não foi possível atualizar as conversas arquivadas. A lista disponível continua visível.',
    );
    assert.equal(mocks.toastError.mock.calls.length, 0);
  } finally {
    view.unmount();
    restoreMatchMedia();
  }
});

test('mesma carga em andamento é coalescida e sua resposta não aplica após invalidar a geração', async () => {
  resetMocks();
  const existing = createChat('existing');
  const state = createOptions([existing]);
  const deferredPage: { resolve?: (chats: CommWhatsAppChat[]) => void } = {};
  mocks.list.mockImplementationOnce(() => new Promise((resolve) => { deferredPage.resolve = resolve; }));
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    let firstLoad: Promise<unknown> | undefined;
    let coalescedLoad: Promise<unknown> | undefined;
    await act(async () => {
      firstLoad = loader?.loadChats();
      coalescedLoad = loader?.loadChats();
    });
    assert.equal(mocks.list.mock.calls.length, 1);

    state.refs.chatsRequestIdRef.current += 1;
    deferredPage.resolve?.([createChat('stale')]);
    await act(async () => { await Promise.all([firstLoad, coalescedLoad]); });

    assert.deepEqual(state.state.chats, [existing]);
    assert.equal(state.refs.latestChatsLoadedAtRef.current, 0);
    assert.equal(state.state.chatLoadError, false);
  } finally {
    view.unmount();
  }
});

test('carrega próxima página de arquivados no offset correto, mescla por ID e atualiza hasMore', async () => {
  resetMocks();
  const existingArchived = createChat('existing-archived', true);
  const nextArchived = createChat('next-archived', true);
  const state = createOptions([existingArchived]);
  state.state.archivedChatsPage = 2;
  state.options.archivedChatsPage = 2;
  state.options.archivedChatsHasMore = true;
  mocks.list.mockResolvedValue([nextArchived]);
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    await act(async () => { await loader?.handleLoadMoreArchivedChats(); });

    assert.deepEqual(mocks.list.mock.calls[0]?.[0], {
      activityFilter: 'all',
      leadStatusFilters: [],
      leadResponsavelFilters: [],
      archivedFilter: 'archived',
      limit: 250,
      offset: 500,
    });
    assert.deepEqual(state.state.chats.map((chat) => chat.id).sort(), ['existing-archived', 'next-archived']);
    assert.equal(state.state.archivedChatsHasMore, false);
    assert.equal(state.state.archivedChatsPage, 3);
    assert.equal(state.state.archivedChatsLoadingMore, false);
    assert.equal(state.refs.chatsSignatureRef.current, 'existing-archived|next-archived');
  } finally {
    view.unmount();
  }
});

test('carga incremental de arquivados usa lock por geração e descarta resposta obsoleta', async () => {
  resetMocks();
  const existingArchived = createChat('existing-archived', true);
  const state = createOptions([existingArchived]);
  state.state.archivedChatsPage = 1;
  state.options.archivedChatsPage = 1;
  state.options.archivedChatsHasMore = true;
  const deferredPage: { resolve?: (chats: CommWhatsAppChat[]) => void } = {};
  mocks.list.mockImplementationOnce(() => new Promise((resolve) => { deferredPage.resolve = resolve; }));
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    let firstLoad: Promise<void> | undefined;
    let duplicateLoad: Promise<void> | undefined;
    await act(async () => {
      firstLoad = loader?.handleLoadMoreArchivedChats();
      duplicateLoad = loader?.handleLoadMoreArchivedChats();
    });

    assert.equal(mocks.list.mock.calls.length, 1);
    state.refs.chatsRequestIdRef.current += 1;
    deferredPage.resolve?.([createChat('stale-archived', true)]);
    await act(async () => { await Promise.all([firstLoad, duplicateLoad]); });

    assert.deepEqual(state.state.chats, [existingArchived]);
    assert.equal(state.state.archivedChatsPage, 1);
    assert.equal(state.state.archivedChatsHasMore, false);
  } finally {
    view.unmount();
  }
});

test('falha de conectividade mostra o estado inicial de erro e aumenta o backoff sem toast', async () => {
  resetMocks();
  const state = createOptions();
  state.refs.chatPollBackoffRef.current = 2;
  mocks.list.mockRejectedValue(new Error('offline'));
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    await act(async () => { await loader?.loadChats(); });

    assert.equal(state.state.chatLoadError, true);
    assert.equal(state.state.chatRefreshError, null);
    assert.equal(state.refs.chatPollBackoffRef.current, 3);
    assert.equal(mocks.toastError.mock.calls.length, 0);
  } finally {
    view.unmount();
  }
});
