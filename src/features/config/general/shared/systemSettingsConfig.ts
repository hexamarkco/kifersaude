import {
  BadgeCheck,
  BedDouble,
  Briefcase,
  Clock3,
  FileText,
  ListTree,
  MapPin,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { ConfigCategory } from "../../data/configService";
import type { SystemSettings } from "../../domain/types";

export type SectionId =
  | "general"
  | "access"
  | "leads"
  | "contracts";

export type LeadConfigCategory = Extract<
  ConfigCategory,
  "lead_tipo_contratacao" | "lead_responsavel"
>;

export type ContractConfigCategory = Extract<
  ConfigCategory,
  | "contract_status"
  | "contract_modalidade"
  | "contract_abrangencia"
  | "contract_acomodacao"
  | "contract_carencia"
>;

export type ConfigManagerDefinition<TCategory extends ConfigCategory> = {
  category: TCategory;
  title: string;
  tabLabel?: string;
  tabIcon?: LucideIcon;
  description: string;
  placeholder: string;
  optionLabel?: string;
  addLabel?: string;
  createDialogTitle?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  searchTerms: string[];
};

export type SectionOverview = {
  id: SectionId;
  title: string;
  description: string;
  icon: LucideIcon;
  iconTone: "terracotta" | "gold";
  searchTerms: string[];
};

export const DEFAULT_GENERAL_PREFERENCES = {
  date_format: "DD/MM/YYYY",
  timezone: "America/Sao_Paulo",
  notification_sound_enabled: true,
  notification_volume: 0.7,
  notification_interval_seconds: 30,
  session_timeout_minutes: 480,
};

export const LEAD_CONFIG_MANAGERS: ConfigManagerDefinition<LeadConfigCategory>[] = [
  {
    category: "lead_tipo_contratacao",
    title: "Tipos de contratação",
    tabIcon: Briefcase,
    description: "Defina as opções disponíveis ao cadastrar leads e contratos.",
    placeholder: "Ex: Pessoa Física",
    searchTerms: ["lead", "tipos", "contratacao", "cadastro"],
  },
  {
    category: "lead_responsavel",
    title: "Responsáveis pelos leads",
    tabIcon: Users,
    description:
      "Configure a lista de responsáveis disponíveis para atribuição.",
    placeholder: "Ex: Maria",
    searchTerms: ["lead", "responsavel", "atendimento", "time"],
  },
];

export const CONTRACT_CONFIG_MANAGERS: ConfigManagerDefinition<ContractConfigCategory>[] = [
  {
    category: "contract_status",
    title: "Status de Contratos",
    tabLabel: "Status",
    tabIcon: BadgeCheck,
    description: "Personalize o ciclo de vida dos contratos.",
    placeholder: "Ex: Ativo",
    optionLabel: "Status do contrato",
    addLabel: "Adicionar status",
    createDialogTitle: "Novo status de contrato",
    emptyStateTitle: "Nenhum status cadastrado",
    emptyStateDescription: "Adicione os status que serão usados para acompanhar os contratos.",
    searchTerms: ["contrato", "status", "etapas"],
  },
  {
    category: "contract_modalidade",
    title: "Modalidades de Contrato",
    tabLabel: "Modalidade",
    tabIcon: Briefcase,
    description: "Cadastre as modalidades aceitas (PF, MEI, Empresarial, etc).",
    placeholder: "Ex: Empresarial",
    optionLabel: "Modalidade",
    addLabel: "Adicionar modalidade",
    createDialogTitle: "Nova modalidade de contrato",
    emptyStateTitle: "Nenhuma modalidade cadastrada",
    emptyStateDescription: "Adicione modalidades para disponibilizá-las no cadastro de contratos.",
    searchTerms: ["contrato", "modalidade", "pf", "mei", "empresarial"],
  },
  {
    category: "contract_abrangencia",
    title: "Abrangências",
    tabLabel: "Abrangência",
    tabIcon: MapPin,
    description: "Lista de coberturas disponíveis para os contratos.",
    placeholder: "Ex: Nacional",
    optionLabel: "Abrangência",
    addLabel: "Adicionar abrangência",
    createDialogTitle: "Nova abrangência",
    emptyStateTitle: "Nenhuma abrangência cadastrada",
    emptyStateDescription: "Adicione as abrangências disponíveis para os contratos.",
    searchTerms: ["contrato", "abrangencia", "cobertura"],
  },
  {
    category: "contract_acomodacao",
    title: "Tipos de acomodação",
    tabLabel: "Acomodação",
    tabIcon: BedDouble,
    description: "Defina as opções de acomodação para os planos.",
    placeholder: "Ex: Enfermaria",
    optionLabel: "Acomodação",
    addLabel: "Adicionar acomodação",
    createDialogTitle: "Nova acomodação",
    emptyStateTitle: "Nenhuma acomodação cadastrada",
    emptyStateDescription: "Adicione as opções de acomodação oferecidas nos contratos.",
    searchTerms: ["contrato", "acomodacao", "plano"],
  },
  {
    category: "contract_carencia",
    title: "Tipos de carência",
    tabLabel: "Carência",
    tabIcon: Clock3,
    description: "Configure as opções de carência disponíveis.",
    placeholder: "Ex: Padrão",
    optionLabel: "Carência",
    addLabel: "Adicionar carência",
    createDialogTitle: "Nova carência",
    emptyStateTitle: "Nenhuma carência cadastrada",
    emptyStateDescription: "Adicione as opções de carência utilizadas nos contratos.",
    searchTerms: ["contrato", "carencia", "prazo"],
  },
];

export const SECTION_OVERVIEW: SectionOverview[] = [
  {
    id: "general",
    title: "Preferências do sistema",
    description: "Sessão, formato de data e notificações.",
    icon: Settings,
    iconTone: "gold",
    searchTerms: ["preferencias", "sistema", "notificacao", "sessao", "data", "fuso", "timezone"],
  },
  {
    id: "access",
    title: "Perfis e acessos",
    description: "Permissões por tipo de usuário.",
    icon: ShieldCheck,
    iconTone: "terracotta",
    searchTerms: ["acesso", "perfil", "permissoes", "admin", "observer"],
  },
  {
    id: "leads",
    title: "Leads",
    description: "Funil, origens e cadastros auxiliares.",
    icon: ListTree,
    iconTone: "terracotta",
    searchTerms: ["lead", "status", "origens", "responsavel"],
  },
  {
    id: "contracts",
    title: "Contratos",
    description: "Estados e parametros do cadastro.",
    icon: FileText,
    iconTone: "gold",
    searchTerms: [
      "contratos",
      "status",
      "modalidade",
      "abrangencia",
      "carencia",
    ],
  },
];

export const normalizeConfigSearchText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const matchesConfigSearch = (
  normalizedTerm: string,
  values: string[],
) => {
  if (!normalizedTerm) {
    return true;
  }

  return values.some((value) =>
    normalizeConfigSearchText(value).includes(normalizedTerm),
  );
};

export const areSystemPreferencesEqual = (
  a: SystemSettings | null,
  b: SystemSettings | null,
) => {
  if (!a || !b) {
    return false;
  }

  return (
    a.date_format === b.date_format &&
    a.timezone === b.timezone &&
    a.notification_sound_enabled === b.notification_sound_enabled &&
    a.notification_volume === b.notification_volume &&
    a.notification_interval_seconds === b.notification_interval_seconds &&
    a.session_timeout_minutes === b.session_timeout_minutes
  );
};
