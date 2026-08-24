import {
  GitBranch,
  Link2,
  Plug,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ConfigTabType = "system" | "users" | "integrations" | "automation" | "links";

type ConfigTabDefinition = {
  id: ConfigTabType;
  icon: LucideIcon;
  label: string;
  moduleId: string;
};

export const CONFIG_TAB_DEFINITIONS: ConfigTabDefinition[] = [
  { id: "system", label: "Geral", icon: Settings, moduleId: "config-system" },
  { id: "users", label: "Usuários", icon: Users, moduleId: "config-users" },
  {
    id: "automation",
    label: "Automações",
    icon: GitBranch,
    moduleId: "config-automation",
  },
  {
    id: "integrations",
    label: "Integrações",
    icon: Plug,
    moduleId: "config-integrations",
  },
  {
    id: "links",
    label: "Links",
    icon: Link2,
    moduleId: "config-links",
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
