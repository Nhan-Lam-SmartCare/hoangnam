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
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Camera,
  Save,
  UserPlus,
  X,
  Package,
  History,
  Banknote,
  Landmark,
  LayoutGrid,
  List,
  PenLine,
  Truck,
  Percent,
  Calendar,
  BookOpen,
  CreditCard,
} from "lucide-react";
import FormattedNumberInput from "../common/FormattedNumberInput";
import PrintSalesPreviewModal, { PrintSalesPayload } from "./modals/PrintSalesPreviewModal";
import { useAppContext } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";
import { formatCurrency } from "../../utils/format";
import { showToast } from "../../utils/toast";
import type { CartItem, Part, PartUnit, Sale } from "../../types";
import ImeiPickerModal from "./modals/ImeiPickerModal";
import { useSerializedPartIds } from "../../hooks/usePartUnitsRepository";
import { useCustomers, useSales, useCreateCustomer } from "../../hooks/useSupabase";
import BarcodeScannerModal from "../common/BarcodeScannerModal";
import { ReturnSaleModal } from "./ReturnSaleModal";
import { usePartsRepo, usePartsRepoPaged } from "../../hooks/usePartsRepository";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { usePrinter } from "../../hooks/usePrinter";
import { fetchStoreSettingsForBranch, getDynamicQrUrl } from "../service/utils/service.utils";
import { useEmployeesDirectoryRepo } from "../../hooks/useEmployeesRepository";
import { getSelectableEmployees } from "../../utils/employees";
import { isPartInBranch } from "../../utils/inventoryCalc";

const getBranchStock = (part: Part, branchId: string): number => {
  const stock = Math.max(0, Number(part.stock?.[branchId] || 0));
  const reserved = Math.max(0, Number(part.reservedStock?.[branchId] || 0));
  return Math.max(0, stock - reserved);
};

const getBranchRetailPrice = (part: Part, branchId: string): number =>
  Math.max(0, Number(part.retailPrice?.[branchId] || 0));

// Màu badge tồn kho theo mức: đỏ (sắp hết) → vàng (thấp) → xanh (dồi dào).
// Giúp nhân viên nhìn lướt là biết hàng nào cần nhập thêm.
const getStockBadgeClass = (stock: number): string => {
  if (stock <= 5)
    return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  if (stock <= 20)
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
};

const getCompactCode = (value?: string | null) => {
  const raw = String(value || "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(-8);
  if (digits.length >= 6) return digits.slice(-6);
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "");
  if (compact.length >= 8) return compact.slice(-8).toLowerCase();
  if (compact.length >= 6) return compact.slice(-6).toLowerCase();
  return raw.toLowerCase();
};

const normalizeSaleRow = (row: any): Sale => ({
  ...row,
  id: row.id,
  date: row.date,
  items: Array.isArray(row.items) ? row.items : [],
  subtotal: Number(row.subtotal || 0),
  discount: Number(row.discount || 0),
  total: Number(row.total || 0),
  customer: row.customer || { name: "Người tiêu dùng" },
  paymentMethod: row.paymentMethod || row.paymentmethod || "cash",
  userId: row.userId || row.userid || "local-user",
  userName: row.userName || row.username || "Local User",
  branchId: row.branchId || row.branchid || row.branch_id || "CN1",
  cashTransactionId:
    row.cashTransactionId || row.cashtransactionid || row.cash_transaction_id,
});

interface HeldOrder {
  id: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  selectedCustomerId: string | null;
  selectedEmployeeId?: string | null;
  items: CartItem[];
  discount: number;
  discountType: "vnd" | "percent";
  paymentMethod: "cash" | "bank" | "card" | null;
  note: string;
  total: number;
  transactionType?: "full" | "partial" | "installment" | "debt";
  promisedPaymentDate?: string;
  installmentProvider?: string;
  installmentDownPayment?: number;
  installmentMonths?: number;
  installmentInterestRate?: number;
  deliveryMethod?: "pickup" | "delivery";
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryNote?: string;
  shippingFee?: number;
  trackingNumber?: string;
}

const SalesManager: React.FC = () => {
  const {
    parts,
    customers,
    cartItems,
    setCartItems,
    setParts,
    setSales,
    currentBranchId,
    finalizeSale,
    deleteSale,
    sales,
  } = useAppContext();
  const { isNative, printViaWiFi, printViaBluetooth } = usePrinter();
  const { profile } = useAuth();
  const canDeleteSale = canDo(profile, "sale.delete");
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
  const { data: salesFromRepo = [], isSuccess: salesLoaded } = useSales();
  const {
    data: partsFromRepo = [],
    isSuccess: partsLoaded,
    isFetching: syncingInventory,
    refetch: refetchParts,
  } = usePartsRepo();

  // Sản phẩm nào bán theo IMEI thì phải mở modal chọn máy thay vì thêm thẳng.
  const { serializedIds } = useSerializedPartIds(currentBranchId);
  const [imeiPickerPart, setImeiPickerPart] = useState<Part | null>(null);

  const [search, setSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const { data: employeesList = [] } = useEmployeesDirectoryRepo();
  const selectableEmployees = useMemo(() => {
    return getSelectableEmployees(employeesList, currentBranchId);
  }, [employeesList, currentBranchId]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Set default seller to current logged-in user if they are in the selectable employee list
  useEffect(() => {
    if (profile?.id && selectableEmployees.some((emp) => emp.id === profile.id)) {
      setSelectedEmployeeId(profile.id);
    } else if (selectableEmployees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(selectableEmployees[0].id);
    }
  }, [profile, selectableEmployees, selectedEmployeeId]);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"vnd" | "percent">("vnd");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | "card" | null>("cash");
  const [cashGiven, setCashGiven] = useState<number | "">(0);
  const [note, setNote] = useState("");
  const [paidAmount, setPaidAmount] = useState<number | "full">("full");
  // Thanh toán tách: khách trả một phần tiền mặt + một phần chuyển khoản.
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitBank, setSplitBank] = useState<number>(0);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);

  // New payment types & installment modal states
  const [transactionType, setTransactionType] = useState<"full" | "partial" | "installment" | "debt">("full");
  const [promisedPaymentDate, setPromisedPaymentDate] = useState<string>("");
  
  // Installment Modal State
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [installmentProvider, setInstallmentProvider] = useState<string>("Cửa hàng (Tự quản lý)");
  const [installmentDownPayment, setInstallmentDownPayment] = useState<number>(0);
  const [installmentMonths, setInstallmentMonths] = useState<number>(6);
  const [installmentInterestRate, setInstallmentInterestRate] = useState<number>(0);

  // Delivery State
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "delivery">("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [shippingFee, setShippingFee] = useState(0);
  const [trackingNumber, setTrackingNumber] = useState("");

  const [printPayload, setPrintPayload] = useState<PrintSalesPayload | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = React.useRef(false);
  const [editingLines, setEditingLines] = useState<Record<string, boolean>>({});
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const createCustomer = useCreateCustomer();
  const heldStorageKey = `motocare_held_orders_${currentBranchId}`;
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"products" | "cart" | "history" | "held">("products");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    const saved = localStorage.getItem("motocare_sales_view_mode");
    return saved === "list" ? "list" : "grid";
  });

  useEffect(() => {
    localStorage.setItem("motocare_sales_view_mode", viewMode);
  }, [viewMode]);

  const [showNoteInput, setShowNoteInput] = useState(false);
  useEffect(() => {
    if (note) {
      setShowNoteInput(true);
    }
  }, [note]);

  // Phím tắt bàn phím chuẩn POS (F2: Tìm SP, F4: Chọn khách, F8: Giữ đơn, F9/Ctrl+Enter: Thanh toán, ESC: Xóa tìm kiếm)
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const customerInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || "").toUpperCase();
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag);

      if (e.key === "F2") {
        e.preventDefault();
        setActiveTab("products");
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "F4") {
        e.preventDefault();
        setActiveTab("cart");
        setTimeout(() => customerInputRef.current?.focus(), 50);
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cartItems.length > 0) {
          holdCurrentOrder();
        } else {
          showToast.info("F8: Giỏ hàng trống, không có đơn để giữ.");
        }
      } else if (e.key === "F9" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        if (cartItems.length > 0) {
          void submitSale();
        } else {
          showToast.info("Giỏ hàng đang trống, không thể thanh toán.");
        }
      } else if (e.key === "Escape") {
        if (search) {
          e.preventDefault();
          setSearch("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cartItems, search]);
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
      if (!isPartInBranch(part, currentBranchId)) return false;
      const hasStock = getBranchStock(part, currentBranchId) > 0;
      const isServiceCategory = ["dịch vụ", "công thợ"].includes((part.category || "").trim().toLowerCase());
      return hasStock || isServiceCategory;
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
    if (!salesLoaded) return;
    setSales((salesFromRepo || []).map(normalizeSaleRow));
  }, [salesLoaded, salesFromRepo, setSales]);

    useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyQuery, sales.length]);

  useEffect(() => {
    if (cartItems.length === 0 && activeTab === "cart") {
      setActiveTab("products");
    }
  }, [cartItems.length, activeTab]);

  // B5: nạp đơn đang giữ theo chi nhánh
  useEffect(() => {
    try {
      const raw = localStorage.getItem(heldStorageKey);
      setHeldOrders(raw ? (JSON.parse(raw) as HeldOrder[]) : []);
    } catch {
      setHeldOrders([]);
    }
  }, [heldStorageKey]);

  // B5: lưu đơn đang giữ
  useEffect(() => {
    try {
      localStorage.setItem(heldStorageKey, JSON.stringify(heldOrders));
    } catch {
      // bỏ qua lỗi lưu cục bộ
    }
  }, [heldStorageKey, heldOrders]);

  const pagedParts = useMemo(() => {
    if (enablePartsPaging) return filteredParts;
    const start = (page - 1) * pageSize;
    return filteredParts.slice(start, start + pageSize);
  }, [filteredParts, page, pageSize, enablePartsPaging]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0),
    [cartItems]
  );

  // Tổng giảm giá theo từng dòng (A2)
  const lineDiscountTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.discount || 0), 0),
    [cartItems]
  );

  // Tạm tính sau khi trừ giảm giá theo dòng; giảm giá đơn (%) tính trên giá trị này.
  const netSubtotal = Math.max(0, subtotal - lineDiscountTotal);

  const discountAmount = useMemo(() => {
    if (discountType === "percent") {
      return Math.round((netSubtotal * discount) / 100);
    }
    return discount;
  }, [netSubtotal, discount, discountType]);

  const total = Math.max(0, netSubtotal - discountAmount);

  // Installment computations
  const installmentDownPaymentValue = installmentDownPayment;
  const loanAmount = Math.max(0, total - installmentDownPaymentValue);
  const totalInterest = Math.round(loanAmount * (installmentInterestRate / 100) * (installmentMonths / 12));
  const totalRepayment = loanAmount + totalInterest;
  const monthlyPayment = installmentMonths > 0 ? Math.round(totalRepayment / installmentMonths) : 0;

  const scheduleRows = useMemo(() => {
    const rows = [];
    const today = new Date();
    for (let i = 1; i <= installmentMonths; i++) {
      const dueDate = new Date(today);
      dueDate.setMonth(today.getMonth() + i);
      const dayStr = `${dueDate.getDate()}/${dueDate.getMonth() + 1}/${dueDate.getFullYear()}`;
      rows.push({
        index: i,
        date: dayStr,
        amount: monthlyPayment
      });
    }
    return rows;
  }, [installmentMonths, monthlyPayment]);

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
    dateValue?: string;
  }) => {
    const line = "--------------------------------";
    const doubleLine = "================================";
    const now = new Date(payload.dateValue || Date.now()).toLocaleString("vi-VN");
    const storeName = (storeSettings?.store_name || "Sơn Nam").toUpperCase();
    const padSize = Math.max(0, Math.floor((32 - storeName.length) / 2));
    const centeredStoreName = " ".repeat(padSize) + storeName;
    
    let itemLines = "";
    payload.items.forEach((it) => {
      // Name line
      itemLines += `${it.partName}\n`;
      // Qty x Price = Total (discounted)
      const qtyPrice = `${it.quantity} x ${formatCurrency(it.sellingPrice)}`;
      const totalIt = formatCurrency(it.sellingPrice * it.quantity - (it.discount || 0));
      const spacesCount = 32 - qtyPrice.length - totalIt.length;
      const spaces = spacesCount > 0 ? " ".repeat(spacesCount) : " ";
      itemLines += `${qtyPrice}${spaces}${totalIt}\n`;
      if (it.discount && it.discount > 0) {
        itemLines += `  (Giam: -${formatCurrency(it.discount)})\n`;
      }
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

  const printInvoice = async (payload: PrintSalesPayload) => {
    const printMode = localStorage.getItem("motocare_print_mode") || "wifi";

    if (isNative && printMode === "bluetooth") {
      const text = generateSalesTextReceipt(payload);
      await printViaBluetooth(text);
    } else {
      const qrUrl = getDynamicQrUrl(
        {
          id: payload.saleId || "DRAFT",
          total: payload.totalValue,
          isSale: true,
          code: payload.saleId,
        },
        storeSettings
      );

      const rows = payload.items
        .map(
          (it) => `
            <tr>
              <td>
                ${escapeHtml(it.partName)}
                ${it.discount && it.discount > 0 ? `<div style="font-size: 7.5pt; color: #ef4444; margin-top: 1px;">(Giảm: -${formatCurrency(it.discount)})</div>` : ""}
              </td>
              <td style="text-align:center">${it.quantity}</td>
              <td style="text-align:right">${formatCurrency(it.sellingPrice)}</td>
              <td style="text-align:right">${formatCurrency(it.sellingPrice * it.quantity - (it.discount || 0))}</td>
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
        ${qrUrl ? `
        <div style="width: 20mm; height: 20mm; border-radius: 2.5mm; overflow: hidden; border: 1px solid #bfdbfe; background-color: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <img src="${qrUrl}" alt="QR Banking" style="width: 100%; height: 100%; object-fit: contain;" />
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
      <div style="margin-bottom: 1.2mm;"><span style="font-weight: bold;">Ngày giờ:</span> ${new Date(payload.dateValue || Date.now()).toLocaleString("vi-VN")}</div>
      <div style="margin-bottom: 1.2mm;"><span style="font-weight: bold;">Khách hàng:</span> ${escapeHtml(payload.customer.name)}${payload.customer.phone ? ` - ${escapeHtml(payload.customer.phone)}` : ""}</div>
      ${payload.saleId ? `<div style="margin-bottom: 1.2mm;"><span style="font-weight: bold;">Mã đơn:</span> ${escapeHtml(payload.saleId)}</div>` : ""}
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
      <div class="sum-row"><span>Tạm tính</span><span>${formatCurrency(payload.subtotalValue)}</span></div>
      ${payload.discountValue > 0 ? `<div class="sum-row" style="color: #e74c3c;"><span>Giảm giá</span><span>-${formatCurrency(payload.discountValue)}</span></div>` : ""}
      <div class="sum-row total"><span>TỔNG CỘNG</span><span>${formatCurrency(payload.totalValue)}</span></div>
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

  /**
   * Thêm các máy đã chọn ở modal IMEI vào giỏ.
   *
   * Gộp theo DANH SÁCH MÁY chứ không cộng số lượng: chọn lại đúng chiếc đã có
   * trong giỏ thì phải không đổi gì, còn cộng dồn sẽ tạo ra "2 chiếc" trong khi
   * chỉ có một máy thật. `quantity` luôn bằng `unitIds.length`.
   */
  const addUnitsToCart = (part: Part, units: PartUnit[]) => {
    if (units.length === 0) return;
    const branchStock = getBranchStock(part, currentBranchId);

    setCartItems((prev) => {
      const existing = prev.find((item) => item.partId === part.id);
      const pickedIds = units.map((u) => u.id);
      const pickedImeis = units.map((u) => (u.isPlaceholder ? "" : u.imei));

      if (existing) {
        return prev.map((item) =>
          item.partId === part.id
            ? {
                ...item,
                unitIds: pickedIds,
                unitImeis: pickedImeis,
                quantity: pickedIds.length,
                stockSnapshot: branchStock,
                discount: Math.min(
                  item.discount || 0,
                  item.sellingPrice * pickedIds.length
                ),
              }
            : item
        );
      }

      const newItem: CartItem = {
        partId: part.id,
        partName: part.name,
        sku: part.sku,
        category: part.category,
        quantity: pickedIds.length,
        sellingPrice: getBranchRetailPrice(part, currentBranchId),
        stockSnapshot: branchStock,
        isService: false,
        unitIds: pickedIds,
        unitImeis: pickedImeis,
      };
      return [...prev, newItem];
    });

    setImeiPickerPart(null);
    showToast.success(`Đã chọn ${units.length} máy cho ${part.name}.`);
  };

  const addPartToCart = (part: Part) => {
    const branchStock = getBranchStock(part, currentBranchId);
    const isService = ["dịch vụ", "công thợ"].includes((part.category || "").trim().toLowerCase());

    // Hàng có IMEI: không tự thêm mà bắt chọn ĐÚNG chiếc nào rời kho — phiếu bảo
    // hành cần IMEI thật và `part_units` phải khớp với `parts.stock`.
    if (!isService && serializedIds.has(part.id)) {
      setImeiPickerPart(part);
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((item) => item.partId === part.id);
      const existingQty = existing?.quantity || 0;

      if (!isService && existingQty >= branchStock) {
        showToast.warning(`Tồn kho còn ${branchStock}, không thể thêm thêm.`);
        return prev;
      }

      if (existing) {
        return prev.map((item) =>
          item.partId === part.id
            ? { ...item, quantity: item.quantity + 1, stockSnapshot: branchStock }
            : item
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
        isService,
      };

      return [...prev, newItem];
    });
  };

  const updateQty = (partId: string, nextQty: number) => {
    if (nextQty <= 0) {
      setCartItems((prev) => prev.filter((item) => item.partId !== partId));
      return;
    }

    // #3: Chặn theo tồn kho LIVE (tra từ danh sách phụ tùng hiện tại) thay vì
    // snapshot chụp lúc thêm giỏ — snapshot có thể đã cũ nếu tồn kho thay đổi.
    const livePart =
      parts.find((p) => p.id === partId) ||
      inventoryParts.find((p) => p.id === partId);

    const isService = livePart
      ? ["dịch vụ", "công thợ"].includes((livePart.category || "").trim().toLowerCase())
      : false;

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.partId !== partId) return item;

        // Hàng có IMEI: giảm = bỏ bớt máy ở cuối danh sách. TĂNG thì không thể ở
        // đây vì phải biết thêm CHIẾC NÀO — người bán chọn lại trong modal.
        if (item.unitIds?.length) {
          if (nextQty > item.unitIds.length) {
            showToast.warning(
              "Hàng có IMEI: bấm vào sản phẩm để chọn thêm máy cụ thể."
            );
            return item;
          }
          return {
            ...item,
            quantity: nextQty,
            unitIds: item.unitIds.slice(0, nextQty),
            unitImeis: item.unitImeis?.slice(0, nextQty),
            discount: Math.min(item.discount || 0, item.sellingPrice * nextQty),
          };
        }

        const liveStock = livePart
          ? getBranchStock(livePart, currentBranchId)
          : item.stockSnapshot;
        if (!isService && !item.isService && nextQty > liveStock) {
          showToast.warning(`Tồn kho chỉ còn ${liveStock}.`);
          return item;
        }
        return {
          ...item,
          quantity: nextQty,
          stockSnapshot: liveStock,
          discount: Math.min(item.discount || 0, item.sellingPrice * nextQty),
        };
      })
    );
  };

  const removeItem = (partId: string) => {
    setCartItems((prev) => prev.filter((item) => item.partId !== partId));
  };

  // A2: sửa đơn giá theo từng dòng
  const updateLinePrice = (partId: string, nextPrice: number) => {
    const safePrice = Math.max(0, Number(nextPrice) || 0);
    // Cảnh báo (không chặn) khi bán dưới giá vốn của chi nhánh hiện tại.
    const livePart =
      parts.find((p) => p.id === partId) ||
      inventoryParts.find((p) => p.id === partId);
    const cost = livePart?.costPrice?.[currentBranchId] || 0;
    if (cost > 0 && safePrice > 0 && safePrice < cost) {
      showToast.warning(
        `Giá bán (${formatCurrency(safePrice)}) thấp hơn giá vốn (${formatCurrency(cost)}).`
      );
    }
    setCartItems((prev) =>
      prev.map((item) =>
        item.partId === partId
          ? {
              ...item,
              sellingPrice: safePrice,
              // Không cho giảm giá dòng vượt thành tiền mới
              discount: Math.min(item.discount || 0, safePrice * item.quantity),
            }
          : item
      )
    );
  };

  // A2: sửa giảm giá (đ) theo từng dòng
  const updateLineDiscount = (partId: string, nextDiscount: number) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.partId !== partId) return item;
        const lineTotal = item.sellingPrice * item.quantity;
        const safeDiscount = Math.min(
          Math.max(0, Number(nextDiscount) || 0),
          lineTotal
        );
        return { ...item, discount: safeDiscount };
      })
    );
  };

  // Quét mã vạch / nhấn Enter: tự thêm sản phẩm khớp barcode/SKU rồi xóa ô tìm
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const keyword = search.trim().toLowerCase();
    if (!keyword) return;

    const cleanKeyword = keyword.replace(/[^a-z0-9]/g, "");

    // 1. Ưu tiên tìm chính xác theo mã SKU hoặc Mã vạch (hỗ trợ gõ a01, PT-01, 01...)
    const matchByCode = inventoryParts.find((p) => {
      const sku = (p.sku || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      const cleanSku = sku.replace(/[^a-z0-9]/g, "");
      const cleanBarcode = barcode.replace(/[^a-z0-9]/g, "");

      return (
        sku === keyword ||
        barcode === keyword ||
        (cleanKeyword.length >= 2 && (cleanSku === cleanKeyword || cleanBarcode === cleanKeyword)) ||
        (cleanKeyword.length >= 2 && cleanSku.endsWith(cleanKeyword))
      );
    });

    if (matchByCode) {
      e.preventDefault();
      const stock = getBranchStock(matchByCode, currentBranchId);
      const isService = ["dịch vụ", "công thợ"].includes((matchByCode.category || "").trim().toLowerCase());
      if (stock > 0 || isService) {
        addPartToCart(matchByCode);
        setSearch("");
      } else {
        showToast.error(`Sản phẩm "${matchByCode.name}" (SKU: ${matchByCode.sku}) hiện đã HẾT HÀNG trong kho!`);
        setSearch("");
      }
      return;
    }

    // 2. Nếu không khớp mã vạch/SKU, kiểm tra danh sách kết quả tìm kiếm duy nhất
    if (filteredParts.length === 1) {
      e.preventDefault();
      addPartToCart(filteredParts[0]);
      setSearch("");
      return;
    }

    if (filteredParts.length === 0) {
      e.preventDefault();
      showToast.warning("Không tìm thấy sản phẩm khớp với từ khóa vừa nhập.");
    }
  };

  // C11: xử lý mã quét từ camera
  const handleScannedBarcode = (code: string) => {
    const keyword = String(code || "").trim().toLowerCase();
    if (!keyword) return;
    const cleanKeyword = keyword.replace(/[^a-z0-9]/g, "");
    const stockSourceParts = enablePartsPaging ? parts : inventoryParts;
    const match = stockSourceParts.find((p) => {
      const sku = (p.sku || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      const cleanSku = sku.replace(/[^a-z0-9]/g, "");
      const cleanBarcode = barcode.replace(/[^a-z0-9]/g, "");

      return (
        sku === keyword ||
        barcode === keyword ||
        (cleanKeyword.length >= 2 && (cleanSku === cleanKeyword || cleanBarcode === cleanKeyword)) ||
        (cleanKeyword.length >= 2 && cleanSku.endsWith(cleanKeyword))
      );
    });
    if (match) {
      const stock = getBranchStock(match, currentBranchId);
      const isService = ["dịch vụ", "công thợ"].includes((match.category || "").trim().toLowerCase());
      if (stock > 0 || isService) {
        addPartToCart(match);
        showToast.success(`Đã thêm: ${match.name}`);
      } else {
        showToast.error(`Sản phẩm "${match.name}" (SKU: ${match.sku}) hiện đã HẾT HÀNG trong kho!`);
      }
    } else {
      setSearch(code);
      showToast.warning("Không tìm thấy sản phẩm khớp mã vừa quét.");
    }
  };

  // B7: tạo nhanh khách hàng thành viên rồi liên kết vào đơn
  const handleQuickCreateCustomer = async () => {
    const name = customerSearch.trim();
    if (!name || name === "Khách lẻ" || name === "Người tiêu dùng") {
      showToast.warning("Vui lòng nhập tên khách hàng cần tạo.");
      return;
    }
    try {
      const created: any = await createCustomer.mutateAsync({
        id: `CUS-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        phone: customerPhone.trim() || undefined,
      } as any);
      const newId = created?.id || null;
      setCustomerName(name);
      setSelectedCustomerId(newId);
      setShowCustomerSuggestions(false);
      showToast.success(`Đã tạo khách hàng "${name}".`);
    } catch (err: any) {
      showToast.error(
        `Không tạo được khách hàng: ${err?.message || "lỗi không xác định"}`
      );
    }
  };

  // B5: reset form về trạng thái trống
  const resetSaleForm = () => {
    setCartItems([]);
    setDiscount(0);
    setDiscountType("vnd");
    setPaymentMethod("cash");
    setPaidAmount("full");
    setNote("");
    setCustomerName("");
    setCustomerSearch("");
    setCustomerPhone("");
    setSelectedCustomerId(null);
    setEditingLines({});

    setTransactionType("full");
    setPromisedPaymentDate("");
    setInstallmentProvider("Cửa hàng (Tự quản lý)");
    setInstallmentDownPayment(0);
    setInstallmentMonths(6);
    setInstallmentInterestRate(0);
    setDeliveryMethod("pickup");
    setDeliveryAddress("");
    setDeliveryPhone("");
    setDeliveryNote("");
    setShippingFee(0);
    setTrackingNumber("");
  };

  // B5: giữ đơn hiện tại lại để bán khách khác
  const holdCurrentOrder = () => {
    if (!cartItems.length) {
      showToast.warning("Giỏ hàng đang trống, không có gì để giữ.");
      return;
    }
    const held: HeldOrder = {
      id: `HOLD-${Date.now()}`,
      createdAt: new Date().toISOString(),
      customerName: customerName.trim() || "Người tiêu dùng",
      customerPhone: customerPhone.trim(),
      selectedCustomerId,
      selectedEmployeeId,
      items: cartItems,
      discount,
      discountType,
      paymentMethod,
      note,
      total,
      transactionType,
      promisedPaymentDate,
      installmentProvider,
      installmentDownPayment,
      installmentMonths,
      installmentInterestRate,
      deliveryMethod,
      deliveryAddress,
      deliveryPhone,
      deliveryNote,
      shippingFee,
      trackingNumber,
    };
    setHeldOrders((prev) => [held, ...prev]);
    resetSaleForm();
    setActiveTab("products");
    showToast.success("Đã giữ đơn. Bạn có thể mở lại bất cứ lúc nào.");
  };

  // B5: mở lại đơn đã giữ
  const restoreHeldOrder = (held: HeldOrder) => {
    if (cartItems.length > 0) {
      const ok = window.confirm(
        "Giỏ hàng hiện tại sẽ bị thay thế bằng đơn giữ. Tiếp tục?"
      );
      if (!ok) return;
    }
    setCartItems(held.items);
    setDiscount(held.discount);
    setDiscountType(held.discountType);
    setPaymentMethod(held.paymentMethod || "cash");
    setNote(held.note);
    setCustomerName(held.customerName);
    setCustomerSearch(held.customerName);
    setCustomerPhone(held.customerPhone);
    setSelectedCustomerId(held.selectedCustomerId);
    if (held.selectedEmployeeId !== undefined) {
      setSelectedEmployeeId(held.selectedEmployeeId);
    }
    setPaidAmount("full");
    
    setTransactionType(held.transactionType || "full");
    setPromisedPaymentDate(held.promisedPaymentDate || "");
    setInstallmentProvider(held.installmentProvider || "Cửa hàng (Tự quản lý)");
    setInstallmentDownPayment(held.installmentDownPayment || 0);
    setInstallmentMonths(held.installmentMonths || 6);
    setInstallmentInterestRate(held.installmentInterestRate || 0);
    setDeliveryMethod(held.deliveryMethod || "pickup");
    setDeliveryAddress(held.deliveryAddress || "");
    setDeliveryPhone(held.deliveryPhone || "");
    setDeliveryNote(held.deliveryNote || "");
    setShippingFee(held.shippingFee || 0);
    setTrackingNumber(held.trackingNumber || "");

    setHeldOrders((prev) => prev.filter((h) => h.id !== held.id));
    setActiveTab("cart");

    // Kiểm tồn kho live: kẹp số lượng theo tồn hiện tại (tồn có thể đã đổi khi giữ đơn).
    const liveStockOf = (pid: string) => {
      const p =
        parts.find((x) => x.id === pid) ||
        inventoryParts.find((x) => x.id === pid);
      return p ? getBranchStock(p, currentBranchId) : 0;
    };
    const adjusted: string[] = [];
    const restoredItems = held.items
      .map((it) => {
        if (it.isService) return it;
        const live = liveStockOf(it.partId);
        if (it.quantity > live) {
          adjusted.push(`${it.partName} (còn ${live})`);
          return { ...it, quantity: live, stockSnapshot: live };
        }
        return { ...it, stockSnapshot: live };
      })
      .filter((it) => it.isService || it.quantity > 0);
    setCartItems(restoredItems);

    if (adjusted.length) {
      showToast.warning(
        `Đã điều chỉnh theo tồn kho hiện tại: ${adjusted.join(", ")}.`
      );
    } else {
      showToast.success("Đã mở lại đơn giữ.");
    }
  };

  const removeHeldOrder = (id: string) => {
    setHeldOrders((prev) => prev.filter((h) => h.id !== id));
  };

  const submitSale = async () => {
    if (submitLockRef.current) return; // chặn double-submit khi đang xử lý

    if (!cartItems.length) {
      showToast.warning("Giỏ hàng đang trống.");
      return;
    }

    if (!customerName.trim()) {
      showToast.warning("Vui lòng nhập tên khách hàng.");
      return;
    }

    if (discount < 0) {
      showToast.warning("Giảm giá không được âm.");
      return;
    }
    if (discountType === "percent" && discount > 100) {
      showToast.warning("Giảm giá phần trăm không được lớn hơn 100%.");
      return;
    }
    if (discountType === "vnd" && discount > netSubtotal) {
      showToast.warning("Giảm giá không được lớn hơn tạm tính.");
      return;
    }

    const stockSourceParts = enablePartsPaging ? parts : inventoryParts;

    for (const item of cartItems) {
      const part = stockSourceParts.find((p) => p.id === item.partId);
      const isService = part
        ? ["dịch vụ", "công thợ"].includes((part.category || "").trim().toLowerCase())
        : item.isService;
      if (!isService) {
        const availableStock = part ? getBranchStock(part, currentBranchId) : 0;
        if (item.quantity > availableStock) {
          showToast.warning(`Sản phẩm ${item.partName} không đủ tồn (${availableStock}).`);
          return;
        }
      }
    }

    const actualPaidAmount = splitPayment
      ? splitCash + splitBank
      : paidAmount === "full"
      ? total
      : paidAmount;
    if (actualPaidAmount < 0) {
      showToast.warning("Số tiền khách trả không hợp lệ.");
      return;
    }

    const finalPaidAmount = Math.min(actualPaidAmount, total);
    const remainingAmount = total - finalPaidAmount;

    // Chặn ghi nợ đối với Khách lẻ vô danh
    if (remainingAmount > 0) {
      const isAnon = !selectedCustomerId && (
        !customerName.trim() ||
        customerName === "Khách lẻ" ||
        customerName === "Người tiêu dùng" ||
        !customerPhone.trim()
      );
      if (isAnon) {
        showToast.warning("Không thể ghi nhận nợ cho Khách lẻ. Vui lòng liên kết khách hàng thành viên hoặc nhập đầy đủ tên và số điện thoại.");
        return;
      }
    }

    // Validate delivery
    if (deliveryMethod === "delivery") {
      if (!deliveryAddress.trim()) {
        showToast.warning("Vui lòng nhập địa chỉ giao hàng.");
        return;
      }
    }

    // Dynamic note compilation
    let autoNoteParts: string[] = [];
    if (paymentMethod === "card") {
      autoNoteParts.push("[Quẹt thẻ POS]");
    }
    if (transactionType === "partial") {
      autoNoteParts.push("[Thanh toán 1 phần]");
      if (promisedPaymentDate) {
        autoNoteParts.push(`Hẹn trả nốt ngày: ${promisedPaymentDate}`);
      }
    } else if (transactionType === "installment") {
      autoNoteParts.push(`[Trả góp: ${installmentProvider} | Kỳ hạn: ${installmentMonths} tháng | Lãi suất: ${installmentInterestRate}% | Góp hàng tháng: ${formatCurrency(monthlyPayment)}]`);
    } else if (transactionType === "debt") {
      autoNoteParts.push("[Khách nợ 100%]");
      if (promisedPaymentDate) {
        autoNoteParts.push(`Hẹn ngày trả nợ: ${promisedPaymentDate}`);
      }
    }

    const finalNote = autoNoteParts.length
      ? `${autoNoteParts.join(" - ")}${note.trim() ? ` | Ghi chú: ${note.trim()}` : ""}`
      : note.trim();

    // Delivery COD details nested in customer JSONB
    const deliveryPayload = deliveryMethod === "delivery" ? {
      method: "delivery",
      status: "pending",
      address: deliveryAddress.trim(),
      phone: deliveryPhone.trim() || customerPhone.trim(),
      note: deliveryNote.trim(),
      shippingFee: shippingFee,
      codAmount: total + shippingFee,
      trackingNumber: trackingNumber.trim() || null,
    } : undefined;

    const finalPaymentMethod = paymentMethod === "card" ? "bank" : (paymentMethod || "cash");

    const payload = {
      customer: {
        id: selectedCustomerId || undefined,
        name: customerName.trim(),
        phone: customerPhone.trim() || undefined,
        delivery: deliveryPayload,
      },
      items: cartItems,
      subtotalValue: subtotal,
      discountValue: lineDiscountTotal + discountAmount,
      totalValue: total,
      payment: finalPaymentMethod,
      noteText: finalNote || undefined,
    } as const;

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const sellerEmp = selectableEmployees.find((emp) => emp.id === selectedEmployeeId);
      const soldBy = sellerEmp
        ? {
            id: sellerEmp.id,
            name: sellerEmp.name || "Nhân viên",
          }
        : profile
        ? {
            id: profile.id,
            name: profile.name || profile.full_name || profile.email || "Nhân viên",
          }
        : undefined;

      const result = await finalizeSale({
        items: cartItems,
        discount: discountAmount,
        paymentMethod: finalPaymentMethod,
        customer: payload.customer,
        note: finalNote || undefined,
        paidAmount: finalPaidAmount,
        // Thanh toán tách -> truyền mảng nguồn; đơn 1 nguồn giữ nguyên (v1).
        payments: splitPayment
          ? [
              { source: "cash", amount: splitCash },
              { source: "bank", amount: splitBank },
            ].filter((p) => p.amount > 0)
          : undefined,
        soldBy,
      });

      if (result.ok) {
        setDiscount(0);
        setDiscountType("vnd");
        setPaymentMethod("cash");
        setPaidAmount("full");
        setSplitPayment(false);
        setSplitCash(0);
        setSplitBank(0);
        setNote("");
        setCustomerName("");
        setCustomerSearch("");
        setCustomerPhone("");
        setSelectedCustomerId(null);
        setActiveTab("products");

        setTransactionType("full");
        setPromisedPaymentDate("");
        setInstallmentProvider("Cửa hàng (Tự quản lý)");
        setInstallmentDownPayment(0);
        setInstallmentMonths(6);
        setInstallmentInterestRate(0);
        setDeliveryMethod("pickup");
        setDeliveryAddress("");
        setDeliveryPhone("");
        setDeliveryNote("");
        setShippingFee(0);
        setTrackingNumber("");

        if (autoPrintInvoice) {
          setPrintPayload({
            ...payload,
            saleId: result.saleId,
          });
          setIsPrintModalOpen(true);
        }
        showToast.success("Đã tạo phiếu bán hàng thành công.");
      }
      // Trường hợp lỗi đã được finalizeSale cảnh báo chi tiết.
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDeleteSale = (saleId: string) => {
    if (!canDeleteSale) {
      showToast.warning("Bạn không có quyền xóa phiếu bán hàng.");
      return;
    }

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

  // B6: in lại hóa đơn từ một phiếu đã lưu (dùng đúng ngày của phiếu)
  const reprintSale = (sale: Sale) => {
    setPrintPayload({
      customer: {
        name: sale.customer?.name || "Người tiêu dùng",
        phone: sale.customer?.phone || undefined,
      },
      items: sale.items,
      subtotalValue: Number(sale.subtotal || 0),
      discountValue: Number(sale.discount || 0),
      totalValue: Number(sale.total || 0),
      payment: sale.paymentMethod === "bank" ? "bank" : "cash",
      noteText: (sale as any).note || undefined,
      dateValue: sale.date,
      saleId: sale.id,
    });
    setIsPrintModalOpen(true);
  };

  const historyPageSize = 6;

  const filteredSalesHistory = useMemo(() => {
    const keyword = historyQuery.trim().toLowerCase();
    const normalized = sales.filter((sale) => {
      // #1: Chỉ hiển thị đơn thuộc chi nhánh đang chọn (đơn thiếu branchId coi
      // như thuộc chi nhánh hiện tại để không ẩn nhầm).
      const saleBranch =
        sale.branchId || (sale as any).branchid || (sale as any).branch_id;
      if (saleBranch && saleBranch !== currentBranchId) return false;

      if (!keyword) return true;
      const customerName = (sale.customer?.name || "").toLowerCase();
      const customerPhone = (sale.customer?.phone || "").toLowerCase();
      const saleId = (sale.id || "").toLowerCase();
      const saleCode = ((sale as any).sale_code || "").toLowerCase();
      const cashTxId = (sale.cashTransactionId || (sale as any).cashtransactionid || "").toLowerCase();
      const cashTxCode = getCompactCode(cashTxId);
      return (
        customerName.includes(keyword) ||
        customerPhone.includes(keyword) ||
        saleId.includes(keyword) ||
        saleCode.includes(keyword) ||
        cashTxId.includes(keyword) ||
        cashTxCode.includes(keyword)
      );
    });
    // #4: không cắt cứng 200 — để phân trang (prev/next) duyệt được toàn bộ đơn
    // của chi nhánh; mỗi trang chỉ render historyPageSize dòng nên DOM vẫn nhẹ.
    return normalized;
  }, [sales, historyQuery, currentBranchId]);

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
    header: "sticky md:top-[53px] top-0 z-20 bg-white/90 dark:bg-[#1e1e2d]/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-4 mb-6",
    leftPanel: "md:col-span-7 lg:col-span-8 space-y-4",
    rightPanel: "md:col-span-5 lg:col-span-4 bg-white dark:bg-[#1e1e2d] rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-5 space-y-4 shadow-sm md:sticky md:top-[100px] h-fit",
    panelHead: "mb-4 flex flex-col sm:flex-row items-center justify-between gap-3",
    stockBadge: "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold",
    addBtn: "inline-flex items-center justify-center gap-1.5 h-9 w-full sm:w-auto px-4 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-bold transition border border-emerald-200 dark:border-emerald-500/30",
    syncBtn: "h-11 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e1e2d] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm flex items-center justify-center font-bold",
};

  return (
    <div className={`${ui.pageBg} sales-screen`}>
      <div className={ui.header}>
        <div className="max-w-[1600px] mx-auto w-full flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("products")}
              className={`flex-1 sm:flex-initial px-2 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeTab === "products"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Sản phẩm
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-bold ${
                activeTab === "products"
                  ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}>
                {filteredParts.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("cart")}
              className={`flex-1 sm:flex-initial px-2 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeTab === "cart"
                  ? "bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Giỏ hàng
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-bold ${
                activeTab === "cart"
                  ? "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}>
                {cartItems.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex-1 sm:flex-initial px-2 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeTab === "history"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Lịch sử bán hàng</span>
              <span className="inline sm:hidden">Lịch sử</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("held")}
              className={`flex-1 sm:flex-initial px-2 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                activeTab === "held"
                  ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Tạm giữ
              {heldOrders.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {heldOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="relative grid max-w-[1600px] mx-auto px-4 grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 overflow-hidden">
        <section
          className={`${ui.leftPanel} transition-all duration-300 ease-out md:translate-x-0 md:opacity-100 md:pointer-events-auto md:static ${
            activeTab === "products" || activeTab === "held"
              ? "translate-x-0 opacity-100"
              : "absolute inset-0 -translate-x-full opacity-0 pointer-events-none md:translate-x-0 md:opacity-100 md:pointer-events-auto md:static"
          }`}
        >
          {activeTab !== "held" ? (
            <>
              <div className={ui.panelHead}>
                <div className="flex items-center gap-2 w-full">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={searchInputRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      aria-label="Tìm sản phẩm theo tên, SKU hoặc mã vạch (F2)"
                      placeholder="Tìm tên, SKU, mã vạch (Enter, F2)..."
                      className="w-full pl-9 pr-3 h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none transition focus:border-emerald-400 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    />
                  </div>

                  {/* Nút chuyển chế độ hiển thị Lưới / Danh sách */}
                  <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        viewMode === "grid"
                          ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-200 dark:hover:text-slate-200"
                      }`}
                      title="Hiển thị dạng lưới"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        viewMode === "list"
                          ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-200 dark:hover:text-slate-200"
                      }`}
                      title="Hiển thị dạng danh sách"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="w-11 h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500/50 inline-flex items-center justify-center shrink-0 transition active:scale-95"
                    title="Quét mã bằng camera"
                    aria-label="Quét mã bằng camera"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={syncInventory}
                    disabled={syncingInventory}
                    className="w-11 h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500/50 disabled:opacity-50 inline-flex items-center justify-center shrink-0 transition active:scale-95"
                    title="Đồng bộ tồn kho"
                    aria-label="Đồng bộ tồn kho"
                  >
                    <RefreshCcw className={`w-4 h-4 ${syncingInventory ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="px-2 py-3 sm:p-5">
                {viewMode === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
                    {pagedParts.map((part) => {
                      const stock = getBranchStock(part, currentBranchId);
                      const price = getBranchRetailPrice(part, currentBranchId);
                      const cartItem = cartItems.find((item) => item.partId === part.id);
                      const warrantyText = part.warrantyPeriod 
                        ? (/^\d+$/.test(String(part.warrantyPeriod).trim()) ? `${part.warrantyPeriod} tháng` : part.warrantyPeriod)
                        : "";
                      
                      return (
                        <button
                          type="button"
                          key={part.id}
                          onClick={() => addPartToCart(part)}
                          className={`group relative text-left rounded-2xl border p-2.5 sm:p-3 transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 flex flex-col h-full ${
                            cartItem
                              ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/10 ring-1 ring-emerald-400/60 shadow-sm"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-md"
                          }`}
                        >
                          {cartItem && (
                            <span className="absolute -top-2 -right-2 z-10 min-w-[22px] h-[22px] px-1.5 inline-flex items-center justify-center rounded-full bg-emerald-600 text-white text-[11px] font-black shadow-md ring-2 ring-white dark:ring-slate-900">
                              {cartItem.quantity}
                            </span>
                          )}
                          <div className="min-w-0 mb-auto w-full">
                            {part.imageUrl ? (
                              <div className="w-full h-16 sm:h-20 mb-2 rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
                                <img
                                  src={part.imageUrl}
                                  alt={part.name}
                                  loading="lazy"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const el = e.currentTarget;
                                    el.style.display = "none";
                                    const ph = el.nextElementSibling as HTMLElement | null;
                                    if (ph) ph.style.display = "flex";
                                  }}
                                />
                                <div
                                  className="w-full h-full items-center justify-center text-slate-400 dark:text-slate-600"
                                  style={{ display: "none" }}
                                >
                                  <Package className="w-6 h-6" />
                                </div>
                              </div>
                            ) : null}
                            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug break-words mb-1 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {part.name}
                            </div>
                            <div className="text-[11px] font-medium text-slate-400 truncate">{part.sku}</div>
                          </div>

                          <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800 w-full space-y-1.5">
                            <div className="flex items-end justify-between gap-1">
                              <div className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-none">
                                {formatCurrency(price)}
                              </div>
                              <span className={`${ui.stockBadge} ${getStockBadgeClass(stock)} shrink-0`}>{stock}</span>
                            </div>
                            {warrantyText ? (
                              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate">
                                BH: {warrantyText}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Chế độ danh sách (List View) cực kỳ tối ưu diện tích */
                  <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/40">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                            <th className="px-4 py-3">Sản phẩm</th>
                            <th className="px-3 py-3">Bảo hành</th>
                            <th className="px-3 py-3 text-center">Tồn kho</th>
                            <th className="px-3 py-3 text-right">Đơn giá</th>
                            <th className="px-4 py-3 text-center">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-slate-800">
                          {pagedParts.map((part) => {
                            const stock = getBranchStock(part, currentBranchId);
                            const price = getBranchRetailPrice(part, currentBranchId);
                            const cartItem = cartItems.find((item) => item.partId === part.id);
                            const warrantyText = part.warrantyPeriod 
                              ? (/^\d+$/.test(String(part.warrantyPeriod).trim()) ? `${part.warrantyPeriod} tháng` : part.warrantyPeriod)
                              : "Không";

                            return (
                              <tr
                                key={part.id}
                                className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${
                                  cartItem ? "bg-emerald-500/5 dark:bg-emerald-500/5" : ""
                                }`}
                              >
                                <td className="px-4 py-2.5">
                                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{part.name}</div>
                                  <div className="text-[11px] text-slate-400 font-medium mt-0.5">{part.sku}</div>
                                </td>
                                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 font-medium">{warrantyText}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`${ui.stockBadge} ${getStockBadgeClass(stock)}`}>{stock}</span>
                                </td>
                                <td className="px-3 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                                  {formatCurrency(price)}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {cartItem ? (
                                    <div className="inline-flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => updateQty(part.id, cartItem.quantity - 1)}
                                        className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold hover:bg-slate-200 transition"
                                      >
                                        -
                                      </button>
                                      <span className="text-xs font-black min-w-[14px]">{cartItem.quantity}</span>
                                      <button
                                        type="button"
                                        onClick={() => updateQty(part.id, cartItem.quantity + 1)}
                                        className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-850 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold hover:bg-slate-200 transition"
                                      >
                                        +
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => addPartToCart(part)}
                                      className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 font-bold transition-all text-xs"
                                    >
                                      + Thêm
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

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
                    <option value={40}>40 / trang</option>
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
            </>
          ) : (
            /* Bố cục danh sách đơn đang tạm giữ */
            <div className="space-y-4 px-2 py-3 sm:p-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
                <h2 className="text-base font-bold text-slate-200 dark:text-white">
                  Danh sách đơn hàng đang tạm giữ
                </h2>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                  {heldOrders.length} đơn chờ
                </span>
              </div>

              {heldOrders.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {heldOrders.map((held) => (
                    <div
                      key={held.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 p-4 hover:border-amber-400 dark:hover:border-amber-500/50 hover:shadow-md transition-all flex flex-col h-full"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {held.customerName || "Người tiêu dùng"}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {held.customerPhone || "Không có SĐT"}
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                          {new Date(held.createdAt).toLocaleTimeString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="mb-4 border-t border-b border-dashed border-slate-100 dark:border-slate-800 py-3 flex-1">
                        <div className="text-xs text-slate-500 font-medium mb-2">
                          Chi tiết sản phẩm ({held.items.length} món):
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {held.items.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="truncate text-slate-700 dark:text-slate-400 max-w-[70%]">
                                {it.quantity} × {it.partName}
                              </span>
                              <span className="font-bold text-slate-900 dark:text-slate-200">
                                {formatCurrency(it.sellingPrice * it.quantity - (it.discount || 0))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 pt-1">
                        <div>
                          <div className="text-[11px] text-slate-400">Tổng tiền</div>
                          <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(held.total)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const ok = window.confirm("Bạn muốn xóa bỏ đơn tạm giữ này?");
                              if (ok) removeHeldOrder(held.id);
                            }}
                            className="px-3 h-9 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10 text-xs font-bold transition-all"
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => restoreHeldOrder(held)}
                            className="px-4 h-9 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold transition-all shadow-md shadow-orange-500/10 active:scale-95"
                          >
                            Mở lại
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Save className="w-8 h-8 text-slate-400" />
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-medium">
                    Không có đơn hàng nào đang tạm giữ.
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section
          className={`${ui.rightPanel} transition-all duration-300 ease-out md:translate-x-0 md:opacity-100 md:pointer-events-auto md:static ${
            activeTab !== "products"
              ? "translate-x-0 opacity-100"
              : "absolute inset-0 translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          {(activeTab === "products" || activeTab === "cart") && (
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/10 p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700/70 dark:text-emerald-400/70 font-bold mb-1">
                    Đơn hàng hiện tại
                  </p>
                  <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
                    <ShoppingCart className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    Thông tin thanh toán
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Sản phẩm</div>
                    <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {cartItems.length}
                    </div>
                  </div>
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ sản phẩm trong giỏ hàng?")) {
                          resetSaleForm();
                        }
                      }}
                      className="p-2 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20 transition duration-200"
                      title="Xóa toàn bộ giỏ hàng"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/10 p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-blue-700/70 dark:text-blue-400/70 font-bold mb-1">
                    Tra cứu giao dịch
                  </p>
                  <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-base">
                    <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Lịch sử bán hàng
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Tổng hóa đơn</div>
                  <div className="text-xl font-black text-blue-600 dark:text-blue-400">
                    {sales.length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === "products" || activeTab === "cart") && (
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
                    {/* IMEI của đúng những chiếc đang bán — người bán phải đối chiếu
                        được với máy trên tay trước khi thu tiền. */}
                    {item.unitImeis?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.unitImeis.map((imei, idx) => (
                          <span
                            key={item.unitIds?.[idx] || `${imei}-${idx}`}
                            className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                          >
                            📱 {imei || "chưa có IMEI"}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) => {
                        const v = Math.floor(Number(e.target.value) || 0);
                        if (v >= 1) updateQty(item.partId, v);
                      }}
                      aria-label={`Số lượng ${item.partName}`}
                      className="w-12 text-center text-sm font-bold text-slate-900 dark:text-white bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => updateQty(item.partId, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md transition shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-right">
                    {item.discount ? (
                      <div className="text-[11px] text-slate-400 line-through">
                        {formatCurrency(item.sellingPrice * item.quantity)}
                      </div>
                    ) : null}
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(item.sellingPrice * item.quantity - (item.discount || 0))}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingLines((prev) => ({
                          ...prev,
                          [item.partId]: !prev[item.partId],
                        }))
                      }
                      className="text-[11px] font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition"
                    >
                      {editingLines[item.partId] ? "Đóng" : "Sửa giá"}
                    </button>
                  </div>
                </div>

                {editingLines[item.partId] && (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-dashed border-slate-200 dark:border-slate-700 pt-3">
                    <label className="block">
                      <span className="text-[11px] text-slate-500">Đơn giá</span>
                      <FormattedNumberInput
                        value={item.sellingPrice}
                        onValue={(v) => updateLinePrice(item.partId, Math.max(0, Math.round(v)))}
                        className="mt-0.5 w-full px-2 h-9 rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 text-right text-sm font-semibold"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] text-slate-500">Giảm giá (đ)</span>
                      <FormattedNumberInput
                        value={item.discount || 0}
                        onValue={(v) => updateLineDiscount(item.partId, Math.max(0, Math.round(v)))}
                        className="mt-0.5 w-full px-2 h-9 rounded-lg border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 text-right text-sm font-semibold"
                      />
                    </label>
                  </div>
                )}
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
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Khách hàng &amp; Nhân viên
                </div>
                {selectedCustomerId && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5 rounded font-bold">
                      Thành viên
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(null);
                        setCustomerName("");
                        setCustomerSearch("");
                        setCustomerPhone("");
                      }}
                      className="text-[11px] text-rose-500 hover:text-rose-600 font-bold hover:underline transition"
                    >
                      Đặt lại
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 z-10" />
                <input
                  ref={customerInputRef}
                  value={customerSearch}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowCustomerSuggestions(false), 120);
                  }}
                  onChange={(e) => {
                    const next = e.target.value;
                    setCustomerSearch(next);
                    setCustomerName(next);
                    setSelectedCustomerId(null); // Clear ID when typing
                    setShowCustomerSuggestions(true);
                  }}
                  placeholder="Tìm / Nhập tên khách (Để trống: Người tiêu dùng)"
                  className="w-full pl-9 pr-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60"
                />
                {showCustomerSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-40 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xl py-1 divide-y divide-slate-100 dark:divide-slate-800">
                    {customerSuggestions.map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onMouseDown={() => {
                          setCustomerName(c.name);
                          setCustomerSearch(c.name);
                          setCustomerPhone(c.phone || "");
                          setSelectedCustomerId(c.id);
                          setShowCustomerSuggestions(false);
                        }}
                        className="w-full px-4 py-2.5 text-left hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                            {c.name}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                            {c.phone || "Không có SĐT"}
                          </div>
                        </div>
                        {c.phone && (
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold shrink-0">
                            Khách hàng
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-500">Số điện thoại</span>
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    inputMode="tel"
                    aria-label="Số điện thoại khách hàng"
                    className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Nhân viên bán</span>
                  <select
                    value={selectedEmployeeId || ""}
                    onChange={(e) => setSelectedEmployeeId(e.target.value || null)}
                    aria-label="Chọn nhân viên ghi nhận doanh số"
                    className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60 text-sm"
                  >
                    {selectableEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.position || "Nhân viên"})
                      </option>
                    ))}
                    {!selectableEmployees.some((emp) => emp.id === selectedEmployeeId) && profile && (
                      <option value={profile.id}>
                        {profile.name || profile.full_name || profile.email} (Hiện tại)
                      </option>
                    )}
                  </select>
                </label>
              </div>
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
              {lineDiscountTotal > 0 && (
                <div className="flex items-center justify-between text-sm text-rose-500">
                  <span>Giảm giá theo dòng</span>
                  <span className="font-semibold">-{formatCurrency(lineDiscountTotal)}</span>
                </div>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <span className="text-xs text-slate-500 font-medium">Giảm giá</span>
                  <FormattedNumberInput
                    value={discount}
                    onValue={(v) => setDiscount(Math.max(0, Math.round(v)))}
                    className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 text-right font-bold focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60"
                  />
                </div>
                <div className="w-16">
                  <span className="text-xs text-transparent select-none">Đơn vị</span>
                  <select
                    aria-label="Đơn vị giảm giá"
                    value={discountType}
                    onChange={(e) => {
                      setDiscountType(e.target.value as "vnd" | "percent");
                      setDiscount(0); // Reset discount when switching type
                    }}
                    className="mt-1 w-full h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 text-sm px-2 text-center"
                  >
                    <option value="vnd">đ</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm text-rose-500">
                  <span>Giảm giá {discountType === "percent" ? `(${discount}%)` : ""}</span>
                  <span className="font-semibold">
                    -{formatCurrency(discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-200/70 dark:border-emerald-500/25 px-3.5 py-2.5 shadow-inner">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-200">Thành tiền</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-100">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* 💳 PHƯƠNG THỨC THANH TOÁN (Mockup Layout) */}
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#1a1a27] shadow-sm p-4 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Phương thức thanh toán
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("cash");
                    setSplitPayment(false);
                  }}
                  className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "cash" && !splitPayment
                      ? "bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30"
                      : "bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  <span className="text-[10px] font-bold tracking-wide uppercase">Tiền mặt</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("bank");
                    setSplitPayment(false);
                  }}
                  className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "bank" && !splitPayment
                      ? "bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30"
                      : "bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span className="text-[10px] font-bold tracking-wide uppercase">Chuyển khoản</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("card");
                    setSplitPayment(false);
                  }}
                  className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "card" && !splitPayment
                      ? "bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30"
                      : "bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <CreditCard className="w-5 h-5 opacity-80" />
                  <span className="text-[10px] font-bold tracking-wide uppercase">Quẹt thẻ</span>
                </button>
              </div>

              {/* Bộ tính tiền thừa trả khách (Tiền mặt) */}
              {paymentMethod === "cash" && !splitPayment && (
                <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>💵 Tiền khách đưa:</span>
                    <span className="text-[11px] text-slate-400 font-normal">Tính tiền thừa</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FormattedNumberInput
                      value={Number(cashGiven || 0)}
                      onValue={(v) => setCashGiven(v > 0 ? Math.round(v) : "")}
                      placeholder="0"
                      ariaLabel="Nhập số tiền khách đưa"
                      className="flex-1 px-3 h-10 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-right font-bold text-sm text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setCashGiven(total)}
                      className="px-3 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shrink-0"
                    >
                      Đủ tiền
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[100000, 200000, 500000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashGiven(preset)}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:border-emerald-500 transition-colors"
                      >
                        {formatCurrency(preset)}
                      </button>
                    ))}
                  </div>
                  {Number(cashGiven) > total && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Tiền thừa trả khách:</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(Number(cashGiven) - total)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={splitPayment}
                  onChange={(e) => {
                    setSplitPayment(e.target.checked);
                    if (e.target.checked) {
                      setPaymentMethod(null);
                      setSplitCash(total);
                      setSplitBank(0);
                    } else {
                      setPaymentMethod("cash");
                    }
                  }}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Thanh toán tách (tiền mặt + chuyển khoản)
              </label>

              {/* Tách nguồn UI */}
              {splitPayment && (
                <div className="space-y-3 pt-1">
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-400">Tiền mặt</span>
                    <FormattedNumberInput
                      value={splitCash}
                      onValue={(v) => setSplitCash(Math.max(0, Math.round(v)))}
                      className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-right"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-400">Chuyển khoản</span>
                    <FormattedNumberInput
                      value={splitBank}
                      onValue={(v) => setSplitBank(Math.max(0, Math.round(v)))}
                      className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-right"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setSplitBank(Math.max(0, total - splitCash))}
                    className="h-8 px-3 rounded-lg text-xs font-bold border border-slate-300/80 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-500"
                  >
                    CK phần còn lại
                  </button>
                  <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Tổng thu:</span>
                    <span className="text-slate-800 dark:text-slate-100">
                      {formatCurrency(splitCash + splitBank)}
                    </span>
                  </div>
                  {total - (splitCash + splitBank) > 0 && (
                    <div className="text-xs font-semibold text-rose-500 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                      Ghi nhận khách nợ: {formatCurrency(total - (splitCash + splitBank))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 🎛️ HÌNH THỨC THANH TOÁN (Visible only when paymentMethod is selected or splitPayment is active) */}
            {(paymentMethod !== null || splitPayment) && (
              <>
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#1a1a27] shadow-sm p-4 space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Hình thức thanh toán
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType("full");
                      setPaidAmount("full");
                    }}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      transactionType === "full"
                        ? "bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30"
                        : "bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span className="text-[9px] font-bold uppercase">Toàn bộ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType("partial");
                      const half = Math.round(total / 2);
                      setPaidAmount(half);
                    }}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      transactionType === "partial"
                        ? "bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30"
                        : "bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                    <span className="text-[9px] font-bold uppercase">Trả 1 phần</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType("installment");
                      const downPay = Math.round(total * 0.3);
                      setInstallmentDownPayment(downPay);
                      setPaidAmount(downPay);
                      setIsInstallmentModalOpen(true);
                    }}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      transactionType === "installment"
                        ? "bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30"
                        : "bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="text-[9px] font-bold uppercase">Trả góp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTransactionType("debt");
                      setPaidAmount(0);
                    }}
                    className={`py-2 px-1 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                      transactionType === "debt"
                        ? "bg-blue-600/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-blue-500/30"
                        : "bg-slate-50/50 dark:bg-slate-900/50 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span className="text-[9px] font-bold uppercase">Ghi nợ</span>
                  </button>
                </div>

                {/* 1. Trả đủ details */}
                {transactionType === "full" && !splitPayment && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    Khách sẽ thanh toán toàn bộ <strong>{formatCurrency(total)}</strong>.
                  </div>
                )}

                {/* 2. Trả 1 phần details */}
                {transactionType === "partial" && !splitPayment && (
                  <div className="space-y-3 pt-1">
                    <label className="block">
                      <span className="text-[11px] font-medium text-slate-400">Số tiền trả trước</span>
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={paidAmount === "full" ? total : paidAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPaidAmount(val === "" ? "full" : Number(val));
                        }}
                        className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-slate-400">Hẹn thanh toán nốt ngày</span>
                      <input
                        type="date"
                        value={promisedPaymentDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setPromisedPaymentDate(e.target.value)}
                        className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                      />
                    </label>
                    <div className="text-xs font-semibold text-rose-500 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                      Ghi nhận khách nợ: {formatCurrency(total - (paidAmount === "full" ? total : paidAmount))}
                    </div>
                  </div>
                )}

                {/* 3. Trả góp details */}
                {transactionType === "installment" && (
                  <div className="space-y-2 pt-1">
                    <div className="bg-purple-500/5 border border-purple-500/10 p-3 rounded-xl space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Đơn vị:</span>
                        <span className="font-bold text-purple-400">{installmentProvider}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Trả trước:</span>
                        <span className="font-bold text-emerald-400">
                          {formatCurrency(splitPayment ? splitCash + splitBank : (paidAmount === "full" ? total : paidAmount))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kỳ hạn:</span>
                        <span className="font-bold text-slate-200">{installmentMonths} tháng</span>
                      </div>
                      <div className="flex justify-between border-t border-purple-500/10 pt-1.5 font-bold text-sm text-purple-400">
                        <span>Góp mỗi tháng:</span>
                        <span>
                          {formatCurrency(
                            Math.round(
                              (total - (splitPayment ? splitCash + splitBank : (paidAmount === "full" ? total : paidAmount))) /
                                installmentMonths
                            )
                          )}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsInstallmentModalOpen(true)}
                      className="w-full h-9 rounded-lg border border-purple-500/30 text-purple-600 hover:bg-purple-500/5 text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Thiết lập Trả góp
                    </button>
                  </div>
                )}

                {/* 4. Ghi nợ details */}
                {transactionType === "debt" && (
                  <div className="space-y-3 pt-1">
                    <label className="block">
                      <span className="text-[11px] font-medium text-slate-400">Hẹn ngày thanh toán</span>
                      <input
                        type="date"
                        value={promisedPaymentDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setPromisedPaymentDate(e.target.value)}
                        className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                      />
                    </label>
                    <div className="text-xs font-semibold text-rose-500 bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                      Ghi nhận khách nợ: {formatCurrency(total)}
                    </div>
                  </div>
                )}
              </div>

              {/* 🚚 GIAO HÀNG (Mockup Layout) */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#1a1a27] shadow-sm p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Truck className="w-4 h-4" />
                Giao hàng
              </div>

              <div className="flex gap-6 mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="pickup"
                    checked={deliveryMethod === "pickup"}
                    onChange={() => setDeliveryMethod("pickup")}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">🏪 Tự lấy</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="delivery"
                    checked={deliveryMethod === "delivery"}
                    onChange={() => setDeliveryMethod("delivery")}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">🚚 Giao hàng COD</span>
                </label>
              </div>

              {deliveryMethod === "delivery" && (
                <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-400">Địa chỉ giao hàng <span className="text-rose-500">*</span></span>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Nhập địa chỉ giao hàng"
                      className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-400">SĐT nhận hàng</span>
                    <input
                      type="tel"
                      value={deliveryPhone}
                      onChange={(e) => setDeliveryPhone(e.target.value)}
                      placeholder="Số điện thoại"
                      className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-400">Phí ship</span>
                    <input
                      type="number"
                      min={0}
                      value={shippingFee || ""}
                      onChange={(e) => setShippingFee(Math.max(0, Number(e.target.value) || 0))}
                      placeholder="0"
                      className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm text-right"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-400">Ghi chú giao hàng</span>
                    <textarea
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder="Ghi chú giao hàng..."
                      rows={2}
                      className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm resize-none outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-400">Mã bưu phẩm (GHN, GHTK...)</span>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Mã vận đơn..."
                      className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-mono"
                    />
                  </label>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-slate-400">COD cần thu:</span>
                    <span className="text-base font-bold text-orange-500">
                      {formatCurrency(total + shippingFee)}
                    </span>
                  </div>
                </div>
              )}
            </div>
              </>
            )}

            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-[#1a1a27] shadow-sm p-4 space-y-3">
              {showNoteInput ? (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ghi chú</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNote("");
                        setShowNoteInput(false);
                      }}
                      className="text-xs text-rose-500 hover:text-rose-600 font-medium transition"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="Nhập ghi chú cho đơn hàng..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300/80 dark:border-slate-600 bg-white/95 dark:bg-slate-900 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/60 text-xs outline-none transition"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowNoteInput(true)}
                    className="text-xs font-semibold text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5 active:scale-95"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    Thêm ghi chú đơn hàng
                  </button>
                </div>
              )}

              <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoPrintInvoice}
                    onChange={(e) => setAutoPrintInvoice(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
                  />
                  In hóa đơn nhanh sau khi xác nhận
                </label>
              </div>
            </div>

            {/* CTA sticky đáy panel (desktop): Thành tiền + Xuất bán luôn trong tầm mắt, không phải cuộn */}
            <div className="xl:sticky xl:bottom-0 xl:z-10 -mx-4 md:-mx-5 px-4 md:px-5 pt-3 pb-1 space-y-2.5 xl:bg-white/95 xl:dark:bg-[#1e1e2d]/95 xl:backdrop-blur-md xl:border-t xl:border-slate-200 xl:dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  Thành tiền
                </span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(total)}
                </span>
              </div>
              <button
                onClick={submitSale}
                disabled={isSubmitting || !cartItems.length}
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-emerald-700 text-white text-base font-bold shadow-[0_16px_30px_-18px_rgba(16,185,129,0.9)] hover:shadow-[0_18px_35px_-18px_rgba(16,185,129,1)] transition disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none inline-flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCcw className="w-5 h-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <ReceiptText className="w-5 h-5" />
                    Xuất bán
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrintPayload({
                      customer: {
                        name: customerName.trim() || "Người tiêu dùng",
                        phone: customerPhone.trim() || undefined,
                      },
                      items: cartItems,
                      subtotalValue: subtotal,
                      discountValue: lineDiscountTotal + discountAmount,
                      totalValue: total,
                      payment: paymentMethod === "card" ? "bank" : (paymentMethod || "cash"),
                      noteText: note.trim() || undefined,
                      saleId: "DRAFT",
                    });
                    setIsPrintModalOpen(true);
                  }}
                  disabled={!cartItems.length}
                  className="h-10 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  In tạm tính
                </button>

                <button
                  type="button"
                  onClick={holdCurrentOrder}
                  disabled={!cartItems.length}
                  className="h-10 rounded-xl border border-amber-300 hover:border-amber-400 dark:border-amber-600/50 text-amber-600 dark:text-amber-400 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-500/10 transition flex items-center justify-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Tạm giữ đơn
                </button>
              </div>
            </div>
          </div>
          </>
          )}

          {activeTab === "history" && (
          <div className="space-y-2">

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
              {pagedSalesHistory.map((sale) => {
                const isExpanded = expandedSaleId === sale.id;
                return (
                <div key={sale.id} className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 bg-white/70 dark:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {sale.customer.name || "Người tiêu dùng"}
                      </div>
                      <div className="text-slate-500 truncate">{(sale as any).sale_code || sale.id}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="text-emerald-600 font-semibold whitespace-nowrap">
                        {formatCurrency(sale.total)}
                      </div>
                      <button
                        type="button"
                        onClick={() => reprintSale(sale)}
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="In lại hóa đơn"
                        aria-label="In lại hóa đơn"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>
                      {canDeleteSale && (
                        <button
                          type="button"
                          onClick={() => setReturnSale(sale)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
                          title="Đổi/Trả hàng"
                          aria-label="Đổi/Trả hàng"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDeleteSale && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSale(sale.id)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                          title="Xóa phiếu bán hàng"
                          aria-label="Xóa phiếu bán hàng"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedSaleId(isExpanded ? null : sale.id)}
                    className="mt-1 w-full text-slate-500 flex items-center justify-between gap-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                  >
                    <span>{new Date(sale.date).toLocaleString("vi-VN")}</span>
                    <span className="inline-flex items-center gap-1">
                      {sale.items.length} sản phẩm
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="mt-2 border-t border-dashed border-slate-200 dark:border-slate-700 pt-2 space-y-1">
                      {sale.items.map((it, idx) => (
                        <div key={`${sale.id}-${it.partId}-${idx}`} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                            {it.quantity} × {it.partName}
                          </span>
                          <span className="shrink-0 font-medium text-slate-700 dark:text-slate-200">
                            {formatCurrency(it.sellingPrice * it.quantity - (it.discount || 0))}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 mt-1">
                        <span className="text-slate-500">
                          {(sale.paymentMethod as any) === "bank" ? "Chuyển khoản" : (sale.paymentMethod as any) === "mixed" ? "Hỗn hợp" : "Tiền mặt"}
                        </span>
                        <span className="text-slate-500">
                          Người bán: <span className="font-semibold text-slate-700 dark:text-slate-300">{sale.userName}</span>
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(sale.total)}
                        </span>
                      </div>
                      
                      {(sale as any).note && (
                        <div className="mt-1 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                          <span className="font-semibold text-slate-600 dark:text-slate-400">Ghi chú:</span> {(sale as any).note}
                        </div>
                      )}

                      {sale.customer && (sale.customer as any).delivery && (
                        <div className="mt-1 text-[11px] text-slate-500 bg-orange-500/5 p-2 rounded border border-orange-500/10 space-y-0.5">
                          <div className="font-bold text-orange-500 flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Giao hàng COD
                          </div>
                          <div className="text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">Địa chỉ:</span> {(sale.customer as any).delivery.address}
                          </div>
                          {(sale.customer as any).delivery.phone && (
                            <div className="text-slate-600 dark:text-slate-300">
                              <span className="font-semibold">SĐT nhận:</span> {(sale.customer as any).delivery.phone}
                            </div>
                          )}
                          {Number((sale.customer as any).delivery.shippingFee || 0) > 0 && (
                            <div className="text-slate-600 dark:text-slate-300">
                              <span className="font-semibold">Phí ship:</span> {formatCurrency((sale.customer as any).delivery.shippingFee)} (COD: {formatCurrency((sale.customer as any).delivery.codAmount)})
                            </div>
                          )}
                          {(sale.customer as any).delivery.trackingNumber && (
                            <div className="text-slate-600 dark:text-slate-300 font-mono">
                              <span className="font-semibold">Mã vận đơn:</span> {(sale.customer as any).delivery.trackingNumber}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })}

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

      {activeTab === "products" && cartItems.length > 0 && (
        <div
          className="md:hidden fixed left-3 right-3 bottom-20 z-[9999]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            onClick={() => {
              if (!cartItems.length) return;
              setActiveTab("cart");
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

      {activeTab === "cart" &&
        cartItems.length > 0 && (
        <div
          className="md:hidden fixed left-3 right-3 bottom-20 z-[9999]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            onClick={submitSale}
            disabled={isSubmitting}
            className="w-full rounded-2xl px-4 py-3 transition bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {isSubmitting ? (
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <ReceiptText className="w-4 h-4" />
                )}
                <span className="text-sm font-semibold">
                  {isSubmitting ? "Đang xử lý..." : "Xuất bán"}
                </span>
              </span>
              <span className="text-sm font-bold">{formatCurrency(total)}</span>
            </span>
          </button>
        </div>
      )}

      <BarcodeScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScannedBarcode}
        title="Quét mã sản phẩm"
      />

      <PrintSalesPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        printPayload={printPayload}
        storeSettings={storeSettings}
        onPrint={() => {
          if (printPayload) {
            printInvoice(printPayload);
            setIsPrintModalOpen(false);
          }
        }}
      />
      {returnSale && (
        <ReturnSaleModal
          sale={returnSale}
          onClose={() => setReturnSale(null)}
        />
      )}

      {imeiPickerPart && (
        <ImeiPickerModal
          part={imeiPickerPart}
          branchId={currentBranchId}
          preselectedUnitIds={
            cartItems.find((i) => i.partId === imeiPickerPart.id)?.unitIds || []
          }
          onClose={() => setImeiPickerPart(null)}
          onConfirm={(units) => addUnitsToCart(imeiPickerPart, units)}
        />
      )}

      {/* 🧾 THIẾT LẬP TRẢ GÓP MODAL */}
      {isInstallmentModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-[#1e1e2d] text-white rounded-3xl border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-purple-600 bg-gradient-to-r from-purple-700 to-indigo-700 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-100" />
                <h3 className="text-base font-bold text-white">Thiết lập Trả góp</h3>
              </div>
              <span className="text-xs bg-purple-800/60 px-3 py-1 rounded-full font-bold text-purple-100">
                Tổng đơn: {formatCurrency(total)}
              </span>
            </div>

            {/* Content */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Loan Info */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold border-b border-slate-700 pb-2 text-slate-300">
                  1. Thông tin khoản vay
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Đơn vị trả góp
                  </label>
                  <select
                    value={installmentProvider}
                    onChange={(e) => setInstallmentProvider(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-700 bg-[#151521] focus:border-purple-500 text-sm outline-none"
                  >
                    <option value="Cửa hàng (Tự quản lý)">Cửa hàng (Tự quản lý)</option>
                    <option value="Home Credit">Home Credit</option>
                    <option value="FE Credit">FE Credit</option>
                    <option value="HD Saison">HD Saison</option>
                    <option value="Mcredit">Mcredit</option>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Cửa hàng tự theo dõi và thu tiền định kỳ của khách.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Tiền đặt cọc / Trả trước
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      value={installmentDownPayment || ""}
                      onChange={(e) => setInstallmentDownPayment(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full h-12 pl-3 pr-12 rounded-xl border border-slate-700 bg-[#151521] text-emerald-400 text-xl font-bold focus:border-purple-500 outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">đ</span>
                  </div>
                  {/* Percentage quick buttons */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[10, 20, 30, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setInstallmentDownPayment(Math.round(total * pct / 100))}
                        className={`py-1.5 rounded-lg border text-xs font-bold transition-all ${
                          installmentDownPayment === Math.round(total * pct / 100)
                            ? "bg-purple-600/10 border-purple-500 text-purple-400"
                            : "bg-[#151521]/40 border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Chọn kỳ hạn (tháng)
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 6, 9, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setInstallmentMonths(m)}
                        className={`py-2 rounded-lg border text-xs font-bold transition-all ${
                          installmentMonths === m
                            ? "bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/10"
                            : "bg-[#151521]/40 border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      SỐ KỲ KHÁC
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={installmentMonths || ""}
                      onChange={(e) => setInstallmentMonths(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full h-11 px-3 rounded-xl border border-slate-700 bg-[#151521] focus:border-purple-500 text-sm outline-none text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      LÃI SUẤT (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={installmentInterestRate || ""}
                      onChange={(e) => setInstallmentInterestRate(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full h-11 px-3 rounded-xl border border-slate-700 bg-[#151521] focus:border-purple-500 text-sm outline-none text-center"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic text-center">
                  * Lãi suất 0% nếu không nhập
                </p>
              </div>

              {/* Right Column: Calculations & Schedule */}
              <div className="space-y-4 flex flex-col h-full">
                <h4 className="text-sm font-bold border-b border-slate-700 pb-2 text-slate-300">
                  2. Chi tiết thanh toán
                </h4>

                {/* Plan Summary */}
                <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-900/30 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5" />
                    TÓM TẮT KẾ HOẠCH
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs pt-1">
                    <span className="text-slate-400">Tổng đơn hàng:</span>
                    <span className="text-right font-bold text-slate-200">{formatCurrency(total)}</span>

                    <span className="text-slate-400">Trả trước:</span>
                    <span className="text-right font-bold text-emerald-400">{formatCurrency(installmentDownPaymentValue)}</span>

                    <span className="text-slate-400">Vay lại:</span>
                    <span className="text-right font-bold text-blue-400">{formatCurrency(loanAmount)}</span>

                    <span className="text-slate-400">Tổng lãi dự kiến:</span>
                    <span className="text-right font-bold text-amber-500">{formatCurrency(totalInterest)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-purple-900/30 pt-2.5 mt-1">
                    <span className="text-sm font-bold text-purple-300">Góp mỗi tháng:</span>
                    <span className="text-lg font-black text-rose-500">{formatCurrency(monthlyPayment)}</span>
                  </div>
                </div>

                {/* Repayment Schedule */}
                <div className="flex-1 flex flex-col min-h-[180px]">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    LỊCH TRẢ NỢ DỰ KIẾN
                  </div>
                  <div className="flex-1 overflow-auto max-h-[200px] border border-slate-800 rounded-xl bg-[#151521]/60">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#151521] text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2 px-3">Kỳ</th>
                          <th className="py-2 px-3">Ngày trả</th>
                          <th className="py-2 px-3 text-right">Số tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleRows.map((row) => (
                          <tr key={row.index} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                            <td className="py-2 px-3 text-slate-400">{row.index}</td>
                            <td className="py-2 px-3 font-medium text-slate-300">{row.date}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-200">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-[#151521] px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsInstallmentModalOpen(false);
                  setTransactionType("full");
                  setPaidAmount("full");
                }}
                className="px-5 h-11 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaidAmount(installmentDownPayment);
                  setIsInstallmentModalOpen(false);
                }}
                className="px-6 h-11 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white shadow-lg shadow-purple-500/20 active:scale-95 transition"
              >
                Xác nhận trả góp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesManager;
