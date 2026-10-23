import {
  Brain,
  FileText,
  GitBranch,
  Link2,
  Plug,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type ConfigTabType = "system" | "users" | "integrations" | "automation" | "links" | "forms" | "ai";
export type ConfigArea = "settings" | "automation";

type ConfigTabDefinition = {
  id: ConfigTabType;
  icon: LucideIcon;
  label: string;
  moduleId: string;
  area: ConfigArea;
};

export const CONFIG_TAB_DEFINITIONS: ConfigTabDefinition[] = [
  { id: "system", label: "Geral", icon: Settings, moduleId: "config-system", area: "settings" },
  { id: "users", label: "Usuários", icon: Users, moduleId: "config-users", area: "settings" },
  {
    id: "automation",
    label: "Automações",
    icon: GitBranch,
    moduleId: "config-automation",
    area: "automation",
  },
  {
    id: "integrations",
    label: "Integrações",
    icon: Plug,
    moduleId: "config-integrations",
    area: "automation",
  },
  {
    id: "ai",
    label: "IA",
    icon: Brain,
    moduleId: "config-ai",
    area: "automation",
  },
  {
    id: "links",
    label: "Links",
    icon: Link2,
    moduleId: "config-links",
    area: "settings",
  },
  {
    id: "forms",
    label: "Formulários",
    icon: FileText,
    moduleId: "config-forms",
    area: "settings",
  },
];

export const getAllowedConfigTabs = (
  role: string,
  getRoleModulePermission: (
    role: string,
    moduleId: string,
  ) => { can_view: boolean },
  area?: ConfigArea,
) =>
  CONFIG_TAB_DEFINITIONS.filter(
    (tab) => (!area || tab.area === area) && (
      getRoleModulePermission(role, tab.moduleId).can_view ||
      (tab.id === "system" && getRoleModulePermission(role, "config-access").can_view)
    ),
  ).map(({ id, icon, label }) => ({ id, icon, label }));

export const hasConfigAreaAccess = (
  role: string,
  getRoleModulePermission: (role: string, moduleId: string) => { can_view: boolean },
  area: ConfigArea,
) => getAllowedConfigTabs(role, getRoleModulePermission, area).length > 0;

export const getConfigAreaForTab = (tab: string | null) => CONFIG_TAB_DEFINITIONS.find((definition) => definition.id === tab)?.area;
