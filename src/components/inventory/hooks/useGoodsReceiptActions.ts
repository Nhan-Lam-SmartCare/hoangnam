import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { showToast } from "../../../utils/toast";
import { generateSKU } from "../../../utils/sku";
import {
  createPart,
  updatePart,
  fetchPartBySku,
} from "../../../lib/repository/partsRepository";
import {
  fetchSupplierById,
  resolveOrCreateSupplier,
} from "../../../lib/repository/suppliersRepository";
import { fetchPaymentSourceRows } from "../../../lib/repository/paymentSourcesRepository";
import { createCashTransaction } from "../../../lib/repository/cashTransactionsRepository";
import { createSupplierDebt } from "../../../lib/repository/debtsRepository";
import {
  deleteReceiptAtomic,
  editReceiptAtomic,
} from "../../../lib/repository/goodsReceiptRepository";
import { useCreateReceiptAtomicRepo } from "../../../hooks/useInventoryTransactionsRepository";
import type { Part } from "../../../types";

type ConfirmFn = (options: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "red" | "blue" | "green";
}) => Promise<boolean>;

interface ProfileLike {
  id?: string;
  name?: string;
  full_name?: string;
}

export interface GoodsReceiptItem {
  partId: string;
  partName: string;
  quantity: number;
  importPrice: number;
  laborCost?: number;
  sellingPrice: number;
  wholesalePrice?: number;
  /**
   * IMEI của TỪNG máy trong dòng này — độ dài phải bằng `quantity` với sản phẩm
   * `is_serialized`. `receipt_create_atomic` sẽ tạo một bản ghi `part_units`
   * cho mỗi phần tử.
   */
  imeis?: string[];
  /** Giữ tương thích với ô IMEI đơn cũ; luôn bằng `imeis[0]`. */
  imei?: string;
  /** Màu áp cho mọi máy trong dòng (thường cả lô nhập cùng màu). */
  color?: string;
  _isNewProduct?: boolean;
  _productData?: {
    name: string;
    sku: string;
    barcode: string;
    category: string;
    description: string;
    warrantyPeriod?: string;
    importPrice: number;
    laborCost?: number;
    retailPrice: number;
    wholesalePrice: number;
  };
}

/**
 * Gom IMEI của một dòng phiếu về một mảng sạch.
 *
 * Modal có hai đường nhập IMEI cùng tồn tại: mảng `imeis` (nhiều máy, dùng cho
 * chi nhánh điện thoại) và ô đơn `imei` cũ (AddProductModal). Hàm này hợp nhất,
 * cắt khoảng trắng và bỏ ô trống — nhân viên bỏ trống ô #3 giữa chừng không
 * được sinh ra một `part_units` rỗng.
 *
 * Trả `undefined` khi không có IMEI nào, để không gửi mảng rỗng xuống RPC.
 */
function normalizeImeis(item: GoodsReceiptItem): string[] | undefined {
  const raw =
    item.imeis && item.imeis.length > 0
      ? item.imeis
      : item.imei
        ? [item.imei]
        : [];

  const clean = raw.map((s) => (s || "").trim()).filter((s) => s.length > 0);
  return clean.length > 0 ? clean : undefined;
}

export interface GoodsReceiptPaymentInfo {
  paymentMethod: "cash" | "bank";
  paymentType: "full" | "partial" | "note";
  paidAmount: number;
  discount: number;
}

export interface UseGoodsReceiptActionsParams {
  currentBranchId: string;
  profile: ProfileLike | null | undefined;
  allPartsData: Part[] | undefined;
  canDeleteReceipt: boolean;
  confirm: ConfirmFn;
  refetchAllParts: () => Promise<unknown>;
  refetchInventory: () => Promise<unknown>;
  /** Gọi sau khi lưu phiếu nhập thành công (component đóng modal tại đây). */
  onReceiptSaved: () => void;
}

/**
 * Nghiệp vụ phiếu nhập kho: tạo phiếu (RPC atomic + đồng bộ giá + sổ quỹ/công
 * nợ), sửa phiếu (editReceiptAtomic), xóa phiếu (deleteReceiptAtomic). Sở hữu
 * state `editingReceipt`. Tách NGUYÊN VĂN từ InventoryManager.
 */
export function useGoodsReceiptActions({
  currentBranchId,
  profile,
  allPartsData,
  canDeleteReceipt,
  confirm,
  refetchAllParts,
  refetchInventory,
  onReceiptSaved,
}: UseGoodsReceiptActionsParams) {
  const queryClient = useQueryClient();
  const createReceiptAtomicMutation = useCreateReceiptAtomicRepo();
  const [editingReceipt, setEditingReceipt] = useState<any | null>(null);

  const handleSaveGoodsReceipt = useCallback(
    async (
      items: GoodsReceiptItem[],
      supplierId: string,
      totalAmount: number,
      note: string,
      paymentInfo?: GoodsReceiptPaymentInfo
    ) => {
      // Generate receipt code: NH-YYYYMMDD-XXXX (using base36 timestamp suffix for uniqueness)
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const timeSuffix = Date.now().toString(36).slice(-4).toUpperCase();
      const receiptCode = `NH-${dateStr}-${timeSuffix}`;

      // Get supplier name
      const supplierRes = await fetchSupplierById(supplierId);
      const supplierName =
        (supplierRes.ok && supplierRes.data?.name) || "Không xác định";

      // Calculate debt amount
      const paidAmount = paymentInfo?.paidAmount || 0;
      const debtAmount = totalAmount - paidAmount;

      // Không có trigger nào trên inventory_transactions (đã xác minh trên DB
      // 2026-07-26 — pg_trigger trả 0 dòng; xem tests/integration/
      // inventory_trigger_correctness.test.ts). Toàn bộ việc cộng tồn kho do RPC
      // receipt_create_atomic làm bên trong MỘT transaction, kèm khóa hàng
      // SELECT ... FOR UPDATE. Cùng transaction đó ghi luôn part_units (IMEI).
      //
      // Ở đây chỉ còn:
      // 1. Tạo sản phẩm mới nếu có (item tạm)
      // 2. Gọi RPC (stock + inventory_transactions + part_units, nguyên tử)
      // 3. Đồng bộ giá về bảng parts — RPC cố ý không đụng tới giá
      // 4. Ghi sổ quỹ / công nợ NCC

      try {
        // First, create any new products that were added temporarily
        const processedItems = await Promise.all(
          items.map(async (item) => {
            if (item._isNewProduct && item._productData) {
              // Create the new product in DB
              try {
                // OPTIMIZATION: Use direct createPart instead of mutation hook to avoid
                // triggering query invalidations for EVERY new product (causing UI freeze)
                // usage: createPart(input) returns RepoResult<Part>
                const result = await createPart({
                  name: item._productData.name,
                  sku: item._productData.sku,
                  barcode: item._productData.barcode || "",
                  category: item._productData.category,
                  description: item._productData.description || "",
                  warrantyPeriod: item._productData.warrantyPeriod,
                  stock: { [currentBranchId]: 0 }, // Stock = 0, sẽ cập nhật khi hoàn tất phiếu nhập
                  costPrice: {
                    [currentBranchId]: item._productData.importPrice,
                  },
                  laborCost: {
                    [currentBranchId]: Number(item._productData.laborCost || 0),
                  } as any,
                  retailPrice: {
                    [currentBranchId]: item._productData.retailPrice,
                  },
                  wholesalePrice: {
                    [currentBranchId]:
                      Number(item._productData.laborCost || 0),
                  },
                });

                if (!result.ok || !result.data) {
                  const errorMessage = !result.ok
                    ? result.error?.message || "Lỗi không xác định"
                    : "Không nhận được dữ liệu sản phẩm";
                  console.error("❌ Link lỗi khi tạo sản phẩm:", errorMessage);
                  throw new Error(
                    `Không thể tạo sản phẩm ${item._productData.name}: ${errorMessage}`
                  );
                }

                const createdPart = result.data;
                const realPartId = createdPart?.id;

                if (!realPartId || realPartId.startsWith("temp-")) {
                  console.error(
                    "❌ Không lấy được ID thật sau khi tạo sản phẩm:",
                    createdPart
                  );
                  throw new Error(
                    `Không thể tạo sản phẩm ${item._productData.name}`
                  );
                }

                return {
                  partId: realPartId,
                  partName: item.partName,
                  quantity: item.quantity,
                  importPrice: item.importPrice,
                  laborCost: Number(item.laborCost || item._productData.laborCost || 0),
                  sellingPrice: item.sellingPrice,
                  wholesalePrice: item.wholesalePrice || 0,
                  imeis: normalizeImeis(item),
                  color: (item.color || "").trim() || undefined,
                  colors: item.colors ? item.colors.map((c) => (c || "").trim()) : undefined,
                };
              } catch (error) {
                console.error("❌ Lỗi khi tạo sản phẩm:", error);
                throw new Error(
                  `Không thể tạo sản phẩm ${item._productData.name}: ${error}`
                );
              }
            }
            // Existing product, return as-is
            return {
              partId: item.partId,
              partName: item.partName,
              quantity: item.quantity,
              importPrice: item.importPrice,
              laborCost: Number(item.laborCost || 0),
              sellingPrice: item.sellingPrice,
              wholesalePrice: item.wholesalePrice || 0,
              imeis: normalizeImeis(item),
              color: (item.color || "").trim() || undefined,
              colors: item.colors ? item.colors.map((c) => (c || "").trim()) : undefined,
            };
          })
        );

        // Use atomic RPC for receipt creation and stock update
        await createReceiptAtomicMutation.mutateAsync({
          items: processedItems,
          supplierId,
          branchId: currentBranchId,
          userId: profile?.id || "unknown",
          notes: `${receiptCode} | NV:${profile?.name || profile?.full_name || "Nhân viên"
            } NCC:${supplierName}${note ? " | " + note : ""}`,
        });

        // Keep branch pricing in parts table in sync with receipt lines so "Giá nhập" shows immediately.
        await Promise.all(
          processedItems.map(async (item) => {
            if (!item.partId) return;

            const existing = (allPartsData || []).find((p) => p.id === item.partId);
            const currentCost = Number(existing?.costPrice?.[currentBranchId] || 0);
            const currentRetail = Number(existing?.retailPrice?.[currentBranchId] || 0);
            const currentWholesale = Number(existing?.wholesalePrice?.[currentBranchId] || 0);
            const currentLabor = Number((existing as any)?.laborCost?.[currentBranchId] || 0);

            const nextCost = Number(item.importPrice || 0) > 0 ? Number(item.importPrice) : currentCost;
            const nextRetail = Number(item.sellingPrice || 0) > 0 ? Number(item.sellingPrice) : currentRetail;
            const nextWholesale =
              Number(item.laborCost || 0) > 0
                ? Number(item.laborCost)
                : Number(item.wholesalePrice || 0) > 0
                  ? Number(item.wholesalePrice)
                  : currentWholesale;
            const nextLabor = Number(item.laborCost || 0) > 0 ? Number(item.laborCost) : currentLabor;

            const updateRes = await updatePart(item.partId, {
              costPrice: {
                ...(existing?.costPrice || {}),
                [currentBranchId]: nextCost,
              },
              retailPrice: {
                ...(existing?.retailPrice || {}),
                [currentBranchId]: nextRetail,
              },
              wholesalePrice: {
                ...(existing?.wholesalePrice || {}),
                [currentBranchId]: nextWholesale,
              },
              laborCost: {
                ...((existing as any)?.laborCost || {}),
                [currentBranchId]: nextLabor,
              } as any,
            } as any);

            if (!updateRes.ok) {
              console.warn("[GoodsReceipt] Could not sync part pricing after receipt", {
                partId: item.partId,
                error: updateRes.error,
              });
            }
          })
        );

        queryClient.invalidateQueries({ queryKey: ["partsRepo"] });
        queryClient.invalidateQueries({ queryKey: ["partsRepoPaged"] });
        queryClient.invalidateQueries({ queryKey: ["allPartsForTotals"] });

        // OPTIMIZATION: Run Cash Transaction and Debt Creation in parallel
        // Track failures for consolidated notification
        let paymentFailed = false;
        let paymentErrorDetail = "";
        let debtFailed = false;

        await Promise.all([
          // 1. Ghi chi tiền vào sổ quỹ
          (async () => {
            if (paidAmount > 0 && paymentInfo) {
              const resolvePaymentSourceCandidates = async (
                paymentMethod: "cash" | "bank"
              ): Promise<string[]> => {
                const preferred = paymentMethod === "bank" ? "bank" : "cash";
                const candidates: string[] = [];

                const pushCandidate = (value: unknown) => {
                  const id = String(value || "").trim();
                  if (!id) return;
                  if (!candidates.includes(id)) {
                    candidates.push(id);
                  }
                };

                const rowsRes = await fetchPaymentSourceRows();
                const rows = rowsRes.ok ? rowsRes.data : [];

                if (rows.length > 0) {
                  const normalized = rows.map((row: any) => ({
                    id: String(
                      row?.id ||
                      row?.paymentSourceId ||
                      row?.paymentsourceid ||
                      row?.payment_source_id ||
                      ""
                    ),
                    type: String(row?.type || "").toLowerCase(),
                    name: String(row?.name || "").toLowerCase(),
                  }));

                  const exactById = normalized.find((row) => row.id === preferred);
                  if (exactById?.id) pushCandidate(exactById.id);

                  const byType = normalized.find((row) => row.type === preferred);
                  if (byType?.id) pushCandidate(byType.id);

                  const byName = normalized.find((row) =>
                    preferred === "bank"
                      ? row.name.includes("ngan hang") || row.name.includes("bank")
                      : row.name.includes("tien mat") || row.name.includes("cash")
                  );
                  if (byName?.id) pushCandidate(byName.id);

                  if (normalized[0]?.id) pushCandidate(normalized[0].id);
                }

                if (candidates.length === 0) {
                  candidates.push(preferred);
                }
                return candidates;
              };

              const isLikelyPaymentSourceError = (err: any): boolean => {
                const text = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();
                return (
                  text.includes("paymentsource") ||
                  text.includes("payment source") ||
                  text.includes("foreign key") ||
                  text.includes("violates")
                );
              };

              const paymentSourceCandidates = await resolvePaymentSourceCandidates(
                paymentInfo.paymentMethod
              );
              let cashTxResult: any = null;

              for (const candidateId of paymentSourceCandidates) {
                cashTxResult = await createCashTransaction({
                  type: "expense",
                  amount: paidAmount,
                  branchId: currentBranchId,
                  paymentSourceId: candidateId,
                  date: today.toISOString(),
                  notes: `Chi trả NCC ${supplierName} - Phiếu nhập ${receiptCode}`,
                  category: "inventory_purchase",
                  supplierId: supplierId,
                  recipient: supplierName,
                });

                if (cashTxResult.ok) break;
                if (!isLikelyPaymentSourceError(cashTxResult.error)) break;
              }

              if (!cashTxResult.ok) {
                console.error("❌ Lỗi ghi sổ quỹ:", cashTxResult.error);
                paymentFailed = true;
                paymentErrorDetail = String(
                  cashTxResult?.error?.message ||
                  cashTxResult?.error?.details ||
                  cashTxResult?.error?.code ||
                  "Unknown"
                );
              }
            }
          })(),

          // 2. Create supplier debt
          (async () => {
            if (debtAmount > 0 && paymentInfo) {
              const debtRes = await createSupplierDebt({
                supplierId,
                supplierName,
                branchId: currentBranchId,
                totalAmount: debtAmount,
                paidAmount: 0,
                remainingAmount: debtAmount,
                description: `Nợ tiền nhập hàng (Phiếu ${receiptCode})${note ? ` - ${note}` : ""}`,
                createdDate: new Date().toISOString(),
              });

              if (!debtRes.ok) {
                console.error("❌ Lỗi tạo công nợ:", debtRes.error.cause);
                debtFailed = true;
              } else {
                // Invalidate supplier debts query to refresh UI
                queryClient.invalidateQueries({ queryKey: ["supplierDebts"] });
              }
            }
          })(),
        ]);

        // Show consolidated error message if any payment/debt failed
        if (paymentFailed || debtFailed) {
          const failedParts = [];
          if (paymentFailed) failedParts.push("sổ quỹ");
          if (debtFailed) failedParts.push("công nợ");
          const detailText = paymentErrorDetail
            ? ` [Chi tiết sổ quỹ: ${paymentErrorDetail}]`
            : "";
          showToast.error(
            `⚠️ Nhập kho OK nhưng chưa ghi được ${failedParts.join(" và ")}! Mã phiếu: ${receiptCode}.${detailText} Vui lòng vào Lịch sử nhập kho → Chỉnh sửa → Tạo phiếu chi để bổ sung.`,
            { autoClose: 10000 } // Keep visible longer
          );
        }

        // Invalidate inventory transactions to refresh history
        queryClient.invalidateQueries({ queryKey: ["inventoryTransactions"] });

        onReceiptSaved();
        showToast.success(`Nhập kho thành công! Mã phiếu: ${receiptCode}`);
      } catch (err: any) {
        console.error("🛑 Lỗi lưu phiếu nhập kho:", err);
        showToast.error(`Lỗi: ${err.message || "Không rõ"}`);
      }
    },
    [
      allPartsData,
      currentBranchId,
      createReceiptAtomicMutation,
      profile?.id,
      profile?.name,
      profile?.full_name,
      queryClient,
      onReceiptSaved,
    ]
  );

  // Handle save edited receipt
  const handleSaveEditedReceipt = async (updatedData: {
    supplier: string;
    supplierPhone: string;
    items: any[];
    payments: any[];
    isPaid: boolean;
  }) => {
    if (!editingReceipt) return;
    const { receiptCode } = editingReceipt;

    try {
      // 1. Resolve supplier ID or create new one
      const supplierName = updatedData.supplier;
      const supplierRes = await resolveOrCreateSupplier(
        supplierName,
        updatedData.supplierPhone
      );
      let supplierId = supplierRes.ok ? supplierRes.data?.id : undefined;
      if (!supplierId) {
        throw new Error(supplierRes.ok ? "Không thể định danh nhà cung cấp" : supplierRes.error?.message || "Lỗi định danh nhà cung cấp");
      }

      // 2. Resolve part IDs for items (some might be new or existing)
      const processedItems = await Promise.all(
        updatedData.items.map(async (item) => {
          let partId = item.partId || item.id;
          if (!partId || String(partId).startsWith("new-") || String(partId).startsWith("temp-")) {
            // Find part by SKU
            const existingRes = await fetchPartBySku(item.sku);
            const existingPart = existingRes.ok ? existingRes.data : null;

            if (existingPart) {
              partId = existingPart.id;
            } else {
              // Create new part
              const createRes = await createPart({
                name: item.partName,
                sku: item.sku || generateSKU(),
                stock: { [currentBranchId]: 0 },
                costPrice: { [currentBranchId]: item.unitPrice },
                retailPrice: { [currentBranchId]: Math.round(item.unitPrice * 1.5) },
                wholesalePrice: { [currentBranchId]: Math.round(item.unitPrice * 1.35) },
              });
              if (createRes.ok && createRes.data) {
                partId = createRes.data.id;
              } else {
                throw new Error(`Không thể tạo sản phẩm ${item.partName}`);
              }
            }
          }

          return {
            partId,
            partName: item.partName,
            quantity: Number(item.quantity) || 1,
            importPrice: Number(item.unitPrice) || 0,
            sellingPrice: Number(item.unitPrice * 1.5) || 0,
          };
        })
      );

      // 3. Cập nhật phiếu nhập kho và hoàn/cộng tồn kho atomically via editReceiptAtomic
      const editNotes = `${receiptCode} | NV:${profile?.name || profile?.full_name || "Nhân viên"} NCC:${supplierName} | Đã chỉnh sửa`;
      const editRes = await editReceiptAtomic(
        receiptCode,
        processedItems,
        supplierId,
        currentBranchId,
        profile?.id || "unknown",
        editNotes
      );
      if (!editRes.ok) {
        throw editRes.error.cause || new Error(editRes.error.message);
      }

      // 6. Calculate total amount
      const totalAmount = processedItems.reduce((sum, item) => sum + item.quantity * item.importPrice, 0);
      const paidAmount = updatedData.isPaid ? totalAmount : 0;
      const debtAmount = totalAmount - paidAmount;

      // 7. Create cash transaction and supplier debt if needed
      if (paidAmount > 0) {
        await createCashTransaction({
          type: "expense",
          amount: paidAmount,
          branchId: currentBranchId,
          paymentSourceId: "cash",
          date: new Date().toISOString(),
          notes: `Chi trả NCC ${supplierName} - Phiếu nhập ${receiptCode} (Đã sửa)`,
          category: "inventory_purchase",
          supplierId: supplierId,
          recipient: supplierName,
        });
      }

      if (debtAmount > 0) {
        await createSupplierDebt({
          supplierId: supplierId || "",
          supplierName,
          branchId: currentBranchId,
          totalAmount: debtAmount,
          paidAmount: 0,
          remainingAmount: debtAmount,
          description: `Nợ tiền nhập hàng (Phiếu ${receiptCode} - Đã sửa)`,
          createdDate: new Date().toISOString(),
        });
      }

      showToast.success(`Cập nhật thành công phiếu nhập ${receiptCode}!`);
      setEditingReceipt(null);

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ["inventoryTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["supplierDebts"] });
      queryClient.invalidateQueries({ queryKey: ["partsRepo"] });
      queryClient.invalidateQueries({ queryKey: ["partsRepoPaged"] });
      queryClient.invalidateQueries({ queryKey: ["allPartsForTotals"] });
      refetchAllParts();
      refetchInventory();
    } catch (error: any) {
      console.error("Error saving edited receipt:", error);
      showToast.error("Lỗi cập nhật phiếu nhập: " + error.message);
    }
  };

  // Handle delete receipt
  const handleDeleteReceipt = async (receiptCode: string) => {
    if (!canDeleteReceipt) {
      showToast.error("Bạn không có quyền xóa phiếu nhập kho");
      return;
    }

    const confirmed = await confirm({
      title: "Xác nhận xóa phiếu nhập",
      message: `Bạn có chắc chắn muốn xóa phiếu nhập "${receiptCode}"? Hành động này sẽ hoàn tác tồn kho và công nợ liên quan.`,
      confirmText: "Xóa phiếu",
      cancelText: "Hủy",
      confirmColor: "red",
    });

    if (!confirmed) return;

    try {
      // Call atomic delete RPC via repository
      const delRes = await deleteReceiptAtomic(receiptCode, currentBranchId);
      if (!delRes.ok) throw delRes.error.cause || new Error(delRes.error.message);

      showToast.success(`Đã xóa phiếu nhập ${receiptCode} và hoàn trả tồn kho`);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["inventoryTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["supplierDebts"] });
      queryClient.invalidateQueries({ queryKey: ["partsRepo"] });
      queryClient.invalidateQueries({ queryKey: ["partsRepoPaged"] });
      queryClient.invalidateQueries({ queryKey: ["allPartsForTotals"] });
      refetchAllParts();

    } catch (error: any) {
      console.error("Delete receipt error:", error);
      showToast.error(`Lỗi xóa phiếu: ${error.message}`);
    }
  };

  return {
    editingReceipt,
    setEditingReceipt,
    handleSaveGoodsReceipt,
    handleSaveEditedReceipt,
    handleDeleteReceipt,
  };
}
