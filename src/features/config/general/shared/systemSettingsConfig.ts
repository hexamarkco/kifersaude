import {
  Calculator,
  FileText,
  ListTree,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import type { ConfigCategory } from "../../../../lib/configService";
import type { SystemSettings } from "../../../../lib/supabase";

export type SettingsMessage = { type: "success" | "error"; text: string };
export type SectionId =
  | "general"
  | "cotador"
  | "access"
  | "leads"
  | "contracts";

export type ConfigManagerDefinition = {
  category: ConfigCategory;
  title: string;
  description: string;
  placeholder: string;
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

export const LEAD_CONFIG_MANAGERS: ConfigManagerDefinition[] = [
  {
    category: "lead_tipo_contratacao",
    title: "Tipos de Contratacao",
    description: "Defina as opcoes disponiveis ao cadastrar leads e contratos.",
    placeholder: "Ex: Pessoa Fisica",
    searchTerms: ["lead", "tipos", "contratacao", "cadastro"],
  },
  {
    category: "lead_responsavel",
    title: "Responsaveis pelos Leads",
    description:
      "Configure a lista de responsaveis disponiveis para atribuicao.",
    placeholder: "Ex: Maria",
    searchTerms: ["lead", "responsavel", "atendimento", "time"],
  },
];

export const CONTRACT_CONFIG_MANAGERS: ConfigManagerDefinition[] = [
  {
    category: "contract_status",
    title: "Status de Contratos",
    description: "Personalize o ciclo de vida dos contratos.",
    placeholder: "Ex: Ativo",
    searchTerms: ["contrato", "status", "etapas"],
  },
  {
    category: "contract_modalidade",
    title: "Modalidades de Contrato",
    description: "Cadastre as modalidades aceitas (PF, MEI, Empresarial, etc).",
    placeholder: "Ex: Empresarial",
    searchTerms: ["contrato", "modalidade", "pf", "mei", "empresarial"],
  },
  {
    category: "contract_abrangencia",
    title: "Abrangencias",
    description: "Lista de coberturas disponiveis para os contratos.",
    placeholder: "Ex: Nacional",
    searchTerms: ["contrato", "abrangencia", "cobertura"],
  },
  {
    category: "contract_acomodacao",
    title: "Tipos de Acomodacao",
    description: "Defina as opcoes de acomodacao para os planos.",
    placeholder: "Ex: Enfermaria",
    searchTerms: ["contrato", "acomodacao", "plano"],
  },
  {
    category: "contract_carencia",
    title: "Tipos de Carencia",
    description: "Configure as opcoes de carencia disponiveis.",
    placeholder: "Ex: Padrao",
    searchTerms: ["contrato", "carencia", "prazo"],
  },
];

export const SECTION_OVERVIEW: SectionOverview[] = [
  {
    id: "general",
    title: "Preferencias do sistema",
    description: "Sessao, formato de data e notificacoes.",
    icon: Settings,
    iconTone: "gold",
    searchTerms: ["preferencias", "sistema", "notificacao", "sessao", "data", "fuso", "timezone"],
  },
  {
    id: "access",
    title: "Perfis e acessos",
    description: "Permissoes por tipo de usuario.",
    icon: ShieldCheck,
    iconTone: "terracotta",
    searchTerms: ["acesso", "perfil", "permissoes", "admin", "observer"],
  },
  {
    id: "cotador",
    title: "Cotador",
    description: "Operadoras, administradoras, linhas, produtos, tabelas e regras comerciais.",
    icon: Calculator,
    iconTone: "terracotta",
    searchTerms: ["cotador", "operadora", "operadoras", "administradora", "administradoras", "entidade", "entidades", "produto", "produtos", "linha", "linhas", "tabela", "tabelas", "mei", "coparticipacao", "catalogo", "comissao", "bonus", "prazo"],
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
