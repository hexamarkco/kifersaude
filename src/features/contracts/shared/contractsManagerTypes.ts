import type { Lead } from "../../../lib/supabase";

export type ContractsManagerProps = {
  leadToConvert?: Lead | null;
  onConvertComplete?: () => void;
  initialOperadoraFilter?: string;
};

export type ContractHolder = {
  id: string;
  contract_id: string;
  nome_completo: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  data_nascimento?: string | null;
};

export type ContractDependentSearch = {
  id: string;
  contract_id: string;
  nome_completo: string;
  data_nascimento?: string | null;
};

export type ContractDateDisplayType = "default" | "monthYear" | "monthOnly";

export type ContractManagerBadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger";

export type ContractManagerHighlightBadge = {
  key: string;
  label: string;
  tone: ContractManagerBadgeTone;
  sortOrder: number;
};
