import assert from "node:assert/strict";
import { test } from "vitest";

import { normalizeCommissionInstallments } from "../contractCommission";

test("normalizeCommissionInstallments removes empty entries and preserves valid values", () => {
  const normalizedInstallments = normalizeCommissionInstallments([
    { percentual: 0, valor: 0, data_pagamento: null },
    { percentual: 40, data_pagamento: "2026-03-12" },
    { valor: 350.5, data_pagamento: "2026-04-10" },
    { percentual: Number.NaN, valor: 200, data_pagamento: null },
  ]);

  assert.deepEqual(normalizedInstallments, [
    { percentual: 40, data_pagamento: "2026-03-12" },
    { valor: 350.5, data_pagamento: "2026-04-10" },
    { valor: 200, data_pagamento: null },
  ]);
});
