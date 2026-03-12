import assert from "node:assert/strict";
import { test } from "vitest";

import {
  getTaskDateKey,
  isTaskSameDay,
  isTaskSameMonth,
  parseTaskDate,
} from "../todoCalendarUtils";

test("todoCalendarUtils parses task dates safely", () => {
  assert.equal(parseTaskDate("2026-03-12T10:00:00Z") instanceof Date, true);
  assert.equal(parseTaskDate("invalid-date"), null);
});

test("todoCalendarUtils compares month and day boundaries", () => {
  const baseDate = new Date("2026-03-12T10:00:00");
  assert.equal(
    isTaskSameMonth(baseDate, new Date("2026-03-01T00:00:00")),
    true,
  );
  assert.equal(isTaskSameDay(baseDate, new Date("2026-03-12T23:59:59")), true);
  assert.equal(isTaskSameDay(baseDate, new Date("2026-03-13T00:00:00")), false);
});

test("todoCalendarUtils builds stable keys for calendar grouping", () => {
  assert.equal(getTaskDateKey(new Date("2026-03-12T00:00:00Z")), "2026-03-12");
});
