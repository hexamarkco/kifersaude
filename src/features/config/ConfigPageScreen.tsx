import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { useAuth } from "../../contexts/AuthContext";
import { useConfig } from "../../contexts/ConfigContext";
import { Alert, Badge, PageHeader, Tabs, type TabItem } from "../../design-system";
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
    <div className="panel-page-shell w-full space-y-6">
      <PageHeader
        eyebrow="Administracao"
        title="Configurações"
        description="Centralize a operação administrativa do CRM em áreas claras, seguras e orientadas à tarefa."
        actions={
          <Badge tone="gold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {allowedTabs.length} áreas disponíveis
          </Badge>
        }
      >
        <Tabs
          items={allowedTabs}
          value={activeAllowedTab}
          onChange={setActiveTab}
          variant="underline"
          listClassName="flex-nowrap overflow-x-auto"
        />
      </PageHeader>

      <main className="min-w-0">
          {activeAllowedTab === "system" && <SystemSettingsScreen />}
          {activeAllowedTab === "users" && <UsersScreen />}
          {activeAllowedTab === "automation" && <AutomationSettingsScreen />}
          {activeAllowedTab === "integrations" && <IntegrationsScreen />}
      </main>
    </div>
  );
}
