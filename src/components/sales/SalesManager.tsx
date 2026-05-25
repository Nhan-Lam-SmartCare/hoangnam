import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  User,
  ReceiptText,
  Printer,
  RefreshCcw,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency } from "../../utils/format";
import { showToast } from "../../utils/toast";
import type { CartItem, Part } from "../../types";
import { useCustomers } from "../../hooks/useSupabase";
import { usePartsRepo, usePartsRepoPaged } from "../../hooks/usePartsRepository";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePrinter } from "../../hooks/usePrinter";
import { fetchStoreSettingsForBranch } from "../service/utils/service.utils";

const getBranchStock = (part: Part, branchId: string): number => {
  const stock = Math.max(0, Number(part.stock?.[branchId] || 0));
  const reserved = Math.max(0, Number(part.reservedStock?.[branchId] || 0));
  return Math.max(0, stock - reserved);
};

const getBranchRetailPrice = (part: Part, branchId: string): number =>
  Math.max(0, Number(part.retailPrice?.[branchId] || 0));

const SalesManager: React.FC = () => {
  const {
    parts,
    customers,
    cartItems,
    setCartItems,
    setParts,
    currentBranchId,
    finalizeSale,
    deleteSale,
    sales,
  } = useAppContext();
  const { isNative, printViaWiFi, printViaBluetooth } = usePrinter();
  const [storeSettings, setStoreSettings] = useState<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await fetchStoreSettingsForBranch(currentBranchId);
        if (data) {
          setStoreSettings(data);
        }
      } catch (err) {
        console.error("Error loading store settings in SalesManager:", err);
      }
    };
    loadSettings();
  }, [currentBranchId]);
  const { data: customersFromRepo = [] } = useCustomers();
  const {
    data: partsFromRepo = [],
    isSuccess: partsLoaded,
    isFetching: syncingInventory,
    refetch: refetchParts,
  } = usePartsRepo();

  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("Khách lẻ");
  const [customerName, setCustomerName] = useState("Khách lẻ");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [note, setNote] = useState("");
  const [paidAmount, setPaidAmount] = useState<number | "full">("full");
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [rightTab, setRightTab] = useState<"checkout" | "history">("checkout");
  const [mobileStep, setMobileStep] = useState<"products" | "checkout">(
    "products"
  );
    const enablePartsPaging =
    (import.meta.env.VITE_SALES_PARTS_PAGED || "false").toLowerCase() === "true";
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data: pagedPartsResult } = usePartsRepoPaged({
    page,
    pageSize,
    search: debouncedSearch,
    category: "all",
    enabled: enablePartsPaging,
  });

  const pagedPartsData = pagedPartsResult?.ok ? pagedPartsResult.data : [];
  const inventoryParts = enablePartsPaging ? pagedPartsData : parts;

  const customerSource = useMemo(() => {
    if (customersFromRepo.length) return customersFromRepo;
    return customers;
  }, [customersFromRepo, customers]);

  const customerSuggestions = useMemo(() => {
    const keyword = customerSearch.trim().toLowerCase();
    if (!keyword) return customerSource.slice(0, 8);
    return customerSource
      .filter((c) => {
        const name = (c.name || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        return name.includes(keyword) || phone.includes(keyword);
      })
      .slice(0, 8);
  }, [customerSource, customerSearch]);

  const filteredParts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const base = inventoryParts.filter((part) => {
      const hasStock = getBranchStock(part, currentBranchId) > 0;
      const hasWarranty = Boolean(String(part.warrantyPeriod || "").trim());
      return hasStock || hasWarranty;
    });

    if (enablePartsPaging) {
      return base.sort((a, b) => a.name.localeCompare(b.name, "vi"));
    }

    return base
      .filter((part) => {
        if (!keyword) return true;
        return (
          part.name.toLowerCase().includes(keyword) ||
          part.sku.toLowerCase().includes(keyword) ||
          (part.barcode || "").toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [inventoryParts, currentBranchId, search, enablePartsPaging]);

  const totalPages = useMemo(() => {
    if (enablePartsPaging && pagedPartsResult?.ok) {
      const total = Number(pagedPartsResult.meta?.total || 0);
      return Math.max(1, Math.ceil(total / pageSize));
    }
    return Math.max(1, Math.ceil(filteredParts.length / pageSize));
  }, [enablePartsPaging, pagedPartsResult, pageSize, filteredParts.length]);

  useEffect(() => {
    setPage(1);
  }, [search, currentBranchId, pageSize]);

  useEffect(() => {
    if (!partsLoaded) return;
    setParts(partsFromRepo);
  }, [partsLoaded, partsFromRepo, setParts]);

    useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyQuery, sales.length]);

  useEffect(() => {
    if (cartItems.length === 0 && mobileStep === "checkout") {
      setMobileStep("products");
    }
  }, [cartItems.length, mobileStep]);

  const pagedParts = useMemo(() => {
    if (enablePartsPaging) return filteredParts;
    const start = (page - 1) * pageSize;
    return filteredParts.slice(start, start + pageSize);
  }, [filteredParts, page, pageSize, enablePartsPaging]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0),
    [cartItems]
  );

  const total = Math.max(0, subtotal - discount);

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

  const generateSalesTextReceipt = (payload: {
    customer: { name: string; phone?: string };
    items: CartItem[];
    subtotalValue: number;
    discountValue: number;
    totalValue: number;
    payment: "cash" | "bank";
    noteText?: string;
  }) => {
    const line = "--------------------------------";
    const doubleLine = "================================";
    const now = new Date().toLocaleString("vi-VN");
    const storeName = (storeSettings?.store_name || "Sơn Nam").toUpperCase();
    const padSize = Math.max(0, Math.floor((32 - storeName.length) / 2));
    const centeredStoreName = " ".repeat(padSize) + storeName;
    
    let itemLines = "";
    payload.items.forEach((it) => {
      // Name line
      itemLines += `${it.partName}\n`;
      // Qty x Price = Total
      const qtyPrice = `${it.quantity} x ${formatCurrency(it.sellingPrice)}`;
      const totalIt = formatCurrency(it.sellingPrice * it.quantity);
      const spacesCount = 32 - qtyPrice.length - totalIt.length;
      const spaces = spacesCount > 0 ? " ".repeat(spacesCount) : " ";
      itemLines += `${qtyPrice}${spaces}${totalIt}\n`;
    });

    const subtotalStr = formatCurrency(payload.subtotalValue);
    const discountStr = `-${formatCurrency(payload.discountValue)}`;
    const totalStr = formatCurrency(payload.totalValue);

    const subtotalLine = `Tam tinh:${" ".repeat(Math.max(1, 32 - 9 - subtotalStr.length))}${subtotalStr}`;
    const discountLine = `Giam gia:${" ".repeat(Math.max(1, 32 - 9 - discountStr.length))}${discountStr}`;
    const totalLine = `Thanh toan:${" ".repeat(Math.max(1, 32 - 11 - totalStr.length))}${totalStr}`;

    return `
================================
${centeredStoreName}
================================
Ngay: ${now}
Khach hang: ${payload.customer.name}
${payload.customer.phone ? `SDT: ${payload.customer.phone}\n` : ""}${doubleLine}
San pham          SL x DG / T.Tien
${line}
${itemLines}${line}
${subtotalLine}
${discountLine}
${totalLine}
${doubleLine}
Thanh toan: ${payload.payment === "cash" ? "Tien mat" : "Chuyen khoan"}
${payload.noteText ? `Ghi chu: ${payload.noteText}\n` : ""}
Cam on quy khach da tin tuong!
================================
\n\n\n\n`;
  };

  const printInvoice = async (payload: {
    customer: { name: string; phone?: string };
    items: CartItem[];
    subtotalValue: number;
    discountValue: number;
    totalValue: number;
    payment: "cash" | "bank";
    noteText?: string;
  }) => {
    const printMode = localStorage.getItem("motocare_print_mode") || "wifi";

    if (isNative && printMode === "bluetooth") {
      const text = generateSalesTextReceipt(payload);
      try {
        const success = await printViaBluetooth(text);
        if (success) {
          showToast.success("Đã gửi lệnh in nhiệt Bluetooth.");
        } else {
          showToast.error("In Bluetooth thất bại. Vui lòng kết nối máy in.");
        }
      } catch (err: any) {
        showToast.error(`Lỗi in: ${err.message || err}`);
      }
    } else {
      const rows = payload.items
        .map(
          (it) => `
            <tr>
              <td>${escapeHtml(it.partName)}</td>
              <td style="text-align:center">${it.quantity}</td>
              <td style="text-align:right">${formatCurrency(it.sellingPrice)}</td>
              <td style="text-align:right">${formatCurrency(it.sellingPrice * it.quantity)}</td>
            </tr>`
        )
        .join("");

      const paperSizeKey = storeSettings?.print_paper_size_receipt || "80mm";
      const resolvePaperSize = (key: string, fallback = "80mm") => {
        const PAPER_SIZE_MAP: Record<string, { width: string; pageSize: string }> = {
          "58mm": { width: "58mm", pageSize: "58mm auto" },
          "80mm": { width: "80mm", pageSize: "80mm auto" },
          "A5":   { width: "148mm", pageSize: "A5 portrait" },
          "A4":   { width: "210mm", pageSize: "A4 portrait" },
        };
        if (PAPER_SIZE_MAP[key]) return PAPER_SIZE_MAP[key];
        const match = key.match(/^(\d+)mm$/i);
        if (match) {
          const w = `${match[1]}mm`;
          return { width: w, pageSize: `${w} auto` };
        }
        return PAPER_SIZE_MAP[fallback] || PAPER_SIZE_MAP["80mm"];
      };
      const paperSize = resolvePaperSize(paperSizeKey, "80mm");

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Hóa đơn bán hàng</title>
  <style>
    @page { size: ${paperSize.pageSize}; margin: 0; }
    html, body { width: ${paperSize.width}; margin: 0 auto; padding: 0; background-color: #fff; color: #000; }
    body { font-family: Arial, Helvetica, sans-serif; box-sizing: border-box; }
    #sales-receipt {
      width: calc(${paperSize.width} - 4mm) !important;
      margin: 0 auto !important;
      padding: 2mm !important;
      box-sizing: border-box;
      overflow-wrap: break-word;
    }
    .card {
      border: 1px solid #dbe2ea;
      border-radius: 3.5mm;
      padding: 3mm;
      margin-bottom: 4mm;
      color: #000;
      font-size: 8.5pt;
    }
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-top: 2mm; }
    th, td { border-bottom: 1px dashed #cbd5e1; padding: 6px 4px; }
    th { text-align: left; font-weight: bold; }
    .sum { margin-top: 10px; font-size: 9pt; }
    .sum-row { display: flex; justify-content: space-between; margin: 3px 0; }
    .total { font-weight: 700; font-size: 11pt; margin-top: 5px; color: #2563eb; }
    .footer { margin-top: 20px; text-align: center; font-size: 8.5pt; color: #334155; font-style: italic; }
  </style>
</head>
<body>
  <div id="sales-receipt">
    <!-- Header with Logo, Store Info and Bank Info -->
    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1.8mm; border-bottom: 2px solid #3b82f6; padding-bottom: 3mm; margin-bottom: 4mm;">
      ${storeSettings?.logo_url ? `
      <div style="width: 19mm; height: 19mm; border-radius: 999px; border: 1px solid #bfdbfe; background: linear-gradient(180deg, #ffffff 0%, #eff6ff 100%); display: flex; align-items: center; justify-content: center; padding: 2mm; box-shadow: 0 1.5mm 3mm rgba(37, 99, 235, 0.12); flex-shrink: 0; margin-bottom: 1.5mm; box-sizing: border-box;">
        <img src="${storeSettings.logo_url}" alt="Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
      </div>` : ""}
      
      <div style="font-weight: bold; font-size: 13pt; line-height: 1.15; color: #1d4ed8; letter-spacing: 0.15mm;">
        ${storeSettings?.store_name || "SƠN NAM"}
      </div>
      
      <div style="font-size: 8pt; line-height: 1.45; color: #334155; max-width: 94%;">
        ${storeSettings?.address || "Ấp Phú Lợi B, Xã Long Phú Thuận, Đồng Tháp"}
      </div>
      
      <div style="display: flex; align-items: center; justify-content: center; gap: 1.6mm; font-size: 8pt; font-weight: bold; color: #0f172a; padding: 1mm 2.5mm; border-radius: 999px; border: 1px solid #bfdbfe; background-color: #eff6ff;">
        <span style="color: #2563eb;">Hotline</span>
        <span>${storeSettings?.phone || "0947.747.907"}</span>
      </div>

      ${storeSettings?.bank_name ? `
      <div style="display: flex; align-items: center; gap: 3mm; width: 100%; border: 1px solid #93c5fd; border-radius: 3.5mm; padding: 2.8mm 3mm; background: linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%); box-shadow: inset 0 0 0 0.3mm rgba(255, 255, 255, 0.65); text-align: left; margin-top: 2mm; box-sizing: border-box;">
        ${storeSettings.bank_qr_url ? `
        <div style="width: 20mm; height: 20mm; border-radius: 2.5mm; overflow: hidden; border: 1px solid #bfdbfe; background-color: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="${storeSettings.bank_qr_url}" alt="QR Banking" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>` : ""}
        <div style="flex: 1; min-width: 0; color: #0f172a;">
          <div style="font-weight: bold; font-size: 8.8pt; margin-bottom: 1mm; color: #1e3a8a;">${storeSettings.bank_name}</div>
          ${storeSettings.bank_account_number ? `<div style="font-size: 8pt; margin-bottom: 0.6mm;">STK: ${storeSettings.bank_account_number}</div>` : ""}
          ${storeSettings.bank_account_holder ? `<div style="font-size: 8pt; font-weight: 600;">${storeSettings.bank_account_holder}</div>` : ""}
        </div>
      </div>` : ""}
    </div>

    <!-- Title and Meta Info -->
    <div style="text-align: center; margin-top: 3mm; margin-bottom: 3mm;">
      <h1 style="font-size: 13pt; font-weight: bold; margin: 0; text-transform: uppercase; color: #1e40af; line-height: 1.25;">HÓA ĐƠN BÁN HÀNG</h1>
    </div>

    <div class="card">
      <div style="margin-bottom: 1.2mm;"><span style="font-weight: bold;">Ngày giờ:</span> ${new Date().toLocaleString("vi-VN")}</div>
      <div style="margin-bottom: 1.2mm;"><span style="font-weight: bold;">Khách hàng:</span> ${escapeHtml(payload.customer.name)}${payload.customer.phone ? ` - ${escapeHtml(payload.customer.phone)}` : ""}</div>
      <div><span style="font-weight: bold;">Thanh toán:</span> ${payload.payment === "cash" ? "Tiền mặt" : "Chuyển khoản"}</div>
    </div>

    <!-- Products Table -->
    <table>
      <thead>
        <tr>
          <th>Sản phẩm</th>
          <th style="text-align:center; width: 10mm;">SL</th>
          <th style="text-align:right; width: 18mm;">Đơn giá</th>
          <th style="text-align:right; width: 22mm;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- Sum values -->
    <div class="sum">
      <div class="sum-row"><span>Tạm tính</span><span>${formatCurrency(payload.subtotalValue)} đ</span></div>
      ${payload.discountValue > 0 ? `<div class="sum-row" style="color: #e74c3c;"><span>Giảm giá</span><span>-${formatCurrency(payload.discountValue)} đ</span></div>` : ""}
      <div class="sum-row total"><span>TỔNG CỘNG</span><span>${formatCurrency(payload.totalValue)} đ</span></div>
    </div>

    ${payload.noteText ? `
    <div class="card" style="margin-top: 4mm; background-color: #fff9e6; border: 1px solid #ffd700;">
      <div style="font-weight: bold; margin-bottom: 0.8mm;">Ghi chú:</div>
      <div>${escapeHtml(payload.noteText)}</div>
    </div>` : ""}

    <div class="footer">
      <p style="margin: 0;">Cảm ơn quý khách đã tin tưởng và ủng hộ!</p>
      <p style="margin: 1mm 0 0 0;">Hẹn gặp lại quý khách!</p>
    </div>
  </div>
</body>
</html>`;

      await printViaWiFi(html);
    }
  };

  const syncInventory = async () => {
    const result = await refetchParts();
    const next = result.data || partsFromRepo;
    if (next?.length) {
      setParts(next);
      showToast.success("Đã đồng bộ tồn kho mới nhất từ dữ liệu kho.");
      return;
    }
    showToast.warning("Không lấy được dữ liệu kho để đồng bộ.");
  };

  const addPartToCart = (part: Part) => {
    const branchStock = getBranchStock(part, currentBranchId);

    setCartItems((prev) => {
      const existing = prev.find((item) => item.partId === part.id);
      const existingQty = existing?.quantity || 0;

      if (existingQty >= branchStock) {
        showToast.warning(`Tồn kho còn ${branchStock}, không thể thêm thêm.`);
        return prev;
      }

      if (existing) {
        return prev.map((item) =>
          item.partId === part.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      const newItem: CartItem = {
        partId: part.id,
        partName: part.name,
        sku: part.sku,
        category: part.category,
        quantity: 1,
        sellingPrice: getBranchRetailPrice(part, currentBranchId),
        stockSnapshot: branchStock,
      };

      return [...prev, newItem];
    });
  };

  const updateQty = (partId: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCartItems((prev) => prev.filter((item) => item.partId !== partId));
      return;
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.partId !== partId) return item;
        if (nextQty > item.stockSnapshot) {
          showToast.warning(`Tồn kho chỉ còn ${item.stockSnapshot}.`);
          return item;
        }
        return { ...item, quantity: nextQty };
      })
    );
  };

  const removeItem = (partId: string) => {
    setCartItems((prev) => prev.filter((item) => item.partId !== partId));
  };

  const submitSale = () => {
    if (!cartItems.length) {
      showToast.warning("Giỏ hàng đang trống.");
      return;
    }

    if (!customerName.trim()) {
      showToast.warning("Vui lòng nhập tên khách hàng.");
      return;
    }

    if (discount < 0 || discount > subtotal) {
      showToast.warning("Giảm giá không hợp lệ.");
      return;
    }

    const stockSourceParts = enablePartsPaging ? parts : inventoryParts;

    for (const item of cartItems) {
      const part = stockSourceParts.find((p) => p.id === item.partId);
      const availableStock = part ? getBranchStock(part, currentBranchId) : 0;
      if (item.quantity > availableStock) {
        showToast.warning(`Sản phẩm ${item.partName} không đủ tồn (${availableStock}).`);
        return;
      }
    }

    const actualPaidAmount = paidAmount === "full" ? total : paidAmount;
    if (actualPaidAmount < 0 || actualPaidAmount > total) {
      showToast.warning("Số tiền khách trả không hợp lệ.");
      return;
    }

    const payload = {
      customer: {
        name: customerName.trim(),
        phone: customerPhone.trim() || undefined,
      },
      items: cartItems,
      subtotalValue: subtotal,
      discountValue: discount,
      totalValue: total,
      payment: paymentMethod,
      noteText: note.trim() || undefined,
    } as const;

    finalizeSale({
      items: cartItems,
      discount,
      paymentMethod,
      customer: payload.customer,
      note: note.trim() || undefined,
      paidAmount: actualPaidAmount,
    });

    setDiscount(0);
    setPaidAmount("full");
    setNote("");
    setMobileStep("products");
    if (autoPrintInvoice) {
      printInvoice(payload);
    }
    showToast.success("Đã tạo phiếu bán hàng thành công.");
  };

  const handleDeleteSale = (saleId: string) => {
    const targetSale = sales.find((sale) => sale.id === saleId);
    if (!targetSale) {
      showToast.warning("Không tìm thấy phiếu bán hàng để xóa.");
      return;
    }

    const ok = window.confirm(
      `Xóa phiếu ${saleId}?\nHệ thống sẽ hoàn lại tồn kho và hoàn tiền về nguồn thanh toán.`
    );
    if (!ok) return;

    deleteSale(saleId);
  };

  const historyPageSize = 6;

  const filteredSalesHistory = useMemo(() => {
    const keyword = historyQuery.trim().toLowerCase();
    const normalized = sales.filter((sale) => {
      if (!keyword) return true;
      const customerName = (sale.customer?.name || "").toLowerCase();
      const customerPhone = (sale.customer?.phone || "").toLowerCase();
      const saleId = (sale.id || "").toLowerCase();
      return (
        customerName.includes(keyword) ||
        customerPhone.includes(keyword) ||
        saleId.includes(keyword)
      );
    });
    return normalized.slice(0, 200);
  }, [sales, historyQuery]);

  const totalHistoryPages = Math.max(
    1,
    Math.ceil(filteredSalesHistory.length / historyPageSize)
  );

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages);
    }
  }, [historyPage, totalHistoryPages]);

  const pagedSalesHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredSalesHistory.slice(start, start + historyPageSize);
  }, [filteredSalesHistory, historyPage]);

  const ui = {
    pageBg: "min-h-screen bg-slate-50 dark:bg-[#151521] pb-20",
    header: "sticky top-0 z-20 bg-white/90 dark:bg-[#1e1e2d]/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-4 mb-6",
    leftPanel: "xl:col-span-2 space-y-4",
    rightPanel: "bg-white dark:bg-[#1e1e2d] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-5 space-y-4 shadow-sm xl:sticky xl:top-[100px] h-fit",
    panelHead: "mb-4 flex flex-col sm:flex-row items-center justify-between gap-3",
    stockBadge: "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    addBtn: "inline-flex items-center justify-center gap-1.5 h-9 w-full sm:w-auto px-4 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-bold transition border border-emerald-200 dark:border-emerald-500/30",
    syncBtn: "h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e1e2d] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm flex items-center justify-center font-bold",
};

  return (
    <div className={`${ui.pageBg} sales-screen`}>
      <div className={ui.header}>
        <div className="max-w-[1400px] mx-auto w-full flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                        <ShoppingCart className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    Bán hàng tại quầy
                </h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 ml-[50px]">
                    Điểm bán thông minh
                </p>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold">
                <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    Sản phẩm: {filteredParts.length}
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                    Giỏ hàng: {cartItems.length}
                </span>
            </div>
        </div>
      </div>
      <div className="relative grid max-w-[1400px] mx-auto px-4 grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 overflow-hidden">
        <section
          className={`${ui.leftPanel} transition-all duration-300 ease-out md:translate-x-0 md:opacity-100 md:pointer-events-auto md:static ${
            mobileStep === "products"
              ? "translate-x-0 opacity-100"
              : "absolute inset-0 -translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          <div className={ui.panelHead}>
            <div className="flex items-center gap-2 w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, SKU, mã vạch"
                  className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none ring-0 focus:border-rose-400 focus:shadow-[0_0_0_3px_rgba(244,63,94,0.15)]"
                />
              </div>
              <button
                onClick={syncInventory}
                disabled={syncingInventory}
                className={`${ui.syncBtn} w-10 px-0 inline-flex items-center justify-center shrink-0`}
                title="Đồng bộ tồn kho"
                aria-label="Đồng bộ tồn kho"
              >
                <RefreshCcw className={`w-4 h-4 ${syncingInventory ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {pagedParts.map((part) => {
                const stock = getBranchStock(part, currentBranchId);
                const price = getBranchRetailPrice(part, currentBranchId);
                const cartItem = cartItems.find((item) => item.partId === part.id);
                return (
                  <button
                    type="button"
                    key={part.id}
                    onClick={() => addPartToCart(part)}
                    className={`text-left rounded-2xl border p-3 sm:p-4 transition-all duration-200 active:scale-[0.98] flex flex-col h-full ${
                      cartItem
                        ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10 shadow-[0_0_0_1px_rgba(52,211,153,0.5)]"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-sm"
                    }`}
                  >
                    <div className="min-w-0 mb-auto w-full">
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug break-words mb-1">
                        {part.name}
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 truncate">SKU: {part.sku}</div>
                    </div>
                    
                    <div className="mt-4 flex flex-col items-start gap-2 w-full">
                      <div className="w-full flex items-center justify-between">
                        <div className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(price)}
                        </div>
                        <span className={ui.stockBadge}>{stock} tồn</span>
                      </div>
                      <div className="w-full flex items-center justify-between h-5">
                        {part.warrantyPeriod ? (
                          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            BH: {part.warrantyPeriod}
                          </div>
                        ) : <div></div>}
                        
                        {cartItem && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white shadow-sm">
                            x{cartItem.quantity}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {!filteredParts.length && (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-slate-400" />
                </div>
                <div className="text-slate-500 dark:text-slate-400 font-medium">
                  Không tìm thấy sản phẩm phù hợp.
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-slate-50/70 dark:bg-slate-900/40">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Hiển thị {(filteredParts.length === 0 ? 0 : (page - 1) * pageSize + 1)}-
              {Math.min(page * pageSize, filteredParts.length)} / {filteredParts.length} sản phẩm
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
              >
                <option value={12}>12 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={30}>30 / trang</option>
              </select>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs disabled:opacity-50 hover:bg-white dark:hover:bg-slate-800 transition"
              >
                Trước
              </button>

              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 min-w-[72px] text-center">
                Trang {page}/{totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-3 rounded-lg border border-slate-300 dark:border-slate-600 text-xs disabled:opacity-50 hover:bg-white dark:hover:bg-slate-800 transition"
              >
                Sau
              </button>
            </div>
          </div>

        </section>

        <section
          className={`${ui.rightPanel} transition-all duration-300 ease-out md:translate-x-0 md:opacity-100 md:pointer-events-auto md:static ${
            mobileStep === "checkout"
              ? "translate-x-0 opacity-100"
              : "absolute inset-0 translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          <div className="md:hidden">
            <button
              onClick={() => setMobileStep("products")}
              className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại chọn sản phẩm
            </button>
          </div>
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/10 p-4 mb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700/70 dark:text-emerald-400/70 font-bold mb-1">
                  Giao dịch nhanh
                </p>
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
                  <ReceiptText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Quản lý bán hàng
                </h2>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Giỏ hàng</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {cartItems.length}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
            <button
              type="button"
              onClick={() => setRightTab("checkout")}
              className={`h-9 rounded-lg text-sm font-bold transition-all ${
                rightTab === "checkout"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Thanh toán
            </button>
            <button
              type="button"
              onClick={() => setRightTab("history")}
              className={`h-9 rounded-lg text-sm font-bold transition-all ${
                rightTab === "history"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              Lịch sử bán hàng
            </button>
          </div>

          {rightTab === "checkout" && (
          <>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 mb-4">
            {cartItems.map((item) => (
              <div
                key={item.partId}
                className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-[#1a1a27] shadow-sm relative group transition-all hover:border-emerald-300 dark:hover:border-emerald-500/50"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 pr-8">
                    <p className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                      {item.partName}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">{item.sku || "N/A"}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.partId)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 w-7 h-7 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 inline-flex items-center justify-center transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                    <button
                      onClick={() => updateQty(item.partId, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md transition shadow-sm"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center text-sm font-bold text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(item.partId, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md transition shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.sellingPrice * item.quantity)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!cartItems.length && (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 flex flex-col items-center justify-center text-center">
                <ShoppingCart className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Chưa có sản phẩm trong giỏ hàng.
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-200/70 dark:border-slate-700 pt-4">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#1a1a27] shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Khách hàng</div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={customerSearch}
                    onFocus={() => setShowCustomerSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowCustomerSuggestions(false), 120);
                    }}
                    onChange={(e) => {
                      const next = e.target.value;
                      setCustomerSearch(next);
                      setCustomerName(next);
                      setShowCustomerSuggestions(true);
                    }}
                    placeholder="Tìm khách hàng (tên, SDT, biển số)"
                    className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60"
                  />
                </div>
              </div>
              {showCustomerSuggestions && customerSuggestions.length > 0 && (
                <div className="mt-1 max-h-52 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                  {customerSuggestions.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onMouseDown={() => {
                        setCustomerName(c.name);
                        setCustomerSearch(c.name);
                        setCustomerPhone(c.phone || "");
                        setShowCustomerSuggestions(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.phone || "Không có số điện thoại"}</div>
                    </button>
                  ))}
                </div>
              )}

              <label className="block">
                <span className="text-xs text-slate-500">Số điện thoại</span>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#1a1a27] shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Tổng kết đơn hàng
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Tạm tính</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex-1">
                  <span className="text-xs text-slate-500">Giảm giá</span>
                  <input
                    type="number"
                    min={0}
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                    className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 text-right focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60"
                  />
                </label>
                <select
                  aria-label="Don vi giam gia"
                  className="mt-5 w-14 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 text-sm"
                  defaultValue="vnd"
                >
                  <option value="vnd">đ</option>
                </select>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 px-3 py-2">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">Thành tiền</span>
                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-100">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#1a1a27] shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Phương thức thanh toán
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`h-11 rounded-xl border text-sm font-semibold transition ${
                    paymentMethod === "cash"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white/90 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300/80 dark:border-slate-600"
                  }`}
                >
                  Tiền mặt
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("bank")}
                  className={`h-11 rounded-xl border text-sm font-semibold transition ${
                    paymentMethod === "bank"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white/90 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300/80 dark:border-slate-600"
                  }`}
                >
                  Chuyển khoản
                </button>
                <button
                  type="button"
                  disabled
                  className="h-11 rounded-xl border text-sm font-semibold text-slate-400 border-slate-200/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 cursor-not-allowed"
                >
                  Quẹt thẻ
                </button>
              </div>

              <label className="block">
                <span className="text-xs text-slate-500">Khách thanh toán</span>
                <input
                  type="number"
                  min={0}
                  max={total}
                  value={paidAmount === "full" ? total : paidAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPaidAmount(val === "" ? "full" : Number(val));
                  }}
                  className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60"
                />
              </label>
              {paidAmount !== "full" && total - paidAmount > 0 && (
                <div className="text-sm font-semibold text-rose-500">
                  Ghi nhận khách nợ: {formatCurrency(total - paidAmount)}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#1a1a27] shadow-sm p-4 space-y-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ghi chú</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60"
              />

              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={autoPrintInvoice}
                  onChange={(e) => setAutoPrintInvoice(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
                In hóa đơn nhanh sau khi xác nhận
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled
                className="h-12 rounded-2xl border border-slate-300/80 dark:border-slate-600 text-slate-400 dark:text-slate-500 bg-slate-50/60 dark:bg-slate-900/60 cursor-not-allowed"
              >
                Lưu nháp
              </button>

              <button
                onClick={submitSale}
                className="h-12 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold shadow-[0_16px_30px_-18px_rgba(16,185,129,0.9)] hover:shadow-[0_18px_35px_-18px_rgba(16,185,129,1)] transition"
              >
                Xuất bán
              </button>
            </div>

            <button
              onClick={() =>
                printInvoice({
                  customer: {
                    name: customerName.trim() || "Khách lẻ",
                    phone: customerPhone.trim() || undefined,
                  },
                  items: cartItems,
                  subtotalValue: subtotal,
                  discountValue: discount,
                  totalValue: total,
                  payment: paymentMethod,
                  noteText: note.trim() || undefined,
                })
              }
              disabled={!cartItems.length}
              className="w-full h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <span className="inline-flex items-center gap-2">
                <Printer className="w-4 h-4" />
                In hóa đơn
              </span>
            </button>
          </div>
          </>
          )}

          {rightTab === "history" && (
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2 mt-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Lịch sử bán hàng
            </h3>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={historyQuery}
                onChange={(e) => setHistoryQuery(e.target.value)}
                placeholder="Tìm mã phiếu, tên khách, số điện thoại"
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {pagedSalesHistory.map((sale) => (
                <div key={sale.id} className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 bg-white/70 dark:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {sale.customer.name || "Khách lẻ"}
                      </div>
                      <div className="text-slate-500 truncate">{sale.id}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-emerald-600 font-semibold whitespace-nowrap">
                        {formatCurrency(sale.total)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteSale(sale.id)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        title="Xóa phiếu bán hàng"
                        aria-label="Xóa phiếu bán hàng"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 text-slate-500 flex items-center justify-between gap-2">
                    <span>{new Date(sale.date).toLocaleString("vi-VN")}</span>
                    <span>{sale.items.length} sản phẩm</span>
                  </div>
                </div>
              ))}

              {!filteredSalesHistory.length && (
                <div className="text-xs text-slate-500">Chưa có giao dịch bán hàng.</div>
              )}
            </div>

            {!!filteredSalesHistory.length && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="text-[11px] text-slate-500">
                  {filteredSalesHistory.length} giao dịch
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                    className="h-7 px-2 rounded border border-slate-300 dark:border-slate-600 text-[11px] disabled:opacity-50"
                  >
                    Trước
                  </button>
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 min-w-[56px] text-center">
                    {historyPage}/{totalHistoryPages}
                  </span>
                  <button
                    onClick={() =>
                      setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))
                    }
                    disabled={historyPage >= totalHistoryPages}
                    className="h-7 px-2 rounded border border-slate-300 dark:border-slate-600 text-[11px] disabled:opacity-50"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
          )}
        </section>
      </div>

      {mobileStep === "products" && cartItems.length > 0 && (
        <div
          className="md:hidden fixed left-3 right-3 bottom-20 z-[9999]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            onClick={() => {
              if (!cartItems.length) return;
              setRightTab("checkout");
              setMobileStep("checkout");
            }}
            className="w-full rounded-2xl border px-4 py-3 transition bg-slate-900/95 dark:bg-emerald-700 text-white shadow-xl border-white/10"
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                <span className="text-sm font-semibold">{cartItems.length} sản phẩm</span>
              </span>
              <span className="text-sm font-bold">{formatCurrency(total)}</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 px-2 py-1 rounded-full">
                Tiếp tục giỏ hàng
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default SalesManager;

