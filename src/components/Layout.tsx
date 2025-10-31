import { ReactNode, useState } from 'react';
import { Users, FileText, LayoutDashboard, Bell, LogOut, Settings, MessageCircle, ChevronDown, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type TabConfig = {
  id: string;
  label: string;
  icon: any;
  badge?: number;
  badgeColor?: string;
  children?: TabConfig[];
};

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
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  const crmChildren = [
    { id: 'leads', label: 'Leads', icon: Users, badge: newLeadsCount, badgeColor: 'bg-orange-500' },
    { id: 'contracts', label: 'Contratos', icon: FileText },
  ];

  const comunicacaoChildren = !isObserver ? [
    { id: 'reminders', label: 'Lembretes', icon: Bell, badge: unreadReminders },
    { id: 'whatsapp-history', label: 'WhatsApp', icon: MessageCircle },
  ] : [];

  const baseTabs: TabConfig[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'crm', label: 'CRM', icon: Briefcase, children: crmChildren },
  ];

  if (!isObserver && comunicacaoChildren.length > 0) {
    baseTabs.push({ id: 'comunicacao', label: 'Comunicação', icon: MessageCircle, children: comunicacaoChildren });
  }

  const tabs = isAdmin
    ? [...baseTabs, { id: 'config', label: 'Configurações', icon: Settings }]
    : baseTabs;

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleTabClick = (tab: TabConfig) => {
    if (tab.children && tab.children.length > 0) {
      setExpandedParent(expandedParent === tab.id ? null : tab.id);
    } else {
      onTabChange(tab.id);
      setExpandedParent(null);
    }
  };

  const isParentActive = (tab: TabConfig) => {
    if (tab.id === activeTab) return true;
    if (tab.children) {
      return tab.children.some(child => child.id === activeTab);
    }
    return false;
  };

  const getTotalBadge = (tab: TabConfig): number => {
    if (!tab.children) return tab.badge || 0;
    return tab.children.reduce((sum, child) => sum + (child.badge || 0), 0);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
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
                  const isActive = isParentActive(tab);
                  const isExpanded = expandedParent === tab.id;
                  const totalBadge = getTotalBadge(tab);

                  return (
                    <div key={tab.id} className="relative">
                      <button
                        onClick={() => handleTabClick(tab)}
                        className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-orange-50 text-orange-700'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4" />
                          <span>{tab.label}</span>
                          {tab.children && tab.children.length > 0 && (
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                        {totalBadge > 0 && (
                          <span className={`absolute -top-1 -right-1 ${
                            tab.badgeColor || 'bg-orange-500'
                          } text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${
                            hasActiveNotification && (tab.id === 'comunicacao' || activeTab === 'reminders') ? 'animate-pulse' : ''
                          } ${
                            (tab.id === 'crm' || activeTab === 'leads') && newLeadsCount > 0 ? 'animate-pulse' : ''
                          }`}>
                            {totalBadge > 9 ? '9+' : totalBadge}
                          </span>
                        )}
                      </button>

                      {tab.children && isExpanded && (
                        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px] z-50">
                          {tab.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <button
                                key={child.id}
                                onClick={() => {
                                  onTabChange(child.id);
                                  setExpandedParent(null);
                                }}
                                className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors flex items-center justify-between ${
                                  activeTab === child.id
                                    ? 'bg-orange-50 text-orange-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center space-x-2">
                                  <ChildIcon className="w-4 h-4" />
                                  <span>{child.label}</span>
                                </div>
                                {child.badge !== undefined && child.badge > 0 && (
                                  <span className={`${
                                    child.badgeColor || 'bg-orange-500'
                                  } text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${
                                    child.id === 'reminders' && hasActiveNotification ? 'animate-pulse' : ''
                                  } ${
                                    child.id === 'leads' && child.badge > 0 ? 'animate-pulse' : ''
                                  }`}>
                                    {child.badge > 9 ? '9+' : child.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
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
