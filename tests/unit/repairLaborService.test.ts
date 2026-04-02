import { describe, expect, it } from "vitest";
import {
  calculateLabor,
  splitWorkerAmount,
  sumRepairOrderLaborTotals,
} from "../../src/lib/services/repairLaborService";

describe("calculateLabor", () => {
  it("supports fixed labor", () => {
    expect(
      calculateLabor({
        labor_calc_type: "fixed",
        labor_fixed_amount: 100000,
      })
    ).toBe(100000);
  });

  it("supports percent_of_cost", () => {
    expect(
      calculateLabor(
        {
          labor_calc_type: "percent_of_cost",
          labor_percent_of_cost: 8,
          minimum_labor_amount: 50000,
        },
        800000
      )
    ).toBe(64000);
  });

  it("respects minimum labor amount", () => {
    expect(
      calculateLabor(
        {
          labor_calc_type: "percent_of_cost",
          labor_percent_of_cost: 5,
          minimum_labor_amount: 20000,
        },
        100000
      )
    ).toBe(20000);
  });
});

describe("splitWorkerAmount", () => {
  it("supports one worker", () => {
    expect(
      splitWorkerAmount(100000, [{ worker_id: "A", share_percent: 30 }])
    ).toEqual([
      {
        worker_id: "A",
        worker_name: undefined,
        share_percent: 30,
        worker_amount: 30000,
      },
    ]);
  });

  it("supports multiple workers", () => {
    expect(
      splitWorkerAmount(500000, [
        { worker_id: "A", share_percent: 70 },
        { worker_id: "B", share_percent: 30 },
      ])
    ).toEqual([
      {
        worker_id: "A",
        worker_name: undefined,
        share_percent: 70,
        worker_amount: 350000,
      },
      {
        worker_id: "B",
        worker_name: undefined,
        share_percent: 30,
        worker_amount: 150000,
      },
    ]);
  });
});

describe("sumRepairOrderLaborTotals", () => {
  it("supports repair order totals", () => {
    const totals = sumRepairOrderLaborTotals([
      {
        id: "svc-1",
        repairOrderId: "wo-1",
        serviceName: "Thay bom xang",
        laborCalcType: "percent_of_cost",
        laborFixedAmount: 0,
        laborPercentOfCost: 8,
        minimumLaborAmount: 50000,
        relatedProductCost: 800000,
        laborAmount: 64000,
        workerSharePercent: 30,
        workerAmount: 19200,
        isBillable: true,
        isPayableToWorker: true,
      },
      {
        id: "svc-2",
        repairOrderId: "wo-1",
        serviceName: "Ve sinh hong ga",
        laborCalcType: "fixed",
        laborFixedAmount: 100000,
        laborPercentOfCost: 0,
        minimumLaborAmount: 0,
        relatedProductCost: 0,
        laborAmount: 100000,
        workerSharePercent: 30,
        workerAmount: 30000,
        isBillable: true,
        isPayableToWorker: true,
      },
    ]);

    expect(totals).toEqual({
      laborTotal: 164000,
      workerTotal: 49200,
    });

    expect(1190000 + totals.laborTotal).toBe(1354000);
  });
});
