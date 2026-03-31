import { AlertCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import Card from "../../components/ui/Card";
import Tabs, { type TabItem } from "../../components/ui/Tabs";
import { useAuth } from "../../contexts/AuthContext";
import { useConfig } from "../../contexts/ConfigContext";
import AutomationSettingsScreen from "./automation/AutomationSettingsScreen";
import SystemSettingsScreen from "./general/SystemSettingsScreen";
import IntegrationsScreen from "./integrations/IntegrationsScreen";
import { getAllowedConfigTabs, type ConfigTabType } from "./shared/configTabs";
import UsersScreen from "./users/UsersScreen";

const isConfigTabType = (value: string | null): value is ConfigTabType =>
  value === "system" || value === "users" || value === "integrations" || value === "automation";

export default function ConfigPageScreen() {
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();

  const allowedTabs = getAllowedConfigTabs(
    role,
    getRoleModulePermission,
  ) as TabItem<ConfigTabType>[];

  if (allowedTabs.length === 0) {
    return (
      <div className="w-full">
        <Card
          variant="glass"
          className="border-red-200 bg-red-50 p-8 text-center"
        >
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-600" />
          <h2 className="mb-2 text-2xl font-bold text-red-900">
            Acesso Negado
          </h2>
          <p className="text-red-700">
            Você não tem permissão para acessar esta página.
          </p>
        </Card>
      </div>
    );
  }

  const requestedTab = searchParams.get("tab");
  const activeAllowedTab =
    isConfigTabType(requestedTab) && allowedTabs.some((tab) => tab.id === requestedTab)
      ? requestedTab
      : allowedTabs[0].id;

  const handleTabChange = (nextTab: ConfigTabType) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextTab === allowedTabs[0].id) {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", nextTab);
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <div className="config-transparent-buttons panel-page-shell w-full">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">
          Configurações
        </h1>
        <p className="text-slate-600">
          Centralize regras do sistema, operadoras, acessos e integrações
        </p>
      </div>

      <Card variant="glass" padding="none" className="mb-6 overflow-hidden">
        <Tabs
          items={allowedTabs}
          value={activeAllowedTab}
          onChange={handleTabChange}
          variant="panel"
          listClassName="rounded-none border-x-0 border-t-0"
        />

        <div className="p-6">
          {activeAllowedTab === "system" && <SystemSettingsScreen />}
          {activeAllowedTab === "users" && <UsersScreen />}
          {activeAllowedTab === "automation" && <AutomationSettingsScreen />}
          {activeAllowedTab === "integrations" && <IntegrationsScreen />}
        </div>
      </Card>
    </div>
  );
}
