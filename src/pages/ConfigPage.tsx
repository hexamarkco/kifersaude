import { useState } from 'react';
import { Settings, Users, AlertCircle, Plug, GitBranch } from 'lucide-react';
import SystemSettingsTab from '../components/config/SystemSettingsTab';
import UsersTab from '../components/config/UsersTab';
import IntegrationsTab from '../components/config/IntegrationsTab';
import AutomationFlowsTab from '../components/config/AutomationFlowsTab';
import Card from '../components/ui/Card';
import Tabs, { type TabItem } from '../components/ui/Tabs';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';

type TabType = 'system' | 'users' | 'integrations' | 'automation';

export default function ConfigPage() {
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const [activeTab, setActiveTab] = useState<TabType>('system');

  const allowedTabs: TabItem<TabType>[] = [
    getRoleModulePermission(role, 'config-system').can_view
      ? { id: 'system', label: 'Geral', icon: Settings }
      : null,
    getRoleModulePermission(role, 'config-users').can_view
      ? { id: 'users', label: 'Usu?rios', icon: Users }
      : null,
    getRoleModulePermission(role, 'config-automation').can_view
      ? { id: 'automation', label: 'Automa??es', icon: GitBranch }
      : null,
    getRoleModulePermission(role, 'config-integrations').can_view
      ? { id: 'integrations', label: 'Integra??es', icon: Plug }
      : null,
  ].filter(Boolean) as TabItem<TabType>[];

  if (allowedTabs.length === 0) {
    return (
      <div className="w-full">
        <Card variant="glass" className="border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-600" />
          <h2 className="mb-2 text-2xl font-bold text-red-900">Acesso Negado</h2>
          <p className="text-red-700">Voc? n?o tem permiss?o para acessar esta p?gina.</p>
        </Card>
      </div>
    );
  }

  const tabs = allowedTabs;
  const activeAllowedTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0].id;

  return (
    <div className="config-transparent-buttons panel-page-shell w-full">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Configura??es</h1>
        <p className="text-slate-600">Centralize regras do sistema, operadoras, acessos e integra??es</p>
      </div>

      <Card variant="glass" padding="none" className="mb-6 overflow-hidden">
        <Tabs
          items={tabs}
          value={activeAllowedTab}
          onChange={setActiveTab}
          variant="panel"
          listClassName="rounded-none border-x-0 border-t-0"
        />

        <div className="p-6">
          {activeAllowedTab === 'system' && <SystemSettingsTab />}
          {activeAllowedTab === 'users' && <UsersTab />}
          {activeAllowedTab === 'automation' && <AutomationFlowsTab />}
          {activeAllowedTab === 'integrations' && <IntegrationsTab />}
        </div>
      </Card>
    </div>
  );
}
