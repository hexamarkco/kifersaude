import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Settings, Users, Building2, AlertCircle, Plug, GitBranch } from 'lucide-react';
import SystemSettingsTab from '../components/config/SystemSettingsTab';
import OperadorasTab from '../components/config/OperadorasTab';
import UsersTab from '../components/config/UsersTab';
import IntegrationsTab from '../components/config/IntegrationsTab';
import AutomationFlowsTab from '../components/config/AutomationFlowsTab';
import Card from '../components/ui/Card';
import Tabs, { type TabItem } from '../components/ui/Tabs';

type TabType = 'system' | 'operadoras' | 'users' | 'integrations' | 'automation';

export default function ConfigPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('system');

  if (!isAdmin) {
    return (
      <div className="w-full">
        <Card variant="glass" className="border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-900 mb-2">Acesso Negado</h2>
          <p className="text-red-700">Você não tem permissão para acessar esta página.</p>
        </Card>
      </div>
    );
  }

  const tabs: TabItem<TabType>[] = [
    { id: 'system' as TabType, label: 'Sistema', icon: Settings },
    { id: 'operadoras' as TabType, label: 'Operadoras', icon: Building2 },
    { id: 'users' as TabType, label: 'Usuários', icon: Users },
    { id: 'automation' as TabType, label: 'Automações', icon: GitBranch },
    { id: 'integrations' as TabType, label: 'Integrações', icon: Plug },
  ];

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Configurações</h1>
        <p className="text-slate-600">Gerencie as configurações do sistema</p>
      </div>

      <Card variant="glass" padding="none" className="mb-6 overflow-hidden">
        <Tabs items={tabs} value={activeTab} onChange={setActiveTab} />

        <div className="p-6">
          {activeTab === 'system' && <SystemSettingsTab />}
          {activeTab === 'operadoras' && <OperadorasTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'automation' && <AutomationFlowsTab />}
          {activeTab === 'integrations' && <IntegrationsTab />}
        </div>
      </Card>
    </div>
  );
}
