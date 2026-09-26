import type { Contract } from "../../contracts";

export type CommissionContract = Pick<
  Contract,
  | "id"
  | "codigo_contrato"
  | "operadora"
  | "previsao_recebimento_comissao"
  | "comissao_prevista"
  | "comissao_recebimento_adiantado"
  | "comissao_parcelas"
  | "mensalidade_total"
  | "previsao_pagamento_bonificacao"
  | "bonus_por_vida_aplicado"
  | "bonus_por_vida_configuracoes"
  | "bonus_por_vida_valor"
  | "vidas"
  | "vidas_elegiveis_bonus"
>;
