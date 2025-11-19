import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, Lead, Reminder } from './lib/supabase';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import LeadsManager from './components/LeadsManager';
import ContractsManager from './components/ContractsManager';
import RemindersManagerEnhanced from './components/RemindersManagerEnhanced';
import NotificationToast from './components/NotificationToast';
import LeadNotificationToast from './components/LeadNotificationToast';
import { notificationService } from './lib/notificationService';
import { pushSubscriptionService } from './lib/pushSubscriptionService';
import { audioService } from './lib/audioService';
import { useAuth } from './contexts/AuthContext';
import { useConfig } from './contexts/ConfigContext';
import type { TabNavigationOptions } from './types/navigation';

function App() {
  const { isObserver, session } = useAuth();
  const { leadOrigins } = useConfig();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadReminders, setUnreadReminders] = useState(0);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<Reminder[]>([]);
  const [activeLeadNotifications, setActiveLeadNotifications] = useState<Lead[]>([]);
  const [hasActiveNotification, setHasActiveNotification] = useState(false);
  const [newLeadsCount, setNewLeadsCount] = useState(0);

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

  const loadUnreadReminders = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('lido', false);

      if (error) throw error;
      setUnreadReminders(count || 0);
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error);
    }
  }, []);

  useEffect(() => {
    loadUnreadReminders();
    const interval = setInterval(loadUnreadReminders, 60000);

    notificationService.start(30000);

    const unsubscribe = notificationService.subscribe((reminder) => {
      setActiveNotifications((prev) => [...prev, reminder]);
      setHasActiveNotification(true);
      audioService.playNotificationSound();
      loadUnreadReminders();
    });

    return () => {
      clearInterval(interval);
      notificationService.stop();
      unsubscribe();
    };
  }, [loadUnreadReminders]);

  useEffect(() => {
    if (!session?.user) {
      return;
    }

    pushSubscriptionService.ensureSubscription().catch((error) => {
      console.error('Erro ao sincronizar a assinatura push', error);
    });
  }, [session?.user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.serviceWorker) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'push-service') {
        return;
      }

      const payload = event.data.payload;
      if (!payload) {
        return;
      }

      if (payload.type === 'reminder' && payload.reminder?.id) {
        notificationService.markAsNotified(payload.reminder.id);
      }

      if (payload.type === 'lead' && payload.lead?.id) {
        notificationService.markLeadAsNotified(payload.lead.id);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
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
  }, [isObserver, isOriginVisibleToObserver]);

  const handleConvertLead = (lead: Lead) => {
    setLeadToConvert(lead);
    setActiveTab('contracts');
  };

  const handleCloseNotification = (index: number) => {
    setActiveNotifications((prev) => prev.filter((_, i) => i !== index));
    if (activeNotifications.length <= 1) {
      setHasActiveNotification(false);
    }
  };

  const handleViewReminders = () => {
    setActiveTab('reminders');
    setHasActiveNotification(false);
  };

  const handleTabChange = (tab: string, _options?: TabNavigationOptions) => {
    setActiveTab(tab);
    if (tab === 'reminders') {
      setHasActiveNotification(false);
      setActiveNotifications([]);
    }
    if (tab === 'leads') {
      setNewLeadsCount(0);
    }
  };

  const handleCloseLeadNotification = (index: number) => {
    setActiveLeadNotifications((prev) => prev.filter((_, i) => i !== index));
  };

  const handleViewLead = () => {
    setActiveTab('leads');
    setNewLeadsCount(0);
    setActiveLeadNotifications([]);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'leads':
        return <LeadsManager onConvertToContract={handleConvertLead} />;
      case 'contracts':
        return <ContractsManager leadToConvert={leadToConvert} onConvertComplete={() => setLeadToConvert(null)} />;
      case 'reminders':
        return <RemindersManagerEnhanced />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadReminders={unreadReminders}
        hasActiveNotification={hasActiveNotification}
        newLeadsCount={newLeadsCount}
      >
        {renderContent()}
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

export default App;
