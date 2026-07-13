import type { Part, RepairOrderService, ServiceConfig } from '../../../types';
import { supabase } from '../../../supabaseClient';

export interface RepairServiceDraftWorker {
  worker_id: string;
  worker_name?: string;
  share_percent: number;
}

export interface RepairServiceDraft {
  id: string;
  serviceId?: string;
  serviceName: string;
  laborCalcType: ServiceConfig['laborCalcType'];
  laborFixedAmount: number;
  laborPercentOfCost: number;
  minimumLaborAmount: number;
  defaultWorkerSharePercent: number;
  manualLabor: number;
  relatedItemIds: string[];
  workers: RepairServiceDraftWorker[];
  isBillable: boolean;
  isPayableToWorker: boolean;
  note: string;
}

export const createEmptyRepairServiceDraft = (): RepairServiceDraft => ({
  id: `labor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  serviceName: '',
  laborCalcType: 'fixed',
  laborFixedAmount: 0,
  laborPercentOfCost: 0,
  minimumLaborAmount: 0,
  defaultWorkerSharePercent: 30,
  manualLabor: 0,
  relatedItemIds: [],
  workers: [],
  isBillable: true,
  isPayableToWorker: true,
  note: '',
});

export const mapRepairServiceToDraft = (
  service: RepairOrderService
): RepairServiceDraft => ({
  id: service.id,
  serviceId: service.serviceId,
  serviceName: service.serviceName,
  laborCalcType: service.laborCalcType,
  laborFixedAmount: service.laborFixedAmount,
  laborPercentOfCost: service.laborPercentOfCost,
  minimumLaborAmount: service.minimumLaborAmount,
  defaultWorkerSharePercent: service.workerSharePercent || 30,
  manualLabor:
    service.laborCalcType === 'manual'
      ? service.laborAmount
      : service.laborFixedAmount,
  relatedItemIds: (service.relatedItems || []).map((item) => item.partId),
  workers: (service.workers || []).map((worker) => ({
    worker_id: worker.workerId,
    worker_name: worker.workerName || '',
    share_percent: worker.sharePercent,
  })),
  isBillable: service.isBillable,
  isPayableToWorker: service.isPayableToWorker,
  note: service.note || '',
});

export const getWarrantyText = (part: Part | null | undefined): string => {
  if (!part) return '';
  return String(
    (part as any).warrantyPeriod ??
      (part as any).warrantyperiod ??
      (part as any).warranty_period ??
      (part as any).warranty ??
      ''
  ).trim();
};

export interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  bank_qr_url?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
  work_order_prefix?: string;
}

const getMissingColumnFromSupabaseError = (err: any): string | null => {
  const message = String(err?.message || '');
  const details = String(err?.details || '');
  const hint = String(err?.hint || '');
  const text = `${message} ${details} ${hint}`;
  
  const match1 = text.match(/Could not find the '([^']+)' column/i);
  if (match1) return match1[1];
  
  const match2 = text.match(/column "([^"]+)"/i);
  if (match2) return match2[1];
  
  const match3 = text.match(/column '([^']+)'/i);
  if (match3) return match3[1];
  
  const match4 = text.match(/'([^']+)'/i);
  if (match4) return match4[1];
  
  return null;
};

const buildCashTxCreatorFields = (user: any): Record<string, any> => {
  if (!user) return {};
  const creatorId = user.id;
  const creatorName =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split('@')?.[0] ||
    null;

  return {
    userid: creatorId,
    username: creatorName,
    created_by: creatorId,
    createdby: creatorId,
    created_by_name: creatorName,
    createdbyname: creatorName,
    userId: creatorId,
    userName: creatorName,
    createdBy: creatorId,
    createdByName: creatorName,
  };
};

export const insertCashTransactionWithCreator = async (
  payload: Record<string, any>
) => {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const creatorFields = buildCashTxCreatorFields(user);
  const workingPayload = { ...payload, ...creatorFields };
  let lastError: any = null;

  for (let i = 0; i < 8; i += 1) {
    const { error } = await supabase.from('cash_transactions').insert(workingPayload);
    if (!error) return { ok: true, error: null as any };

    const missingColumn = getMissingColumnFromSupabaseError(error);
    if (missingColumn && missingColumn in workingPayload) {
      delete workingPayload[missingColumn];
      lastError = error;
      continue;
    }

    return { ok: false, error };
  }

  return { ok: false, error: lastError };
};
