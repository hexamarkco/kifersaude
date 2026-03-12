import assert from "node:assert/strict";
import { test } from "vitest";

import {
  formatContractManagerDate,
  getContractBadgeTone,
  getContractDisplayName,
  getContractFidelityEndDate,
  getContractNextAdjustmentDate,
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
});

test("contractsManagerUtils detects nearby contract milestones", () => {
  assert.equal(
    hasUpcomingImportantContractDate(
      {
        data_renovacao: "2026-04",
        mes_reajuste: 4,
        previsao_recebimento_comissao: undefined,
        previsao_pagamento_bonificacao: undefined,
      },
      new Date("2026-03-12T10:00:00"),
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
