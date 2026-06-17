import { useCallback } from "react";
import {
  createCashTransaction,
  deleteCashTransaction,
} from "../../lib/repository/cashTransactionsRepository";
import { updatePaymentSourceBalance } from "../../lib/repository/paymentSourcesRepository";
import {
  decrementStockForSale,
  incrementStockForReturn,
} from "../../lib/repository/partsRepository";
import {
  createCustomerDebt,
  deleteCustomerDebt,
} from "../../lib/repository/debtsRepository";
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
  | "cashTransactions"
  | "customerDebts"
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
    cashTransactions,
    customerDebts,
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
      paidAmount?: number;
    }): Promise<{ ok: boolean; saleId: string }> => {
      if (!data.items.length)
        return Promise.resolve({ ok: false, saleId: "" });

      const lineSubtotal = data.items.reduce(
        (sum, it) => sum + it.sellingPrice * it.quantity,
        0
      );
      const lineDiscounts = data.items.reduce(
        (sum, it) => sum + (it.discount || 0),
        0
      );
      const total = lineSubtotal - lineDiscounts - data.discount;
      const saleId = `SALE-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 5)
        .toUpperCase()}`;

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

      // Số tiền khách thực trả (kẹp trong [0, total]); phần còn lại ghi công nợ.
      const actualPaidAmount =
        data.paidAmount !== undefined
          ? Math.max(0, Math.min(total, data.paidAmount))
          : total;

      const saleItems = data.items.map((it) => ({
        partId: it.partId,
        quantity: it.quantity,
      }));

      // Hoàn tác cập nhật lạc quan khi ghi CSDL thất bại (chống "đơn ma").
      const rollbackOptimistic = () => {
        setSales((prev) => prev.filter((s) => s.id !== saleId));
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
                [currentBranchId]: (p.stock[currentBranchId] || 0) + soldQty,
              },
            };
          })
        );
        if (actualPaidAmount > 0) {
          setCashTransactions((prev) => prev.filter((ct) => ct.saleId !== saleId));
          setPaymentSources((prev) =>
            prev.map((ps) =>
              ps.id === data.paymentMethod
                ? {
                    ...ps,
                    balance: {
                      ...ps.balance,
                      [currentBranchId]:
                        (ps.balance[currentBranchId] || 0) - actualPaidAmount,
                    },
                  }
                : ps
            )
          );
        }
        setCartItems(data.items);
      };

      const persistence = (async (): Promise<{ ok: boolean }> => {
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;
        const issuedBy =
          currentUser?.user_metadata?.name ||
          currentUser?.email ||
          newSale.userName;

        // Xác định customer id thật (ưu tiên id, sau đó tra theo phone) để gắn
        // công nợ và cập nhật thống kê đúng khách hàng.
        let resolvedCustomerId: string | null = newSale.customer.id || null;
        if (!resolvedCustomerId && newSale.customer.phone) {
          const { data: existingCustomers } = await supabase
            .from("customers")
            .select("id")
            .eq("phone", newSale.customer.phone)
            .limit(1);
          if (existingCustomers && existingCustomers.length > 0) {
            resolvedCustomerId = existingCustomers[0].id;
          }
        }

        // 1) Trừ kho nguyên tử TRƯỚC khi lưu đơn để chống bán âm/oversell: nếu
        //    không đủ tồn thì hủy luôn, không tạo phiếu (không còn "đơn lưu mà
        //    kho không trừ").
        const decRes = await decrementStockForSale(saleItems, newSale.branchId);
        if (!decRes.ok) {
          rollbackOptimistic();
          showToast.error(
            `Không thể tạo đơn (kho): ${mapRepoErrorForUser(decRes.error)}`
          );
          return { ok: false };
        }
        const stockFailedParts =
          decRes.data.mode === "fallback" ? decRes.data.failedParts || [] : [];

        // 2) Lưu đơn. Nếu lỗi, cộng trả lại số kho vừa trừ rồi rollback state.
        const payload = {
          id: newSale.id,
          date: newSale.date,
          items: newSale.items,
          subtotal: newSale.subtotal,
          discount: newSale.discount,
          total: newSale.total,
          customer: newSale.customer,
          paymentmethod: newSale.paymentMethod,
          userid: currentUser?.id || newSale.userId,
          username: issuedBy,
          branchid: newSale.branchId,
          branch_id: newSale.branchId,
          branchId: newSale.branchId,
          cashtransactionid: newSale.cashTransactionId || null,
          note: data.note || null,
          refunded: false,
        };

        const { error } = await supabase.from("sales").insert([payload]);
        if (error) {
          await incrementStockForReturn(saleItems, newSale.branchId);
          rollbackOptimistic();
          const mappedError = {
            code: "supabase" as const,
            message: error.message || "Lỗi CSDL khi lưu đơn bán",
          };
          showToast.error(
            `Lưu đơn thất bại, đã hoàn kho: ${mapRepoErrorForUser(mappedError)}`
          );
          return { ok: false };
        }

        if (stockFailedParts.length > 0) {
          showToast.warning(
            `Đơn đã lưu nhưng chưa trừ kho CSDL cho: ${stockFailedParts.join(", ")}`
          );
        }

        let cashResId: string | undefined = undefined;

        if (actualPaidAmount > 0) {
          const cashRes = await createCashTransaction({
            type: "income",
            amount: actualPaidAmount,
            branchId: newSale.branchId,
            paymentSourceId: newSale.paymentMethod,
            date: newSale.date,
            category: "sale_income",
            notes: data.note || "Thu tiền bán hàng",
            saleId: newSale.id,
            recipient: newSale.customer?.name || "Khách lẻ",
          });

          if (!cashRes.ok) {
            showToast.warning(
              `Đơn bán đã lưu nhưng chưa ghi sổ quỹ: ${mapRepoErrorForUser(cashRes.error)}`
            );
          } else {
            cashResId = cashRes.data.id;
            const effectivePaymentSourceId =
              cashRes.data.paymentSourceId || newSale.paymentMethod;
            const balRes = await updatePaymentSourceBalance(
              effectivePaymentSourceId,
              newSale.branchId,
              actualPaidAmount
            );
            if (!balRes.ok) {
              showToast.warning(
                `Đơn bán đã lưu nhưng chưa cập nhật số dư nguồn tiền: ${mapRepoErrorForUser(
                  balRes.error
                )}`
              );
            }

            await supabase
              .from("sales")
              .update({ cashtransactionid: cashResId })
              .eq("id", newSale.id);
          }
        }

        const remainingAmount = total - actualPaidAmount;
        if (remainingAmount > 0) {
          const safeCustomerName =
            newSale.customer.name?.trim() ||
            newSale.customer.phone ||
            "Khách lẻ";

          let description = `Mua hàng (Hóa đơn #${newSale.id})`;
          if (newSale.items.length > 0) {
            description += "\n\nSản phẩm:";
            newSale.items.forEach((item) => {
              description += `\n  - ${item.quantity} x ${item.partName} - ${(item.sellingPrice * item.quantity).toLocaleString()}đ`;
            });
          }

          // Dùng repository chuẩn (cột sale_id + id CDEBT-SALE-...) để công nợ
          // liên kết đúng phiếu bán và gắn đúng customer id.
          const debtRes = await createCustomerDebt({
            customerId:
              resolvedCustomerId ||
              newSale.customer.phone ||
              `CUST-ANON-${saleId}`,
            customerName: safeCustomerName,
            phone: newSale.customer.phone,
            description,
            totalAmount: total,
            paidAmount: actualPaidAmount,
            remainingAmount,
            createdDate: new Date().toISOString().split("T")[0],
            branchId: newSale.branchId,
            saleId: newSale.id,
          } as any);

          if (!debtRes.ok) {
            console.error("Error creating customer debt for sale:", debtRes.error);
            showToast.error("Đơn bán đã lưu nhưng không thể tạo công nợ tự động.");
          } else {
            showToast.success(
              `Đã tạo công nợ ${remainingAmount.toLocaleString()}đ cho ${safeCustomerName}`
            );
          }
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
              // SKU dùng chung cho mọi đơn vị, không phải số serial duy nhất ->
              // để trống tránh hiểu nhầm là IMEI/serial.
              imei_serial: null,
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

        // Cập nhật thống kê khách hàng (Tổng chi tiêu, Số lần mua, Hạng).
        // Lưu ý: vẫn là read-modify-write phía client (#8) — fix nguyên tử nằm
        // ở RPC sale_create_atomic (sql/2026-06-17_sale_create_atomic.sql).
        if (resolvedCustomerId) {
          try {
            const { data: currentStats } = await supabase
              .from("customers")
              .select("totalspent, visitcount")
              .eq("id", resolvedCustomerId)
              .single();

            const newTotalSpent = Number(currentStats?.totalspent || 0) + total;
            const newVisitCount = Number(currentStats?.visitcount || 0) + 1;

            let newSegment = "New";
            if (newTotalSpent > 10000000) newSegment = "VIP";
            else if (newTotalSpent > 3000000) newSegment = "Loyal";
            else if (newVisitCount > 1) newSegment = "Potential";

            await supabase
              .from("customers")
              .update({
                totalspent: newTotalSpent,
                visitcount: newVisitCount,
                lastvisit: new Date().toISOString(),
                segment: newSegment,
              })
              .eq("id", resolvedCustomerId);
          } catch (e) {
            console.error("Lỗi cập nhật số liệu khách hàng:", e);
          }
        }

        return { ok: true };
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

      // Chỉ ghi nhận tiền vào sổ quỹ/số dư theo SỐ THỰC THU (phần còn lại là
      // công nợ), khớp với những gì persistence ghi xuống CSDL (#2).
      if (actualPaidAmount > 0) {
        const ctId = `CT-${Date.now()}`;
        const cashTx: CashTransaction = {
          id: ctId,
          type: "income",
          date: new Date().toISOString(),
          amount: actualPaidAmount,
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
                    [currentBranchId]:
                      (ps.balance[currentBranchId] || 0) + actualPaidAmount,
                  },
                }
              : ps
          )
        );
      }

      clearCart();

      return persistence.then((r) => ({ ok: r.ok, saleId }));
    },
    [
      clearCart,
      currentBranchId,
      parts,
      setCartItems,
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

      // Các giao dịch sổ quỹ thực tế gắn với đơn (nguồn sự thật để hoàn tiền
      // ĐÚNG số đã thu — không hoàn theo sale.total khi đơn còn nợ) (#4).
      const linkedTx = cashTransactions.filter((ct) => ct.saleId === saleId);
      const linkedDebts = customerDebts.filter(
        (d) => (d as any).saleId === saleId
      );

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

        // 1) Hoàn kho nguyên tử (RPC, fallback read-modify-write) (#5).
        const incRes = await incrementStockForReturn(
          sale.items.map((it) => ({ partId: it.partId, quantity: it.quantity })),
          currentBranchId
        );
        if (!incRes.ok) {
          showToast.warning(
            `Đã xóa đơn nhưng chưa hoàn kho CSDL: ${mapRepoErrorForUser(incRes.error)}`
          );
        } else if (
          incRes.data.mode === "fallback" &&
          incRes.data.failedParts &&
          incRes.data.failedParts.length > 0
        ) {
          showToast.warning(
            `Đã xóa đơn nhưng chưa hoàn kho CSDL cho: ${incRes.data.failedParts.join(", ")}`
          );
        }

        // 2) Hoàn tiền THẬT vào CSDL: xóa giao dịch sổ quỹ + đảo số dư nguồn tiền
        //    theo đúng số đã thu, dùng RPC nguyên tử có sẵn (#3, #4).
        const refundBySource: Record<string, number> = {};
        let refundFailed = false;
        for (const tx of linkedTx) {
          const srcId = tx.paymentSourceId || sale.paymentMethod;
          const amt = Number(tx.amount || 0);
          const delRes = await deleteCashTransaction(tx.id);
          if (!delRes.ok) {
            refundFailed = true;
            continue;
          }
          if (amt > 0) {
            const balRes = await updatePaymentSourceBalance(
              srcId,
              currentBranchId,
              -amt
            );
            if (!balRes.ok) {
              refundFailed = true;
              continue;
            }
            refundBySource[srcId] = (refundBySource[srcId] || 0) + amt;
          }
        }
        if (refundFailed) {
          showToast.warning(
            "Đã xóa đơn nhưng hoàn tiền/sổ quỹ chưa hoàn tất trên CSDL."
          );
        }

        // 3) Xóa công nợ liên kết với đơn (nếu có) (#4).
        for (const d of linkedDebts) {
          await deleteCustomerDebt(d.id);
        }

        // 4) Đảo thống kê khách hàng (best-effort) (#4).
        if (sale.customer?.id) {
          try {
            const { data: cur } = await supabase
              .from("customers")
              .select("totalspent, visitcount")
              .eq("id", sale.customer.id)
              .single();
            if (cur) {
              await supabase
                .from("customers")
                .update({
                  totalspent: Math.max(0, Number(cur.totalspent || 0) - sale.total),
                  visitcount: Math.max(0, Number(cur.visitcount || 0) - 1),
                })
                .eq("id", sale.customer.id);
            }
          } catch (e) {
            console.error("Lỗi đảo thống kê khách hàng khi xóa đơn:", e);
          }
        }

        // 5) Cập nhật state cục bộ theo SỐ THỰC đã hoàn.
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
          prev.map((ps) => {
            const refund = refundBySource[ps.id] || 0;
            if (!refund) return ps;
            return {
              ...ps,
              balance: {
                ...ps.balance,
                [currentBranchId]: (ps.balance[currentBranchId] || 0) - refund,
              },
            };
          })
        );

        if (linkedDebts.length > 0) {
          setCustomerDebts((prev) =>
            prev.filter((d) => (d as any).saleId !== saleId)
          );
        }

        showToast.success(
          "Đã xóa phiếu bán hàng, hoàn kho và hoàn tiền thành công."
        );
      })();
    },
    [
      currentBranchId,
      sales,
      cashTransactions,
      customerDebts,
      setCashTransactions,
      setCustomerDebts,
      setParts,
      setPaymentSources,
      setSales,
    ]
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
