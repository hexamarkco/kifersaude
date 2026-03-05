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
import { PanelBootSkeleton } from '../components/ui/panelSkeletons';
import { useAdaptiveLoading } from '../hooks/useAdaptiveLoading';
import { PanelTopLoadingBar } from '../components/ui/panelLoading';

const ROUTE_TAB_MAP: Record<string, string> = {
  'dashboard': 'dashboard',
  'leads': 'leads',
  'contratos': 'contracts',
  'comissoes': 'financeiro-comissoes',
  'tarefas': 'financeiro-agenda',
  'lembretes': 'reminders',
  'whatsapp': 'whatsapp',
  'blog': 'blog',
  'config': 'config',
};

const TAB_ROUTE_MAP: Record<string, string> = {
  'dashboard': 'dashboard',
  'leads': 'leads',
  'contracts': 'contratos',
  'financeiro-comissoes': 'comissoes',
  'financeiro-agenda': 'tarefas',
  'reminders': 'lembretes',
  'whatsapp': 'whatsapp',
  'blog': 'blog',
  'config': 'config',
};

export default function PainelWrapper() {
  const { isObserver } = useAuth();
  const { leadOrigins, loading: configLoading } = useConfig();
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
  const configLoadingUi = useAdaptiveLoading(configLoading);

  const activeTab = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const route = pathParts[1] || 'dashboard';
    return ROUTE_TAB_MAP[route] || 'dashboard';
  }, [location.pathname]);

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

  const handleCloseNotification = (index: number) => {
    setActiveNotifications((prev) => prev.filter((_, i) => i !== index));
    if (activeNotifications.length <= 1) {
      setHasActiveNotification(false);
    }
  };

  const handleViewReminders = () => {
    handleTabChange('reminders');
  };

  const handleTabChange = (tab: string, options?: TabNavigationOptions) => {
    const route = TAB_ROUTE_MAP[tab];
    if (route) {
      navigate(`/painel/${route}`);
    }

    if (tab === 'reminders') {
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
    if (configLoadingUi.showSkeleton) {
      return <PanelBootSkeleton />;
    }

    return (
      <div className="min-h-screen bg-slate-50">
        <PanelTopLoadingBar
          active={configLoadingUi.showBar}
          fixed
          label="Preparando painel..."
        />
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
