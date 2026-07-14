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
        expect(canDo(role, "pawn.manage")).toBe(true);
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
        expect(canDo(role, "pawn.manage")).toBe(true);
      });
    });

    describe("staff role", () => {
      const role: UserRole = "staff";

      it("should not have default admin/report privileges", () => {
        expect(canDo(role, "reports.view")).toBe(false);
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
        expect(canDo(role, "pawn.manage")).toBe(false);
      });
    });

    describe("per-action permission overrides", () => {
      it("grants a restricted action when override is true for a staff profile", () => {
        const profile = { role: "staff" as UserRole, permissions: { "finance.view": true, "pawn.manage": true } };
        expect(canDo(profile, "finance.view")).toBe(true);
        expect(canDo(profile, "pawn.manage")).toBe(true);
      });

      it("revokes a default-allowed action when override is false", () => {
        const profile = { role: "manager" as UserRole, permissions: { "settings.update": false } };
        expect(canDo(profile, "settings.update")).toBe(false);
      });

      it("falls back to role policy when no override is present", () => {
        const profile = { role: "staff" as UserRole, permissions: { "sale.create": true } };
        // sale.create overridden true; reports.view not overridden -> role policy (false)
        expect(canDo(profile, "reports.view")).toBe(false);
      });

      it("ignores non-boolean override values", () => {
        const profile = {
          role: "staff" as UserRole,
          permissions: { "finance.view": "yes" as unknown as boolean },
        };
        expect(canDo(profile, "finance.view")).toBe(false);
      });
    });
  });
});
