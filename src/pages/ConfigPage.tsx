import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Users, Building2, AlertCircle, Zap, FileText } from 'lucide-react';
import SystemSettingsTab from '../components/config/SystemSettingsTab';
import OperadorasTab from '../components/config/OperadorasTab';
import UsersTab from '../components/config/UsersTab';
import ApiIntegrationsTab from '../components/config/ApiIntegrationsTab';
import BlogTab from '../components/config/BlogTab';

type TabType = 'system' | 'operadoras' | 'users' | 'apis' | 'blog';

export default function ConfigPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('system');

  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-900 mb-2">Acesso Negado</h2>
          <p className="text-red-700">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'system' as TabType, label: 'Sistema', icon: Settings },
    { id: 'operadoras' as TabType, label: 'Operadoras', icon: Building2 },
    { id: 'users' as TabType, label: 'Usuários', icon: Users },
    { id: 'blog' as TabType, label: 'Blog', icon: FileText },
    { id: 'apis' as TabType, label: 'Integrações', icon: Zap },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Configurações</h1>
        <p className="text-slate-600">Gerencie as configurações do sistema</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-orange-600 text-orange-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'system' && <SystemSettingsTab />}
          {activeTab === 'operadoras' && <OperadorasTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'blog' && <BlogTab />}
          {activeTab === 'apis' && <ApiIntegrationsTab />}
        </div>
      </div>
    </div>
  );
}
