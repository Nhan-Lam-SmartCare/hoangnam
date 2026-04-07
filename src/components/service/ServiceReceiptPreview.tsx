import React from "react";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import type { WorkOrder } from "../../types";

interface Props {
  workOrder: WorkOrder;
  storeSettings?: { work_order_prefix?: string } | null;
}

const ServiceReceiptPreview: React.FC<Props> = ({
  workOrder,
  storeSettings = null,
}) => {
  const items = workOrder.partsUsed || [];
  const total = workOrder.total || 0;
  const formattedId = formatWorkOrderId(
    workOrder.id,
    storeSettings?.work_order_prefix
  );

  return (
    <div id="service-receipt-preview" style={{ padding: 20, maxWidth: 680 }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>
          PHIẾU DỊCH VỤ SỬA CHỮA
        </h2>
        <div style={{ fontSize: 11, color: "#666" }}>
          Mã: <strong style={{ color: "#000" }}>{formattedId}</strong> - Ngày:{" "}
          <strong>{formatDate(new Date(workOrder.creationDate), true)}</strong>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div>
          <strong>Khách hàng:</strong> {workOrder.customerName || "Khách lẻ"}
        </div>
        {workOrder.customerPhone && (
          <div>
            <strong>Điện thoại:</strong> {workOrder.customerPhone}
          </div>
        )}
      </div>

      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
      >
        <thead>
          <tr style={{ backgroundColor: "#f1f3f5" }}>
            <th style={{ textAlign: "left", padding: 8, fontWeight: 700 }}>
              Sản phẩm
            </th>
            <th style={{ textAlign: "center", padding: 8, fontWeight: 700 }}>
              SL
            </th>
            <th style={{ textAlign: "right", padding: 8, fontWeight: 700 }}>
              Thành tiền
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((it: any, idx: number) => (
            <tr key={idx}>
              <td style={{ padding: 8 }}>{it.name || it.partName}</td>
              <td style={{ padding: 8, textAlign: "center" }}>
                {it.quantity || 1}
              </td>
              <td style={{ padding: 8, textAlign: "right" }}>
                {formatCurrency(
                  (it.price || it.sellingPrice || 0) * (it.quantity || 1)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12, textAlign: "right", fontWeight: 700 }}>
        Tổng: {formatCurrency(total)}
      </div>
    </div>
  );
};

export default ServiceReceiptPreview;
