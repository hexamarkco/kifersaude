import { AlertCircle } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext";
import { useConfig } from "../../contexts/ConfigContext";
import { Alert, Button, PageHeader, Tabs, type TabItem } from "../../design-system";
import { Plus } from "lucide-react";
import { useState } from "react";
import AiConfigScreen from "./ai/AiConfigScreen";
import AutoContactFlowSettingsScreen from "./automation/AutoContactFlowSettingsScreen";
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
  const isAutomationWorkspace = area === "automation" && activeAllowedTab === "automation";
  const query = new URLSearchParams(location.search);
  const section = query.get('section');
  const leadTab = query.get('leadTab');
  const contractTab = query.get('contractTab');
  const leadManager = LEAD_CONFIG_MANAGERS.find(item => `manager:${item.category}` === leadTab);
  const contractManager = CONTRACT_CONFIG_MANAGERS.find(item => item.category === (contractTab ?? 'contract_status'));
  const systemTitle = section === 'access' ? 'O acesso certo para cada pessoa.'
    : section === 'leads' ? (leadTab === 'origins' ? 'De onde chegam as oportunidades.' : leadManager?.title ?? 'Um funil que acompanha a sua rotina.')
    : section === 'contracts' ? (contractManager?.title ?? 'Configurações de contratos')
    : 'O painel, do seu jeito.';
  const title = area === 'automation'
    ? activeAllowedTab === 'integrations' ? 'Tudo conectado à sua operação.' : activeAllowedTab === 'ai' ? 'Inteligência com direção.' : 'Rotinas que trabalham com você.'
    : activeAllowedTab === 'users' ? 'As pessoas por trás do cuidado.'
    : activeAllowedTab === 'links' ? 'Uma página com o seu jeito.'
    : activeAllowedTab === 'forms' ? isFormEditorOpen ? 'Editor de formulários' : 'O primeiro passo da conversa.' : systemTitle;
  const description = area === 'automation'
    ? activeAllowedTab === 'integrations'
      ? 'Acompanhe os serviços usados pela equipe e o que precisa de atenção.'
      : activeAllowedTab === 'ai'
        ? 'Defina como a IA apoia a sua equipe em cada tarefa.'
        : 'Organize jornadas, mensagens e regras de acompanhamento.'
    : activeAllowedTab === 'users'
      ? 'Gerencie quem participa da operação e seus perfis de acesso.'
      : activeAllowedTab === 'links'
        ? 'Seu perfil, seus contatos e os caminhos para começar uma conversa.'
        : activeAllowedTab === 'forms'
          ? isFormEditorOpen
            ? 'Edite os dados, as perguntas e as respostas do formulário.'
            : 'Organize os formulários que recebem novos contatos.'
          : section === 'access'
            ? 'Controle quais áreas do painel ficam disponíveis para cada perfil.'
            : section === 'leads'
              ? leadTab === 'origins'
                ? 'Defina os canais de entrada e a visibilidade das origens para observadores.'
                : leadManager?.description ?? 'Organize as etapas e os cadastros usados no acompanhamento de leads.'
              : section === 'contracts'
                ? contractManager?.description ?? 'Organize as opções usadas no cadastro de contratos.'
                : 'Preferências que deixam a operação mais simples para a equipe.';
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
  const areaNavigation = allowedTabs.length > 1 && (
    <Tabs
      items={allowedTabs}
      value={activeAllowedTab}
      onChange={handleTabChange}
      variant="underline"
      ariaLabel={area === "automation" ? "Automações, integrações e IA" : "Áreas de configurações"}
      listClassName="kds-config-tabs-scrollable flex-nowrap overflow-x-auto"
      triggerClassName="shrink-0 whitespace-nowrap"
    />
  );
  return (
    <div className={`kds-config-screen panel-page-shell w-full ${area === "settings" ? "kds-settings-area" : "space-y-6"}`}>
      {area === "automation" && !(isAutomationWorkspace && query.has("flowId")) && areaNavigation}
      {!isAutomationWorkspace && (
        <PageHeader
          title={title}
          description={description}
          descriptionPlacement="visible"
          actions={headerActions}
        >
          {area === "settings" && areaNavigation}
        </PageHeader>
      )}

      <div className="min-w-0">
          {activeAllowedTab === "system" && <SystemSettingsScreen />}
          {activeAllowedTab === "users" && <UsersScreen createDialogOpen={createUserDialogOpen} onCreateDialogOpenChange={setCreateUserDialogOpen} />}
          {activeAllowedTab === "automation" && <AutoContactFlowSettingsScreen />}
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
      </div>
    </div>
  );
}
