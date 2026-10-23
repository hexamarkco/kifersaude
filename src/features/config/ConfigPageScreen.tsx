import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { useConfig } from "../../contexts/ConfigContext";
import { Alert, Badge, PageHeader, Tabs, type TabItem } from "../../design-system";
import AiConfigScreen from "./ai/AiConfigScreen";
import AutomationSettingsScreen from "./automation/AutomationSettingsScreen";
import FormsScreen from "./forms/FormsScreen";
import SystemSettingsScreen from "./general/SystemSettingsScreen";
import IntegrationsScreen from "./integrations/IntegrationsScreen";
import LinksScreen from "./links/LinksScreen";
import { CONFIG_TAB_DEFINITIONS, getAllowedConfigTabs, getConfigAreaForTab, type ConfigArea, type ConfigTabType } from "./shared/configTabs";
import { useConfigParam } from "./shared/useConfigTab";
import UsersScreen from "./users/UsersScreen";

const ALL_TAB_IDS = CONFIG_TAB_DEFINITIONS.map((t) => t.id);

export default function ConfigPageScreen({ area = "settings" }: { area?: ConfigArea }) {
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const location = useLocation();
  const [activeTab, setActiveTab] = useConfigParam("tab", ALL_TAB_IDS, area === "automation" ? "automation" : "system");

  const allowedTabs = getAllowedConfigTabs(
    role,
    getRoleModulePermission,
    area,
  ) as TabItem<ConfigTabType>[];

  // Keep saved links to moved tabs working, including their existing filters.
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const requestedArea = getConfigAreaForTab(requestedTab);
  if (requestedArea && requestedArea !== area) {
    return <Navigate replace to={{ pathname: requestedArea === "automation" ? "/painel/automacoes" : "/painel/config", search: location.search }} />;
  }

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
    <div className="kds-config-screen panel-page-shell w-full space-y-6">
      <PageHeader
        eyebrow="Administração"
        title={area === "automation" ? "Automações, integrações e IA" : "Configurações"}
        description={area === "automation" ? "Organize os atendimentos automáticos, conecte serviços e configure a inteligência artificial." : "Ajuste o sistema, os cadastros e os acessos da equipe."}
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
          variant="rail"
          size={area === "automation" ? "sm" : "md"}
          ariaLabel={area === "automation" ? "Áreas de automações e IA" : "Áreas de configurações"}
          listClassName="flex-nowrap overflow-x-auto"
          triggerClassName="shrink-0 whitespace-nowrap"
        />
      </PageHeader>

      <main className="min-w-0">
          {activeAllowedTab === "system" && <SystemSettingsScreen />}
          {activeAllowedTab === "users" && <UsersScreen />}
          {activeAllowedTab === "automation" && <AutomationSettingsScreen />}
          {activeAllowedTab === "integrations" && <IntegrationsScreen />}
          {activeAllowedTab === "ai" && <AiConfigScreen />}
          {activeAllowedTab === "links" && <LinksScreen />}
          {activeAllowedTab === "forms" && <FormsScreen />}
      </main>
    </div>
  );
}
