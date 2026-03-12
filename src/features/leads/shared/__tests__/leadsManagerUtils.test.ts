import assert from "node:assert/strict";
import { test } from "vitest";

import {
  getLeadFirstName,
  getWhatsappLink,
  isWithinDateRange,
} from "../leadsManagerUtils";

test("leadsManagerUtils validates date ranges inclusively", () => {
  assert.equal(
    isWithinDateRange("2026-03-12T10:00:00", "2026-03-01", "2026-03-31"),
    true,
  );
  assert.equal(
    isWithinDateRange("2026-02-28T23:59:59", "2026-03-01", "2026-03-31"),
    false,
  );
  assert.equal(isWithinDateRange(null, "2026-03-01", "2026-03-31"), false);
});

test("leadsManagerUtils builds a WhatsApp link with the Brazilian prefix", () => {
  assert.equal(
    getWhatsappLink("(11) 98888-7777"),
    "https://wa.me/5511988887777",
  );
  assert.equal(getWhatsappLink(""), null);
});

test("leadsManagerUtils returns the first name with a safe fallback", () => {
  assert.equal(getLeadFirstName("Maria de Souza"), "Maria");
  assert.equal(getLeadFirstName("   "), "cliente");
});
