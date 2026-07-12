import type {
  Employee,
  LaborCalcType,
  RepairOrderService,
  RepairOrderServiceWorker,
  ServiceConfig,
  WorkerMonthlySalary,
} from "../../types";

export interface LaborCalculationInput {
  labor_calc_type?: LaborCalcType;
  labor_fixed_amount?: number | null;
  labor_percent_of_cost?: number | null;
  minimum_labor_amount?: number | null;
}

export interface WorkerSplitInput {
  worker_id: string;
  worker_name?: string;
  share_percent: number;
}

const roundMoney = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export function calculateLabor(
  service: LaborCalculationInput,
  relatedProductCost = 0,
  manualLabor = 0
): number {
  if (service.labor_calc_type === "fixed") {
    return roundMoney(service.labor_fixed_amount || 0);
  }

  if (service.labor_calc_type === "percent_of_cost") {
    const raw = Number(relatedProductCost || 0) * (Number(service.labor_percent_of_cost || 0) / 100);
    return roundMoney(Math.max(raw, Number(service.minimum_labor_amount || 0)));
  }

  if (service.labor_calc_type === "manual") {
    return roundMoney(manualLabor || 0);
  }

  return 0;
}

export function splitWorkerAmount(
  laborAmount: number,
  workers: WorkerSplitInput[]
): Array<{
  worker_id: string;
  worker_name?: string;
  share_percent: number;
  worker_amount: number;
}> {
  const totalPercent = (workers || []).reduce((sum, w) => sum + Number(w.share_percent || 0), 0);
  if (totalPercent > 100) {
    console.warn(`[splitWorkerAmount] Total share percent ${totalPercent}% exceeds 100%!`);
  }
  return workers.map((worker) => ({
    worker_id: worker.worker_id,
    worker_name: worker.worker_name,
    share_percent: Number(worker.share_percent || 0),
    worker_amount: roundMoney(Number(laborAmount || 0) * (Number(worker.share_percent || 0) / 100)),
  }));
}

export function buildDefaultWorkerSplit(
  employees: Employee[],
  technicianName: string | undefined,
  defaultSharePercent: number
): WorkerSplitInput[] {
  if (!technicianName) return [];

  const matchedWorker = employees.find((employee) => employee.name === technicianName);
  if (!matchedWorker) return [];

  return [
    {
      worker_id: matchedWorker.id,
      worker_name: matchedWorker.name,
      share_percent: Number(defaultSharePercent || 0),
    },
  ];
}

export function sumRepairOrderLaborTotals(services: RepairOrderService[]): {
  laborTotal: number;
  workerTotal: number;
} {
  let laborTotal = 0;
  let workerTotal = 0;

  for (const service of services) {
    if (service.isBillable) {
      laborTotal += Number(service.laborAmount || 0);
    }

    if (!service.isPayableToWorker) {
      continue;
    }

    if (service.workers && service.workers.length > 0) {
      workerTotal += service.workers.reduce(
        (sum, worker) => sum + Number(worker.workerAmount || 0),
        0
      );
      continue;
    }

    workerTotal += Number(service.workerAmount || 0);
  }

  return {
    laborTotal: roundMoney(laborTotal),
    workerTotal: roundMoney(workerTotal),
  };
}

export function computeMonthlySalarySummary(input: {
  workerId: string;
  workerName: string;
  serviceWorkers: RepairOrderServiceWorker[];
  employee?: Employee | null;
  bonus?: number;
  penalty?: number;
  advance?: number;
}): WorkerMonthlySalary {
  const totalWorkerAmount = roundMoney(
    input.serviceWorkers.reduce((sum, worker) => sum + Number(worker.workerAmount || 0), 0)
  );
  const baseSalary = Number(input.employee?.baseSalary || 0);
  const bonus = Number(input.bonus || 0);
  const penalty = Number(input.penalty || 0);
  const advance = Number(input.advance || 0);

  return {
    workerId: input.workerId,
    workerName: input.workerName,
    totalServiceCount: input.serviceWorkers.length,
    totalWorkerAmount,
    baseSalary,
    bonus,
    penalty,
    advance,
    finalSalary: roundMoney(baseSalary + totalWorkerAmount + bonus - penalty - advance),
  };
}

export function toServiceLaborConfig(service: Partial<ServiceConfig>): LaborCalculationInput {
  return {
    labor_calc_type: service.laborCalcType,
    labor_fixed_amount: service.laborFixedAmount,
    labor_percent_of_cost: service.laborPercentOfCost,
    minimum_labor_amount: service.minimumLaborAmount,
  };
}
