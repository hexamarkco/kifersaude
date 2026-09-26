import assert from "node:assert/strict";
import { test } from "vitest";

import { LeadStatusMutationLock } from "../leadStatusMutationLock";

test("permite apenas uma alteração por lead e libera leads diferentes", () => {
  const lock = new LeadStatusMutationLock();

  const firstToken = lock.tryAcquire("lead-1");

  assert.notEqual(firstToken, null);
  assert.equal(lock.tryAcquire("lead-1"), null);
  assert.notEqual(lock.tryAcquire("lead-2"), null);
  assert.equal(lock.isCurrent("lead-1", firstToken ?? -1), true);
});

test("libera somente o token atual da alteração", () => {
  const lock = new LeadStatusMutationLock();
  const token = lock.tryAcquire("lead-1");

  assert.notEqual(token, null);
  lock.release("lead-1", (token ?? 0) + 1);
  assert.equal(lock.tryAcquire("lead-1"), null);

  lock.release("lead-1", token ?? -1);
  assert.notEqual(lock.tryAcquire("lead-1"), null);
});
