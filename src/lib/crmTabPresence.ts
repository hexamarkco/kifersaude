type ActiveCrmTabRecord = {
  tabId: string;
  expiresAt: number;
};

const ACTIVE_CRM_TAB_STORAGE_KEY = 'kifer.crm.active-tab';
const ACTIVE_CRM_TAB_TTL_MS = 15_000;
const ACTIVE_CRM_TAB_HEARTBEAT_MS = 5_000;

const createTabId = () => {
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

  return `${Date.now()}-${randomId}`;
};

const isCurrentTabActive = () => (
  typeof document !== 'undefined'
  && document.visibilityState === 'visible'
  && document.hasFocus()
);

const readActiveTab = (): ActiveCrmTabRecord | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(ACTIVE_CRM_TAB_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<ActiveCrmTabRecord>;
    if (typeof parsed.tabId !== 'string' || typeof parsed.expiresAt !== 'number') {
      window.localStorage.removeItem(ACTIVE_CRM_TAB_STORAGE_KEY);
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(ACTIVE_CRM_TAB_STORAGE_KEY);
      return null;
    }

    return {
      tabId: parsed.tabId,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
};

const clearActiveTab = (tabId: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const activeTab = readActiveTab();
    if (activeTab?.tabId === tabId) {
      window.localStorage.removeItem(ACTIVE_CRM_TAB_STORAGE_KEY);
    }
  } catch {
    // Storage indisponível não deve impedir o fluxo de notificações.
  }
};

export const crmTabPresenceService = {
  start() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return () => undefined;
    }

    const tabId = createTabId();
    const syncPresence = () => {
      if (!isCurrentTabActive()) {
        clearActiveTab(tabId);
        return;
      }

      try {
        window.localStorage.setItem(
          ACTIVE_CRM_TAB_STORAGE_KEY,
          JSON.stringify({ tabId, expiresAt: Date.now() + ACTIVE_CRM_TAB_TTL_MS }),
        );
      } catch {
        // Storage indisponível: a checagem local de visibilidade continua válida.
      }
    };

    const stop = () => {
      window.clearInterval(heartbeatId);
      window.removeEventListener('focus', syncPresence);
      window.removeEventListener('blur', syncPresence);
      document.removeEventListener('visibilitychange', syncPresence);
      window.removeEventListener('pagehide', clearPresenceOnPageHide);
      clearActiveTab(tabId);
    };

    const clearPresenceOnPageHide = () => clearActiveTab(tabId);
    const heartbeatId = window.setInterval(syncPresence, ACTIVE_CRM_TAB_HEARTBEAT_MS);

    window.addEventListener('focus', syncPresence);
    window.addEventListener('blur', syncPresence);
    document.addEventListener('visibilitychange', syncPresence);
    window.addEventListener('pagehide', clearPresenceOnPageHide);
    syncPresence();

    return stop;
  },

  hasActiveTab() {
    return readActiveTab() !== null;
  },
};
