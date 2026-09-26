import { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import type { Lead } from '../features/leads';
import Layout from '../components/Layout';
import NotificationToast from '../components/NotificationToast';
import LeadNotificationToast from '../components/LeadNotificationToast';
import WhatsAppInboxNotificationToast from '../components/WhatsAppInboxNotificationToast';
import { browserNotificationService, type BrowserNotificationPermission } from '../lib/browserNotificationService';
import {
  notificationService,
  type InboxMessageNotification,
  type NotificationReminder,
} from '../lib/notificationService';
import { audioService } from '../lib/audioService';
import { crmTabPresenceService } from '../lib/crmTabPresence';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import {
  Alert,
  AppLoadingScreen,
  Button,
} from '../design-system';
import { RefreshCw } from 'lucide-react';
import type { TabNavigationOptions } from '../types/navigation';

const ROUTE_TAB_MAP: Record<string, string> = {
  'dashboard': 'dashboard',
  'leads': 'leads',
  'contratos': 'contracts',
  'comissoes': 'financeiro-comissoes',
  'agenda': 'agenda',
  'inbox': 'whatsapp-inbox',
  'disparos': 'whatsapp-campaigns',
  'tarefas': 'agenda',
  'lembretes': 'agenda',
  'blog': 'blog',
  'config': 'config',
};

const TAB_ROUTE_MAP: Record<string, string> = {
  'dashboard': 'dashboard',
  'leads': 'leads',
  'contracts': 'contratos',
  'financeiro-comissoes': 'comissoes',
  'agenda': 'agenda',
  'whatsapp-inbox': 'inbox',
  'whatsapp-campaigns': 'disparos',
  'blog': 'blog',
  'config': 'config',
};

export default function PainelWrapper() {
  const { isObserver, role } = useAuth();
  const {
    leadOrigins,
    loading: configLoading,
    loadError: configLoadError,
    retryLoad: retryConfigLoad,
    getRoleModulePermission,
  } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadReminders, setUnreadReminders] = useState(0);
  const [unreadInboxChats, setUnreadInboxChats] = useState(0);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<NotificationReminder[]>([]);
  const [activeLeadNotifications, setActiveLeadNotifications] = useState<Lead[]>([]);
  const [activeInboxNotifications, setActiveInboxNotifications] = useState<InboxMessageNotification[]>([]);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<BrowserNotificationPermission>(() => (
    browserNotificationService.getPermission()
  ));
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [leadStatusFilter, setLeadStatusFilter] = useState<string[] | undefined>();
  const [leadIdFilter, setLeadIdFilter] = useState<string | undefined>();
  const [contractOperadoraFilter, setContractOperadoraFilter] = useState<string | undefined>();
  const hasActiveNotification = activeNotifications.length > 0;

  const validTabIds = useMemo(() => {
    const entries: Array<[string, boolean]> = [
      ['dashboard', getRoleModulePermission(role, 'dashboard').can_view],
      ['leads', getRoleModulePermission(role, 'leads').can_view],
      ['contracts', getRoleModulePermission(role, 'contracts').can_view],
      ['financeiro-comissoes', getRoleModulePermission(role, 'financeiro-comissoes').can_view],
      ['agenda', getRoleModulePermission(role, 'agenda').can_view],
      ['whatsapp-inbox', getRoleModulePermission(role, 'whatsapp-inbox').can_view],
      ['whatsapp-campaigns', getRoleModulePermission(role, 'whatsapp-campaigns').can_view],
      ['blog', getRoleModulePermission(role, 'blog').can_view],
      [
        'config',
        ['config-system', 'config-users', 'config-automation', 'config-integrations', 'config-access'].some(
          (moduleId) => getRoleModulePermission(role, moduleId).can_view,
        ),
      ],
    ];

    return new Set(entries.filter(([, allowed]) => allowed).map(([tabId]) => tabId));
  }, [getRoleModulePermission, role]);

  const activeTab = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const route = pathParts[1] || 'dashboard';
    const requestedTab = ROUTE_TAB_MAP[route] || 'dashboard';
    return validTabIds.has(requestedTab) ? requestedTab : (Array.from(validTabIds)[0] ?? 'dashboard');
  }, [location.pathname, validTabIds]);

  const restrictedOriginNamesForObservers = useMemo(
    () => leadOrigins.filter((origin) => origin.visivel_para_observadores === false).map((origin) => origin.nome),
    [leadOrigins],
  );

  const isOriginVisibleToObserver = useCallback(
    (originName: string | null | undefined) => {
      if (!originName) {
        return true;
      }
      return !restrictedOriginNamesForObservers.includes(originName);
    },
    [restrictedOriginNamesForObservers],
  );

  useEffect(() => {
    const stopCrmTabPresence = crmTabPresenceService.start();
    const unsubscribeUnreadCount = notificationService.subscribeToUnreadCount(setUnreadReminders);
    const unsubscribeInboxUnreadCount = notificationService.subscribeToInboxUnreadCount(setUnreadInboxChats);
    notificationService.start(30000);

    const unsubscribe = notificationService.subscribe((reminder) => {
      setActiveNotifications((prev) => [...prev, reminder]);
      audioService.playNotificationSound();
    });

    const unsubscribeInboxMessages = notificationService.subscribeToInboxMessages((notification) => {
      setActiveInboxNotifications((prev) => [...prev, notification]);
      audioService.playNotificationSound();
      if (document.visibilityState === 'hidden' && !crmTabPresenceService.hasActiveTab()) {
        browserNotificationService.show({
          title: `WhatsApp: ${notification.displayName}`,
          body: notification.messagePreview,
          onClick: () => navigate(`/painel/inbox?chatId=${encodeURIComponent(notification.chatId)}`),
        });
      }
    });

    return () => {
      stopCrmTabPresence();
      notificationService.stop();
      unsubscribe();
      unsubscribeInboxMessages();
      unsubscribeUnreadCount();
      unsubscribeInboxUnreadCount();
    };
  }, [navigate]);

  useEffect(() => {
    if (configLoading) {
      return;
    }

    const unsubscribeLeads = notificationService.subscribeToLeads((lead) => {
      if (isObserver && !isOriginVisibleToObserver(lead.origem)) {
        return;
      }

      setActiveLeadNotifications((prev) => [...prev, lead]);
      setNewLeadsCount((prev) => prev + 1);
      audioService.playNotificationSound();
    });

    return () => {
      unsubscribeLeads();
    };
  }, [configLoading, isObserver, isOriginVisibleToObserver]);

  useEffect(() => {
    if (configLoading) {
      return;
    }

    const pathParts = location.pathname.split('/').filter(Boolean);
    const route = pathParts[1] || 'dashboard';
    const requestedTab = ROUTE_TAB_MAP[route] || 'dashboard';

    if (validTabIds.has(requestedTab)) {
      return;
    }

    const fallbackTab = Array.from(validTabIds)[0];
    const fallbackRoute = fallbackTab ? TAB_ROUTE_MAP[fallbackTab] : 'dashboard';
    navigate(`/painel/${fallbackRoute}`, { replace: true });
  }, [configLoading, location.pathname, navigate, validTabIds]);

  const handleCloseNotification = (reminder: NotificationReminder) => {
    setActiveNotifications((prev) => prev.filter((item) => item !== reminder));
  };

  const handleViewReminders = () => {
    handleTabChange('agenda');
  };

  const handleTabChange = (tab: string, options?: TabNavigationOptions) => {
    if (!validTabIds.has(tab)) {
      return;
    }

    const route = TAB_ROUTE_MAP[tab];
    if (route) {
      navigate(`/painel/${route}`);
    }

    if (tab === 'agenda') {
      setActiveNotifications([]);
    }
    if (tab === 'leads') {
      setNewLeadsCount(0);
      setLeadStatusFilter(options?.leadsStatusFilter);
      setLeadIdFilter(options?.leadIdFilter);
    } else if (options?.leadsStatusFilter === undefined) {
      setLeadStatusFilter(undefined);
      setLeadIdFilter(undefined);
    }

    if (tab === 'contracts') {
      setContractOperadoraFilter(options?.contractOperadoraFilter);
    } else if (options?.contractOperadoraFilter === undefined) {
      setContractOperadoraFilter(undefined);
    }
  };

  const handleCloseLeadNotification = (lead: Lead) => {
    setActiveLeadNotifications((prev) => prev.filter((item) => item !== lead));
  };

  const handleCloseInboxNotification = (notification: InboxMessageNotification) => {
    setActiveInboxNotifications((prev) => prev.filter((item) => item !== notification));
  };

  const handleViewLead = () => {
    handleTabChange('leads');
    setActiveLeadNotifications([]);
  };

  const handleViewInboxChat = (notification: InboxMessageNotification) => {
    setActiveInboxNotifications([]);
    navigate(`/painel/inbox?chatId=${encodeURIComponent(notification.chatId)}`);
  };

  const handleEnableBrowserNotifications = useCallback(async () => {
    const permission = await browserNotificationService.requestPermission();
    setBrowserNotificationPermission(permission);
  }, []);

  if (configLoading) {
    return <AppLoadingScreen />;
  }

  if (configLoadError) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Alert
          tone="danger"
          title="Não foi possível carregar as configurações do sistema."
          action={
            <Button variant="secondary" size="sm" onClick={retryConfigLoad}>
              <RefreshCw className="kds-control-icon" />
              <span>Tentar novamente</span>
            </Button>
          }
        >
          Verifique sua conexão ou sessão e tente novamente. Seus dados não foram apagados.
        </Alert>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>KS Workspace</title>
      </Helmet>
      <Layout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadReminders={unreadReminders}
        unreadInboxChats={unreadInboxChats}
        hasActiveNotification={hasActiveNotification}
        newLeadsCount={newLeadsCount}
        useFullBleedContent={activeTab === 'whatsapp-inbox'}
      >
        <Outlet context={{ 
          activeTab, 
          handleTabChange, 
          leadToConvert, 
          onConvertComplete: () => setLeadToConvert(null),
          setLeadToConvert,
          leadStatusFilter,
          leadIdFilter,
          contractOperadoraFilter,
        }} />
      </Layout>

      {activeNotifications.map((reminder) => (
        <NotificationToast
          key={reminder.id}
          reminder={reminder}
          onClose={() => handleCloseNotification(reminder)}
          onViewReminders={handleViewReminders}
        />
      ))}

      {activeLeadNotifications.map((lead) => (
        <LeadNotificationToast
          key={lead.id}
          lead={lead}
          onClose={() => handleCloseLeadNotification(lead)}
          onViewLead={handleViewLead}
        />
      ))}

      {activeInboxNotifications.map((notification) => (
        <WhatsAppInboxNotificationToast
          key={`${notification.chatId}-${notification.messageAt ?? notification.messagePreview}`}
          notification={notification}
          browserNotificationPermission={browserNotificationPermission}
          onClose={() => handleCloseInboxNotification(notification)}
          onViewChat={() => handleViewInboxChat(notification)}
          onEnableBrowserNotifications={handleEnableBrowserNotifications}
        />
      ))}
    </>
  );
}
