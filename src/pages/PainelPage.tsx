import { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { supabase, Lead, Reminder } from '../lib/supabase';
import Layout from '../components/Layout';
import Dashboard from '../components/Dashboard';
import LeadsManager from '../components/LeadsManager';
import ContractsManager from '../components/ContractsManager';
import RemindersManagerEnhanced from '../components/RemindersManagerEnhanced';
import EmailManager from '../components/EmailManager';
import BlogTab from '../components/config/BlogTab';
import ConfigPage from './ConfigPage';
import WhatsappPage from './WhatsappPage';
import NotificationToast from '../components/NotificationToast';
import LeadNotificationToast from '../components/LeadNotificationToast';
import { notificationService } from '../lib/notificationService';
import { audioService } from '../lib/audioService';
import FinanceiroComissoesTab from '../components/finance/FinanceiroComissoesTab';
import FinanceiroAgendaTab from '../components/finance/FinanceiroAgendaTab';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import type { WhatsappLaunchParams } from '../types/whatsapp';

export default function PainelPage() {
  const { isObserver } = useAuth();
  const { leadOrigins, loading: configLoading } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadReminders, setUnreadReminders] = useState(0);
  const [whatsappUnreadCount, setWhatsappUnreadCount] = useState(0);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<Reminder[]>([]);
  const [activeLeadNotifications, setActiveLeadNotifications] = useState<Lead[]>([]);
  const [hasActiveNotification, setHasActiveNotification] = useState(false);
  const [newLeadsCount, setNewLeadsCount] = useState(0);
  const [whatsappLaunchParams, setWhatsappLaunchParams] = useState<WhatsappLaunchParams | null>(null);

  const validTabIds = useMemo(
    () =>
      new Set([
        'dashboard',
        'leads',
        'contracts',
        'financeiro-comissoes',
        'financeiro-agenda',
        'whatsapp',
        'reminders',
        'email',
        'blog',
        'config',
      ]),
    [],
  );

  const updateSearchParamsForTab = useCallback(
    (tabId: string, nextWhatsappParams?: WhatsappLaunchParams | null) => {
      setSearchParams(
        currentParams => {
          const nextParams = new URLSearchParams(currentParams);

          nextParams.set('tab', tabId);

          if (tabId === 'whatsapp' && nextWhatsappParams?.phone) {
            nextParams.set('whatsappPhone', nextWhatsappParams.phone);

            if (nextWhatsappParams.chatName) {
              nextParams.set('whatsappName', nextWhatsappParams.chatName);
            } else {
              nextParams.delete('whatsappName');
            }

            if (nextWhatsappParams.leadId) {
              nextParams.set('whatsappLeadId', nextWhatsappParams.leadId);
            } else {
              nextParams.delete('whatsappLeadId');
            }

            if (nextWhatsappParams.message !== undefined && nextWhatsappParams.message !== null) {
              nextParams.set('whatsappMessage', nextWhatsappParams.message);
            } else {
              nextParams.delete('whatsappMessage');
            }
          } else {
            nextParams.delete('whatsappPhone');
            nextParams.delete('whatsappName');
            nextParams.delete('whatsappLeadId');
            nextParams.delete('whatsappMessage');
          }

          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

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
    const tabParam = searchParams.get('tab');
    const requestedTab = tabParam && validTabIds.has(tabParam) ? tabParam : 'dashboard';

    if (requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }

    const phoneParam = searchParams.get('whatsappPhone');

    if (phoneParam) {
      const messageParam = searchParams.get('whatsappMessage');
      const chatNameParam = searchParams.get('whatsappName');
      const leadIdParam = searchParams.get('whatsappLeadId');

      setWhatsappLaunchParams({
        phone: phoneParam,
        chatName: chatNameParam,
        leadId: leadIdParam,
        message: messageParam === null ? undefined : messageParam,
      });

      if (requestedTab !== 'whatsapp') {
        setActiveTab('whatsapp');
      }
    } else if (whatsappLaunchParams) {
      setWhatsappLaunchParams(null);
    }
  }, [activeTab, searchParams, validTabIds, whatsappLaunchParams]);

  useEffect(() => {
    if (activeTab === 'whatsapp') {
      return;
    }

    setWhatsappLaunchParams(null);
    setSearchParams(
      currentParams => {
        if (
          !currentParams.get('whatsappPhone') &&
          !currentParams.get('whatsappName') &&
          !currentParams.get('whatsappLeadId') &&
          !currentParams.get('whatsappMessage')
        ) {
          return currentParams;
        }

        const nextParams = new URLSearchParams(currentParams);
        nextParams.delete('whatsappPhone');
        nextParams.delete('whatsappName');
        nextParams.delete('whatsappLeadId');
        nextParams.delete('whatsappMessage');
        return nextParams;
      },
      { replace: true },
    );
  }, [activeTab, setSearchParams]);

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

  const handleConvertLead = (lead: Lead) => {
    setLeadToConvert(lead);
    handleTabChange('contracts');
  };

  const handleCloseNotification = (index: number) => {
    setActiveNotifications((prev) => prev.filter((_, i) => i !== index));
    if (activeNotifications.length <= 1) {
      setHasActiveNotification(false);
    }
  };

  const handleViewReminders = () => {
    handleTabChange('reminders');
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    updateSearchParamsForTab(tab, tab === 'whatsapp' ? whatsappLaunchParams : null);

    if (tab !== 'whatsapp') {
      setWhatsappLaunchParams(null);
    }

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
    handleTabChange('leads');
    setActiveLeadNotifications([]);
  };

  const handleOpenWhatsapp = (params: WhatsappLaunchParams) => {
    setWhatsappLaunchParams(params);
    setActiveTab('whatsapp');
    updateSearchParamsForTab('whatsapp', params);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigateToTab={handleTabChange} />;
      case 'leads':
        return <LeadsManager onConvertToContract={handleConvertLead} onOpenWhatsapp={handleOpenWhatsapp} />;
      case 'contracts':
        return <ContractsManager leadToConvert={leadToConvert} onConvertComplete={() => setLeadToConvert(null)} />;
      case 'financeiro-comissoes':
        return <FinanceiroComissoesTab />;
      case 'financeiro-agenda':
        return <FinanceiroAgendaTab />;
      case 'whatsapp':
        return (
          <WhatsappPage
            onUnreadCountChange={setWhatsappUnreadCount}
            initialChatPhone={whatsappLaunchParams?.phone}
            initialChatName={whatsappLaunchParams?.chatName}
            initialMessage={whatsappLaunchParams?.message ?? undefined}
          />
        );
      case 'reminders':
        return <RemindersManagerEnhanced onOpenWhatsapp={handleOpenWhatsapp} />;
      case 'email':
        return <EmailManager />;
      case 'blog':
        return <BlogTab />;
      case 'config':
        return <ConfigPage />;
      default:
        return <Dashboard />;
    }
  };

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
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
        whatsappUnreadCount={whatsappUnreadCount}
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
