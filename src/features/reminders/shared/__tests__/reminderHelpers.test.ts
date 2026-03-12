import assert from "node:assert/strict";
import { test } from "vitest";

import {
  getReminderWhatsappLink,
  isReminderPriority,
  normalizeReminderLeadPhone,
} from "../reminderHelpers";

test("reminderHelpers normalizes phone values and builds WhatsApp links", () => {
  assert.equal(normalizeReminderLeadPhone("(11) 91234-5678"), "11912345678");
  assert.equal(
    getReminderWhatsappLink("11912345678"),
    "https://wa.me/5511912345678",
  );
  assert.equal(getReminderWhatsappLink(null), null);
});

test("reminderHelpers validates reminder priorities", () => {
  assert.equal(isReminderPriority("alta"), true);
  assert.equal(isReminderPriority("urgente"), false);
});
