import React from "react";
import type { PawnRecord } from "../../types";
import { formatCurrency } from "../../utils/format";
import { numberToVietnameseWords } from "../../utils/numberToWords";

interface PawnReceiptTemplateProps {
  id?: string;
  record: PawnRecord;
  storeSettings?: any;
}

export const PawnReceiptTemplate: React.FC<PawnReceiptTemplateProps> = ({
  id = "pawn-receipt",
  record,
  storeSettings,
}) => {
  const storeName = storeSettings?.store_name || "CỬA HÀNG DỊCH VỤ TIN HỌC VIỄN THÔNG SƠN NAM";
  const storePhone = storeSettings?.phone || "0868.1111.01 - 0976.507.401";
  const storeAddress = storeSettings?.address || "Vĩnh Lập, An Cư, An Giang";

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "..../..../.......";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "..../..../.......";
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getFullYear()}`;
  };

  const getDayMonthYear = (dateStr?: string) => {
    if (!dateStr) return { day: "...", month: "...", year: "..." };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { day: "...", month: "...", year: "..." };
    return {
      day: d.getDate().toString().padStart(2, "0"),
      month: (d.getMonth() + 1).toString().padStart(2, "0"),
      year: d.getFullYear().toString(),
    };
  };

  const startInfo = getDayMonthYear(record.startDate);
  const endInfo = getDayMonthYear(record.endDate);

  return (
    <div
      id={id}
      className="hidden print:block"
      style={{
        width: "148mm", // A5 Width (standard for pawn receipts in Vietnam)
        minHeight: "210mm", // A5 Height
        margin: "0 auto",
        padding: "10mm",
        fontFamily: "'Arial', sans-serif",
        fontSize: "11pt",
        color: "#000",
        backgroundColor: "#fff",
        boxSizing: "border-box",
        lineHeight: "1.6",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "4mm" }}>
        <div
          style={{
            fontWeight: "bold",
            fontSize: "13pt",
            color: "#b91c1c", // Dark Red
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {storeName}
        </div>
        <div style={{ fontSize: "9.5pt", fontWeight: "bold", color: "#1e3a8a" }}>
          ĐC: {storeAddress}
        </div>
        <div style={{ fontSize: "9.5pt", fontWeight: "bold", color: "#b91c1c" }}>
          ĐT: {storePhone}
        </div>
      </div>

      {/* Main Title */}
      <div style={{ textAlign: "center", marginBottom: "6mm" }}>
        <h1
          style={{
            fontSize: "20pt",
            fontWeight: "bold",
            color: "#b91c1c",
            margin: "0 0 2px 0",
            letterSpacing: "2px",
          }}
        >
          BIÊN NHẬN
        </h1>
        <div style={{ fontSize: "9.5pt", fontStyle: "italic", color: "#4b5563" }}>
          Số: {record.id}
        </div>
      </div>

      {/* Customer Info */}
      <div style={{ marginBottom: "5mm" }}>
        <div style={{ display: "flex", width: "100%", marginBottom: "4px" }}>
          <div style={{ whiteSpace: "nowrap" }}>Khách hàng:</div>
          <div
            style={{
              flex: 1,
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              fontWeight: "bold",
              paddingLeft: "4px",
            }}
          >
            {record.customerName}
          </div>
          <div style={{ whiteSpace: "nowrap", marginLeft: "15px" }}>ĐT:</div>
          <div
            style={{
              width: "120px",
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              fontWeight: "bold",
              paddingLeft: "4px",
            }}
          >
            {record.customerPhone || ""}
          </div>
        </div>

        <div style={{ display: "flex", width: "100%", marginBottom: "4px" }}>
          <div style={{ whiteSpace: "nowrap" }}>Địa chỉ:</div>
          <div
            style={{
              flex: 1,
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              paddingLeft: "4px",
            }}
          >
            {record.customerAddress || ""}
          </div>
        </div>

        <div style={{ display: "flex", width: "100%", marginBottom: "4px" }}>
          <div style={{ whiteSpace: "nowrap" }}>CCCD:</div>
          <div
            style={{
              flex: 1,
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              paddingLeft: "4px",
            }}
          >
            {record.customerCccd || ""}
          </div>
        </div>
      </div>

      {/* Agreement Statement */}
      <div style={{ marginBottom: "5mm", textAlign: "justify", textIndent: "15px" }}>
        Tôi xin thoả thuận tự nguyện đặt đồ vật, tài sản liệt kê sau đây cho cửa hàng{" "}
        <b>Sơn Nam</b> để nhận bằng tiền mặt:
      </div>

      {/* Asset Info */}
      <div style={{ marginBottom: "5mm" }}>
        <div style={{ display: "flex", width: "100%", marginBottom: "4px" }}>
          <div style={{ whiteSpace: "nowrap" }}>Loại tài sản cầm:</div>
          <div
            style={{
              flex: 1,
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              fontWeight: "bold",
              paddingLeft: "4px",
            }}
          >
            {record.assetType}
          </div>
        </div>

        <div style={{ display: "flex", width: "100%", marginBottom: "4px" }}>
          <div style={{ whiteSpace: "nowrap" }}>Model:</div>
          <div
            style={{
              flex: 1,
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              paddingLeft: "4px",
            }}
          >
            {record.assetModel || ""}
          </div>
          <div style={{ whiteSpace: "nowrap", marginLeft: "15px" }}>Số seri:</div>
          <div
            style={{
              flex: 1,
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              paddingLeft: "4px",
            }}
          >
            {record.assetSerial || ""}
          </div>
        </div>

        <div style={{ display: "flex", width: "100%", marginBottom: "4px" }}>
          <div style={{ whiteSpace: "nowrap" }}>Tương đương với số tiền cầm là:</div>
          <div
            style={{
              flex: 1,
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              fontWeight: "bold",
              paddingLeft: "4px",
            }}
          >
            {formatCurrency(record.loanAmount)}
          </div>
        </div>

        <div style={{ display: "flex", width: "100%", marginBottom: "4px" }}>
          <div style={{ whiteSpace: "nowrap" }}>Viết bằng chữ:</div>
          <div
            style={{
              flex: 1,
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              fontStyle: "italic",
              paddingLeft: "4px",
            }}
          >
            {numberToVietnameseWords(record.loanAmount)}
          </div>
        </div>
      </div>

      {/* Interest and Term */}
      <div style={{ marginBottom: "6mm" }}>
        <div style={{ display: "flex", width: "100%", flexWrap: "wrap", lineHeight: "1.8" }}>
          <span style={{ whiteSpace: "nowrap" }}>Với lãi suất:</span>
          <span
            style={{
              minWidth: "40px",
              borderBottom: "1px dashed #000",
              textAlign: "center",
              fontWeight: "bold",
              padding: "0 4px",
            }}
          >
            {record.interestRate || "0"}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>% /</span>
          <span
            style={{
              minWidth: "50px",
              borderBottom: "1px dashed #000",
              textAlign: "center",
              padding: "0 4px",
            }}
          >
            {record.interestPeriod === "day" ? "Ngày" : "Tháng"}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>, tính từ ngày</span>
          <span
            style={{
              minWidth: "80px",
              borderBottom: "1px dashed #000",
              textAlign: "center",
              padding: "0 4px",
            }}
          >
            {startInfo.day}/{startInfo.month}/{startInfo.year}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>đến ngày</span>
          <span
            style={{
              minWidth: "80px",
              borderBottom: "1px dashed #000",
              textAlign: "center",
              padding: "0 4px",
            }}
          >
            {endInfo.day}/{endInfo.month}/{endInfo.year}
          </span>
        </div>
        <div style={{ display: "flex", width: "100%", marginTop: "4px" }}>
          <div style={{ whiteSpace: "nowrap" }}>Nhưng sẽ không thấp hơn:</div>
          <div
            style={{
              flex: 1,
              borderBottom: "1px dashed #000",
              marginLeft: "6px",
              fontWeight: "bold",
              paddingLeft: "4px",
            }}
          >
            {formatCurrency(record.minInterest || 0)}
          </div>
          <div style={{ whiteSpace: "nowrap", marginLeft: "6px" }}>/lần chuộc.</div>
        </div>
      </div>

      {/* Conditions */}
      <div style={{ fontSize: "9pt", textAlign: "justify", marginBottom: "8mm", color: "#374151" }}>
        <div style={{ marginBottom: "4px" }}>
          <b>1. Sau ngày {formatDate(record.endDate)}:</b> Nếu khách hàng (chủ tài sản) không đến chuộc lại
          hoặc đóng lãi như thoả thuận thì cửa hàng có toàn quyền định đoạt, thanh lý tài sản mà không cần
          phải báo cho khách hàng (chủ tài sản) để thu hồi vốn, và khách hàng (chủ tài sản) không có quyền
          khiếu nại về sau, việc thoả thuận này phải được thực hiện trực tiếp tại cửa hàng SƠN NAM, nơi thoả
          thuận việc cầm cố tài sản trước đó, mọi giao dịch, thoả thuận qua điện thoại sẽ không có hiệu lực.
        </div>
        <div>
          <b>2.</b> Và khách hàng (chủ tài sản) cam kết tài sản này thuộc quyền sở hữu của chính mình không
          tranh chấp, sở hữu chung với ai hoặc từ vi phạm pháp luật mà có; Nếu không đúng những gì cam kết
          (2) thì khách hàng (chủ tài sản) phải hoàn toàn chịu trách nhiệm trước pháp luật.
        </div>
      </div>

      {/* Footer / Signatures */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10pt" }}>
        <div style={{ textAlign: "center", width: "45%" }}>
          <p style={{ fontWeight: "bold", margin: "0 0 15mm 0", textTransform: "uppercase" }}>
            KHÁCH HÀNG
          </p>
          <p style={{ margin: "0", fontSize: "9.5pt", color: "#4b5563" }}>
            (Ký và ghi rõ họ tên)
          </p>
        </div>
        <div style={{ textAlign: "center", width: "45%" }}>
          <p style={{ fontWeight: "bold", margin: "0 0 15mm 0", textTransform: "uppercase" }}>
            CỬA HÀNG
          </p>
          <p style={{ margin: "0", fontSize: "9.5pt", color: "#4b5563" }}>
            (Ký tên, đóng dấu)
          </p>
        </div>
      </div>
    </div>
  );
};
