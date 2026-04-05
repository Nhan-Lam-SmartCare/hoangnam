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
    [clearCart, currentBranchId, setCashTransactions, setParts, setPaymentSources, setSales]
  );

  const deleteSale = useCallback(
    (saleId: string) => {
      const sale = sales.find((s) => s.id === saleId);
      if (!sale) return;

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
