import { useState } from 'react';
import { Settings, Users, AlertCircle, Plug, GitBranch } from 'lucide-react';
import SystemSettingsTab from '../components/config/SystemSettingsTab';
import UsersTab from '../components/config/UsersTab';
import IntegrationsTab from '../components/config/IntegrationsTab';
import AutomationFlowsTab from '../components/config/AutomationFlowsTab';
import Card from '../components/ui/Card';
import Tabs, { type TabItem } from '../components/ui/Tabs';
import { useAuth } from '../contexts/AuthContext';

type TabType = 'system' | 'users' | 'integrations' | 'automation';

export default function ConfigPage() {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('system');

  if (!isAdmin) {
    return (
      <div className="w-full">
        <Card variant="glass" className="border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-600" />
          <h2 className="mb-2 text-2xl font-bold text-red-900">Acesso Negado</h2>
          <p className="text-red-700">Voce nao tem permissao para acessar esta pagina.</p>
        </Card>
      </div>
    );
  }

  const tabs: TabItem<TabType>[] = [
    { id: 'system', label: 'Geral', icon: Settings },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'automation', label: 'Automacoes', icon: GitBranch },
    { id: 'integrations', label: 'Integracoes', icon: Plug },
  ];

  return (
    <div className="config-transparent-buttons panel-page-shell w-full">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Configuracoes</h1>
        <p className="text-slate-600">Centralize regras do sistema, operadoras, acessos e integracoes</p>
      </div>

      <Card variant="glass" padding="none" className="mb-6 overflow-hidden">
        <Tabs
          items={tabs}
          value={activeTab}
          onChange={setActiveTab}
          variant="panel"
          listClassName="rounded-none border-x-0 border-t-0"
        />

        <div className="p-6">
          {activeTab === 'system' && <SystemSettingsTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'automation' && <AutomationFlowsTab />}
          {activeTab === 'integrations' && <IntegrationsTab />}
        </div>
      </Card>
    </div>
  );
}
