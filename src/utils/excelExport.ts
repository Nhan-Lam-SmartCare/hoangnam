import * as XLSX from "xlsx";
import {
  Sale,
  CashTransaction,
  Part,
  PayrollRecord,
  Customer,
  Supplier,
  WorkOrder,
} from "../types";
import { formatCurrency, formatDate, formatAnyId, formatWorkOrderId } from "./format";
import {
  formatCashTxCategory,
  getCashTxCategoryKey,
} from "../lib/finance/cashTxCategories";

// ==================== REVENUE REPORT ====================
export const exportRevenueReport = (
  sales: Sale[],
  startDate: string,
  endDate: string
) => {
  // Tạo workbook
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = sales.reduce((sum, s) => {
    return (
      sum +
      s.items.reduce(
        (c, it) => c + ((it as any).costPrice || 0) * it.quantity,
        0
      )
    );
  }, 0);
  const profit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  const summaryData = [
    ["BÁO CÁO DOANH THU"],
    [`Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng doanh thu", formatCurrency(totalRevenue)],
    ["Tổng chi phí", formatCurrency(totalCost)],
    ["Lợi nhuận", formatCurrency(profit)],
    ["Biên lợi nhuận", `${margin.toFixed(2)}%`],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Detailed Sales Sheet
  const salesData: (string | number)[][] = [
    [
      "Mã đơn",
      "Ngày",
      "Khách hàng",
      "SĐT",
      "Sản phẩm",
      "Số lượng",
      "Đơn giá",
      "Thành tiền",
      "Giảm giá",
      "Tổng",
      "Phương thức",
    ],
  ];

  sales.forEach((sale) => {
    sale.items.forEach((item, idx) => {
      salesData.push([
        idx === 0 ? formatAnyId(sale.id) : "",
        idx === 0 ? formatDate(sale.date) : "",
        idx === 0 ? sale.customer.name : "",
        idx === 0 ? sale.customer.phone || "" : "",
        item.partName,
        item.quantity,
        item.sellingPrice,
        item.sellingPrice * item.quantity,
        idx === 0 ? sale.discount : "",
        idx === 0 ? sale.total : "",
        idx === 0
          ? sale.paymentMethod === "cash"
            ? "Tiền mặt"
            : "Ngân hàng"
          : "",
      ]);
    });
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(salesData);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Chi tiết bán hàng");

  // Export file
  const fileName = `BaoCaoDoanhThu_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== CASHFLOW REPORT ====================
export const exportCashflowReport = (
  transactions: CashTransaction[],
  startDate: string,
  endDate: string
) => {
  const wb = XLSX.utils.book_new();

  // 1. Summary
  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const net = income - expense;

  const summaryData = [
    ["BÁO CÁO THU CHI"],
    [`Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng thu", formatCurrency(income)],
    ["Tổng chi", formatCurrency(expense)],
    ["Thu chi ròng", formatCurrency(net)],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Detailed transactions
  const transData: (string | number)[][] = [
    [
      "Ngày",
      "Loại",
      "Danh mục (nhãn)",
      "Mã danh mục",
      "Số tiền",
      "Đối tượng",
      "Nguồn thanh toán",
      "Ghi chú",
    ],
  ];

  transactions.forEach((t) => {
    transData.push([
      formatDate(t.date),
      t.type === "income" ? "Thu" : "Chi",
      formatCashTxCategory(t.category),
      getCashTxCategoryKey(t.category),
      t.amount,
      t.recipient || "",
      t.paymentSourceId,
      t.notes,
    ]);
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(transData);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Chi tiết giao dịch");

  // 3. Category breakdown
  const categoryMap: Record<
    string,
    { label: string; income: number; expense: number }
  > = {};

  transactions.forEach((t) => {
    const categoryKey = getCashTxCategoryKey(t.category) || "";
    const categoryLabel = formatCashTxCategory(t.category) || "";
    const groupKey = categoryKey || categoryLabel || "other";

    if (!categoryMap[groupKey]) {
      categoryMap[groupKey] = {
        label: categoryLabel || categoryKey || "",
        income: 0,
        expense: 0,
      };
    }
    if (t.type === "income") {
      categoryMap[groupKey].income += t.amount;
    } else {
      categoryMap[groupKey].expense += t.amount;
    }
  });

  const categoryData: (string | number)[][] = [
    ["Danh mục (nhãn)", "Mã danh mục", "Thu", "Chi", "Chênh lệch"],
  ];
  Object.entries(categoryMap).forEach(([key, amounts]) => {
    categoryData.push([
      amounts.label || key,
      key,
      amounts.income,
      amounts.expense,
      amounts.income - amounts.expense,
    ]);
  });

  const wsCategory = XLSX.utils.aoa_to_sheet(categoryData);
  XLSX.utils.book_append_sheet(wb, wsCategory, "Theo danh mục");

  const fileName = `BaoCaoThuChi_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== INVENTORY REPORT ====================
export const exportInventoryReport = (
  parts: Part[],
  branchId: string,
  startDate: string,
  endDate: string
) => {
  const wb = XLSX.utils.book_new();

  // 1. Summary
  const totalValue = parts.reduce(
    (sum, p) =>
      sum + (p.stock[branchId] || 0) * (p.wholesalePrice?.[branchId] || 0),
    0
  );
  const lowStockCount = parts.filter(
    (p) => (p.stock[branchId] || 0) < 10
  ).length;

  const summaryData = [
    ["BÁO CÁO TỒN KHO"],
    [`Ngày: ${formatDate(endDate)}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng giá trị tồn kho", formatCurrency(totalValue)],
    ["Số loại sản phẩm", parts.length],
    ["Sản phẩm tồn kho thấp", lowStockCount],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Detailed inventory
  const inventoryData: (string | number)[][] = [
    [
      "Mã SKU",
      "Tên sản phẩm",
      "Danh mục",
      "Tồn kho",
      "Giá nhập",
      "Giá bán",
      "Giá trị tồn",
      "Trạng thái",
    ],
  ];

  parts.forEach((p) => {
    const stock = p.stock[branchId] || 0;
    const costPrice = p.wholesalePrice?.[branchId] || 0;
    const sellPrice = p.retailPrice[branchId] || 0;
    const value = stock * costPrice;
    const status = stock < 10 ? "Thấp" : stock < 50 ? "Trung bình" : "Đủ";

    inventoryData.push([
      p.sku,
      p.name,
      p.category || "",
      stock,
      costPrice,
      sellPrice,
      value,
      status,
    ]);
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(inventoryData);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Chi tiết tồn kho");

  // 3. Low stock warnings
  const lowStock = parts.filter((p) => (p.stock[branchId] || 0) < 10);
  if (lowStock.length > 0) {
    const warningData: (string | number)[][] = [
      ["Mã SKU", "Tên sản phẩm", "Tồn kho", "Ghi chú"],
    ];

    lowStock.forEach((p) => {
      warningData.push([
        p.sku,
        p.name,
        p.stock[branchId] || 0,
        "Cần nhập thêm hàng",
      ]);
    });

    const wsWarning = XLSX.utils.aoa_to_sheet(warningData);
    XLSX.utils.book_append_sheet(wb, wsWarning, "Cảnh báo tồn kho");
  }

  const fileName = `BaoCaoTonKho_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== PAYROLL REPORT ====================
export const exportPayrollReport = (
  payrollRecords: PayrollRecord[],
  startMonth: string,
  endMonth: string
) => {
  const wb = XLSX.utils.book_new();

  // 1. Summary
  const totalBase = payrollRecords.reduce((sum, p) => sum + p.baseSalary, 0);
  const totalNet = payrollRecords.reduce((sum, p) => sum + p.netSalary, 0);
  const paid = payrollRecords.filter((p) => p.paymentStatus === "paid").length;
  const pending = payrollRecords.filter(
    (p) => p.paymentStatus === "pending"
  ).length;

  const summaryData = [
    ["BÁO CÁO LƯƠNG"],
    [`Từ ${startMonth} đến ${endMonth}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng lương cơ bản", formatCurrency(totalBase)],
    ["Tổng lương thực nhận", formatCurrency(totalNet)],
    ["Số bảng lương đã trả", paid],
    ["Số bảng lương chưa trả", pending],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Detailed payroll
  const payrollData: (string | number)[][] = [
    [
      "Nhân viên",
      "Tháng",
      "Lương cơ bản",
      "Phụ cấp",
      "Thưởng",
      "Khấu trừ",
      "BHXH",
      "BHYT",
      "BHTN",
      "Thuế TNCN",
      "Thực nhận",
      "Trạng thái",
      "Ngày trả",
    ],
  ];

  payrollRecords.forEach((p) => {
    payrollData.push([
      p.employeeName,
      p.month,
      p.baseSalary,
      p.allowances,
      p.bonus,
      p.deduction,
      p.socialInsurance,
      p.healthInsurance,
      p.unemploymentInsurance,
      p.personalIncomeTax,
      p.netSalary,
      p.paymentStatus === "paid" ? "Đã trả" : "Chưa trả",
      p.paymentDate ? formatDate(p.paymentDate) : "",
    ]);
  });

  const wsDetails = XLSX.utils.aoa_to_sheet(payrollData);
  XLSX.utils.book_append_sheet(wb, wsDetails, "Chi tiết lương");

  // 3. By employee summary
  const employeeMap: Record<
    string,
    { totalBase: number; totalNet: number; months: number }
  > = {};

  payrollRecords.forEach((p) => {
    if (!employeeMap[p.employeeName]) {
      employeeMap[p.employeeName] = { totalBase: 0, totalNet: 0, months: 0 };
    }
    employeeMap[p.employeeName].totalBase += p.baseSalary;
    employeeMap[p.employeeName].totalNet += p.netSalary;
    employeeMap[p.employeeName].months += 1;
  });

  const employeeData: (string | number)[][] = [
    [
      "Nhân viên",
      "Số tháng",
      "Tổng lương cơ bản",
      "Tổng thực nhận",
      "TB/tháng",
    ],
  ];

  Object.entries(employeeMap).forEach(([name, data]) => {
    employeeData.push([
      name,
      data.months,
      data.totalBase,
      data.totalNet,
      Math.round(data.totalNet / data.months),
    ]);
  });

  const wsEmployee = XLSX.utils.aoa_to_sheet(employeeData);
  XLSX.utils.book_append_sheet(wb, wsEmployee, "Theo nhân viên");

  const fileName = `BaoCaoLuong_${startMonth}_${endMonth}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== DEBT REPORT ====================
export const exportDebtReport = (
  customers: Customer[],
  suppliers: Supplier[],
  sales: Sale[],
  startDate: string,
  endDate: string
) => {
  const wb = XLSX.utils.book_new();

  // For now, create simple customer/supplier lists
  // In real app, you'd track actual debt amounts

  // 1. Summary
  const summaryData = [
    ["BÁO CÁO CÔNG NỢ"],
    [`Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`],
    [],
    ["Loại", "Số lượng"],
    ["Khách hàng", customers.length],
    ["Nhà cung cấp", suppliers.length],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. Customers
  const customerData = [
    ["Tên khách hàng", "SĐT", "Xe", "Biển số", "Phân khúc"],
  ];

  customers.forEach((c) => {
    customerData.push([
      c.name,
      c.phone || "",
      c.vehicleModel || "",
      c.licensePlate || "",
      c.segment || "",
    ]);
  });

  const wsCustomers = XLSX.utils.aoa_to_sheet(customerData);
  XLSX.utils.book_append_sheet(wb, wsCustomers, "Khách hàng");

  // 3. Suppliers
  const supplierData = [["Tên nhà cung cấp", "SĐT", "Email", "Địa chỉ"]];

  suppliers.forEach((s) => {
    supplierData.push([s.name, s.phone || "", s.email || "", s.address || ""]);
  });

  const wsSuppliers = XLSX.utils.aoa_to_sheet(supplierData);
  XLSX.utils.book_append_sheet(wb, wsSuppliers, "Nhà cung cấp");

  const fileName = `BaoCaoCongNo_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== TOP SELLING PRODUCTS REPORT ====================
export const exportTopProductsReport = (
  sales: Sale[],
  startDate: string,
  endDate: string,
  limit: number = 20
) => {
  const wb = XLSX.utils.book_new();

  // Tính toán top sản phẩm
  const productStats = new Map<
    string,
    {
      name: string;
      sku: string;
      quantity: number;
      revenue: number;
      orders: number;
    }
  >();

  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const existing = productStats.get(item.partId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.sellingPrice * item.quantity;
        existing.orders += 1;
      } else {
        productStats.set(item.partId, {
          name: item.partName,
          sku: item.sku || "",
          quantity: item.quantity,
          revenue: item.sellingPrice * item.quantity,
          orders: 1,
        });
      }
    });
  });

  // Sort by quantity (best sellers)
  const topProducts = Array.from(productStats.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);

  // Create Excel data
  const summaryData = [
    ["TOP SẢN PHẨM BÁN CHẠY"],
    [`Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`],
    [],
    [
      "STT",
      "Tên sản phẩm",
      "SKU",
      "Số lượng bán",
      "Doanh thu",
      "Số đơn",
      "Trung bình/đơn",
    ],
  ];

  topProducts.forEach((product, index) => {
    summaryData.push([
      String(index + 1),
      product.name,
      product.sku,
      String(product.quantity),
      formatCurrency(product.revenue),
      String(product.orders),
      formatCurrency(product.revenue / product.orders),
    ]);
  });

  // Add totals
  const totalQuantity = topProducts.reduce((sum, p) => sum + p.quantity, 0);
  const totalRevenue = topProducts.reduce((sum, p) => sum + p.revenue, 0);
  const totalOrders = topProducts.reduce((sum, p) => sum + p.orders, 0);

  summaryData.push([]);
  summaryData.push([
    "TỔNG",
    "",
    "",
    String(totalQuantity),
    formatCurrency(totalRevenue),
    String(totalOrders),
    formatCurrency(totalRevenue / totalOrders),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws, "Top sản phẩm");

  const fileName = `TopSanPhamBanChay_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== PRODUCT PROFIT REPORT ====================
export const exportProductProfitReport = (
  sales: Sale[],
  startDate: string,
  endDate: string
) => {
  const wb = XLSX.utils.book_new();

  // Tính toán lợi nhuận theo sản phẩm
  const productProfit = new Map<
    string,
    {
      name: string;
      sku: string;
      quantity: number;
      revenue: number;
      cost: number;
      profit: number;
      margin: number;
    }
  >();

  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      const cost = ((item as any).costPrice || 0) * item.quantity;
      const revenue = item.sellingPrice * item.quantity;
      const profit = revenue - cost;

      const existing = productProfit.get(item.partId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += revenue;
        existing.cost += cost;
        existing.profit += profit;
        existing.margin =
          existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : 0;
      } else {
        productProfit.set(item.partId, {
          name: item.partName,
          sku: item.sku || "",
          quantity: item.quantity,
          revenue,
          cost,
          profit,
          margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        });
      }
    });
  });

  // Sort by profit (highest first)
  const profitData = Array.from(productProfit.values()).sort(
    (a, b) => b.profit - a.profit
  );

  // Create Excel data
  const summaryData = [
    ["BÁO CÁO LỢI NHUẬN THEO SẢN PHẨM"],
    [`Từ ${formatDate(startDate)} đến ${formatDate(endDate)}`],
    [],
    [
      "STT",
      "Tên sản phẩm",
      "SKU",
      "SL",
      "Doanh thu",
      "Giá vốn",
      "Lợi nhuận",
      "Biên LN (%)",
    ],
  ];

  profitData.forEach((product, index) => {
    summaryData.push([
      String(index + 1),
      product.name,
      product.sku,
      String(product.quantity),
      formatCurrency(product.revenue),
      formatCurrency(product.cost),
      formatCurrency(product.profit),
      product.margin.toFixed(2) + "%",
    ]);
  });

  // Add totals
  const totalQuantity = profitData.reduce((sum, p) => sum + p.quantity, 0);
  const totalRevenue = profitData.reduce((sum, p) => sum + p.revenue, 0);
  const totalCost = profitData.reduce((sum, p) => sum + p.cost, 0);
  const totalProfit = profitData.reduce((sum, p) => sum + p.profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  summaryData.push([]);
  summaryData.push([
    "TỔNG",
    "",
    "",
    String(totalQuantity),
    formatCurrency(totalRevenue),
    formatCurrency(totalCost),
    formatCurrency(totalProfit),
    avgMargin.toFixed(2) + "%",
  ]);

  const ws = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws, "Lợi nhuận sản phẩm");

  const fileName = `LoiNhuanTheoSanPham_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== DETAILED INVENTORY REPORT ====================
export const exportDetailedInventoryReport = (
  parts: Part[],
  branchId: string,
  startDate: string,
  endDate: string
) => {
  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const totalParts = parts.length;
  const totalStock = parts.reduce(
    (sum, p) => sum + (p.stock?.[branchId] || 0),
    0
  );
  const totalValue = parts.reduce((sum, p) => {
    const stock = p.stock?.[branchId] || 0;
    const price =
      typeof p.costPrice === "number"
        ? p.costPrice
        : p.retailPrice?.[branchId] || 0;
    return sum + stock * price;
  }, 0);

  const lowStockParts = parts.filter((p) => {
    const stock = p.stock?.[branchId] || 0;
    return stock > 0 && stock <= 5;
  });

  const outOfStockParts = parts.filter((p) => (p.stock?.[branchId] || 0) === 0);

  const summaryData = [
    ["BÁO CÁO TỒN KHO CHI TIẾT"],
    [`Ngày: ${formatDate(new Date().toISOString())}`],
    [`Khoảng thời gian: ${formatDate(startDate)} - ${formatDate(endDate)}`],
    [`Chi nhánh: ${branchId}`],
    [],
    ["Chỉ tiêu", "Giá trị"],
    ["Tổng số mặt hàng", totalParts],
    ["Tổng số lượng tồn", totalStock],
    ["Giá trị tồn kho", formatCurrency(totalValue)],
    ["Sản phẩm tồn thấp (≤5)", lowStockParts.length],
    ["Sản phẩm hết hàng", outOfStockParts.length],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Tổng quan");

  // 2. All Products Sheet
  const allPartsData = [
    [
      "SKU",
      "Tên sản phẩm",
      "Danh mục",
      "Tồn kho",
      "Giá vốn",
      "Giá bán",
      "Giá trị tồn",
      "Trạng thái",
    ],
  ];

  parts.forEach((part) => {
    const stock = part.stock?.[branchId] || 0;
    const costPrice = typeof part.costPrice === "number" ? part.costPrice : 0;
    const retailPrice = part.retailPrice?.[branchId] || 0;
    const stockValue = stock * costPrice;
    let status = "Bình thường";
    if (stock === 0) status = "Hết hàng";
    else if (stock <= 5) status = "Tồn thấp";

    allPartsData.push([
      part.sku || "",
      part.name,
      part.category || "",
      String(stock),
      formatCurrency(costPrice),
      formatCurrency(retailPrice),
      formatCurrency(stockValue),
      status,
    ]);
  });

  const wsAll = XLSX.utils.aoa_to_sheet(allPartsData);
  XLSX.utils.book_append_sheet(wb, wsAll, "Tất cả sản phẩm");

  // 3. Low Stock Sheet
  if (lowStockParts.length > 0) {
    const lowStockData = [["SKU", "Tên sản phẩm", "Tồn kho", "Cần nhập"]];

    lowStockParts.forEach((part) => {
      const stock = part.stock?.[branchId] || 0;
      const needToOrder = Math.max(10 - stock, 0); // Đề xuất nhập về 10

      lowStockData.push([
        part.sku || "",
        part.name,
        String(stock),
        String(needToOrder),
      ]);
    });

    const wsLowStock = XLSX.utils.aoa_to_sheet(lowStockData);
    XLSX.utils.book_append_sheet(wb, wsLowStock, "Tồn thấp");
  }

  // 4. Out of Stock Sheet
  if (outOfStockParts.length > 0) {
    const outOfStockData = [["SKU", "Tên sản phẩm", "Giá bán", "Đề xuất"]];

    outOfStockParts.forEach((part) => {
      const retailPrice = part.retailPrice?.[branchId] || 0;

      outOfStockData.push([
        part.sku || "",
        part.name,
        formatCurrency(retailPrice),
        "Cần nhập ngay",
      ]);
    });

    const wsOutOfStock = XLSX.utils.aoa_to_sheet(outOfStockData);
    XLSX.utils.book_append_sheet(wb, wsOutOfStock, "Hết hàng");
  }

  const fileName = `TonKhoChiTiet_${branchId}_${startDate}_${endDate}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

// ==================== SỔ DOANH THU MẪU S1a-HKD ====================
/**
 * Xuất Sổ chi tiết doanh thu bán hàng hóa, dịch vụ - Mẫu S1a-HKD
 * (Theo Thông tư 152/2025/TT-BTC)
 * Dành cho hộ kinh doanh dưới 500 triệu/năm - không thuộc diện chịu thuế GTGT
 */
export interface BusinessInfo {
  businessName: string;      // Họ, cá nhân kinh doanh
  taxCode: string;           // Mã số thuế
  address: string;           // Địa chỉ
  businessLocation?: string; // Địa điểm kinh doanh
}

export const exportS1aHKD = (
  sales: Sale[],
  workOrders: any[],
  businessInfo: BusinessInfo,
  startDate: Date,
  endDate: Date
) => {
  const wb = XLSX.utils.book_new();

  // Format period
  const startMonth = startDate.getMonth() + 1;
  const endMonth = endDate.getMonth() + 1;
  const year = startDate.getFullYear();
  const periodText = startMonth === endMonth 
    ? `Tháng ${startMonth}/${year}` 
    : `Từ tháng ${startMonth} đến tháng ${endMonth}/${year}`;

  // Collect all transactions
  interface RevenueEntry {
    date: Date;
    description: string;
    amount: number;
    type: "ban-hang" | "ban-phu-tung" | "sua-chua"; // Phân loại để kê khai thuế
  }

  const entries: RevenueEntry[] = [];

  // From sales (bán hàng - bán lẻ phụ tùng)
  // Lưu ý: sales đã được lọc từ financialSummary
  sales.forEach((sale) => {
    const saleDate = new Date(sale.date);
    const itemNames = sale.items.map(i => i.partName).join(", ");
    entries.push({
      date: saleDate,
      description: `Bán phụ tùng - ${sale.customer?.name || "Khách lẻ"}: ${itemNames.slice(0, 80)}${itemNames.length > 80 ? '...' : ''}`,
      amount: sale.total,
      type: "ban-hang",
    });
  });

  // From work orders - TÁCH RIÊNG phụ tùng và tiền công
  // Lưu ý: workOrders đã được lọc từ financialSummary (chỉ paid và trong date range)
  workOrders.forEach((wo: any) => {
    const woDate = new Date(wo.paymentDate || wo.paymentdate || wo.creationDate || wo.creationdate || wo.date);
    
    // Tính tiền phụ tùng từ partsUsed (không có field totalPrice trong WorkOrder!)
    const partsUsed = wo.partsUsed || wo.partsused || [];
    const partsTotal = partsUsed.reduce((sum: number, p: any) => {
      const price = parseFloat(p.price || p.sellingPrice || p.sellingprice || 0);
      const qty = parseFloat(p.quantity || 1);
      return sum + (price * qty);
    }, 0);
    
    // Tính tiền dịch vụ gia công từ additionalServices
    const additionalServices = wo.additionalServices || wo.additionalservices || [];
    const servicesTotal = additionalServices.reduce((sum: number, s: any) => {
      const price = parseFloat(s.price || 0);
      const qty = parseFloat(s.quantity || 1);
      return sum + (price * qty);
    }, 0);
    
    const laborCost = parseFloat(wo.laborCost || wo.laborcost || 0);
    const discount = parseFloat(wo.discount || 0);
    
    // Tổng tiền = phụ tùng + tiền công + dịch vụ gia công - chiết khấu
    const theoreticalTotal = partsTotal + laborCost + servicesTotal - discount;
    
    // Sử dụng totalPaid (số tiền thực thu) 
    const totalPaid = parseFloat(wo.totalPaid || wo.totalpaid || wo.total || theoreticalTotal);
    
    // Tính tỷ lệ phân bổ dựa trên totalPaid
    const ratio = theoreticalTotal > 0 ? totalPaid / theoreticalTotal : 1;
    
    // Phân bổ theo tỷ lệ
    const actualPartsRevenue = Math.round(partsTotal * ratio);
    const actualServicesRevenue = Math.round(servicesTotal * ratio);
    const actualLaborRevenue = totalPaid - actualPartsRevenue - actualServicesRevenue;
    
    const vehicleInfo = wo.vehicleInfo?.licensePlate || wo.vehicleinfo?.licenseplate || wo.licensePlate || wo.licenseplate || "";
    const customerName = wo.customerName || wo.customername || "Khách hàng";
    
    // 1. Tiền phụ tùng -> Bán phụ tùng (thuế suất thấp)
    if (actualPartsRevenue > 0) {
      const partNames = partsUsed.map((p: any) => p.partName || p.partname || "").filter(Boolean).join(", ");
      entries.push({
        date: woDate,
        description: `Bán phụ tùng${vehicleInfo ? ` (${vehicleInfo})` : ""} - ${customerName}${partNames ? `: ${partNames.slice(0, 60)}${partNames.length > 60 ? '...' : ''}` : ''}`,
        amount: actualPartsRevenue,
        type: "ban-phu-tung",
      });
    }
    
    // 2. Tiền dịch vụ gia công (outsourcing) - cũng là dịch vụ
    if (actualServicesRevenue > 0) {
      entries.push({
        date: woDate,
        description: `Dịch vụ gia công${vehicleInfo ? ` (${vehicleInfo})` : ""} - ${customerName}`,
        amount: actualServicesRevenue,
        type: "sua-chua",
      });
    }
    
    // 3. Tiền công -> Sửa chữa/Dịch vụ (thuế suất cao hơn)
    if (actualLaborRevenue > 0) {
      entries.push({
        date: woDate,
        description: `Dịch vụ sửa chữa${vehicleInfo ? ` (${vehicleInfo})` : ""} - ${customerName}`,
        amount: actualLaborRevenue,
        type: "sua-chua",
      });
    }
  });

  // Sort by date
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate totals by type
  const totalGoods = entries
    .filter(e => e.type === "ban-hang" || e.type === "ban-phu-tung")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalServices = entries
    .filter(e => e.type === "sua-chua")
    .reduce((sum, e) => sum + e.amount, 0);
  const totalRevenue = totalGoods + totalServices;

  // Build sheet data according to Mẫu S1a-HKD format
  // TÁCH RIÊNG cột Bán hàng hóa và Dịch vụ để kê khai thuế đúng
  const sheetData: (string | number)[][] = [
    // Header section
    [`HỘ, CÁ NHÂN KINH DOANH: ${businessInfo.businessName}`, "", "", "", "Mẫu số S1a-HKD"],
    [`Mã số thuế: ${businessInfo.taxCode}`, "", "", "", "(Kèm theo Thông tư số"],
    [`Địa chỉ: ${businessInfo.address}`, "", "", "", "152/2025/TT-BTC ngày 31 tháng 12"],
    ["", "", "", "", "năm 2025 của Bộ trưởng Bộ Tài chính)"],
    [],
    ["SỔ CHI TIẾT DOANH THU BÁN HÀNG HÓA, DỊCH VỤ", "", "", "", ""],
    [`Địa điểm kinh doanh: ${businessInfo.businessLocation || businessInfo.address}`, "", "", "", ""],
    [`Kỳ kê khai: ${periodText}`, "", "", "", ""],
    [],
    // Table header - TÁCH 2 CỘT cho thuế
    ["Ngày tháng", "Nội dung giao dịch", "Bán hàng hóa", "Dịch vụ", "Tổng cộng"],
    ["A", "B", "1", "2", "3 = 1 + 2"],
  ];

  // Add entries with separated columns
  entries.forEach((entry) => {
    const isGoods = entry.type === "ban-hang" || entry.type === "ban-phu-tung";
    sheetData.push([
      formatDate(entry.date.toISOString()),
      entry.description,
      isGoods ? entry.amount : "",      // Cột Bán hàng hóa
      !isGoods ? entry.amount : "",     // Cột Dịch vụ
      entry.amount,                      // Tổng
    ]);
  });

  // Add empty rows for manual entries (total 5 empty rows)
  for (let i = 0; i < Math.max(0, 5 - entries.length); i++) {
    sheetData.push(["", "", "", "", ""]);
  }

  // Total row
  sheetData.push(["", "TỔNG CỘNG", totalGoods, totalServices, totalRevenue]);
  sheetData.push([]);
  
  // Summary for tax declaration
  sheetData.push(["", "TÓM TẮT KÊ KHAI THUẾ:", "", "", ""]);
  sheetData.push(["", "- Doanh thu bán hàng hóa (thuế suất thấp):", totalGoods, "", ""]);
  sheetData.push(["", "- Doanh thu dịch vụ (thuế suất cao):", "", totalServices, ""]);
  sheetData.push([]);
  sheetData.push([]);

  // Signature section
  const today = new Date();
  sheetData.push(["", "", "", `Ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`, ""]);
  sheetData.push(["", "", "", "NGƯỜI ĐẠI DIỆN HỘ KINH DOANH/", ""]);
  sheetData.push(["", "", "", "CÁ NHÂN KINH DOANH", ""]);
  sheetData.push(["", "", "", "(Ký, họ tên, đóng dấu)", ""]);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  ws["!cols"] = [
    { wch: 12 },  // Ngày tháng
    { wch: 55 },  // Nội dung giao dịch
    { wch: 18 },  // Bán hàng hóa
    { wch: 18 },  // Dịch vụ
    { wch: 18 },  // Tổng cộng
  ];

  // Merge cells for header
  ws["!merges"] = [
    { s: { r: 5, c: 0 }, e: { r: 5, c: 3 } }, // Title row
    { s: { r: 6, c: 0 }, e: { r: 6, c: 3 } }, // Business location
    { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } }, // Period
  ];

  XLSX.utils.book_append_sheet(wb, ws, "S1a-HKD");

  // Create filename
  const monthStr = startMonth.toString().padStart(2, "0");
  const fileName = `SoDoanhThu_S1a-HKD_T${monthStr}_${year}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return {
    fileName,
    totalRevenue,
    totalGoods,
    totalServices,
    transactionCount: entries.length,
    period: periodText,
  };
};

// ==================== WORK ORDERS REPORT ====================
export const exportWorkOrdersReport = (
  orders: WorkOrder[],
  prefix?: string
) => {
  const wb = XLSX.utils.book_new();

  const headers = [
    "Mã Phiếu",
    "Ngày tạo",
    "Khách hàng",
    "SĐT",
    "Thiết bị/Xe",
    "Biển số/IMEI",
    "Nội dung sửa chữa",
    "Kỹ thuật viên",
    "Chi phí linh kiện",
    "Chi phí dịch vụ/công",
    "Giảm giá",
    "Tổng chi phí",
    "Đã thu",
    "Còn nợ",
    "Trạng thái",
    "Thanh toán",
  ];

  const data: (string | number)[][] = [
    ["BÁO CÁO DANH SÁCH PHIẾU SỬA CHỮA"],
    [`Ngày xuất báo cáo: ${new Date().toLocaleString("vi-VN")}`],
    [],
    headers,
  ];

  orders.forEach((order) => {
    const formattedId = formatWorkOrderId(order.id, prefix) || "";
    const creationDate = formatDate(order.creationDate, true);
    const customerName = order.customerName || "";
    const customerPhone = order.customerPhone || "";
    const vehicleModel = order.vehicleModel || "";
    const licensePlate = order.licensePlate || "";
    const issueDescription = order.issueDescription || "";
    const technicianName = order.technicianName || "";

    const partsTotal = order.partsUsed?.reduce((sum, p) => sum + (p.quantity * p.price), 0) || 0;
    const servicesTotal = order.additionalServices?.reduce((sum, s) => sum + ((s.price || 0) * (s.quantity || 1)), 0) || 0;
    const laborCost = order.laborCost || 0;
    const servicesAndLabor = servicesTotal + laborCost;

    const discount = order.discount || 0;
    const total = order.total || (partsTotal + servicesAndLabor - discount);
    const remainingAmount = order.remainingAmount || 0;
    const paidAmount = Math.max(0, total - remainingAmount);

    const status = order.status || "";
    const paymentStatus = order.paymentStatus === "paid" 
      ? "Đã thanh toán" 
      : order.paymentStatus === "partial" 
        ? "Thanh toán một phần" 
        : "Chưa thanh toán";

    data.push([
      formattedId,
      creationDate,
      customerName,
      customerPhone,
      vehicleModel,
      licensePlate,
      issueDescription,
      technicianName,
      partsTotal,
      servicesAndLabor,
      discount,
      total,
      paidAmount,
      remainingAmount,
      status,
      paymentStatus,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws["!cols"] = [
    { wch: 15 }, // Mã Phiếu
    { wch: 18 }, // Ngày tạo
    { wch: 20 }, // Khách hàng
    { wch: 15 }, // SĐT
    { wch: 18 }, // Thiết bị/Xe
    { wch: 15 }, // Biển số/IMEI
    { wch: 30 }, // Nội dung sửa chữa
    { wch: 20 }, // Kỹ thuật viên
    { wch: 15 }, // Chi phí linh kiện
    { wch: 18 }, // Chi phí dịch vụ/công
    { wch: 12 }, // Giảm giá
    { wch: 15 }, // Tổng chi phí
    { wch: 15 }, // Đã thu
    { wch: 15 }, // Còn nợ
    { wch: 12 }, // Trạng thái
    { wch: 18 }, // Thanh toán
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Phiếu Sửa Chữa");
  
  const fileName = `DanhSachPhieuSuaChua_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

