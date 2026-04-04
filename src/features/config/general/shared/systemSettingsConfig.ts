import {
  Building2,
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
  | "operadoras"
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
  accentClassName: string;
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
    accentClassName: "bg-amber-50 text-amber-700 ring-amber-100",
    searchTerms: ["preferencias", "sistema", "notificacao", "sessao", "data", "fuso", "timezone"],
  },
  {
    id: "operadoras",
    title: "Operadoras",
    description: "Comissao, prazo e regras comerciais.",
    icon: Building2,
    accentClassName: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    searchTerms: ["operadoras", "operadora", "bonus", "comissao", "prazo"],
  },
  {
    id: "access",
    title: "Perfis e acessos",
    description: "Permissoes por tipo de usuario.",
    icon: ShieldCheck,
    accentClassName: "bg-sky-50 text-sky-700 ring-sky-100",
    searchTerms: ["acesso", "perfil", "permissoes", "admin", "observer"],
  },
  {
    id: "cotador",
    title: "Cotador",
    description: "Administradoras, entidades e produtos do catalogo comercial.",
    icon: Calculator,
    accentClassName: "bg-orange-50 text-orange-700 ring-orange-100",
    searchTerms: ["cotador", "administradora", "administradoras", "entidade", "entidades", "produto", "produtos", "catalogo"],
  },
  {
    id: "leads",
    title: "Leads",
    description: "Funil, origens e cadastros auxiliares.",
    icon: ListTree,
    accentClassName: "bg-orange-50 text-orange-700 ring-orange-100",
    searchTerms: ["lead", "status", "origens", "responsavel"],
  },
  {
    id: "contracts",
    title: "Contratos",
    description: "Estados e parametros do cadastro.",
    icon: FileText,
    accentClassName: "bg-teal-50 text-teal-700 ring-teal-100",
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

export const SYSTEM_SETTINGS_SECTION_CARD_CLASS =
  "flex w-full items-start justify-between gap-4 rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] p-4 text-left shadow-sm transition-colors hover:border-[color:var(--panel-border)]";

export const SYSTEM_SETTINGS_SECTION_BODY_CLASS =
  "rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] p-6 shadow-sm";
