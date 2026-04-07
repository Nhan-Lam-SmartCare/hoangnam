import { useCallback } from "react";
import { createCashTransaction } from "../../lib/repository/cashTransactionsRepository";
import { updatePaymentSourceBalance } from "../../lib/repository/paymentSourcesRepository";
import { showToast } from "../../utils/toast";
import { mapRepoErrorForUser } from "../../utils/errorMapping";
import { supabase } from "../../supabaseClient";
import type {
  CashTransaction,
  CartItem,
  InventoryTransaction,
  Sale,
} from "../../types";
import type { AppActions, AppState } from "./types";

type FinanceDeps = Pick<
  AppState,
  | "currentBranchId"
  | "parts"
  | "sales"
  | "setSales"
  | "setParts"
  | "setCashTransactions"
  | "setPaymentSources"
  | "setCustomerDebts"
  | "setSupplierDebts"
  | "setCartItems"
  | "setInventoryTransactions"
>;

const parseWarrantyMonths = (input?: string | null): number => {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return 0;

  const numberMatch = raw.match(/\d+/);
  if (!numberMatch) return 0;

  const value = Number(numberMatch[0]);
  if (!Number.isFinite(value) || value <= 0) return 0;

  if (raw.includes("nam") || raw.includes("năm") || raw.includes("year")) {
    return value * 12;
  }

  return value;
};

// eslint-disable-next-line max-lines-per-function
export function useFinanceActions(
  deps: FinanceDeps
): Pick<
  AppActions,
  | "clearCart"
  | "finalizeSale"
  | "deleteSale"
  | "recordInventoryTransaction"
  | "payCustomerDebts"
  | "paySupplierDebts"
> {
  const {
    currentBranchId,
    parts,
    sales,
    setSales,
    setParts,
    setCashTransactions,
    setPaymentSources,
    setCustomerDebts,
    setSupplierDebts,
    setCartItems,
    setInventoryTransactions,
  } = deps;

  const clearCart = useCallback(() => setCartItems([]), [setCartItems]);

  const finalizeSale = useCallback(
    (data: {
      items: CartItem[];
      discount: number;
      paymentMethod: "cash" | "bank";
      customer: { id?: string; name: string; phone?: string };
      note?: string;
    }) => {
      if (!data.items.length) return;

      const lineSubtotal = data.items.reduce(
        (sum, it) => sum + it.sellingPrice * it.quantity,
        0
      );
      const lineDiscounts = data.items.reduce(
        (sum, it) => sum + (it.discount || 0),
        0
      );
      const total = lineSubtotal - lineDiscounts - data.discount;
      const saleId = `SALE-${Date.now()}`;

      const newSale: Sale = {
        id: saleId,
        date: new Date().toISOString(),
        items: data.items,
        subtotal: lineSubtotal,
        discount: data.discount + lineDiscounts,
        total,
        customer: data.customer,
        paymentMethod: data.paymentMethod,
        userId: "local-user",
        userName: "Local User",
        branchId: currentBranchId,
        cashTransactionId: undefined,
      };

      void (async () => {
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;
        const issuedBy =
          currentUser?.user_metadata?.name ||
          currentUser?.email ||
          newSale.userName;

        const payload = {
          id: newSale.id,
          date: newSale.date,
          items: newSale.items,
          subtotal: newSale.subtotal,
          discount: newSale.discount,
          total: newSale.total,
          customer: newSale.customer,
          paymentmethod: newSale.paymentMethod,
          userid: newSale.userId,
          username: newSale.userName,
          branchid: newSale.branchId,
          branch_id: newSale.branchId,
          branchId: newSale.branchId,
          cashtransactionid: newSale.cashTransactionId || null,
          note: data.note || null,
          refunded: false,
        };

        const { error } = await supabase.from("sales").insert([payload]);
        if (error) {
          const mappedError = {
            code: "supabase" as const,
            message: error.message || "Lỗi CSDL khi lưu đơn bán",
          };
          showToast.warning(
            `Đã tạo đơn tại máy nhưng lưu CSDL thất bại: ${mapRepoErrorForUser(mappedError)}`
          );
          return;
        }

        const warrantyRows: Array<Record<string, unknown>> = [];
        for (const item of newSale.items) {
          const part = parts.find((p) => p.id === item.partId);
          const months = parseWarrantyMonths(part?.warrantyPeriod);
          if (months <= 0) continue;

          const today = new Date();
          const end = new Date(today);
          end.setMonth(end.getMonth() + months);

          for (let i = 0; i < item.quantity; i += 1) {
            warrantyRows.push({
              customer_name: newSale.customer.name,
              customer_phone: newSale.customer.phone || null,
              device_model: item.partName,
              imei_serial: item.sku || null,
              warranty_start_date: today.toISOString().slice(0, 10),
              warranty_end_date: end.toISOString().slice(0, 10),
              warranty_period_months: months,
              warranty_type: "standard",
              covered_parts: ["Lỗi kỹ thuật do nhà sản xuất"],
              coverage_terms: "Không áp dụng cho rơi vỡ, ngấm nước, can thiệp bên ngoài",
              issued_by: issuedBy,
              branch_id: newSale.branchId,
              status: "active",
              notes: `Tự động tạo từ phiếu bán ${newSale.id} - ${item.partName} (${i + 1}/${item.quantity})`,
            });
          }
        }

        if (warrantyRows.length > 0) {
          const { error: warrantyError } = await supabase
            .from("warranty_cards")
            .insert(warrantyRows);

          if (warrantyError) {
            const mappedWarrantyError = {
              code: "supabase" as const,
              message: warrantyError.message || "Lỗi CSDL khi tạo phiếu bảo hành tự động",
            };
            showToast.warning(
              `Đơn đã lưu nhưng tạo phiếu bảo hành tự động thất bại: ${mapRepoErrorForUser(
                mappedWarrantyError
              )}`
            );
          }
        }
      })();

      setSales((prev) => [newSale, ...prev]);

      setParts((prev) =>
        prev.map((p) => {
          const soldQty = data.items
            .filter((i) => i.partId === p.id)
            .reduce((s, i) => s + i.quantity, 0);
          if (!soldQty) return p;
          return {
            ...p,
            stock: {
              ...p.stock,
              [currentBranchId]: (p.stock[currentBranchId] || 0) - soldQty,
            },
          };
        })
      );

      const ctId = `CT-${Date.now()}`;
      const cashTx: CashTransaction = {
        id: ctId,
        type: "income",
        date: new Date().toISOString(),
        amount: total,
        notes: data.note || "Thu tiền bán hàng",
        paymentSourceId: data.paymentMethod,
        branchId: currentBranchId,
        category: "sale_income",
        saleId,
      };
      setCashTransactions((prev) => [cashTx, ...prev]);

      setPaymentSources((prev) =>
        prev.map((ps) =>
          ps.id === data.paymentMethod
            ? {
                ...ps,
                balance: {
                  ...ps.balance,
                  [currentBranchId]: (ps.balance[currentBranchId] || 0) + total,
                },
              }
            : ps
        )
      );

      clearCart();
    },
    [
      clearCart,
      currentBranchId,
      parts,
      setCashTransactions,
      setParts,
      setPaymentSources,
      setSales,
    ]
  );

  const deleteSale = useCallback(
    (saleId: string) => {
      const sale = sales.find((s) => s.id === saleId);
      if (!sale) return;

      void (async () => {
        const { error } = await supabase.from("sales").delete().eq("id", saleId);
        if (error) {
          const mappedError = {
            code: "supabase" as const,
            message: error.message || "Lỗi CSDL khi xóa đơn bán",
          };
          showToast.error(
            `Không thể xóa đơn trên CSDL: ${mapRepoErrorForUser(mappedError)}`
          );
          return;
        }

        setSales((prev) => prev.filter((s) => s.id !== saleId));

        setParts((prev) =>
          prev.map((p) => {
            const soldQty = sale.items
              .filter((i) => i.partId === p.id)
              .reduce((s, i) => s + i.quantity, 0);
            if (!soldQty) return p;
            return {
              ...p,
              stock: {
                ...p.stock,
                [currentBranchId]: (p.stock[currentBranchId] || 0) + soldQty,
              },
            };
          })
        );

        setCashTransactions((prev) => prev.filter((ct) => ct.saleId !== saleId));

        setPaymentSources((prev) =>
          prev.map((ps) =>
            ps.id === sale.paymentMethod
              ? {
                  ...ps,
                  balance: {
                    ...ps.balance,
                    [currentBranchId]:
                      (ps.balance[currentBranchId] || 0) - sale.total,
                  },
                }
              : ps
          )
        );

        showToast.success("Đã xóa phiếu bán hàng, hoàn kho và hoàn tiền thành công.");
      })();
    },
    [currentBranchId, sales, setCashTransactions, setParts, setPaymentSources, setSales]
  );

  const recordInventoryTransaction = useCallback(
    (tx: Omit<InventoryTransaction, "id">) => {
      const id = `INV-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const full: InventoryTransaction = { id, ...tx };
      setInventoryTransactions((prev) => [full, ...prev]);
    },
    [setInventoryTransactions]
  );

  const payCustomerDebts = useCallback(
    (
      customerIds: string[],
      paymentMethod: "cash" | "bank",
      timestamp: string
    ) => {
      let totalPaid = 0;

      setCustomerDebts((prev) =>
        prev
          .map((debt) => {
            if (
              customerIds.includes(debt.customerId) &&
              debt.branchId === currentBranchId
            ) {
              const amountToPay = debt.remainingAmount;
              totalPaid += amountToPay;

              return {
                ...debt,
                paidAmount: debt.totalAmount,
                remainingAmount: 0,
                status: "paid" as const,
              };
            }
            return debt;
          })
          .filter((debt) => debt.remainingAmount > 0)
      );

      if (totalPaid > 0) {
        void (async () => {
          const { data: userData } = await supabase.auth.getUser();
          const _userId = userData?.user?.id || null;
          const cashRes = await createCashTransaction({
            type: "income",
            amount: totalPaid,
            branchId: currentBranchId,
            paymentSourceId: paymentMethod,
            date: timestamp,
            category: "debt_collection",
            notes: `Thu hết nợ cho ${customerIds.length} khách hàng`,
            recipient: `Thu nợ ${customerIds.length} khách hàng`,
          });
          if (!cashRes.ok) {
            showToast.error(mapRepoErrorForUser(cashRes.error));
            return;
          }
          const balRes = await updatePaymentSourceBalance(
            paymentMethod,
            currentBranchId,
            totalPaid
          );
          if (!balRes.ok) {
            showToast.error(mapRepoErrorForUser(balRes.error));
          }
        })();
      }
    },
    [currentBranchId, setCustomerDebts]
  );

  const paySupplierDebts = useCallback(
    (
      supplierIds: string[],
      paymentMethod: "cash" | "bank",
      timestamp: string
    ) => {
      let totalPaid = 0;

      setSupplierDebts((prev) =>
        prev
          .map((debt) => {
            if (
              supplierIds.includes(debt.supplierId) &&
              debt.branchId === currentBranchId
            ) {
              const amountToPay = debt.remainingAmount;
              totalPaid += amountToPay;

              return {
                ...debt,
                paidAmount: debt.totalAmount,
                remainingAmount: 0,
                status: "paid" as const,
              };
            }
            return debt;
          })
          .filter((debt) => debt.remainingAmount > 0)
      );

      if (totalPaid > 0) {
        void (async () => {
          const { data: userData } = await supabase.auth.getUser();
          const _userId = userData?.user?.id || null;
          const cashRes = await createCashTransaction({
            type: "expense",
            amount: totalPaid,
            branchId: currentBranchId,
            paymentSourceId: paymentMethod,
            date: timestamp,
            category: "debt_payment",
            notes: `Trả hết nợ cho ${supplierIds.length} nhà cung cấp`,
            recipient: `Trả nợ ${supplierIds.length} nhà cung cấp`,
          });
          if (!cashRes.ok) {
            showToast.error(mapRepoErrorForUser(cashRes.error));
            return;
          }
          const balRes = await updatePaymentSourceBalance(
            paymentMethod,
            currentBranchId,
            -totalPaid
          );
          if (!balRes.ok) {
            showToast.error(mapRepoErrorForUser(balRes.error));
          }
        })();
      }
    },
    [currentBranchId, setSupplierDebts]
  );

  return {
    clearCart,
    finalizeSale,
    deleteSale,
    recordInventoryTransaction,
    payCustomerDebts,
    paySupplierDebts,
  };
}
