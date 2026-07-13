import { useCallback } from "react";
import {
  createCashTransaction,
  deleteCashTransaction,
} from "../../lib/repository/cashTransactionsRepository";
import { updatePaymentSourceBalance } from "../../lib/repository/paymentSourcesRepository";
import { incrementStockForReturn } from "../../lib/repository/partsRepository";
import { deleteCustomerDebt } from "../../lib/repository/debtsRepository";
import { showToast } from "../../utils/toast";
import { mapRepoErrorForUser } from "../../utils/errorMapping";
import { supabase } from "../../supabaseClient";
import type {
  CashTransaction,
  CartItem,
  CustomerDebt,
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

/** Tạo phiếu bảo hành tự động cho sản phẩm có warranty trong đơn bán (non-critical). */
async function createWarrantyCardsForSale(
  sale: Sale,
  allParts: { id: string; warrantyPeriod?: string | null }[],
  issuedBy: string
): Promise<void> {
  const warrantyRows: Array<Record<string, unknown>> = [];
  for (const item of sale.items) {
    const part = allParts.find((p) => p.id === item.partId);
    const months = parseWarrantyMonths(part?.warrantyPeriod);
    if (months <= 0) continue;

    const today = new Date();
    const end = new Date(today);
    end.setMonth(end.getMonth() + months);

    for (let i = 0; i < item.quantity; i += 1) {
      warrantyRows.push({
        customer_name: sale.customer.name,
        customer_phone: sale.customer.phone || null,
        device_model: item.partName,
        imei_serial: null,
        warranty_start_date: today.toISOString().slice(0, 10),
        warranty_end_date: end.toISOString().slice(0, 10),
        warranty_period_months: months,
        warranty_type: "standard",
        covered_parts: ["Lỗi kỹ thuật do nhà sản xuất"],
        coverage_terms:
          "Không áp dụng cho rơi vỡ, ngấm nước, can thiệp bên ngoài",
        issued_by: issuedBy,
        branch_id: sale.branchId,
        status: "active",
        notes: `Tự động tạo từ phiếu bán ${sale.id} - ${item.partName} (${i + 1}/${item.quantity})`,
      });
    }
  }

  if (warrantyRows.length > 0) {
    const { error: warrantyError } = await supabase
      .from("warranty_cards")
      .insert(warrantyRows);

    if (warrantyError) {
      console.warn(
        "Tạo phiếu bảo hành tự động thất bại:",
        warrantyError.message
      );
    }
  }
}

// eslint-disable-next-line max-lines-per-function
export function useFinanceActions(
  deps: FinanceDeps
): Pick<
  AppActions,
  | "clearCart"
  | "finalizeSale"
  | "deleteSale"
  | "returnSaleItems"
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
      paidAmount?: number;
      /** Thanh toán tách: nhiều nguồn trên 1 đơn. Nếu có, sẽ ưu tiên thay cho paymentMethod/paidAmount. */
      payments?: { source: string; amount: number }[];
      /** Nhân viên bán hàng (lấy từ profile đăng nhập) — gắn vào đơn để tính doanh số. */
      soldBy?: { id: string; name: string };
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
        userId: data.soldBy?.id || "local-user",
        userName: data.soldBy?.name || "Local User",
        branchId: currentBranchId,
        cashTransactionId: undefined,
      };

      // Chuẩn hóa nguồn thanh toán. Nếu client truyền `payments` (tách nguồn) ->
      // dùng nguyên; nếu không -> suy ra 1 nguồn từ (paymentMethod, paidAmount).
      const rawPayments = (data.payments || [])
        .map((p) => ({
          source: p.source,
          amount: Math.max(0, Number(p.amount) || 0),
        }))
        .filter((p) => p.amount > 0);

      // Số tiền khách thực trả (kẹp trong [0, total]); phần còn lại ghi công nợ.
      const actualPaidAmount = rawPayments.length
        ? Math.min(
            total,
            rawPayments.reduce((s, p) => s + p.amount, 0)
          )
        : data.paidAmount !== undefined
        ? Math.max(0, Math.min(total, data.paidAmount))
        : total;

      // Danh sách nguồn để ghi sổ quỹ + cập nhật số dư (1 hoặc nhiều nguồn).
      let payments: { source: string; amount: number }[] = [];
      if (rawPayments.length > 0) {
        let remainingToAllocate = actualPaidAmount;
        // Ưu tiên bank trước để nếu dư thì giảm trừ vào cash (trả lại tiền thừa)
        const sortedRaw = [...rawPayments].sort((a, b) => {
          if (a.source === "bank" && b.source === "cash") return -1;
          if (a.source === "cash" && b.source === "bank") return 1;
          return 0;
        });

        for (const p of sortedRaw) {
          if (p.amount > 0 && remainingToAllocate > 0) {
            const allocated = Math.min(p.amount, remainingToAllocate);
            payments.push({ source: p.source, amount: allocated });
            remainingToAllocate -= allocated;
          }
        }
      } else if (actualPaidAmount > 0) {
        payments = [{ source: data.paymentMethod, amount: actualPaidAmount }];
      }
      const isSplitPayment = payments.length > 1;

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
            prev.map((ps) => {
              const revert = payments
                .filter((p) => p.source === ps.id)
                .reduce((s, p) => s + p.amount, 0);
              if (!revert) return ps;
              return {
                ...ps,
                balance: {
                  ...ps.balance,
                  [currentBranchId]:
                    (ps.balance[currentBranchId] || 0) - revert,
                },
              };
            })
          );
        }
        // Gỡ công nợ optimistic đã tạo cho đơn này (nếu có).
        if (total - actualPaidAmount > 0) {
          setCustomerDebts((prev) =>
            prev.filter((d) => d.id !== `CDEBT-SALE-${saleId}`)
          );
        }
        setCartItems(data.items);
      };

      const persistence = (async (): Promise<{ ok: boolean }> => {
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;
        // Ưu tiên nhân viên do client truyền (từ bảng profiles — chuẩn, không tự
        // sửa được như user_metadata); fallback auth session; cuối cùng "Local User".
        const issuedBy =
          data.soldBy?.name ||
          currentUser?.user_metadata?.name ||
          currentUser?.email ||
          newSale.userName;
        const soldByUserId =
          data.soldBy?.id || currentUser?.id || newSale.userId;

        // Xác định customer id thật (ưu tiên id, sau đó tra theo phone).
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

        const cashTxId = `CT-${saleId}`;

        const pSale = {
          id: newSale.id,
          date: newSale.date,
          items: newSale.items,
          subtotal: newSale.subtotal,
          discount: newSale.discount,
          total: newSale.total,
          customer: newSale.customer,
          paymentMethod: newSale.paymentMethod,
          userId: soldByUserId,
          userName: issuedBy,
          note: data.note || null,
          customerId: resolvedCustomerId,
        };

        // ── Thử gọi RPC nguyên tử trước ──────────────────────────────────
        // Tách nguồn -> v2 (p_payments[]); 1 nguồn -> v1 (giữ nguyên, đã deploy).
        const { data: rpcResult, error: rpcError } = isSplitPayment
          ? await supabase.rpc("sale_create_atomic_v2", {
              p_sale: pSale,
              p_items: saleItems,
              p_branch_id: newSale.branchId,
              p_payments: payments,
              p_cash_tx_prefix: cashTxId,
            })
          : await supabase.rpc("sale_create_atomic", {
              p_sale: pSale,
              p_items: saleItems,
              p_branch_id: newSale.branchId,
              p_paid_amount: actualPaidAmount,
              p_cash_tx_id: cashTxId,
            });

        // RPC nguyên tử là đường DUY NHẤT tạo đơn: kho + phiếu + sổ quỹ + công nợ
        // + thống kê khách được xử lý trong MỘT transaction ở DB (đã deploy trên
        // production). Không còn nhánh fallback từng-bước (không atomic) trước đây.
        if (rpcError) {
          rollbackOptimistic();
          const isRpcMissing =
            rpcError.code === "PGRST202" ||
            rpcError.message?.includes("could not find") ||
            (rpcError as any).status === 404;
          showToast.error(
            isRpcMissing
              ? `RPC ${
                  isSplitPayment ? "sale_create_atomic_v2" : "sale_create_atomic"
                } chưa được deploy trên CSDL. Vui lòng báo quản trị viên áp dụng migration.`
              : `Lỗi tạo đơn bán: ${rpcError.message || "Lỗi CSDL"}`
          );
          return { ok: false };
        }

        const result =
          typeof rpcResult === "string" ? JSON.parse(rpcResult) : rpcResult;

        if (!result || !result.success) {
          rollbackOptimistic();
          // Hiển thị chi tiết sản phẩm thiếu kho nếu có.
          if (result?.insufficient && Array.isArray(result.insufficient)) {
            const details = result.insufficient
              .map((i: any) => {
                const part = parts.find((p) => p.id === i.partId);
                return `${part?.name || i.partId}: cần ${i.requested}, còn ${i.available}`;
              })
              .join("; ");
            showToast.error(`Không đủ tồn kho: ${details}`);
          } else {
            showToast.error(
              `Không thể tạo đơn: ${result?.message || "Lỗi không xác định"}`
            );
          }
          return { ok: false };
        }

        // RPC thành công — tạo warranty cards (non-critical, chạy sau).
        await createWarrantyCardsForSale(newSale, parts, issuedBy);

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
      // công nợ), khớp với những gì persistence ghi xuống CSDL (#2). Hỗ trợ
      // thanh toán tách: 1 giao dịch + cộng số dư cho MỖI nguồn.
      if (actualPaidAmount > 0) {
        payments.forEach((p, idx) => {
          const cashTx: CashTransaction = {
            id: `CT-${Date.now()}-${idx}`,
            type: "income",
            date: new Date().toISOString(),
            amount: p.amount,
            notes: data.note || "Thu tiền bán hàng",
            paymentSourceId: p.source,
            branchId: currentBranchId,
            category: "sale_income",
            saleId,
          };
          setCashTransactions((prev) => [cashTx, ...prev]);
        });

        setPaymentSources((prev) =>
          prev.map((ps) => {
            const add = payments
              .filter((p) => p.source === ps.id)
              .reduce((s, p) => s + p.amount, 0);
            if (!add) return ps;
            return {
              ...ps,
              balance: {
                ...ps.balance,
                [currentBranchId]: (ps.balance[currentBranchId] || 0) + add,
              },
            };
          })
        );
      }

      // #2: Phần còn thiếu -> tạo công nợ optimistic ngay ở client cho CẢ hai luồng
      // (RPC atomic lẫn fallback đều chỉ ghi công nợ xuống DB, không cập nhật state),
      // để màn Công nợ hiển thị ngay mà không cần reload. Dùng cùng id với RPC/DB
      // (CDEBT-SALE-...) nên khi tải lại từ CSDL sẽ khớp, không nhân đôi.
      const remainingDebt = total - actualPaidAmount;
      if (remainingDebt > 0) {
        const optimisticDebt: CustomerDebt = {
          id: `CDEBT-SALE-${saleId}`,
          customerId:
            data.customer.id ||
            data.customer.phone ||
            `CUST-ANON-${saleId}`,
          customerName:
            data.customer.name?.trim() || data.customer.phone || "Khách lẻ",
          phone: data.customer.phone,
          description: `Mua hàng (Hóa đơn #${saleId})`,
          totalAmount: total,
          paidAmount: actualPaidAmount,
          remainingAmount: remainingDebt,
          createdDate: new Date().toISOString().split("T")[0],
          branchId: currentBranchId,
        };
        setCustomerDebts((prev) => [
          optimisticDebt,
          ...prev.filter((d) => d.id !== optimisticDebt.id),
        ]);
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
      setCustomerDebts,
      setParts,
      setPaymentSources,
      setSales,
      createWarrantyCardsForSale,
    ]
  );

  const deleteSale = useCallback(
    (saleId: string) => {
      const sale = sales.find((s) => s.id === saleId);
      if (!sale) return;

      const saleBranchId = sale.branchId || currentBranchId;

      // Cập nhật state cục bộ sau khi CSDL đã hoàn tất xóa/hoàn (dùng chung cho
      // cả nhánh RPC và fallback).
      const applyLocalDelete = (
        branch: string,
        refundBySource: Record<string, number>,
        hadDebts: boolean
      ) => {
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
                [branch]: (p.stock[branch] || 0) + soldQty,
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
                [branch]: (ps.balance[branch] || 0) - refund,
              },
            };
          })
        );

        if (hadDebts) {
          setCustomerDebts((prev) =>
            prev.filter(
              (d) =>
                d.id !== `CDEBT-SALE-${saleId}` &&
                (d as any).saleId !== saleId &&
                (d as any).sale_id !== saleId
            )
          );
        }
      };

      void (async () => {
        // ── Thử RPC nguyên tử trước (hoàn kho + hoàn tiền + xóa nợ trong 1 TX) ──
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "sale_delete_atomic",
          { p_sale_id: saleId, p_branch_id: saleBranchId }
        );

        const isRpcMissing =
          !!rpcError &&
          (rpcError.code === "PGRST202" ||
            rpcError.message?.includes("could not find") ||
            (rpcError as any).status === 404);

        if (!rpcError && rpcResult) {
          const result =
            typeof rpcResult === "string" ? JSON.parse(rpcResult) : rpcResult;
          if (!result.success) {
            showToast.error(
              `Không thể xóa đơn: ${result.message || "Lỗi không xác định"}`
            );
            return;
          }
          const branch = result.branchId || saleBranchId;
          const refunds: Record<string, number> = result.refunds || {};
          applyLocalDelete(branch, refunds, true);
          showToast.success(
            "Đã xóa phiếu bán hàng, hoàn kho và hoàn tiền thành công."
          );
          return;
        }

        if (rpcError && !isRpcMissing) {
          showToast.error(
            `Không thể xóa đơn trên CSDL: ${rpcError.message || "Lỗi CSDL"}`
          );
          return;
        }

        // ── Fallback: RPC chưa deploy -> luồng từng bước (không atomic) ──────
        console.warn(
          "[deleteSale] RPC sale_delete_atomic chưa có, dùng fallback từng bước"
        );

        // Query linked cash transactions directly from the database (bypass stale client state)
        const { data: dbLinkedTx } = await supabase
          .from("cash_transactions")
          .select("*")
          .or(`saleid.eq.${saleId},saleId.eq.${saleId}`);
        const actualLinkedTx = dbLinkedTx || [];

        // Query linked customer debts directly from the database (bypass stale client state)
        const { data: dbLinkedDebts } = await supabase
          .from("customer_debts")
          .select("*")
          .or(`sale_id.eq.${saleId},saleId.eq.${saleId}`);
        const actualLinkedDebts = dbLinkedDebts || [];

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

        // 1) Hoàn kho nguyên tử (RPC, fallback read-modify-write) trên ĐÚNG chi nhánh của đơn hàng
        const incRes = await incrementStockForReturn(
          sale.items.map((it) => ({ partId: it.partId, quantity: it.quantity })),
          saleBranchId
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
        //    theo đúng số đã thu trên ĐÚNG chi nhánh ghi nhận đơn hàng.
        const refundBySource: Record<string, number> = {};
        let refundFailed = false;
        for (const tx of actualLinkedTx) {
          const srcId = tx.paymentsource || tx.paymentSource || tx.paymentSourceId || sale.paymentMethod;
          const amt = Number(tx.amount || 0);
          const delRes = await deleteCashTransaction(tx.id, { skipBalanceUpdate: true });
          if (!delRes.ok) {
            refundFailed = true;
            continue;
          }
          if (amt > 0) {
            const balRes = await updatePaymentSourceBalance(
              srcId,
              saleBranchId,
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

        // 3) Xóa công nợ liên kết với đơn (nếu có)
        for (const d of actualLinkedDebts) {
          await deleteCustomerDebt(d.id);
        }

        // 4) Đảo thống kê khách hàng (best-effort)
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
                [saleBranchId]: (p.stock[saleBranchId] || 0) + soldQty,
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
                [saleBranchId]: (ps.balance[saleBranchId] || 0) - refund,
              },
            };
          })
        );

        if (actualLinkedDebts.length > 0) {
          setCustomerDebts((prev) =>
            prev.filter((d) => (d as any).saleId !== saleId && (d as any).sale_id !== saleId)
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
      setCashTransactions,
      setCustomerDebts,
      setParts,
      setPaymentSources,
      setSales,
    ]
  );

  const returnSaleItems = useCallback(
    (input: {
      saleId: string;
      items: { partId: string; quantity: number }[];
      refundAmount: number;
      refundSource: string;
      reason?: string;
    }): Promise<{ ok: boolean; message?: string }> => {
      const sale = sales.find((s) => s.id === input.saleId);
      const branch = sale?.branchId || currentBranchId;
      const items = input.items.filter((i) => i.quantity > 0);
      if (!items.length)
        return Promise.resolve({ ok: false, message: "Chưa chọn số lượng trả" });

      return (async () => {
        const returnId = `RET-${input.saleId}-${Date.now()}`;
        const { data: userData } = await supabase.auth.getUser();

        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "sale_return_partial_atomic",
          {
            p_sale_id: input.saleId,
            p_branch_id: branch,
            p_items: items,
            p_refund_amount: Math.max(0, input.refundAmount || 0),
            p_refund_source: input.refundSource || "cash",
            p_reason: input.reason || null,
            p_return_id: returnId,
            p_created_by: userData?.user?.id || null,
          }
        );

        if (rpcError) {
          const isMissing =
            rpcError.code === "PGRST202" ||
            rpcError.message?.includes("could not find") ||
            (rpcError as any).status === 404;
          showToast.error(
            isMissing
              ? "RPC sale_return_partial_atomic chưa được deploy. Vui lòng áp dụng migration."
              : `Lỗi trả hàng: ${rpcError.message || "Lỗi CSDL"}`
          );
          return { ok: false, message: rpcError.message };
        }

        const result =
          typeof rpcResult === "string" ? JSON.parse(rpcResult) : rpcResult;
        if (!result || !result.success) {
          if (result?.invalid && Array.isArray(result.invalid)) {
            showToast.error("Số lượng trả vượt quá số còn lại của đơn.");
          } else {
            showToast.error(
              `Không thể trả hàng: ${result?.message || "Lỗi không xác định"}`
            );
          }
          return { ok: false, message: result?.message };
        }

        // 1) Hoàn kho cục bộ.
        setParts((prev) =>
          prev.map((p) => {
            const q = items
              .filter((i) => i.partId === p.id)
              .reduce((s, i) => s + i.quantity, 0);
            if (!q) return p;
            return {
              ...p,
              stock: { ...p.stock, [branch]: (p.stock[branch] || 0) + q },
            };
          })
        );

        // 2) Cập nhật returnedQty + cờ refunded trên đơn.
        setSales((prev) =>
          prev.map((s) => {
            if (s.id !== input.saleId) return s;
            const newItems = s.items.map((it) => {
              const q = items
                .filter((i) => i.partId === it.partId)
                .reduce((sum, i) => sum + i.quantity, 0);
              if (!q) return it;
              return { ...it, returnedQty: (it.returnedQty || 0) + q };
            });
            return {
              ...s,
              items: newItems,
              refunded: result.fullyReturned || (s as any).refunded,
            } as any;
          })
        );

        // 3) Hoàn tiền -> cash tx (chi) + trừ số dư nguồn.
        const refunds: Record<string, number> = result.refunds || {};
        const refundTotal = Object.values(refunds).reduce(
          (s, n) => s + Number(n || 0),
          0
        );
        if (refundTotal > 0) {
          const ct: CashTransaction = {
            id: `CT-${returnId}`,
            type: "expense",
            date: new Date().toISOString(),
            amount: refundTotal,
            notes: `Hoàn tiền trả hàng (HĐ #${input.saleId})`,
            paymentSourceId: input.refundSource,
            branchId: branch,
            category: "sale_refund",
            saleId: input.saleId,
          };
          setCashTransactions((prev) => [ct, ...prev]);
          setPaymentSources((prev) =>
            prev.map((ps) => {
              const amt = refunds[ps.id] || 0;
              if (!amt) return ps;
              return {
                ...ps,
                balance: {
                  ...ps.balance,
                  [branch]: (ps.balance[branch] || 0) - amt,
                },
              };
            })
          );
        }

        showToast.success("Đã trả hàng và hoàn kho thành công.");
        return { ok: true };
      })();
    },
    [
      sales,
      currentBranchId,
      setParts,
      setSales,
      setCashTransactions,
      setPaymentSources,
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
            skipBalanceUpdate: true,
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
            skipBalanceUpdate: true,
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
    returnSaleItems,
    recordInventoryTransaction,
    payCustomerDebts,
    paySupplierDebts,
  };
}
