import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrency } from "./format";
import { Part, Sale, InventoryTransaction } from "../types";

// Add font support for Vietnamese (using default fonts)
const addHeader = (doc: jsPDF, title: string, subtitle?: string) => {
  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 20);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, 14, 28);
  }

  // Date
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(
    `Xuất lúc: ${new Date().toLocaleString("vi-VN")}`,
    14,
    subtitle ? 35 : 28
  );
  doc.setTextColor(0);

  return subtitle ? 42 : 35;
};

const addFooter = (doc: jsPDF) => {
  const pageCount = (doc as any).internal.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Trang ${i}/${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
  }
};

export const exportInventoryReport = (
  parts: Part[],
  currentBranchId: string
) => {
  const doc = new jsPDF();
  const startY = addHeader(
    doc,
    "BÁO CÁO TỒN KHO",
    `Tổng sản phẩm: ${parts.length}`
  );

  // Summary stats
  const totalValue = parts.reduce((sum, part) => {
    const stock = part.stock[currentBranchId] || 0;
    const price = part.retailPrice[currentBranchId] || 0;
    return sum + stock * price;
  }, 0);

  const totalStock = parts.reduce(
    (sum, part) => sum + (part.stock[currentBranchId] || 0),
    0
  );

  const lowStock = parts.filter(
    (p) =>
      (p.stock[currentBranchId] || 0) > 0 &&
      (p.stock[currentBranchId] || 0) <= 10
  ).length;

  const outOfStock = parts.filter(
    (p) => (p.stock[currentBranchId] || 0) === 0
  ).length;

  // Summary table
  autoTable(doc, {
    startY,
    head: [["Chỉ tiêu", "Giá trị"]],
    body: [
      ["Tổng giá trị tồn kho", formatCurrency(totalValue)],
      ["Tổng sản phẩm", parts.length.toString()],
      ["Tổng số lượng tồn", totalStock.toString()],
      ["Sắp hết hàng", lowStock.toString()],
      ["Hết hàng", outOfStock.toString()],
    ],
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246] },
  });

  // Products table
  const tableData = parts.map((part) => {
    const stock = part.stock[currentBranchId] || 0;
    const price = part.retailPrice[currentBranchId] || 0;
    const value = stock * price;

    return [
      part.sku || "N/A",
      part.name,
      part.category || "Chưa phân loại",
      stock.toString(),
      formatCurrency(price),
      formatCurrency(value),
    ];
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["Mã", "Tên", "Danh mục", "Tồn", "Giá bán", "Giá trị"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8 },
    columnStyles: {
      1: { cellWidth: 50 },
      3: { halign: "center" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });

  addFooter(doc);
  doc.save(`BaoCao_TonKho_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportSalesReport = (
  sales: Sale[],
  parts: Part[],
  dateRange: { start?: Date; end?: Date } = {}
) => {
  const doc = new jsPDF();

  let filteredSales = sales;
  if (dateRange.start || dateRange.end) {
    filteredSales = sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      if (dateRange.start && saleDate < dateRange.start) return false;
      if (dateRange.end && saleDate > dateRange.end) return false;
      return true;
    });
  }

  const subtitle = dateRange.start
    ? `Kỳ: ${dateRange.start.toLocaleDateString("vi-VN")} - ${
        dateRange.end?.toLocaleDateString("vi-VN") || "Hiện tại"
      }`
    : `Tổng đơn: ${filteredSales.length}`;

  const startY = addHeader(doc, "BÁO CÁO BÁN HÀNG", subtitle);

  // Summary stats
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalOrders = filteredSales.length;
  const totalItems = filteredSales.reduce(
    (sum, s) => sum + s.items.reduce((s2, item) => s2 + item.quantity, 0),
    0
  );
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Summary table
  autoTable(doc, {
    startY,
    head: [["Chỉ tiêu", "Giá trị"]],
    body: [
      ["Tổng doanh thu", formatCurrency(totalRevenue)],
      ["Tổng đơn", totalOrders.toString()],
      ["Tổng số lượng bán", totalItems.toString()],
      ["Giá trị đơn trung bình", formatCurrency(avgOrderValue)],
    ],
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129] },
  });

  // Top products
  const productSales = new Map<
    string,
    { quantity: number; revenue: number; name: string }
  >();

  filteredSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const existing = productSales.get(item.partId);
      const part = parts.find((p) => p.id === item.partId);
      const name = part?.name || "Sản phẩm không xác định";

      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.sellingPrice * item.quantity;
      } else {
        productSales.set(item.partId, {
          quantity: item.quantity,
          revenue: item.sellingPrice * item.quantity,
          name,
        });
      }
    });
  });

  const topProducts = Array.from(productSales.entries())
    .map(([id, data]) => ({
      name: data.name,
      quantity: data.quantity,
      revenue: data.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["Sản phẩm", "Số lượng", "Doanh thu"]],
    body: topProducts.map((p) => [
      p.name,
      p.quantity.toString(),
      formatCurrency(p.revenue),
    ]),
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: "center" },
      2: { halign: "right" },
    },
  });

  addFooter(doc);
  doc.save(`BaoCao_BanHang_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportFinancialReport = (
  sales: Sale[],
  transactions: InventoryTransaction[],
  parts: Part[],
  currentBranchId: string,
  customerDebts: any[],
  supplierDebts: any[],
  dateRange: { start?: Date; end?: Date } = {}
) => {
  const doc = new jsPDF();

  // Filter by date range
  let filteredSales = sales;
  let filteredTransactions = transactions;

  if (dateRange.start || dateRange.end) {
    filteredSales = sales.filter((sale) => {
      const date = new Date(sale.date);
      if (dateRange.start && date < dateRange.start) return false;
      if (dateRange.end && date > dateRange.end) return false;
      return true;
    });

    filteredTransactions = transactions.filter((tx) => {
      const date = new Date(tx.date);
      if (dateRange.start && date < dateRange.start) return false;
      if (dateRange.end && date > dateRange.end) return false;
      return true;
    });
  }

  const subtitle = dateRange.start
    ? `Kỳ: ${dateRange.start.toLocaleDateString("vi-VN")} - ${
        dateRange.end?.toLocaleDateString("vi-VN") || "Hiện tại"
      }`
    : "Toàn thời gian";

  const startY = addHeader(doc, "BÁO CÁO TÀI CHÍNH", subtitle);

  // Calculate financials
  const income = filteredSales.reduce((sum, s) => sum + s.total, 0);

  const expenses = filteredTransactions
    .filter((tx) => tx.type === "Nhập kho")
    .reduce((sum, tx) => {
      const part = parts.find((p) => p.id === tx.partId);
      const cost = part?.wholesalePrice?.[currentBranchId] || 0;
      return sum + cost * tx.quantity;
    }, 0);

  const profit = income - expenses;
  const profitMargin = income > 0 ? (profit / income) * 100 : 0;

  const inventoryValue = parts.reduce((sum, part) => {
    const stock = part.stock[currentBranchId] || 0;
    const price = part.retailPrice[currentBranchId] || 0;
    return sum + stock * price;
  }, 0);

  const totalCustomerDebts = customerDebts.reduce(
    (sum, d) => sum + d.amount,
    0
  );
  const totalSupplierDebts = supplierDebts.reduce(
    (sum, d) => sum + d.amount,
    0
  );

  // Financial summary
  autoTable(doc, {
    startY,
    head: [["Chỉ tiêu", "Số tiền"]],
    body: [
      ["Tổng thu", formatCurrency(income)],
      ["Tổng chi", formatCurrency(expenses)],
      ["Lợi nhuận ròng", formatCurrency(profit)],
      ["Biên lợi nhuận", `${profitMargin.toFixed(2)}%`],
      ["Giá trị tồn kho", formatCurrency(inventoryValue)],
      ["Công nợ khách hàng", formatCurrency(totalCustomerDebts)],
      ["Công nợ nhà cung cấp", formatCurrency(totalSupplierDebts)],
      [
        "Vị thế ròng",
        formatCurrency(
          profit + inventoryValue + totalCustomerDebts - totalSupplierDebts
        ),
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [139, 92, 246] },
    didParseCell: (data) => {
      // Highlight profit row
      if (data.row.index === 2) {
        data.cell.styles.fillColor =
          profit >= 0 ? [220, 252, 231] : [254, 226, 226];
        data.cell.styles.textColor =
          profit >= 0 ? [22, 101, 52] : [127, 29, 29];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Notes
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Ghi chú:", 14, finalY);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const notes = [
    "• Thu: bao gồm toàn bộ doanh thu bán hàng",
    "• Chi: bao gồm chi phí nhập kho (tính theo giá vốn)",
    "• Biên lợi nhuận = (Lợi nhuận ròng / Tổng thu) × 100%",
    "• Vị thế ròng = Lợi nhuận + Tồn kho + Công nợ KH - Công nợ NCC",
  ];

  notes.forEach((note, index) => {
    doc.text(note, 14, finalY + 7 + index * 5);
  });

  addFooter(doc);
  doc.save(`BaoCao_TaiChinh_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportLowStockReport = (
  parts: Part[],
  currentBranchId: string
) => {
  const doc = new jsPDF();

  const lowStockItems = parts.filter((p) => {
    const stock = p.stock[currentBranchId] || 0;
    return stock > 0 && stock <= 10;
  });

  const outOfStockItems = parts.filter(
    (p) => (p.stock[currentBranchId] || 0) === 0
  );

  const startY = addHeader(
    doc,
    "CẢNH BÁO TỒN KHO",
    `Sắp hết hàng: ${lowStockItems.length} | Hết hàng: ${outOfStockItems.length}`
  );

  // Low stock table
  if (lowStockItems.length > 0) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Sản phẩm sắp hết (≤ 10)", 14, startY);

    const lowStockData = lowStockItems
      .sort(
        (a, b) =>
          (a.stock[currentBranchId] || 0) - (b.stock[currentBranchId] || 0)
      )
      .map((part) => {
        const stock = part.stock[currentBranchId] || 0;
        const status = stock <= 3 ? "Nguy cấp" : stock <= 5 ? "Cảnh báo" : "Thấp";

        return [
          part.sku || "N/A",
          part.name,
          part.category || "Chưa phân loại",
          stock.toString(),
          status,
        ];
      });

    autoTable(doc, {
      startY: startY + 5,
      head: [["Mã", "Tên", "Danh mục", "Tồn", "Trạng thái"]],
      body: lowStockData,
      theme: "striped",
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { cellWidth: 60 },
        3: { halign: "center" },
        4: { halign: "center" },
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.row.section === "body") {
          const status = data.cell.raw;
          if (status === "Nguy cấp") {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [127, 29, 29];
          } else if (status === "Cảnh báo") {
            data.cell.styles.fillColor = [254, 243, 199];
            data.cell.styles.textColor = [146, 64, 14];
          }
        }
      },
    });
  }

  // Out of stock table
  if (outOfStockItems.length > 0) {
    const currentY =
      lowStockItems.length > 0
        ? (doc as any).lastAutoTable.finalY + 15
        : startY;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Sản phẩm hết hàng", 14, currentY);

    const outOfStockData = outOfStockItems.map((part) => [
      part.sku || "N/A",
      part.name,
      part.category || "Chưa phân loại",
    ]);

    autoTable(doc, {
      startY: currentY + 5,
      head: [["Mã", "Tên", "Danh mục"]],
      body: outOfStockData,
      theme: "striped",
      headStyles: { fillColor: [239, 68, 68] },
      styles: { fontSize: 8 },
      columnStyles: {
        1: { cellWidth: 80 },
      },
    });
  }

  if (lowStockItems.length === 0 && outOfStockItems.length === 0) {
    doc.setFontSize(12);
    doc.text("Tất cả sản phẩm đều còn hàng!", 14, startY);
  }

  addFooter(doc);
  doc.save(`CanhBao_TonKho_${new Date().toISOString().slice(0, 10)}.pdf`);
};
