import React from "react";
import { formatCurrency, formatWorkOrderId } from "../../../utils/format";
import type { WorkOrder, WorkOrderPart } from "../../../types";
import type { StoreSettings } from "../types/service.types";
import { sanitizeIssueDescriptionForPrint, getDynamicQrUrl } from "../utils/service.utils";

interface WorkOrderReceiptTemplateProps {
  id?: string;
  workOrder: WorkOrder;
  storeSettings?: StoreSettings | null;
}

export const WorkOrderReceiptTemplate: React.FC<WorkOrderReceiptTemplateProps> = ({
  id = "work-order-receipt",
  workOrder,
  storeSettings,
}) => {
  const printableIssueDescription = sanitizeIssueDescriptionForPrint(
    workOrder.issueDescription
  );

  return (
    <div
      id={id}
      className="hidden print:block"
      style={{
        position: "relative",
        width: "80mm",
        margin: "0 auto",
        padding: "3mm",
        fontFamily: "Arial, sans-serif",
        fontSize: "9pt",
        color: "#000",
        backgroundColor: "#fff",
      }}
    >
      {/* Header with Logo, Store Info and Bank Info */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "4mm",
          borderBottom: "2px solid #3b82f6",
          paddingBottom: "3mm",
          marginBottom: "4mm",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Left: Logo (if available) */}
        {storeSettings?.logo_url && (
          <img
            src={storeSettings.logo_url}
            alt="Logo"
            style={{
              height: "18mm",
              width: "18mm",
              objectFit: "contain",
              flexShrink: 0,
            }}
          />
        )}

        {/* Center: Store Info */}
        <div style={{ fontSize: "8.5pt", lineHeight: "1.4", flex: 1, textAlign: "center" }}>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "11pt",
              marginBottom: "1mm",
              color: "#1e40af",
              letterSpacing: "0.2mm",
            }}
          >
            {storeSettings?.store_name || "SƠN NAM"}
          </div>
          <div
            style={{
              color: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1mm",
            }}
          >
            <svg
              style={{ width: "10px", height: "10px", flexShrink: 0 }}
              viewBox="0 0 24 24"
              fill="#ef4444"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span>
              {storeSettings?.address ||
                "Ấp Phú Lợi B, Xã Long Phú Thuận, Đông Tháp"}
            </span>
          </div>
          <div
            style={{
              color: "#000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1mm",
            }}
          >
            <svg
              style={{ width: "10px", height: "10px", flexShrink: 0 }}
              viewBox="0 0 24 24"
              fill="#16a34a"
            >
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
            <span>{storeSettings?.phone || "0947.747.907"}</span>
          </div>
          {storeSettings?.email && (
            <div
              style={{
                color: "#000",
                display: "flex",
                alignItems: "center",
                gap: "1mm",
              }}
            >
              <svg
                style={{
                  width: "10px",
                  height: "10px",
                  flexShrink: 0,
                  fill: "#1877F2"
                }}
                viewBox="0 0 24 24"
              >
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              <span>{storeSettings.email}</span>
            </div>
          )}
        </div>

        {/* Right: Bank Info & QR */}
        <div
          style={{
            fontSize: "8pt",
            lineHeight: "1.4",
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {storeSettings?.bank_name && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "3mm",
                border: "1px solid #3b82f6",
                borderRadius: "2mm",
                padding: "2mm",
                backgroundColor: "#eff6ff",
              }}
            >
              {/* Bank Info */}
              <div style={{ textAlign: "right", flex: 1 }}>
                <div
                  style={{
                    fontWeight: "bold",
                    marginBottom: "1mm",
                    color: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "1mm",
                  }}
                >
                  <svg
                    style={{ width: "10px", height: "10px", flexShrink: 0 }}
                    viewBox="0 0 24 24"
                    fill="#0891b2"
                  >
                    <path d="M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z" />
                  </svg>
                  <span>{storeSettings.bank_name}</span>
                </div>
                {storeSettings.bank_account_number && (
                  <div style={{ color: "#000" }}>
                    STK: {storeSettings.bank_account_number}
                  </div>
                )}
                {storeSettings.bank_account_holder && (
                  <div style={{ color: "#000", fontSize: "7.5pt" }}>
                    {storeSettings.bank_account_holder}
                  </div>
                )}
              </div>
              {/* QR Code - Larger */}
              {getDynamicQrUrl(workOrder, storeSettings) && (
                <div style={{ flexShrink: 0 }}>
                  <img
                    src={getDynamicQrUrl(workOrder, storeSettings)}
                    alt="QR Banking"
                    style={{
                      height: "25mm",
                      width: "25mm",
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Title & Meta */}
      <div style={{ marginBottom: "4mm" }}>
        <div style={{ textAlign: "center", marginBottom: "2mm" }}>
          <h1
            style={{
              fontSize: "13pt",
              fontWeight: "bold",
              margin: "0",
              textTransform: "uppercase",
              color: "#1e40af",
              lineHeight: 1.25,
            }}
          >
            PHIẾU DỊCH VỤ SỬA CHỮA
          </h1>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "2mm",
            fontSize: "8.5pt",
            color: "#666",
          }}
        >
          <div>
            {new Date(workOrder.creationDate).toLocaleString("vi-VN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div style={{ fontWeight: "bold" }}>
            Mã:{" "}
            {formatWorkOrderId(
              workOrder.id,
              storeSettings?.work_order_prefix
            )}
          </div>
        </div>
      </div>

      {/* Customer Info */}
      <div
        style={{
          border: "1px solid #ddd",
          padding: "3mm",
          marginBottom: "4mm",
          borderRadius: "2mm",
        }}
      >
        <div style={{ marginBottom: "1.2mm", wordBreak: "break-word" }}>
          <span style={{ fontWeight: "bold" }}>Khách hàng:</span> {workOrder.customerName}
        </div>
        <div style={{ marginBottom: "1.2mm", wordBreak: "break-word" }}>
          <span style={{ fontWeight: "bold" }}>SĐT:</span> {workOrder.customerPhone}
        </div>
        <div style={{ marginBottom: "1.2mm", wordBreak: "break-word" }}>
          <span style={{ fontWeight: "bold" }}>Tên thiết bị:</span> {workOrder.vehicleModel}
        </div>
        <div style={{ wordBreak: "break-word" }}>
          <span style={{ fontWeight: "bold" }}>Serial/IMEI:</span> {workOrder.licensePlate}
        </div>
      </div>

      {/* Issue Description */}
      <div
        style={{
          border: "1px solid #ddd",
          padding: "3mm",
          marginBottom: "4mm",
          borderRadius: "2mm",
        }}
      >
        <div style={{ fontWeight: "bold", marginBottom: "1.5mm" }}>
          Mô tả sự cố:
        </div>
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {printableIssueDescription}
        </div>
      </div>

      {/* Parts Table */}
      {workOrder.partsUsed && workOrder.partsUsed.length > 0 && (
        <div style={{ marginBottom: "4mm" }}>
          <p
            style={{
              fontWeight: "bold",
              margin: "0 0 2mm 0",
              fontSize: "11pt",
            }}
          >
            Linh kiện:
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "2mm" }}>
            {workOrder.partsUsed.map((part: WorkOrderPart, idx: number) => (
              <div
                key={idx}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: "2mm",
                  padding: "2.5mm",
                  backgroundColor: "#fff",
                }}
              >
                <div
                  style={{
                    fontSize: "10pt",
                    fontWeight: "bold",
                    marginBottom: "1mm",
                    wordBreak: "break-word",
                  }}
                >
                  {part.partName}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "2mm",
                    fontSize: "9pt",
                    color: "#374151",
                  }}
                >
                  <div>
                    SL: {part.quantity} x {formatCurrency(part.price)}
                  </div>
                  <div style={{ fontWeight: "bold", color: "#111827", whiteSpace: "nowrap" }}>
                    {formatCurrency(part.price * part.quantity)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional Services */}
      {workOrder.additionalServices &&
        workOrder.additionalServices.length > 0 && (
          <div style={{ marginBottom: "4mm" }}>
            <p
              style={{
                fontWeight: "bold",
                margin: "0 0 2mm 0",
                fontSize: "11pt",
              }}
            >
              Dịch vụ bổ sung:
            </p>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "1px solid #ddd",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f5f5f5" }}>
                  <th
                    style={{
                      border: "1px solid #ddd",
                      padding: "2mm",
                      textAlign: "left",
                      fontSize: "10pt",
                    }}
                  >
                    Tên dịch vụ
                  </th>
                  <th
                    style={{
                      border: "1px solid #ddd",
                      padding: "2mm",
                      textAlign: "center",
                      fontSize: "10pt",
                      width: "15%",
                    }}
                  >
                    SL
                  </th>
                  <th
                    style={{
                      border: "1px solid #ddd",
                      padding: "2mm",
                      textAlign: "right",
                      fontSize: "10pt",
                      width: "25%",
                    }}
                  >
                    Thành tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                {workOrder.additionalServices.map((service, idx) => (
                  <tr key={idx}>
                    <td
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        fontSize: "10pt",
                      }}
                    >
                      {service.description}
                    </td>
                    <td
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "center",
                        fontSize: "10pt",
                      }}
                    >
                      {service.quantity || 1}
                    </td>
                    <td
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "right",
                        fontSize: "10pt",
                        fontWeight: "bold",
                      }}
                    >
                      {formatCurrency((service.price || 0) * (service.quantity || 1))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      {/* Cost Summary - Only show items > 0 */}
      <div
        style={{
          border: "1px solid #ddd",
          padding: "4mm",
          marginBottom: "4mm",
          borderRadius: "2mm",
          backgroundColor: "#f9f9f9",
        }}
      >
        <table style={{ width: "100%", borderSpacing: "0" }}>
          <tbody>
            {/* Tiền công - chỉ hiển thị khi > 0 */}
            {(workOrder.laborCost ?? 0) > 0 && (
              <tr>
                <td style={{ fontWeight: "bold", paddingBottom: "2mm", fontSize: "10pt" }}>
                  Tiền công:
                </td>
                <td style={{ textAlign: "right", paddingBottom: "2mm", fontSize: "10pt" }}>
                  {formatCurrency(workOrder.laborCost || 0)}
                </td>
              </tr>
            )}

            {/* Giá công/Đặt hàng - chỉ hiển thị khi > 0 */}
            {(() => {
              const additionalTotal = workOrder.additionalServices?.reduce(
                (sum: number, s: any) => sum + (s.price || 0) * (s.quantity || 1),
                0
              ) || 0;
              return additionalTotal > 0 && (
                <tr>
                  <td style={{ fontWeight: "bold", paddingBottom: "2mm", fontSize: "10pt" }}>
                    Giá công/Đặt hàng:
                  </td>
                  <td style={{ textAlign: "right", paddingBottom: "2mm", fontSize: "10pt" }}>
                    {formatCurrency(additionalTotal)}
                  </td>
                </tr>
              );
            })()}

            {/* Dịch vụ bổ sung aggregated above as Giá công/Đặt hàng */}
            {workOrder.discount != null && workOrder.discount > 0 && (
              <tr>
                <td
                  style={{
                    fontWeight: "bold",
                    paddingBottom: "2mm",
                    fontSize: "10pt",
                    color: "#e74c3c",
                  }}
                >
                  Giảm giá:
                </td>
                <td
                  style={{
                    textAlign: "right",
                    paddingBottom: "2mm",
                    fontSize: "10pt",
                    color: "#e74c3c",
                  }}
                >
                  -{formatCurrency(workOrder.discount)}
                </td>
              </tr>
            )}
            <tr style={{ borderTop: "2px solid #333" }}>
              <td
                style={{
                  fontWeight: "bold",
                  paddingTop: "2mm",
                  fontSize: "12pt",
                }}
              >
                TỔNG CỘNG:
              </td>
              <td
                style={{
                  textAlign: "right",
                  paddingTop: "2mm",
                  fontSize: "12pt",
                  fontWeight: "bold",
                  color: "#2563eb",
                }}
              >
                {formatCurrency(workOrder.total)} ₫
              </td>
            </tr>
            {workOrder.totalPaid != null && workOrder.totalPaid > 0 && (
              <tr>
                <td
                  style={{
                    fontWeight: "bold",
                    paddingTop: "2mm",
                    fontSize: "10pt",
                    color: "#16a34a",
                  }}
                >
                  Đã thanh toán:
                </td>
                <td
                  style={{
                    textAlign: "right",
                    paddingTop: "2mm",
                    fontSize: "10pt",
                    color: "#16a34a",
                  }}
                >
                  {formatCurrency(workOrder.totalPaid)}
                </td>
              </tr>
            )}
            {workOrder.remainingAmount != null &&
              workOrder.remainingAmount > 0 && (
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      fontSize: "11pt",
                      color: "#dc2626",
                    }}
                  >
                    Còn lại:
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontSize: "11pt",
                      fontWeight: "bold",
                      color: "#dc2626",
                    }}
                  >
                    {formatCurrency(workOrder.remainingAmount)}
                  </td>
                </tr>
              )}
            {workOrder.paymentMethod && (
              <tr>
                <td
                  style={{
                    paddingTop: "2mm",
                    fontSize: "9pt",
                    color: "#666",
                  }}
                >
                  Hình thức thanh toán:
                </td>
                <td
                  style={{
                    textAlign: "right",
                    paddingTop: "2mm",
                    fontSize: "9pt",
                    color: "#666",
                  }}
                >
                  {workOrder.paymentMethod === "cash"
                    ? "Tiền mặt"
                    : workOrder.paymentMethod === "bank"
                      ? "Chuyển khoản"
                      : workOrder.paymentMethod}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "8mm",
          paddingTop: "4mm",
          borderTop: "1px dashed #999",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10pt",
          }}
        >
          <div style={{ textAlign: "center", width: "45%" }}>
            <p style={{ fontWeight: "bold", margin: "0 0 10mm 0" }}>
              Khách hàng
            </p>
            <p style={{ margin: "0", fontSize: "9pt", color: "#666" }}>
              (Ký và ghi rõ họ tên)
            </p>
          </div>
          <div style={{ textAlign: "center", width: "45%" }}>
            <p style={{ fontWeight: "bold", margin: "0 0 10mm 0" }}>
              Nhân viên
            </p>
            <p style={{ margin: "0", fontSize: "9pt", color: "#666" }}>
              {workOrder.technicianName || "(Ký và ghi rõ họ tên)"}
            </p>
          </div>
        </div>
      </div>

      {/* Note */}
      <div
        style={{
          marginTop: "4mm",
          padding: "3mm",
          backgroundColor: "#fff9e6",
          border: "1px solid #ffd700",
          borderRadius: "2mm",
          fontSize: "9pt",
          textAlign: "center",
        }}
      >
        <p style={{ margin: "0", fontStyle: "italic" }}>
          Cảm ơn quý khách đã sử dụng dịch vụ!
        </p>
        <p style={{ margin: "1mm 0 0 0", fontStyle: "italic" }}>
          Vui lòng giữ phiếu này để đối chiếu khi nhận máy
        </p>
      </div>

      {/* Warranty Policy Disclaimer */}
      <div
        style={{
          marginTop: "3mm",
          padding: "2mm",
          fontSize: "8pt",
          color: "#666",
          borderTop: "1px solid #e5e7eb",
          lineHeight: "1.4",
        }}
      >
        <p style={{ margin: "0 0 1mm 0", fontWeight: "bold" }}>
          Chính sách bảo hành:
        </p>
        <ul
          style={{
            margin: "0",
            paddingLeft: "5mm",
            listStyleType: "disc",
          }}
        >
          <li>
            Bảo hành áp dụng cho phụ tùng chính hãng và lỗi kỹ thuật do thợ
          </li>
          <li>
            Không bảo hành đối với rơi vỡ, vào nước sau khi nhận
            máy
          </li>
          <li>
            Mang theo phiếu này khi đến bảo hành. Liên hệ hotline nếu có
            thắc mắc
          </li>
        </ul>
      </div>
    </div>
  );
};
