import type { WorkOrder } from "../../../types";
import { decodeAdditionalServicesFromNotes } from "./additionalServices";

export const parseWarrantyMonths = (raw: unknown): number => {
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return 0;
  const numMatch = text.match(/\d+/);
  if (!numMatch) return 0;
  const value = Number(numMatch[0]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (text.includes("năm") || text.includes("nam") || text.includes("year")) {
    return value * 12;
  }
  return value;
};

export const normalizeStatusKey = (raw: unknown): string =>
  String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const REQUIRED_FIELDS: (keyof WorkOrder)[] = [
  "creationDate", "status", "total", "branchId",
];

function devWarnMissingFields(row: any, result: WorkOrder): void {
  if (import.meta.env.DEV && row?.id) {
    for (const field of REQUIRED_FIELDS) {
      if (result[field] == null || result[field] === "") {
        console.warn(
          `[normalizeWorkOrder] Field "${String(field)}" is missing/undefined`,
          { id: row.id }
        );
      }
    }
  }
}

// Helper: Convert snake_case DB response to camelCase TypeScript
// Nguồn sự thật duy nhất — mọi hàm repository trả WorkOrder đều phải qua đây.
export function normalizeWorkOrder(row: any): WorkOrder {
  if (!row) row = {};
  const notesDecoded = decodeAdditionalServicesFromNotes(row.notes || "");
  const result: WorkOrder = {
    id: row.id,
    creationDate: row.creationdate || row.creationDate,
    customerName: row.customername || row.customerName,
    customerPhone: row.customerphone || row.customerPhone,
    vehicleId: row.vehicleid || row.vehicleId,
    vehicleModel: row.vehiclemodel || row.vehicleModel,
    licensePlate: row.licenseplate || row.licensePlate,
    currentKm: row.currentkm || row.currentKm,
    issueDescription:
      row.issuedescription || row.issueDescription || notesDecoded.cleanNotes || "",
    devicePhotos:
      row.device_photos || row.devicephotos || row.devicePhotos || undefined,
    technicianName: row.technicianname || row.technicianName,
    status: row.status,
    laborCost: row.laborcost || row.laborCost || 0,
    laborTotal: row.labor_total || row.laborTotal || row.laborcost || row.laborCost || 0,
    discount: row.discount,
    partsUsed: row.partsused || row.partsUsed,
    additionalServices:
      row.additionalservices ||
      row.additionalServices ||
      row.additional_services ||
      notesDecoded.services,
    notes: notesDecoded.cleanNotes || "",
    total: row.total,
    workerTotal: row.worker_total || row.workerTotal || 0,
    branchId: row.branchid || row.branchId,
    // Canonical: createdBy — các field cũ giữ để tương thích, sẽ xoá sau
    createdBy: row.createdBy || row.created_by || row.createdby || null,
    /** @deprecated Dùng createdBy */
    created_by: row.created_by || row.createdBy || row.createdby || null,
    /** @deprecated Dùng createdBy */
    createdby: row.createdby || row.created_by || row.createdBy || null,
    depositAmount: row.depositamount || row.depositAmount,
    depositDate: row.depositdate || row.depositDate,
    depositTransactionId: row.deposittransactionid || row.depositTransactionId,
    paymentStatus: row.paymentstatus || row.paymentStatus,
    paymentMethod: row.paymentmethod || row.paymentMethod,
    additionalPayment: row.additionalpayment || row.additionalPayment,
    totalPaid: row.totalpaid || row.totalPaid,
    remainingAmount: row.remainingamount || row.remainingAmount,
    paymentDate: row.paymentdate || row.paymentDate,
    cashTransactionId: row.cashtransactionid || row.cashTransactionId,
    refunded:
      row.refunded === true ||
      row.status === "Đã hủy" ||
      row.status === "Da huy",
    refunded_at: row.refunded_at || row.refundedAt,
    refund_transaction_id: row.refund_transaction_id || row.refundTransactionId,
    refund_reason: row.refund_reason || row.refundReason,
    inventoryDeducted:
      Boolean(row.inventory_deducted) || Boolean(row.inventoryDeducted),
  };

  devWarnMissingFields(row, result);
  return result;
}
