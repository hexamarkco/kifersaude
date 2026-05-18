import { AlertCircle } from "lucide-react";
import { useState } from "react";

import { useAuth } from "../../contexts/AuthContext";
import { useConfig } from "../../contexts/ConfigContext";
import { Alert, PageHeader, Surface, Tabs, type TabItem } from "../../design-system";
import AutomationSettingsScreen from "./automation/AutomationSettingsScreen";
import SystemSettingsScreen from "./general/SystemSettingsScreen";
import IntegrationsScreen from "./integrations/IntegrationsScreen";
import { getAllowedConfigTabs, type ConfigTabType } from "./shared/configTabs";
import UsersScreen from "./users/UsersScreen";

export default function ConfigPageScreen() {
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const [activeTab, setActiveTab] = useState<ConfigTabType>("system");

  const allowedTabs = getAllowedConfigTabs(
    role,
    getRoleModulePermission,
  ) as TabItem<ConfigTabType>[];

  if (allowedTabs.length === 0) {
    return (
      <div className="w-full">
        <Alert tone="danger" title="Acesso Negado" className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12" />
          Você não tem permissão para acessar esta página.
        </Alert>
      </div>
    );
  }

  const activeAllowedTab = allowedTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : allowedTabs[0].id;

  return (
    <div className="config-transparent-buttons panel-page-shell w-full">
      <PageHeader
        eyebrow="Administracao"
        title="Configurações"
        description="Centralize regras do sistema, acessos, automações e integrações."
        className="mb-8"
      />

      <Surface padding="none" className="mb-6 overflow-hidden">
        <Tabs
          items={allowedTabs}
          value={activeAllowedTab}
          onChange={setActiveTab}
          variant="panel"
          listClassName="rounded-b-none border-x-0 border-t-0"
        />

        <div className="p-6">
          {activeAllowedTab === "system" && <SystemSettingsScreen />}
          {activeAllowedTab === "users" && <UsersScreen />}
          {activeAllowedTab === "automation" && <AutomationSettingsScreen />}
          {activeAllowedTab === "integrations" && <IntegrationsScreen />}
        </div>
      </Surface>
    </div>
  );
}
