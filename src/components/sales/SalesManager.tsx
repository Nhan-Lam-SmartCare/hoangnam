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
import { usePartsRepo } from "../../hooks/usePartsRepository";

type UiMode = "enterprise" | "retail" | "dark";

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
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [rightTab, setRightTab] = useState<"checkout" | "history">("checkout");
  const [mobileStep, setMobileStep] = useState<"products" | "checkout">(
    "products"
  );
  const [uiMode, setUiMode] = useState<UiMode>(() => {
    try {
      const saved = localStorage.getItem("sales-ui-mode") as UiMode | null;
      if (saved === "enterprise") return "retail";
      return saved || "retail";
    } catch {
      return "retail";
    }
  });

  const inventoryParts = parts;

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
    return inventoryParts
      .filter((part) => {
        const hasStock = getBranchStock(part, currentBranchId) > 0;
        const hasWarranty = Boolean(String(part.warrantyPeriod || "").trim());
        return hasStock || hasWarranty;
      })
      .filter((part) => {
        if (!keyword) return true;
        return (
          part.name.toLowerCase().includes(keyword) ||
          part.sku.toLowerCase().includes(keyword) ||
          (part.barcode || "").toLowerCase().includes(keyword)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [inventoryParts, currentBranchId, search]);

  const totalPages = Math.max(1, Math.ceil(filteredParts.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, currentBranchId, pageSize]);

  useEffect(() => {
    if (!partsLoaded) return;
    setParts(partsFromRepo);
  }, [partsLoaded, partsFromRepo, setParts]);

  useEffect(() => {
    try {
      localStorage.setItem("sales-ui-mode", uiMode);
    } catch {
      // ignore storage errors
    }
  }, [uiMode]);

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
    const start = (page - 1) * pageSize;
    return filteredParts.slice(start, start + pageSize);
  }, [filteredParts, page, pageSize]);

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0),
    [cartItems]
  );

  const total = Math.max(0, subtotal - discount);

  const printInvoice = (payload: {
    customer: { name: string; phone?: string };
    items: CartItem[];
    subtotalValue: number;
    discountValue: number;
    totalValue: number;
    payment: "cash" | "bank";
    noteText?: string;
  }) => {
    const w = window.open("", "_blank", "width=420,height=700");
    if (!w) {
      showToast.warning("Trình duyệt đang chặn cửa sổ in hóa đơn.");
      return;
    }

    const rows = payload.items
      .map(
        (it) => `
          <tr>
            <td>${it.partName}</td>
            <td style="text-align:center">${it.quantity}</td>
            <td style="text-align:right">${formatCurrency(it.sellingPrice)}</td>
            <td style="text-align:right">${formatCurrency(it.sellingPrice * it.quantity)}</td>
          </tr>`
      )
      .join("");

    w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Hóa đơn bán hàng</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; padding: 16px; color: #0f172a; }
    h1 { margin: 0 0 8px; font-size: 18px; }
    .meta { font-size: 12px; margin-bottom: 10px; color: #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border-bottom: 1px dashed #cbd5e1; padding: 6px 4px; }
    th { text-align: left; }
    .sum { margin-top: 10px; font-size: 13px; }
    .sum-row { display: flex; justify-content: space-between; margin: 3px 0; }
    .total { font-weight: 700; font-size: 15px; margin-top: 5px; }
  </style>
</head>
<body>
  <h1>Hóa đơn bán hàng</h1>
  <div class="meta">Ngày giờ: ${new Date().toLocaleString("vi-VN")}</div>
  <div class="meta">Khách hàng: ${payload.customer.name}${payload.customer.phone ? ` - ${payload.customer.phone}` : ""}</div>
  <div class="meta">Thanh toán: ${payload.payment === "cash" ? "Tiền mặt" : "Chuyển khoản"}</div>
  <table>
    <thead>
      <tr>
        <th>Sản phẩm</th>
        <th style="text-align:center">SL</th>
        <th style="text-align:right">Đơn giá</th>
        <th style="text-align:right">Thành tiền</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sum">
    <div class="sum-row"><span>Tạm tính</span><span>${formatCurrency(payload.subtotalValue)}</span></div>
    <div class="sum-row"><span>Giảm giá</span><span>- ${formatCurrency(payload.discountValue)}</span></div>
    <div class="sum-row total"><span>Thanh toán</span><span>${formatCurrency(payload.totalValue)}</span></div>
  </div>
  ${payload.noteText ? `<div class="meta">Ghi chú: ${payload.noteText}</div>` : ""}
</body>
</html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
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

    for (const item of cartItems) {
      const part = inventoryParts.find((p) => p.id === item.partId);
      const availableStock = part ? getBranchStock(part, currentBranchId) : 0;
      if (item.quantity > availableStock) {
        showToast.warning(`Sản phẩm ${item.partName} không đủ tồn (${availableStock}).`);
        return;
      }
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
    });

    setDiscount(0);
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

  const ui = useMemo(() => {
    if (uiMode === "retail") {
      return {
        pageBg:
          "w-full px-3 md:px-6 py-4 md:py-6 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.14),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(236,72,153,0.14),_transparent_34%),linear-gradient(180deg,#fff7ed_0%,#fff1f2_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(236,72,153,0.16),_transparent_34%),linear-gradient(180deg,#1f2937_0%,#111827_100%)]",
        header:
          "mb-4 md:mb-6 rounded-2xl border border-orange-200/60 dark:border-orange-500/30 bg-white/80 dark:bg-slate-900/70 backdrop-blur-md shadow-sm px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3",
        leftPanel:
          "xl:col-span-2 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-orange-200/70 dark:border-orange-500/30 overflow-hidden shadow-sm",
        rightPanel:
          "bg-white/90 dark:bg-slate-900/85 rounded-2xl border border-orange-200/70 dark:border-orange-500/30 p-4 md:p-5 space-y-4 shadow-sm xl:sticky xl:top-24 h-fit",
        panelHead:
          "p-4 border-b border-orange-200/60 dark:border-orange-500/30 flex items-center justify-between gap-3 bg-gradient-to-r from-orange-50 to-pink-50 dark:from-slate-900 dark:to-slate-800",
        rowHover: "border-t border-slate-100 dark:border-slate-700 hover:bg-orange-50/60 dark:hover:bg-slate-800/70 transition",
        stockBadge:
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
        addBtn:
          "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white shadow-sm hover:shadow transition",
        syncBtn:
          "h-10 px-3 rounded-xl border border-orange-300 dark:border-orange-500/40 text-orange-700 dark:text-orange-200 hover:bg-orange-50 dark:hover:bg-orange-500/10 disabled:opacity-50 transition",
        summary: "rounded-xl bg-orange-50/70 dark:bg-orange-500/10 border border-orange-200/70 dark:border-orange-500/30 p-3 space-y-1 text-sm",
      };
    }

    if (uiMode === "dark") {
      return {
        pageBg:
          "w-full px-3 md:px-6 py-4 md:py-6 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.18),_transparent_34%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]",
        header:
          "mb-4 md:mb-6 rounded-2xl border border-sky-500/20 bg-slate-900/60 backdrop-blur-xl shadow-[0_20px_45px_-25px_rgba(14,165,233,0.45)] px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3",
        leftPanel:
          "xl:col-span-2 bg-slate-900/65 backdrop-blur-xl rounded-2xl border border-sky-500/20 overflow-hidden shadow-[0_20px_45px_-25px_rgba(14,165,233,0.35)]",
        rightPanel:
          "bg-slate-900/65 rounded-2xl border border-sky-500/20 p-4 md:p-5 space-y-4 shadow-[0_20px_45px_-25px_rgba(14,165,233,0.35)] xl:sticky xl:top-24 h-fit",
        panelHead:
          "p-4 border-b border-sky-500/20 flex items-center justify-between gap-3 bg-gradient-to-r from-slate-900/70 to-slate-800/40",
        rowHover: "border-t border-slate-700/70 hover:bg-sky-500/10 transition",
        stockBadge:
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-sky-500/20 text-sky-300",
        addBtn:
          "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-sm hover:shadow transition",
        syncBtn:
          "h-10 px-3 rounded-xl border border-sky-500/30 text-sky-200 hover:bg-sky-500/10 disabled:opacity-50 transition",
        summary: "rounded-xl bg-slate-950/70 border border-sky-500/20 p-3 space-y-1 text-sm",
      };
    }

    return {
      pageBg:
        "w-full px-3 md:px-6 py-4 md:py-6 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.06),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(14,116,144,0.07),_transparent_30%)]",
      header:
        "mb-4 md:mb-6 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md shadow-sm px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-3",
      leftPanel:
        "xl:col-span-2 bg-white/95 dark:bg-slate-800/92 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-700 overflow-hidden shadow-sm",
      rightPanel:
        "bg-white/95 dark:bg-slate-800/95 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 md:p-5 space-y-4 shadow-sm xl:sticky xl:top-24 h-fit",
      panelHead:
        "p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-900",
      rowHover: "border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition",
      stockBadge:
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
      addBtn:
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-900 hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white text-white shadow-sm hover:shadow transition",
      syncBtn:
        "h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 transition",
      summary: "rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 space-y-1 text-sm",
    };
  }, [uiMode]);

  return (
    <div className={`${ui.pageBg} sales-screen`}>
      <div className={ui.header}>
        <div className="w-full md:w-auto">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 font-semibold">
            Điểm bán thông minh
          </p>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-rose-500" />
            Bán hàng tại quầy
          </h1>
        </div>
        <div className="w-full md:w-auto space-y-2">
          <div className="md:hidden">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Giao diện
            </label>
            <select
              value={uiMode}
              onChange={(e) => setUiMode(e.target.value as UiMode)}
              className="mt-1 w-full h-9 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-100"
            >
              <option value="enterprise">Doanh nghiệp</option>
              <option value="retail">Bán lẻ tại quầy</option>
              <option value="dark">Kính tối</option>
            </select>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-100">
              Giao diện
            </span>
            {[
              { key: "enterprise", label: "Doanh nghiệp" },
              { key: "retail", label: "Bán lẻ tại quầy" },
              { key: "dark", label: "Kính tối" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setUiMode(item.key as UiMode)}
                className={`px-2.5 py-1 rounded-full border transition ${
                  uiMode === item.key
                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                    : "bg-white/70 text-slate-600 border-slate-300 dark:bg-slate-700/60 dark:text-slate-200 dark:border-slate-600"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:flex md:items-center gap-2 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-center md:text-left">
              Sản phẩm: {filteredParts.length}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 text-center md:text-left">
              Giỏ hàng: {cartItems.length}
            </span>
          </div>
        </div>
      </div>
      <div className="relative grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6 overflow-hidden">
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

          <div>
            <div className="md:hidden p-3 space-y-3">
              {pagedParts.map((part) => {
                const stock = getBranchStock(part, currentBranchId);
                const price = getBranchRetailPrice(part, currentBranchId);
                return (
                  <button
                    type="button"
                    key={part.id}
                    onClick={() => addPartToCart(part)}
                    className="w-full text-left rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 p-3 active:scale-[0.99] transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 leading-snug break-words">
                          {part.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">SKU: {part.sku}</div>
                        {part.warrantyPeriod && (
                          <div className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                            Bảo hành: {part.warrantyPeriod}
                          </div>
                        )}
                      </div>
                      <span className={ui.stockBadge}>{stock}</span>
                    </div>

                    <div className="mt-2">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {formatCurrency(price)}
                      </div>
                    </div>
                  </button>
                );
              })}

              {!filteredParts.length && (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">
                  Không có sản phẩm phù hợp.
                </div>
              )}
            </div>

            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Sản phẩm</th>
                    <th className="px-4 py-3">Tồn</th>
                    <th className="px-4 py-3">Giá bán</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedParts.map((part) => {
                    const stock = getBranchStock(part, currentBranchId);
                    const price = getBranchRetailPrice(part, currentBranchId);
                    return (
                      <tr
                        key={part.id}
                        onClick={() => addPartToCart(part)}
                        className={`${ui.rowHover} cursor-pointer`}
                        title="Nhấn để thêm vào giỏ"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{part.name}</div>
                          <div className="text-xs text-slate-500">{part.sku}</div>
                          {part.warrantyPeriod && (
                            <div className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                              Bảo hành: {part.warrantyPeriod}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                          <span className={ui.stockBadge}>{stock}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(price)}</td>
                      </tr>
                    );
                  })}
                  {!filteredParts.length && (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                        Không có sản phẩm phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-emerald-500" />
            Quản lý bán hàng
          </h2>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRightTab("checkout")}
              className={`h-9 rounded-lg text-sm font-semibold border transition ${
                rightTab === "checkout"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              }`}
            >
              Thanh toán
            </button>
            <button
              type="button"
              onClick={() => setRightTab("history")}
              className={`h-9 rounded-lg text-sm font-semibold border transition ${
                rightTab === "history"
                  ? "bg-slate-900 text-white border-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              }`}
            >
              Lịch sử bán hàng
            </button>
          </div>

          {rightTab === "checkout" && (
          <>
          <div className="space-y-2 max-h-64 overflow-auto pr-1 mt-3">
            {cartItems.map((item) => (
              <div key={item.partId} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 bg-slate-50/70 dark:bg-slate-900/40">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{item.partName}</p>
                    <p className="text-xs text-slate-500">{formatCurrency(item.sellingPrice)} x {item.quantity}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.partId)}
                    className="text-red-500 hover:text-red-600"
                    title="Xóa khỏi giỏ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => updateQty(item.partId, item.quantity - 1)}
                    className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="min-w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.partId, item.quantity + 1)}
                    className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {!cartItems.length && (
              <p className="text-sm text-slate-500 text-center py-6">Chưa có sản phẩm trong giỏ hàng.</p>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4">
            <label className="block relative">
              <span className="text-xs text-slate-500">Tên khách hàng</span>
              <div className="relative mt-1">
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
                  placeholder="Nhập tên hoặc số điện thoại"
                  className="w-full pl-9 pr-3 h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </div>
              {showCustomerSuggestions && customerSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-20">
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
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Số điện thoại</span>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="mt-1 w-full px-3 h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Phương thức thanh toán</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as "cash" | "bank")}
                className="mt-1 w-full px-3 h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
              >
                <option value="cash">Tiền mặt</option>
                <option value="bank">Chuyển khoản</option>
              </select>
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={autoPrintInvoice}
                onChange={(e) => setAutoPrintInvoice(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              In hóa đơn nhanh sau khi xác nhận
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Giảm giá đơn hàng</span>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                className="mt-1 w-full px-3 h-10 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
              />
            </label>

            <label className="block">
              <span className="text-xs text-slate-500">Ghi chú</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
              />
            </label>

            <div className={ui.summary}>
              <div className="flex justify-between"><span>Tạm tính</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span>Giảm giá</span><span>- {formatCurrency(discount)}</span></div>
              <div className="flex justify-between font-semibold text-base pt-1 border-t border-slate-200 dark:border-slate-700"><span>Thành tiền</span><span>{formatCurrency(total)}</span></div>
            </div>

            <button
              onClick={submitSale}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm hover:shadow transition"
            >
              Xác nhận bán hàng
            </button>

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
              className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <span className="inline-flex items-center gap-2">
                <Printer className="w-4 h-4" />
                In hóa đơn ngay
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
        <div className="md:hidden fixed left-3 right-3 bottom-3 z-30">
          <button
            onClick={() => {
              setRightTab("checkout");
              setMobileStep("checkout");
            }}
            className="w-full rounded-2xl bg-slate-900/95 dark:bg-emerald-700 text-white shadow-xl border border-white/10 px-4 py-3"
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                <span className="text-sm font-semibold">{cartItems.length} sản phẩm</span>
              </span>
              <span className="text-sm font-bold">{formatCurrency(total)}</span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/15 px-2 py-1 rounded-full">
                Tiếp tục
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

