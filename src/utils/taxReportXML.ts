/**
 * TAX REPORT XML EXPORT SERVICE
 * Xuất báo cáo thuế theo định dạng XML chuẩn Tổng cục Thuế Việt Nam
 *
 * Hỗ trợ các mẫu:
 * - 01/GTGT: Tờ khai thuế GTGT (Giá trị gia tăng)
 * - Báo cáo doanh thu theo tháng/quý
 * - Báo cáo chi phí
 */

import { Sale, WorkOrder, CashTransaction } from "../types";
import { formatDate } from "./format";
import {
  getWorkOrderAccountingDate,
  isPaidWorkOrder,
} from "../lib/reports/financialSummary";

// =====================================================
// INTERFACES
// =====================================================

export interface OrganizationTaxInfo {
  taxCode: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  taxAuthority: string; // "Cục Thuế TP.HCM"
  taxDepartment: string; // "Chi cục Thuế Quận 1"
  legalRepresentative: string;
  accountantName?: string;
  accountantPhone?: string;
}

interface TaxPeriod {
  type: "month" | "quarter" | "year";
  year: number;
  month?: number; // 1-12
  quarter?: number; // 1-4
}

interface VATReportData {
  period: TaxPeriod;
  organization: OrganizationTaxInfo;

  // Hàng hóa, dịch vụ bán ra
  outputVAT: {
    totalRevenue: number; // Tổng doanh thu chưa VAT
    vatAmount: number; // Thuế GTGT đầu ra
    transactions: Array<{
      invoiceNumber: string;
      date: string;
      customerName: string;
      customerTaxCode?: string;
      amountBeforeVAT: number;
      vatRate: number;
      vatAmount: number;
      totalAmount: number;
    }>;
  };

  // Hàng hóa, dịch vụ mua vào
  inputVAT: {
    totalExpense: number; // Tổng chi phí chưa VAT
    vatAmount: number; // Thuế GTGT đầu vào
    transactions: Array<{
      invoiceNumber: string;
      date: string;
      supplierName: string;
      supplierTaxCode?: string;
      amountBeforeVAT: number;
      vatRate: number;
      vatAmount: number;
      totalAmount: number;
    }>;
  };

  // Thuế GTGT phải nộp = Thuế đầu ra - Thuế đầu vào
  vatPayable: number;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Tính thuế GTGT từ tổng tiền (giả định VAT đã bao gồm trong tổng tiền)
 */
function calculateVAT(
  total: number,
  vatRate: number = 10
): {
  amountBeforeVAT: number;
  vatAmount: number;
} {
  const amountBeforeVAT = Math.round(total / (1 + vatRate / 100));
  const vatAmount = total - amountBeforeVAT;
  return { amountBeforeVAT, vatAmount };
}

/**
 * Format period cho XML
 */
function formatPeriod(period: TaxPeriod): string {
  if (period.type === "month") {
    return `${period.month?.toString().padStart(2, "0")}/${period.year}`;
  } else if (period.type === "quarter") {
    return `Q${period.quarter}/${period.year}`;
  } else {
    return `${period.year}`;
  }
}

/**
 * Lấy kỳ thuế từ date range
 */
export function getPeriodFromDateRange(
  startDate: Date,
  endDate: Date
): TaxPeriod {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check if it's a full month
  if (
    start.getDate() === 1 &&
    end.getMonth() === start.getMonth() &&
    end.getFullYear() === start.getFullYear()
  ) {
    return {
      type: "month",
      year: start.getFullYear(),
      month: start.getMonth() + 1,
    };
  }

  // Check if it's a quarter
  const startQuarter = Math.floor(start.getMonth() / 3) + 1;
  const endQuarter = Math.floor(end.getMonth() / 3) + 1;
  if (startQuarter === endQuarter) {
    return {
      type: "quarter",
      year: start.getFullYear(),
      quarter: startQuarter,
    };
  }

  // Otherwise, treat as custom period (use year)
  return {
    type: "year",
    year: start.getFullYear(),
  };
}

// =====================================================
// DATA PREPARATION
// =====================================================

/**
 * Chuẩn bị dữ liệu báo cáo VAT từ Sales và Work Orders
 */
export function prepareVATReportData(
  sales: Sale[],
  workOrders: WorkOrder[],
  cashTransactions: CashTransaction[],
  organization: OrganizationTaxInfo,
  startDate: Date,
  endDate: Date
): VATReportData {
  const period = getPeriodFromDateRange(startDate, endDate);

  // ===== THUẾ ĐẦU RA (từ bán hàng) =====
  const outputTransactions: VATReportData["outputVAT"]["transactions"] = [];
  let totalOutputRevenue = 0;
  let totalOutputVAT = 0;

  // Từ Sales
  sales.forEach((sale) => {
    const saleDate = new Date(sale.date);
    if (saleDate >= startDate && saleDate <= endDate) {
      const vatRate = (sale as any).vatRate || 10;
      let amountBeforeVAT = (sale as any).amountBeforeVAT;
      let vatAmount = (sale as any).vatAmount;

      // Nếu chưa có thông tin VAT, tính toán
      if (!amountBeforeVAT || !vatAmount) {
        const calculated = calculateVAT(sale.total, vatRate);
        amountBeforeVAT = calculated.amountBeforeVAT;
        vatAmount = calculated.vatAmount;
      }

      outputTransactions.push({
        invoiceNumber: sale.id,
        date: formatDate(sale.date),
        customerName: sale.customer?.name || "Khách lẻ",
        customerTaxCode: (sale.customer as any)?.taxCode || "",
        amountBeforeVAT,
        vatRate,
        vatAmount,
        totalAmount: sale.total,
      });

      totalOutputRevenue += amountBeforeVAT;
      totalOutputVAT += vatAmount;
    }
  });

  // Từ Work Orders (đã có thu tiền)
  workOrders.forEach((wo: any) => {
    const woDate = getWorkOrderAccountingDate(wo);
    const isPaid = isPaidWorkOrder(wo);

    if (woDate && woDate >= startDate && woDate <= endDate && isPaid) {
      const total =
        parseFloat(
          wo.totalPaid ?? wo.totalpaid ?? wo.total ?? wo.totalPrice ?? wo.totalprice ?? 0
        ) || 0;

      const vatRate = wo.vatRate || wo.vatrate || 10;
      let amountBeforeVAT = wo.amountBeforeVAT || wo.amount_before_vat;
      let vatAmount = wo.vatAmount || wo.vat_amount;

      if (!amountBeforeVAT || !vatAmount) {
        const calculated = calculateVAT(total, vatRate);
        amountBeforeVAT = calculated.amountBeforeVAT;
        vatAmount = calculated.vatAmount;
      }

      outputTransactions.push({
        invoiceNumber: wo.orderNumber || wo.ordernumber || wo.id,
        date: formatDate(woDate.toISOString()),
        customerName: wo.customerName || wo.customername || "Khách hàng",
        customerTaxCode: "",
        amountBeforeVAT,
        vatRate,
        vatAmount,
        totalAmount: total,
      });

      totalOutputRevenue += amountBeforeVAT;
      totalOutputVAT += vatAmount;
    }
  });

  // ===== THUẾ ĐẦU VÀO (từ mua hàng/chi phí) =====
  const inputTransactions: VATReportData["inputVAT"]["transactions"] = [];
  let totalInputExpense = 0;
  let totalInputVAT = 0;

  // Từ Cash Transactions (chi phí có hóa đơn VAT)
  cashTransactions.forEach((tx) => {
    if (tx.type === "expense") {
      const txDate = new Date(tx.date);
      if (txDate >= startDate && txDate <= endDate) {
        // Chỉ tính những chi phí có hóa đơn đầu vào
        // (trong thực tế cần có cột đánh dấu hasVATInvoice)
        const vatRate = 10; // Giả định
        const calculated = calculateVAT(tx.amount, vatRate);

        inputTransactions.push({
          invoiceNumber: tx.id,
          date: formatDate(tx.date),
          supplierName: tx.recipient || "Nhà cung cấp",
          supplierTaxCode: "",
          amountBeforeVAT: calculated.amountBeforeVAT,
          vatRate,
          vatAmount: calculated.vatAmount,
          totalAmount: tx.amount,
        });

        totalInputExpense += calculated.amountBeforeVAT;
        totalInputVAT += calculated.vatAmount;
      }
    }
  });

  // Tính thuế phải nộp
  const vatPayable = totalOutputVAT - totalInputVAT;

  return {
    period,
    organization,
    outputVAT: {
      totalRevenue: totalOutputRevenue,
      vatAmount: totalOutputVAT,
      transactions: outputTransactions,
    },
    inputVAT: {
      totalExpense: totalInputExpense,
      vatAmount: totalInputVAT,
      transactions: inputTransactions,
    },
    vatPayable,
  };
}

// =====================================================
// XML GENERATION
// =====================================================

/**
 * Escape XML special characters
 */
function escapeXML(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format số tiền cho XML (không dấu phẩy, 2 số thập phân)
 */
function formatXMLAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Tạo XML theo mẫu 01/GTGT (Tờ khai thuế GTGT)
 */
export function generateVAT01XML(data: VATReportData): string {
  const { period, organization, outputVAT, inputVAT, vatPayable } = data;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<TKhaiThue xmlns="http://kekhaithue.gdt.gov.vn/TKhaiThue">\n';

  // Header
  xml += "  <TTinChung>\n";
  xml += `    <PBan>1.0</PBan>\n`;
  xml += `    <MauSo>01/GTGT</MauSo>\n`;
  xml += `    <TenMau>Tờ khai thuế giá trị gia tăng</TenMau>\n`;
  xml += `    <KyKKhai>${escapeXML(formatPeriod(period))}</KyKKhai>\n`;
  xml += `    <KyKhaiTu>${formatDate(new Date())}</KyKhaiTu>\n`;
  xml += `    <KyKhaiDen>${formatDate(new Date())}</KyKhaiDen>\n`;
  xml += "  </TTinChung>\n";

  // Organization Info
  xml += "  <TTinDVu>\n";
  xml += `    <MST>${escapeXML(organization.taxCode)}</MST>\n`;
  xml += `    <Ten>${escapeXML(organization.name)}</Ten>\n`;
  xml += `    <DChi>${escapeXML(organization.address)}</DChi>\n`;
  xml += `    <DThoai>${escapeXML(organization.phone)}</DThoai>\n`;
  xml += `    <CQanThu>${escapeXML(organization.taxAuthority)}</CQanThu>\n`;
  xml += `    <CCucThu>${escapeXML(organization.taxDepartment)}</CCucThu>\n`;
  xml += `    <NguoiDaiDien>${escapeXML(
    organization.legalRepresentative
  )}</NguoiDaiDien>\n`;
  if (organization.accountantName) {
    xml += `    <NguoiKeToan>${escapeXML(
      organization.accountantName
    )}</NguoiKeToan>\n`;
  }
  xml += "  </TTinDVu>\n";

  // Output VAT (Hàng hóa, dịch vụ bán ra)
  xml += "  <BangKe01>\n";
  xml += "    <DauRa>\n";
  xml += `      <TongDoanhThu>${formatXMLAmount(
    outputVAT.totalRevenue
  )}</TongDoanhThu>\n`;
  xml += `      <TongThueGTGT>${formatXMLAmount(
    outputVAT.vatAmount
  )}</TongThueGTGT>\n`;
  xml += `      <SoGiaoDich>${outputVAT.transactions.length}</SoGiaoDich>\n`;

  // Chi tiết từng giao dịch đầu ra
  outputVAT.transactions.forEach((tx, index) => {
    xml += "      <ChiTiet>\n";
    xml += `        <STT>${index + 1}</STT>\n`;
    xml += `        <SoHD>${escapeXML(tx.invoiceNumber)}</SoHD>\n`;
    xml += `        <NgayHD>${tx.date}</NgayHD>\n`;
    xml += `        <TenKH>${escapeXML(tx.customerName)}</TenKH>\n`;
    if (tx.customerTaxCode) {
      xml += `        <MSTKhach>${escapeXML(tx.customerTaxCode)}</MSTKhach>\n`;
    }
    xml += `        <TienChuaThue>${formatXMLAmount(
      tx.amountBeforeVAT
    )}</TienChuaThue>\n`;
    xml += `        <TyLeThue>${tx.vatRate}</TyLeThue>\n`;
    xml += `        <TienThue>${formatXMLAmount(tx.vatAmount)}</TienThue>\n`;
    xml += `        <TongTien>${formatXMLAmount(tx.totalAmount)}</TongTien>\n`;
    xml += "      </ChiTiet>\n";
  });

  xml += "    </DauRa>\n";

  // Input VAT (Hàng hóa, dịch vụ mua vào)
  xml += "    <DauVao>\n";
  xml += `      <TongChiPhi>${formatXMLAmount(
    inputVAT.totalExpense
  )}</TongChiPhi>\n`;
  xml += `      <TongThueGTGT>${formatXMLAmount(
    inputVAT.vatAmount
  )}</TongThueGTGT>\n`;
  xml += `      <SoGiaoDich>${inputVAT.transactions.length}</SoGiaoDich>\n`;

  // Chi tiết từng giao dịch đầu vào
  inputVAT.transactions.forEach((tx, index) => {
    xml += "      <ChiTiet>\n";
    xml += `        <STT>${index + 1}</STT>\n`;
    xml += `        <SoHD>${escapeXML(tx.invoiceNumber)}</SoHD>\n`;
    xml += `        <NgayHD>${tx.date}</NgayHD>\n`;
    xml += `        <TenNCC>${escapeXML(tx.supplierName)}</TenNCC>\n`;
    if (tx.supplierTaxCode) {
      xml += `        <MSTNCC>${escapeXML(tx.supplierTaxCode)}</MSTNCC>\n`;
    }
    xml += `        <TienChuaThue>${formatXMLAmount(
      tx.amountBeforeVAT
    )}</TienChuaThue>\n`;
    xml += `        <TyLeThue>${tx.vatRate}</TyLeThue>\n`;
    xml += `        <TienThue>${formatXMLAmount(tx.vatAmount)}</TienThue>\n`;
    xml += `        <TongTien>${formatXMLAmount(tx.totalAmount)}</TongTien>\n`;
    xml += "      </ChiTiet>\n";
  });

  xml += "    </DauVao>\n";
  xml += "  </BangKe01>\n";

  // Tổng hợp thuế phải nộp
  xml += "  <TongHop>\n";
  xml += `    <ThueGTGTDauRa>${formatXMLAmount(
    outputVAT.vatAmount
  )}</ThueGTGTDauRa>\n`;
  xml += `    <ThueGTGTDauVao>${formatXMLAmount(
    inputVAT.vatAmount
  )}</ThueGTGTDauVao>\n`;
  xml += `    <ThueGTGTPhaiNop>${formatXMLAmount(
    vatPayable
  )}</ThueGTGTPhaiNop>\n`;
  xml += "  </TongHop>\n";

  // Footer
  xml += "  <NguoiKy>\n";
  xml += `    <NguoiLap>${escapeXML(
    organization.accountantName || "Kế toán"
  )}</NguoiLap>\n`;
  xml += `    <NgayLap>${formatDate(new Date())}</NgayLap>\n`;
  xml += "  </NguoiKy>\n";

  xml += "</TKhaiThue>\n";

  return xml;
}

/**
 * Tạo XML báo cáo doanh thu đơn giản
 */
export function generateRevenueReportXML(
  sales: Sale[],
  workOrders: WorkOrder[],
  organization: OrganizationTaxInfo,
  startDate: Date,
  endDate: Date
): string {
  const period = getPeriodFromDateRange(startDate, endDate);

  let totalRevenue = 0;
  let totalVAT = 0;
  const transactions: any[] = [];

  // Process sales
  sales.forEach((sale) => {
    const saleDate = new Date(sale.date);
    if (saleDate >= startDate && saleDate <= endDate) {
      const calculated = calculateVAT(sale.total, 10);
      totalRevenue += calculated.amountBeforeVAT;
      totalVAT += calculated.vatAmount;

      transactions.push({
        type: "sale",
        id: sale.id,
        date: formatDate(sale.date),
        customer: sale.customer?.name || "Khách lẻ",
        amountBeforeVAT: calculated.amountBeforeVAT,
        vatAmount: calculated.vatAmount,
        total: sale.total,
      });
    }
  });

  // Process work orders
  workOrders.forEach((wo: any) => {
    const woDate = getWorkOrderAccountingDate(wo);
    const isPaid = isPaidWorkOrder(wo);

    if (woDate && woDate >= startDate && woDate <= endDate && isPaid) {
      const total =
        parseFloat(
          wo.totalPaid ?? wo.totalpaid ?? wo.total ?? wo.totalPrice ?? wo.totalprice ?? 0
        ) || 0;
      const calculated = calculateVAT(total, 10);
      totalRevenue += calculated.amountBeforeVAT;
      totalVAT += calculated.vatAmount;

      transactions.push({
        type: "service",
        id: wo.orderNumber || wo.ordernumber || wo.id,
        date: formatDate(woDate.toISOString()),
        customer: wo.customerName || wo.customername || "Khách hàng",
        amountBeforeVAT: calculated.amountBeforeVAT,
        vatAmount: calculated.vatAmount,
        total: total,
      });
    }
  });

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<BaoCaoDoanhThu>\n";

  xml += "  <ThongTin>\n";
  xml += `    <MST>${escapeXML(organization.taxCode)}</MST>\n`;
  xml += `    <TenDonVi>${escapeXML(organization.name)}</TenDonVi>\n`;
  xml += `    <DiaChi>${escapeXML(organization.address)}</DiaChi>\n`;
  xml += `    <KyBaoCao>${escapeXML(formatPeriod(period))}</KyBaoCao>\n`;
  xml += `    <TuNgay>${formatDate(startDate)}</TuNgay>\n`;
  xml += `    <DenNgay>${formatDate(endDate)}</DenNgay>\n`;
  xml += "  </ThongTin>\n";

  xml += "  <TongHop>\n";
  xml += `    <TongDoanhThuChuaThue>${formatXMLAmount(
    totalRevenue
  )}</TongDoanhThuChuaThue>\n`;
  xml += `    <TongThueGTGT>${formatXMLAmount(totalVAT)}</TongThueGTGT>\n`;
  xml += `    <TongDoanhThuSauThue>${formatXMLAmount(
    totalRevenue + totalVAT
  )}</TongDoanhThuSauThue>\n`;
  xml += `    <SoGiaoDich>${transactions.length}</SoGiaoDich>\n`;
  xml += "  </TongHop>\n";

  xml += "  <ChiTiet>\n";
  transactions.forEach((tx, index) => {
    xml += "    <GiaoDich>\n";
    xml += `      <STT>${index + 1}</STT>\n`;
    xml += `      <LoaiGiaoDich>${
      tx.type === "sale" ? "Bán hàng" : "Dịch vụ"
    }</LoaiGiaoDich>\n`;
    xml += `      <MaGiaoDich>${escapeXML(tx.id)}</MaGiaoDich>\n`;
    xml += `      <NgayGiaoDich>${tx.date}</NgayGiaoDich>\n`;
    xml += `      <KhachHang>${escapeXML(tx.customer)}</KhachHang>\n`;
    xml += `      <TienChuaThue>${formatXMLAmount(
      tx.amountBeforeVAT
    )}</TienChuaThue>\n`;
    xml += `      <ThueGTGT>${formatXMLAmount(tx.vatAmount)}</ThueGTGT>\n`;
    xml += `      <TongTien>${formatXMLAmount(tx.total)}</TongTien>\n`;
    xml += "    </GiaoDich>\n";
  });
  xml += "  </ChiTiet>\n";

  xml += `  <NgayLap>${formatDate(new Date())}</NgayLap>\n`;
  xml += `  <NguoiLap>${escapeXML(
    organization.accountantName || "Kế toán"
  )}</NguoiLap>\n`;

  xml += "</BaoCaoDoanhThu>\n";

  return xml;
}

// =====================================================
// FILE DOWNLOAD
// =====================================================

/**
 * Download XML file
 */
export function downloadXMLFile(xmlContent: string, fileName: string) {
  const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  
  // Use setTimeout to ensure the download starts before cleanup
  link.click();
  
  // Delay cleanup to ensure download completes
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Export VAT report to XML (Main function)
 */
export function exportVATReportXML(
  sales: Sale[],
  workOrders: WorkOrder[],
  cashTransactions: CashTransaction[],
  organization: OrganizationTaxInfo,
  startDate: Date,
  endDate: Date
) {
  // Prepare data
  const vatData = prepareVATReportData(
    sales,
    workOrders,
    cashTransactions,
    organization,
    startDate,
    endDate
  );

  // Generate XML
  const xml = generateVAT01XML(vatData);

  // Create filename
  const period = formatPeriod(vatData.period);
  const fileName = `ToKhai_VAT_${period.replace(/\//g, "_")}_${
    organization.taxCode
  }.xml`;

  // Download
  downloadXMLFile(xml, fileName);

  return {
    fileName,
    period: vatData.period,
    vatPayable: vatData.vatPayable,
  };
}

/**
 * Export revenue report to XML
 */
export function exportRevenueXML(
  sales: Sale[],
  workOrders: WorkOrder[],
  organization: OrganizationTaxInfo,
  startDate: Date,
  endDate: Date
) {
  const xml = generateRevenueReportXML(
    sales,
    workOrders,
    organization,
    startDate,
    endDate
  );

  const period = getPeriodFromDateRange(startDate, endDate);
  const fileName = `BaoCaoDoanhThu_${formatPeriod(period).replace(
    /\//g,
    "_"
  )}_${organization.taxCode}.xml`;

  downloadXMLFile(xml, fileName);

  return { fileName, period };
}
