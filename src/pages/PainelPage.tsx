import { useState, useEffect } from 'react';
import { supabase, Lead, Reminder } from '../lib/supabase';
import Layout from '../components/Layout';
import Dashboard from '../components/Dashboard';
import LeadsManager from '../components/LeadsManager';
import ContractsManager from '../components/ContractsManager';
import RemindersManagerEnhanced from '../components/RemindersManagerEnhanced';
import EmailManager from '../components/EmailManager';
import BlogTab from '../components/config/BlogTab';
import ConfigPage from './ConfigPage';
import NotificationToast from '../components/NotificationToast';
import LeadNotificationToast from '../components/LeadNotificationToast';
import { notificationService } from '../lib/notificationService';
import { audioService } from '../lib/audioService';
import FinanceiroComissoesTab from '../components/finance/FinanceiroComissoesTab';
import FinanceiroAgendaTab from '../components/finance/FinanceiroAgendaTab';

export default function PainelPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [unreadReminders, setUnreadReminders] = useState(0);
  const [leadToConvert, setLeadToConvert] = useState<Lead | null>(null);
  const [activeNotifications, setActiveNotifications] = useState<Reminder[]>([]);
  const [activeLeadNotifications, setActiveLeadNotifications] = useState<Lead[]>([]);
  const [hasActiveNotification, setHasActiveNotification] = useState(false);
  const [newLeadsCount, setNewLeadsCount] = useState(0);

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

    const unsubscribeLeads = notificationService.subscribeToLeads((lead) => {
      setActiveLeadNotifications((prev) => [...prev, lead]);
      setNewLeadsCount((prev) => prev + 1);
      audioService.playNotificationSound();
    });

    return () => {
      clearInterval(interval);
      notificationService.stop();
      unsubscribe();
      unsubscribeLeads();
    };
  }, []);

  const loadUnreadReminders = async () => {
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
  };

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

  const handleTabChange = (tab: string) => {
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
        return <Dashboard onNavigateToTab={handleTabChange} />;
      case 'leads':
        return <LeadsManager onConvertToContract={handleConvertLead} />;
      case 'contracts':
        return <ContractsManager leadToConvert={leadToConvert} onConvertComplete={() => setLeadToConvert(null)} />;
      case 'financeiro-comissoes':
        return <FinanceiroComissoesTab />;
      case 'financeiro-agenda':
        return <FinanceiroAgendaTab />;
      case 'reminders':
        return <RemindersManagerEnhanced />;
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
