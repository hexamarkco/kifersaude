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
};

export type ContractDateDisplayType = "default" | "monthYear" | "monthOnly";
