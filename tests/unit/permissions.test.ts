/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { canDo } from "../../src/utils/permissions";
import type { UserRole } from "../../src/contexts/AuthContext";

describe("Permissions", () => {
  describe("canDo", () => {
    it("should return false for undefined role", () => {
      expect(canDo(undefined, "sale.delete")).toBe(false);
      expect(canDo(undefined, "finance.view")).toBe(false);
    });

    describe("owner role", () => {
      const role: UserRole = "owner";

      it("should have access to all actions", () => {
        expect(canDo(role, "sale.delete")).toBe(true);
        expect(canDo(role, "part.update_price")).toBe(true);
        expect(canDo(role, "settings.update")).toBe(true);
        expect(canDo(role, "finance.view")).toBe(true);
        expect(canDo(role, "payroll.view")).toBe(true);
        expect(canDo(role, "analytics.view")).toBe(true);
        expect(canDo(role, "reports.view")).toBe(true);
        expect(canDo(role, "employees.view")).toBe(true);
        expect(canDo(role, "debt.view")).toBe(true);
      });
    });

    describe("manager role", () => {
      const role: UserRole = "manager";

      it("should have access to management actions", () => {
        expect(canDo(role, "sale.delete")).toBe(true);
        expect(canDo(role, "part.update_price")).toBe(true);
        expect(canDo(role, "settings.update")).toBe(true);
        expect(canDo(role, "finance.view")).toBe(true);
        expect(canDo(role, "payroll.view")).toBe(true);
        expect(canDo(role, "analytics.view")).toBe(true);
        expect(canDo(role, "reports.view")).toBe(true);
        expect(canDo(role, "employees.view")).toBe(true);
        expect(canDo(role, "debt.view")).toBe(true);
      });
    });

    describe("staff role", () => {
      const role: UserRole = "staff";

      it("should only have access to reports.view", () => {
        expect(canDo(role, "reports.view")).toBe(true);
      });

      it("should NOT have access to restricted actions", () => {
        expect(canDo(role, "sale.delete")).toBe(false);
        expect(canDo(role, "part.update_price")).toBe(false);
        expect(canDo(role, "settings.update")).toBe(false);
        expect(canDo(role, "finance.view")).toBe(false);
        expect(canDo(role, "payroll.view")).toBe(false);
        expect(canDo(role, "analytics.view")).toBe(false);
        expect(canDo(role, "employees.view")).toBe(false);
        expect(canDo(role, "debt.view")).toBe(false);
      });
    });
  });
});
