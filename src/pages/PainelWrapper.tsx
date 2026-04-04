import { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Lead, Reminder } from '../lib/supabase';
import Layout from '../components/Layout';
import NotificationToast from '../components/NotificationToast';
import LeadNotificationToast from '../components/LeadNotificationToast';
import { notificationService } from '../lib/notificationService';
import { audioService } from '../lib/audioService';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import type { TabNavigationOptions } from '../types/navigation';

const ROUTE_TAB_MAP: Record<string, string> = {
  'dashboard': 'dashboard',
  'leads': 'leads',
  'cotador': 'cotador',
  'contratos': 'contracts',
  'comissoes': 'financeiro-comissoes',
  'agenda': 'agenda',
  'inbox': 'whatsapp-inbox',
  'tarefas': 'agenda',
  'lembretes': 'agenda',
  'blog': 'blog',
  'config': 'config',
};

const TAB_ROUTE_MAP: Record<string, string> = {
  'dashboard': 'dashboard',
  'leads': 'leads',
  'cotador': 'cotador',
  'contracts': 'contratos',
  'financeiro-comissoes': 'comissoes',
  'agenda': 'agenda',
  'whatsapp-inbox': 'inbox',
  'blog': 'blog',
  'config': 'config',
};

export default function PainelWrapper() {
  const { isObserver, role } = useAuth();
  const { leadOrigins, loading: configLoading, getRoleModulePermission } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadReminders, setUnreadReminders] = useState(0);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<Reminder[]>([]);
  const [activeLeadNotifications, setActiveLeadNotifications] = useState<Lead[]>([]);
  const [hasActiveNotification, setHasActiveNotification] = useState(false);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [leadStatusFilter, setLeadStatusFilter] = useState<string[] | undefined>();
  const [leadIdFilter, setLeadIdFilter] = useState<string | undefined>();
  const [contractOperadoraFilter, setContractOperadoraFilter] = useState<string | undefined>();

  const validTabIds = useMemo(() => {
    const entries: Array<[string, boolean]> = [
      ['dashboard', getRoleModulePermission(role, 'dashboard').can_view],
      ['leads', getRoleModulePermission(role, 'leads').can_view],
      ['cotador', getRoleModulePermission(role, 'cotador').can_view],
      ['contracts', getRoleModulePermission(role, 'contracts').can_view],
      ['financeiro-comissoes', getRoleModulePermission(role, 'financeiro-comissoes').can_view],
      ['agenda', getRoleModulePermission(role, 'agenda').can_view],
      ['whatsapp-inbox', getRoleModulePermission(role, 'whatsapp-inbox').can_view],
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
    const unsubscribeUnreadCount = notificationService.subscribeToUnreadCount(setUnreadReminders);
    notificationService.start(30000);

    const unsubscribe = notificationService.subscribe((reminder) => {
      setActiveNotifications((prev) => [...prev, reminder]);
      setHasActiveNotification(true);
      audioService.playNotificationSound();
    });

    return () => {
      notificationService.stop();
      unsubscribe();
      unsubscribeUnreadCount();
    };
  }, []);

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

  const handleCloseNotification = (index: number) => {
    setActiveNotifications((prev) => prev.filter((_, i) => i !== index));
    if (activeNotifications.length <= 1) {
      setHasActiveNotification(false);
    }
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
      setHasActiveNotification(false);
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

  const handleCloseLeadNotification = (index: number) => {
    setActiveLeadNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleViewLead = () => {
    handleTabChange('leads');
    setActiveLeadNotifications([]);
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-amber-600" />
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

      {activeNotifications.map((reminder, index) => (
        <NotificationToast
          key={`${reminder.id}-${index}`}
          reminder={reminder}
          onClose={() => handleCloseNotification(index)}
          onViewReminders={handleViewReminders}
        />
      ))}

      {activeLeadNotifications.map((lead, index) => (
        <LeadNotificationToast
          key={`${lead.id}-${index}`}
          lead={lead}
          onClose={() => handleCloseLeadNotification(index)}
          onViewLead={handleViewLead}
        />
      ))}
    </>
  );
}
