import type { Contract } from "../../contracts";

export type CommissionEventType = "comissao" | "bonificacao";

export type CommissionEvent = {
  id: string;
  date: string;
  type: CommissionEventType;
  value: number;
  contract: Contract;
  installmentIndex?: number;
  installmentCount?: number;
};
