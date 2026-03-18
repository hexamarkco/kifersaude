import assert from "node:assert/strict";
import { test } from "vitest";

import {
  formatContractManagerDate,
  getCompletedAgeAdjustmentCount,
  getCompletedAnnualAdjustmentCount,
  getContractBadgeTone,
  getContractDisplayName,
  getContractFidelityEndDate,
  getContractManagerHighlightBadges,
  getContractMonthsUntilDate,
  getContractNextAdjustmentDate,
  getContractNextAnnualAdjustmentDate,
  getDaysUntilContractDate,
  hasUpcomingImportantContractDate,
  parseContractManagerDate,
} from "../contractsManagerUtils";

test("contractsManagerUtils parses date-only values without timezone drift", () => {
  const parsed = parseContractManagerDate("2026-03-12");
  assert.equal(parsed?.getFullYear(), 2026);
  assert.equal(parsed?.getMonth(), 2);
  assert.equal(parsed?.getDate(), 12);
});

test("contractsManagerUtils calculates fidelity and adjustment dates from contract fields", () => {
  assert.equal(
    getContractFidelityEndDate("2026-04")?.toLocaleDateString("pt-BR"),
    "30/04/2026",
  );
  assert.equal(
    getContractNextAdjustmentDate(
      2,
      new Date("2026-03-12T10:00:00"),
    )?.toLocaleDateString("pt-BR"),
    "01/02/2027",
  );
  assert.equal(
    getContractNextAnnualAdjustmentDate(
      4,
      "2026-04-10",
      undefined,
      new Date("2026-03-17T10:00:00"),
    )?.toLocaleDateString("pt-BR"),
    "01/04/2027",
  );
});

test("contractsManagerUtils detects nearby contract milestones", () => {
  assert.equal(
    hasUpcomingImportantContractDate(
      {
        data_inicio: "2026-04-10",
        created_at: "2026-03-17T12:00:00.000Z",
        data_renovacao: "2028-04",
        mes_reajuste: 4,
        previsao_recebimento_comissao: "2026-04-13",
        previsao_pagamento_bonificacao: undefined,
      },
      new Date("2026-03-17T10:00:00"),
    ),
    true,
  );
});

test("contractsManagerUtils formats display labels and countdown helpers", () => {
  assert.equal(
    getDaysUntilContractDate(
      new Date("2026-03-20T00:00:00"),
      new Date("2026-03-12T00:00:00"),
    ),
    8,
  );
  assert.equal(getContractBadgeTone(3), "bg-red-100 text-red-700");
  assert.equal(formatContractManagerDate("2026-03-12"), "12/03/2026");
  assert.equal(
    formatContractManagerDate("6", "monthOnly", new Date("2026-03-12T00:00:00")),
    "junho",
  );
  assert.equal(
    getContractMonthsUntilDate(
      new Date("2026-04-01T00:00:00"),
      new Date("2026-03-12T00:00:00"),
    ),
    1,
  );
});

test("contractsManagerUtils counts annual and age adjustments after the contract start", () => {
  assert.equal(
    getCompletedAnnualAdjustmentCount(
      {
        mes_reajuste: 4,
        data_inicio: "2024-04-10",
        created_at: "2024-03-17T12:00:00.000Z",
      },
      new Date("2026-03-17T10:00:00"),
    ),
    1,
  );

  assert.equal(
    getCompletedAgeAdjustmentCount(
      [{ data_nascimento: "2002-02-10" }, { data_nascimento: "1997-01-05" }],
      "2024-04-10",
      undefined,
      new Date("2026-03-17T10:00:00"),
    ),
    2,
  );
});

test("contractsManagerUtils builds smarter highlight badges for contract cards", () => {
  const preActivationBadges = getContractManagerHighlightBadges(
    {
      status: "Em análise",
      data_inicio: "2026-04-10",
      created_at: "2026-03-17T12:00:00.000Z",
      data_renovacao: "2028-04",
      mes_reajuste: 4,
      previsao_recebimento_comissao: "2026-04-13",
      previsao_pagamento_bonificacao: "2026-04-13",
      comissao_prevista: 2877.47,
      bonus_por_vida_configuracoes: [{ id: "bonus-1", quantidade: 1, valor: 525 }],
      bonus_por_vida_valor: undefined,
    },
    [],
    new Date("2026-03-17T10:00:00"),
  );

  assert.deepEqual(
    preActivationBadges.map((badge) => badge.label),
    [
      "Ativa em 24 dias (10/04/2026)",
      "Recebe comissão em 27 dias (13/04/2026)",
      "Paga bônus em 27 dias (13/04/2026)",
    ],
  );

  const postFidelityBadges = getContractManagerHighlightBadges(
    {
      status: "Ativo",
      data_inicio: "2024-04-10",
      created_at: "2024-03-17T12:00:00.000Z",
      data_renovacao: "2025-06",
      mes_reajuste: 4,
      previsao_recebimento_comissao: undefined,
      previsao_pagamento_bonificacao: undefined,
      comissao_prevista: 0,
      bonus_por_vida_configuracoes: [],
      bonus_por_vida_valor: undefined,
    },
    [{ data_nascimento: "2002-02-10" }, { data_nascimento: "1997-01-05" }],
    new Date("2026-03-17T10:00:00"),
  );

  assert.deepEqual(
    postFidelityBadges.map((badge) => badge.label),
    [
      "Fidelidade encerrada (30/06/2025)",
      "1 reajuste anual",
      "2 reajustes por idade",
    ],
  );
});

test("contractsManagerUtils builds holder display names based on contract modality", () => {
  assert.equal(
    getContractDisplayName(
      { id: "1", modalidade: "PF" as const },
      {
        "1": [
          { id: "h1", contract_id: "1", nome_completo: "Joana Silva" },
          { id: "h2", contract_id: "1", nome_completo: "Pedro Silva" },
        ],
      },
    ),
    "Joana Silva (+1)",
  );
});
