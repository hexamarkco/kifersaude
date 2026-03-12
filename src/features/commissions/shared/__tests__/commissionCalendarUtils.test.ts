import assert from "node:assert/strict";
import { test } from "vitest";

import type { Contract } from "../../../../lib/supabase";
import {
  buildCommissionEvents,
  formatCommissionCurrency,
  getCommissionDateKey,
  groupCommissionEventsByDay,
  parseCommissionDate,
  sumCommissionTotals,
} from "../commissionCalendarUtils";

const createContract = (overrides: Partial<Contract> = {}): Contract => ({
  id: "contract-1",
  codigo_contrato: "CTR-001",
  status: "Ativo",
  modalidade: "Empresarial",
  operadora: "Operadora X",
  produto_plano: "Plano Premium",
  responsavel: "Equipe Comercial",
  created_at: "2026-03-12T00:00:00.000Z",
  updated_at: "2026-03-12T00:00:00.000Z",
  ...overrides,
});

test("parseCommissionDate supports plain dates and invalid values", () => {
  assert.equal(
    getCommissionDateKey(parseCommissionDate("2026-03-12")!),
    "2026-03-12",
  );
  assert.equal(parseCommissionDate("data-invalida"), null);
});

test("buildCommissionEvents creates upfront commission and bonus entries", () => {
  const events = buildCommissionEvents([
    createContract({
      comissao_prevista: 1200,
      previsao_recebimento_comissao: "2026-03-18",
      bonus_por_vida_valor: 50,
      bonus_por_vida_aplicado: true,
      vidas: 3,
      previsao_pagamento_bonificacao: "2026-03-20",
    }),
  ]);

  assert.equal(events.length, 2);
  assert.equal(events[0]?.type, "comissao");
  assert.equal(events[1]?.type, "bonificacao");
  assert.equal(events[1]?.value, 150);
});

test("buildCommissionEvents splits custom commission installments", () => {
  const events = buildCommissionEvents([
    createContract({
      comissao_prevista: 1000,
      comissao_recebimento_adiantado: false,
      previsao_recebimento_comissao: "2026-03-05",
      comissao_parcelas: [
        { percentual: 40, data_pagamento: "2026-03-05" },
        { percentual: 60, data_pagamento: "2026-04-05" },
      ],
    }),
  ]);

  assert.equal(events.length, 2);
  assert.equal(events[0]?.installmentIndex, 1);
  assert.equal(events[0]?.installmentCount, 2);
  assert.equal(events[0]?.value, 400);
  assert.equal(events[1]?.value, 600);
});

test("groupCommissionEventsByDay and totals keep events organized", () => {
  const events = buildCommissionEvents([
    createContract({
      id: "contract-a",
      comissao_prevista: 900,
      comissao_recebimento_adiantado: false,
      mensalidade_total: 300,
      previsao_recebimento_comissao: "2026-03-10",
    }),
    createContract({
      id: "contract-b",
      codigo_contrato: "CTR-002",
      comissao_prevista: 450,
      previsao_recebimento_comissao: "2026-03-10",
    }),
  ]);

  const groupedEvents = groupCommissionEventsByDay(events);
  const totals = sumCommissionTotals(events);
  const dayEvents = groupedEvents.get("2026-03-10") || [];

  assert.equal(dayEvents.length, 2);
  assert.equal(totals.commission, 1350);
  assert.equal(totals.bonus, 0);
  assert.match(formatCommissionCurrency(totals.commission), /1\.350,00/);
});
