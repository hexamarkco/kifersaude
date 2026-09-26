import type { CommissionContract } from "../domain/types";

export type CommissionEventType = "comissao" | "bonificacao";

export type CommissionEvent = {
  id: string;
  date: string;
  type: CommissionEventType;
  value: number;
  contract: CommissionContract;
  installmentIndex?: number;
  installmentCount?: number;
};
