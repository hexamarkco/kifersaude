import { ReactNode } from 'react';
import { Users, FileText, LayoutDashboard, Bell, LogOut, Settings, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type LayoutProps = {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadReminders: number;
  hasActiveNotification?: boolean;
  newLeadsCount?: number;
};

export default function Layout({
  children,
  activeTab,
  onTabChange,
  unreadReminders,
  hasActiveNotification,
  newLeadsCount = 0
}: LayoutProps) {
  const { signOut, isAdmin, isObserver } = useAuth();
  const navigate = useNavigate();

  const baseTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads', label: 'Leads', icon: Users, badge: newLeadsCount, badgeColor: 'bg-teal-500' },
    { id: 'contracts', label: 'Contratos', icon: FileText },
  ];

  // Add reminders tab only for non-observers
  if (!isObserver) {
    baseTabs.push({ id: 'reminders', label: 'Lembretes', icon: Bell, badge: unreadReminders });
    baseTabs.push({ id: 'whatsapp-history', label: 'WhatsApp', icon: MessageCircle });
  }

  const tabs = isAdmin
    ? [...baseTabs, { id: 'config', label: 'Configurações', icon: Settings }]
    : baseTabs;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">K</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Kifer Saúde</h1>
                <p className="text-xs text-slate-500">Sistema de Gestão</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <nav className="flex space-x-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => onTabChange(tab.id)}
                      className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-teal-50 text-teal-700'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </div>
                      {tab.badge !== undefined && tab.badge > 0 && (
                        <span className={`absolute -top-1 -right-1 ${
                          tab.badgeColor || 'bg-red-500'
                        } text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${
                          hasActiveNotification && tab.id === 'reminders' ? 'animate-pulse' : ''
                        } ${
                          tab.id === 'leads' && tab.badge > 0 ? 'animate-pulse' : ''
                        }`}>
                          {tab.badge > 9 ? '9+' : tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
              <button
                onClick={handleLogout}
                className="p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
