import {
  GitBranch,
  Plug,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ConfigTabType = "system" | "users" | "integrations" | "automation";

type ConfigTabDefinition = {
  id: ConfigTabType;
  icon: LucideIcon;
  label: string;
  moduleId: string;
};

export const CONFIG_TAB_DEFINITIONS: ConfigTabDefinition[] = [
  { id: "system", label: "Geral", icon: Settings, moduleId: "config-system" },
  { id: "users", label: "Usuarios", icon: Users, moduleId: "config-users" },
  {
    id: "automation",
    label: "Automacoes",
    icon: GitBranch,
    moduleId: "config-automation",
  },
  {
    id: "integrations",
    label: "Integracoes",
    icon: Plug,
    moduleId: "config-integrations",
  },
];

export const getAllowedConfigTabs = (
  role: string,
  getRoleModulePermission: (
    role: string,
    moduleId: string,
  ) => { can_view: boolean },
) =>
  CONFIG_TAB_DEFINITIONS.filter(
    (tab) => getRoleModulePermission(role, tab.moduleId).can_view,
  ).map(({ id, icon, label }) => ({ id, icon, label }));
