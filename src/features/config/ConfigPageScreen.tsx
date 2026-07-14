import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";

import { useAuth } from "../../contexts/AuthContext";
import { useConfig } from "../../contexts/ConfigContext";
import { Alert, Badge, CardIcon, PageHeader, Surface, type TabItem } from "../../design-system";
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
  const activeTabDetails = {
    system: {
      eyebrow: "Base operacional",
      title: "Geral",
      description: "Preferências, acessos, catálogo comercial, leads e contratos.",
    },
    users: {
      eyebrow: "Equipe e acesso",
      title: "Usuários",
      description: "Gerencie contas, perfis e níveis de acesso da equipe.",
    },
    automation: {
      eyebrow: "Operação assistida",
      title: "Automações",
      description: "Configure fluxos, gatilhos e monitoramento dos envios automáticos.",
    },
    integrations: {
      eyebrow: "Canais e inteligência",
      title: "Integrações",
      description: "Conecte IA, WhatsApp e ferramentas de rastreamento.",
    },
  }[activeAllowedTab];

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
      />

      <div className="grid items-start gap-5 2xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="2xl:sticky 2xl:top-5">
          <Surface padding="sm" className="kds-config-navigation">
          <div className="px-2 pb-3 pt-1">
            <p className="kds-op-section-label">Áreas administrativas</p>
            <p className="mt-1 text-sm leading-5 text-[var(--text-muted)]">
              Selecione uma área para gerenciar suas regras e conexões.
            </p>
          </div>
          <nav aria-label="Áreas de configuração" className="kds-config-nav-list">
            {allowedTabs.map((tab) => {
              const Icon = tab.icon;
              const details = activeTabDetails && tab.id === activeAllowedTab
                ? activeTabDetails
                : {
                    system: { eyebrow: "Base operacional", title: "Geral", description: "Preferências e catálogo comercial." },
                    users: { eyebrow: "Equipe e acesso", title: "Usuários", description: "Contas e perfis da equipe." },
                    automation: { eyebrow: "Operação assistida", title: "Automações", description: "Fluxos e monitoramento." },
                    integrations: { eyebrow: "Canais e inteligência", title: "Integrações", description: "IA, WhatsApp e rastreamento." },
                  }[tab.id];
              const isActive = tab.id === activeAllowedTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`kds-config-nav-item ${isActive ? "is-active" : ""}`}
                  aria-pressed={isActive}
                >
                  {Icon && (
                    <CardIcon tone={isActive ? "terracotta" : "gold"} className="kds-config-nav-icon">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </CardIcon>
                  )}
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold text-[var(--text-primary)]">{details.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{details.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          </Surface>
        </aside>

        <main className="min-w-0">
          <div className="mb-5 flex items-start gap-3 px-1">
            <CardIcon tone="gold" className="mt-0.5">
              {(() => {
                const Icon = allowedTabs.find((tab) => tab.id === activeAllowedTab)?.icon;
                return Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null;
              })()}
            </CardIcon>
            <div>
              <p className="kds-op-section-label">{activeTabDetails.eyebrow}</p>
              <h2 className="kds-section-title kds-section-title-h2 mt-1">{activeTabDetails.title}</h2>
              <p className="kds-section-description mt-1">{activeTabDetails.description}</p>
            </div>
          </div>
          {activeAllowedTab === "system" && <SystemSettingsScreen />}
          {activeAllowedTab === "users" && <UsersScreen />}
          {activeAllowedTab === "automation" && <AutomationSettingsScreen />}
          {activeAllowedTab === "integrations" && <IntegrationsScreen />}
        </main>
      </div>
    </div>
  );
}
