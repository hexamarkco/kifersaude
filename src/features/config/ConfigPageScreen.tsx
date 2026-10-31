import { AlertCircle } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { useConfig } from "../../contexts/ConfigContext";
import { Alert, Button, PageHeader, Tabs, type TabItem } from "../../design-system";
import { Plus } from "lucide-react";
import { useState } from "react";
import AiConfigScreen from "./ai/AiConfigScreen";
import AutomationSettingsScreen from "./automation/AutomationSettingsScreen";
import FormsScreen from "./forms/FormsScreen";
import SystemSettingsScreen from "./general/SystemSettingsScreen";
import IntegrationsScreen from "./integrations/IntegrationsScreen";
import LinksScreen from "./links/LinksScreen";
import { CONFIG_TAB_DEFINITIONS, getAllowedConfigTabs, getConfigAreaForTab, type ConfigArea, type ConfigTabType } from "./shared/configTabs";
import { useConfigParam } from "./shared/useConfigTab";
import UsersScreen from "./users/UsersScreen";
import { CONTRACT_CONFIG_MANAGERS, LEAD_CONFIG_MANAGERS } from "./general/shared/systemSettingsConfig";

const ALL_TAB_IDS = CONFIG_TAB_DEFINITIONS.map((t) => t.id);

export default function ConfigPageScreen({ area = "settings" }: { area?: ConfigArea }) {
  const { role } = useAuth();
  const { getRoleModulePermission } = useConfig();
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [createLinkDialogOpen, setCreateLinkDialogOpen] = useState(false);
  const [createFormDialogOpen, setCreateFormDialogOpen] = useState(false);
  const [canCreateForm, setCanCreateForm] = useState(false);
  const [isFormEditorOpen, setIsFormEditorOpen] = useState(false);
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
  const isAutomationFlowDetail = area === "automation"
    && activeAllowedTab === "automation"
    && Boolean(new URLSearchParams(location.search).get("flowId"));
  const query = new URLSearchParams(location.search);
  const section = query.get('section');
  const leadTab = query.get('leadTab');
  const contractTab = query.get('contractTab');
  const leadManager = LEAD_CONFIG_MANAGERS.find(item => `manager:${item.category}` === leadTab);
  const contractManager = CONTRACT_CONFIG_MANAGERS.find(item => item.category === (contractTab ?? 'contract_status'));
  const systemTitle = section === 'access' ? 'Perfis e acessos'
    : section === 'leads' ? (leadTab === 'origins' ? 'Origens dos leads' : leadManager?.title ?? 'Etapas do funil')
    : section === 'contracts' ? (contractManager?.title ?? 'Configurações de contratos')
    : 'Configurações gerais';
  const title = area === 'automation' ? 'Automações, integrações e IA'
    : activeAllowedTab === 'users' ? 'Usuários e permissões'
    : activeAllowedTab === 'links' ? 'Links públicos'
    : activeAllowedTab === 'forms' ? isFormEditorOpen ? 'Editor de formulários' : 'Formulários de captação' : systemTitle;
  const description = area === 'automation'
    ? activeAllowedTab === 'integrations'
      ? 'Conecte e acompanhe os serviços usados pelo CRM.'
      : activeAllowedTab === 'ai'
        ? 'Configure os recursos de inteligência artificial disponíveis para a equipe.'
        : 'Organize os atendimentos automáticos e as regras que movimentam o CRM.'
    : activeAllowedTab === 'users'
      ? 'Gerencie as contas que podem acessar a operação.'
      : activeAllowedTab === 'links'
        ? 'Gerencie o perfil público e os links exibidos em /links.'
        : activeAllowedTab === 'forms'
          ? isFormEditorOpen
            ? 'Edite os dados, as perguntas e as respostas do formulário.'
            : 'Configure os formulários públicos que recebem novos contatos.'
          : section === 'access'
            ? 'Controle quais áreas do CRM ficam disponíveis para cada perfil.'
            : section === 'leads'
              ? leadTab === 'origins'
                ? 'Defina os canais de entrada e a visibilidade das origens para observadores.'
                : leadManager?.description ?? 'Organize as etapas e os cadastros usados no acompanhamento de leads.'
              : section === 'contracts'
                ? contractManager?.description ?? 'Organize as opções usadas no cadastro de contratos.'
                : 'Defina como datas, sessões e notificações se comportam no CRM.';
  const headerActions = activeAllowedTab === 'users' && getRoleModulePermission(role, 'config-users').can_edit
    ? <Button onClick={() => setCreateUserDialogOpen(true)}><Plus className="kds-control-icon" aria-hidden="true" />Novo usuário</Button>
    : activeAllowedTab === 'links'
      ? <Button onClick={() => setCreateLinkDialogOpen(true)}><Plus className="kds-control-icon" aria-hidden="true" />Novo link</Button>
      : activeAllowedTab === 'forms' && canCreateForm && !isFormEditorOpen
        ? <Button onClick={() => setCreateFormDialogOpen(true)}><Plus className="kds-control-icon" aria-hidden="true" />Novo formulário</Button>
    : undefined;
  const handleTabChange = (nextTab: ConfigTabType) => {
    if (nextTab !== 'users') setCreateUserDialogOpen(false);
    if (nextTab !== 'links') setCreateLinkDialogOpen(false);
    if (nextTab !== 'forms') {
      setCreateFormDialogOpen(false);
      setCanCreateForm(false);
      setIsFormEditorOpen(false);
    }
    setActiveTab(nextTab);
  };
  return (
    <div className="kds-config-screen panel-page-shell w-full space-y-6">
      {!isAutomationFlowDetail && (
        <PageHeader
          eyebrow="Administração"
          title={title}
          description={description}
          actions={headerActions}
        >
          <Tabs
            items={allowedTabs}
            value={activeAllowedTab}
            onChange={handleTabChange}
            variant="underline"
            size={area === "automation" ? "sm" : "md"}
            ariaLabel={area === "automation" ? "Áreas de automações e IA" : "Áreas de configurações"}
            listClassName="kds-config-tabs-scrollable flex-nowrap overflow-x-auto"
            triggerClassName="shrink-0 whitespace-nowrap"
          />
        </PageHeader>
      )}

      <main className="min-w-0">
          {activeAllowedTab === "system" && <SystemSettingsScreen />}
          {activeAllowedTab === "users" && <UsersScreen createDialogOpen={createUserDialogOpen} onCreateDialogOpenChange={setCreateUserDialogOpen} />}
          {activeAllowedTab === "automation" && <AutomationSettingsScreen />}
          {activeAllowedTab === "integrations" && <IntegrationsScreen />}
          {activeAllowedTab === "ai" && <AiConfigScreen />}
          {activeAllowedTab === "links" && (
            <LinksScreen
              showPageHeader={false}
              createDialogOpen={createLinkDialogOpen}
              onCreateDialogOpenChange={setCreateLinkDialogOpen}
            />
          )}
          {activeAllowedTab === "forms" && (
            <FormsScreen
              showPageHeader={false}
              createDialogOpen={createFormDialogOpen}
              onCreateDialogOpenChange={setCreateFormDialogOpen}
              onCreateAvailabilityChange={setCanCreateForm}
              onEditorOpenChange={setIsFormEditorOpen}
            />
          )}
      </main>
    </div>
  );
}
