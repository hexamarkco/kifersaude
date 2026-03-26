import assert from "node:assert/strict";
import { test, vi } from "vitest";

vi.mock("react-quill", () => ({
  default: () => null,
}));

import BlogTab from "../config/BlogTab";
import ContractsManager from "../ContractsManager";
import LeadsManager from "../LeadsManager";
import RemindersManagerEnhanced from "../RemindersManagerEnhanced";
import FinanceiroAgendaTab from "../finance/FinanceiroAgendaTab";
import CommissionCalendar from "../finance/CommissionCalendar";
import FinanceiroComissoesTab from "../finance/FinanceiroComissoesTab";
import TodoCalendar from "../finance/TodoCalendar";
import AgendaScreen from "../../features/agenda/AgendaScreen";
import BlogTabScreen from "../../features/blog/BlogTabScreen";
import FinanceiroComissoesScreen from "../../features/commissions/FinanceiroComissoesScreen";
import CommissionCalendarScreen from "../../features/commissions/CommissionCalendarScreen";
import ContractsManagerScreen from "../../features/contracts/ContractsManagerScreen";
import LeadsManagerScreen from "../../features/leads/LeadsManagerScreen";
import RemindersScreen from "../../features/reminders/RemindersScreen";
import TodoCalendarScreen from "../../features/tasks/TodoCalendarScreen";

test("domain feature adapters keep legacy exports pointing to feature screens", () => {
  assert.equal(BlogTab, BlogTabScreen);
  assert.equal(LeadsManager, LeadsManagerScreen);
  assert.equal(ContractsManager, ContractsManagerScreen);
  assert.equal(RemindersManagerEnhanced, RemindersScreen);
  assert.equal(CommissionCalendar, CommissionCalendarScreen);
  assert.equal(FinanceiroComissoesTab, FinanceiroComissoesScreen);
  assert.equal(FinanceiroAgendaTab, AgendaScreen);
  assert.equal(TodoCalendar, TodoCalendarScreen);
});
