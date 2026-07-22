import { describe, it, expect } from "vitest";
import type { WorkOrder } from "../../src/types";

// ──────────────────────────────────────────────────────────
// Pure functions extracted from ServiceManager.tsx — the 3 copies
// of RepairTemplate → WorkOrder conversion.
//
// Phase 0: capture exact behavior of each copy to detect drift.
// ──────────────────────────────────────────────────────────

// RepairTemplate type (from useRepairTemplatesRepository.ts)
interface RepairTemplatePart {
  name: string;
  quantity: number;
  price: number;
  unit: string;
  sku?: string;
  partId?: string;
}

interface RepairTemplate {
  id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  duration: number;
  labor_cost: number;
  // The DB type uses snake_case, but some copies reference camelCase
  laborCost?: number;
  parts: RepairTemplatePart[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// ──────── Copy 1: handleApplyRepairTemplate (L1606) ────────
// Desktop pre-modal handler, sets id="" for creation mode

function copy1_handleApplyRepairTemplate(
  template: RepairTemplate,
  currentBranchId: string
): Partial<WorkOrder> {
  return {
    id: "", // Empty ID to trigger creation mode
    customerName: "",
    customerPhone: "",
    vehicleModel: "",
    issueDescription: template.description || template.name,
    status: "Tiếp nhận",
    creationDate: new Date().toISOString(),
    estimatedCompletion: new Date(
      Date.now() + (template.duration || 30) * 60000
    ).toISOString(),
    technicianName: "",
    laborCost: template.labor_cost || 0,
    partsUsed: (template.parts || []).map((p: any) => ({
      partId: p.partId || "",
      partName: p.name,
      quantity: p.quantity,
      price: p.price,
      sku: p.sku || "",
    })),
    notes: "",
    total: 0,
    branchId: currentBranchId,
  };
}

// ──────── Copy 2: mobile RepairTemplatesModal onApplyTemplate (L1749) ────────
// Generates an ID, uses camelCase template fields

function copy2_mobileTemplateApply(
  template: RepairTemplate,
  currentBranchId: string,
  generatedId: string
): Partial<WorkOrder> {
  return {
    id: generatedId, // generateWorkOrderId(storeSettings?.work_order_prefix)
    customerName: "",
    customerPhone: "",
    vehicleModel: "",
    issueDescription: template.description as string,
    status: "Tiếp nhận",
    creationDate: new Date().toISOString(),
    estimatedCompletion: new Date(
      Date.now() + template.duration * 60000
    ).toISOString(),
    technicianName: "",
    laborCost: (template as any).laborCost, // camelCase — may be undefined
    partsUsed: template.parts.map((p) => ({
      partId: "",
      partName: p.name,
      quantity: p.quantity,
      price: p.price,
      sku: p.sku || "",
    })),
    notes: "",
    total: 0,
    branchId: currentBranchId,
  };
}

// ──────── Copy 3: desktop bottom RepairTemplatesModal onApplyTemplate (L1893) ────────
// Also generates ID, uses camelCase template fields, but preserves partId

function copy3_desktopBottomTemplateApply(
  template: RepairTemplate,
  currentBranchId: string,
  generatedId: string
): Partial<WorkOrder> {
  return {
    id: generatedId, // generateWorkOrderId(storeSettings?.work_order_prefix)
    customerName: "",
    customerPhone: "",
    vehicleModel: "",
    issueDescription: template.description as string,
    status: "Tiếp nhận",
    creationDate: new Date().toISOString(),
    estimatedCompletion: new Date(
      Date.now() + template.duration * 60000
    ).toISOString(),
    technicianName: "",
    laborCost: (template as any).laborCost, // camelCase — may be undefined
    partsUsed: template.parts.map((p) => ({
      partId: p.partId || "",
      partName: p.name,
      quantity: p.quantity,
      price: p.price,
      sku: p.sku || "",
    })),
    notes: "",
    total: 0,
    branchId: currentBranchId,
  };
}

// ──────────────── Test fixtures ────────────────

const sampleTemplate: RepairTemplate = {
  id: "TPL-001",
  branch_id: null,
  name: "Thay pin iPhone",
  description: "Thay pin cho các dòng iPhone",
  duration: 45,
  labor_cost: 80000,
  parts: [
    { name: "Pin iPhone 15", quantity: 1, price: 350000, unit: "cái", sku: "PIN-15", partId: "P-PIN-15" },
    { name: "Keo dán", quantity: 2, price: 5000, unit: "tube", sku: "KEO-01" },
  ],
  is_active: true,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  created_by: "U-1",
};

const emptyPartsTemplate: RepairTemplate = {
  id: "TPL-002",
  branch_id: null,
  name: "Tư vấn",
  description: "Tư vấn kỹ thuật",
  duration: 15,
  labor_cost: 0,
  parts: [],
  is_active: true,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  created_by: null,
};

const nullDescriptionTemplate: RepairTemplate = {
  id: "TPL-003",
  branch_id: null,
  name: "Vệ sinh máy",
  description: null,
  duration: 20,
  labor_cost: 30000,
  parts: [{ name: "Dung dịch vệ sinh", quantity: 1, price: 10000, unit: "chai" }],
  is_active: true,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  created_by: null,
};

const BRANCH = "CN1";
const GENERATED_ID = "SC-2026071600001";

// ──────────────── Tests ────────────────

describe("workOrderTemplateConversion — Phase 0 safety net", () => {
  describe("shared behavior (all 3 copies)", () => {
    it("sets empty customerName, customerPhone, vehicleModel, technicianName", () => {
      const r1 = copy1_handleApplyRepairTemplate(sampleTemplate, BRANCH);
      const r2 = copy2_mobileTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);

      for (const r of [r1, r2, r3]) {
        expect(r.customerName).toBe("");
        expect(r.customerPhone).toBe("");
        expect(r.vehicleModel).toBe("");
        expect(r.technicianName).toBe("");
      }
    });

    it("sets status='Tiếp nhận', total=0, notes=''", () => {
      const r1 = copy1_handleApplyRepairTemplate(sampleTemplate, BRANCH);
      const r2 = copy2_mobileTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);

      for (const r of [r1, r2, r3]) {
        expect(r.status).toBe("Tiếp nhận");
        expect(r.total).toBe(0);
        expect(r.notes).toBe("");
      }
    });

    it("sets branchId from currentBranchId", () => {
      const r1 = copy1_handleApplyRepairTemplate(sampleTemplate, "CN2");
      const r2 = copy2_mobileTemplateApply(sampleTemplate, "CN2", GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(sampleTemplate, "CN2", GENERATED_ID);

      for (const r of [r1, r2, r3]) {
        expect(r.branchId).toBe("CN2");
      }
    });

    it("maps parts correctly with partName, quantity, price, sku", () => {
      const r1 = copy1_handleApplyRepairTemplate(sampleTemplate, BRANCH);
      const r2 = copy2_mobileTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);

      for (const r of [r1, r2, r3]) {
        expect(r.partsUsed).toHaveLength(2);
        expect(r.partsUsed![0].partName).toBe("Pin iPhone 15");
        expect(r.partsUsed![0].quantity).toBe(1);
        expect(r.partsUsed![0].price).toBe(350000);
        expect(r.partsUsed![0].sku).toBe("PIN-15");
        expect(r.partsUsed![1].partName).toBe("Keo dán");
      }
    });

    it("handles empty parts array", () => {
      const r1 = copy1_handleApplyRepairTemplate(emptyPartsTemplate, BRANCH);
      const r2 = copy2_mobileTemplateApply(emptyPartsTemplate, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(emptyPartsTemplate, BRANCH, GENERATED_ID);

      for (const r of [r1, r2, r3]) {
        expect(r.partsUsed).toEqual([]);
      }
    });
  });

  // ═══════════════ Documented divergences ═══════════════

  describe("DOCUMENTED DIVERGENCES between the 3 copies", () => {
    it('[DIVERGENCE] id: Copy 1 uses "" (empty), Copy 2+3 use generated ID', () => {
      const r1 = copy1_handleApplyRepairTemplate(sampleTemplate, BRANCH);
      const r2 = copy2_mobileTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);

      expect(r1.id).toBe("");           // Copy 1: empty → creation mode
      expect(r2.id).toBe(GENERATED_ID); // Copy 2: generated
      expect(r3.id).toBe(GENERATED_ID); // Copy 3: generated
    });

    it("[DIVERGENCE] issueDescription: Copy 1 fallbacks to template.name, Copy 2+3 only use description", () => {
      // When description is null
      const r1 = copy1_handleApplyRepairTemplate(nullDescriptionTemplate, BRANCH);
      const r2 = copy2_mobileTemplateApply(nullDescriptionTemplate, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(nullDescriptionTemplate, BRANCH, GENERATED_ID);

      expect(r1.issueDescription).toBe("Vệ sinh máy"); // fallback to name
      expect(r2.issueDescription).toBeNull();            // null (no fallback)
      expect(r3.issueDescription).toBeNull();            // null (no fallback)
    });

    it("[DIVERGENCE] laborCost: Copy 1 uses snake_case (labor_cost), Copy 2+3 use camelCase (laborCost)", () => {
      // RepairTemplate has labor_cost=80000 (snake_case DB field)
      // laborCost (camelCase) is NOT on the type
      const r1 = copy1_handleApplyRepairTemplate(sampleTemplate, BRANCH);
      const r2 = copy2_mobileTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);

      expect(r1.laborCost).toBe(80000);     // Copy 1: template.labor_cost ✓
      expect(r2.laborCost).toBeUndefined();  // Copy 2: template.laborCost → undefined
      expect(r3.laborCost).toBeUndefined();  // Copy 3: template.laborCost → undefined
    });

    it("[DIVERGENCE] partsUsed partId: Copy 1+3 preserve partId, Copy 2 always uses ''", () => {
      const r1 = copy1_handleApplyRepairTemplate(sampleTemplate, BRANCH);
      const r2 = copy2_mobileTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(sampleTemplate, BRANCH, GENERATED_ID);

      // Part with partId="P-PIN-15"
      expect(r1.partsUsed![0].partId).toBe("P-PIN-15"); // Copy 1: preserved
      expect(r2.partsUsed![0].partId).toBe("");          // Copy 2: always ""
      expect(r3.partsUsed![0].partId).toBe("P-PIN-15"); // Copy 3: preserved

      // Part without partId (keo dán)
      expect(r1.partsUsed![1].partId).toBe(""); // all: fallback to ""
      expect(r2.partsUsed![1].partId).toBe("");
      expect(r3.partsUsed![1].partId).toBe("");
    });

    it("[DIVERGENCE] duration fallback: Copy 1 has fallback (|| 30), Copy 2+3 do not", () => {
      const zeroDurationTemplate: RepairTemplate = {
        ...sampleTemplate,
        duration: 0, // edge case
      };

      const r1 = copy1_handleApplyRepairTemplate(zeroDurationTemplate, BRANCH);
      const r2 = copy2_mobileTemplateApply(zeroDurationTemplate, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(zeroDurationTemplate, BRANCH, GENERATED_ID);

      // Copy 1: (template.duration || 30) → 30 minutes fallback
      // Copy 2+3: template.duration → 0 → Date.now() + 0
      // We can verify by checking that estimatedCompletion differs
      const r1Est = new Date(r1.estimatedCompletion!).getTime();
      const r2Est = new Date(r2.estimatedCompletion!).getTime();

      // Copy 1 should be ~30min in the future, Copy 2 should be ~0min
      // Since we can't control Date.now() precisely, check relative difference
      expect(r1Est - r2Est).toBeGreaterThan(25 * 60 * 1000); // ~25+ min difference
    });
  });

  describe("summary table of inconsistencies", () => {
    it("documents all differences in one test for reference", () => {
      // This test serves as executable documentation
      const template = { ...sampleTemplate, description: null };
      const r1 = copy1_handleApplyRepairTemplate(template, BRANCH);
      const r2 = copy2_mobileTemplateApply(template, BRANCH, GENERATED_ID);
      const r3 = copy3_desktopBottomTemplateApply(template, BRANCH, GENERATED_ID);

      // Format: [field, copy1, copy2, copy3, matches?]
      const comparison = [
        ["id", r1.id, r2.id, r3.id],
        ["issueDescription", r1.issueDescription, r2.issueDescription, r3.issueDescription],
        ["laborCost", r1.laborCost, r2.laborCost, r3.laborCost],
        ["partsUsed[0].partId", r1.partsUsed?.[0]?.partId, r2.partsUsed?.[0]?.partId, r3.partsUsed?.[0]?.partId],
      ];

      // At least some fields should diverge — proving the copies are NOT identical
      const divergentFields = comparison.filter(
        ([, v1, v2, v3]) => v1 !== v2 || v2 !== v3
      );

      expect(divergentFields.length).toBeGreaterThan(0);
      // Currently 4 fields diverge:
      expect(divergentFields.length).toBe(4);
    });
  });
});
