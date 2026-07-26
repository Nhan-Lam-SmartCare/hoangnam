import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchUnitsByPart,
  fetchAvailableUnits,
  fetchUnitCountsByParts,
  fetchSerializedPartIds,
  searchUnitsByImei,
  checkImeis,
  markUnitsSold,
  releaseUnits,
  releaseUnitsBySale,
  updateUnit,
} from "../lib/repository/partUnitsRepository";
import type { PartUnit } from "../types";
import { showToast } from "../utils/toast";

/**
 * Hook cho `part_units` — tồn kho theo từng máy có IMEI.
 * Xem src/lib/repository/partUnitsRepository.ts và sql/2026-07-26_create_part_units.sql.
 */

/**
 * Mọi mutation đổi trạng thái máy đều phải làm mới cả `partsRepo`, vì
 * `parts.stock` và `part_units` là hai mặt của cùng một sự thật — hiển thị lệch
 * nhau sẽ khiến người dùng mất tin vào số liệu.
 */
const invalidateUnitQueries = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["partUnits"] });
  qc.invalidateQueries({ queryKey: ["partsRepo"] });
  qc.invalidateQueries({ queryKey: ["partsRepoPaged"] });
  qc.invalidateQueries({ queryKey: ["allPartsForTotals"] });
};

/** Danh sách máy của một sản phẩm. `enabled` để lazy-load khi bung dòng bảng kho. */
export const usePartUnits = (
  partId: string | undefined,
  branchId: string | undefined,
  enabled = true
) =>
  useQuery({
    queryKey: ["partUnits", partId, branchId],
    queryFn: async () => {
      const res = await fetchUnitsByPart(partId!, branchId!);
      if (!res.ok) throw res.error;
      return res.data;
    },
    enabled: Boolean(partId && branchId && enabled),
  });

/** Máy còn bán được — dùng ở modal chọn IMEI khi bán hàng. */
export const useAvailableUnits = (
  partId: string | undefined,
  branchId: string | undefined,
  enabled = true
) =>
  useQuery({
    queryKey: ["partUnits", "available", partId, branchId],
    queryFn: async () => {
      const res = await fetchAvailableUnits(partId!, branchId!);
      if (!res.ok) throw res.error;
      return res.data;
    },
    enabled: Boolean(partId && branchId && enabled),
  });

/** Tìm máy theo IMEI. Chỉ chạy khi gõ từ 3 ký tự để khỏi quét bảng vô ích. */
/**
 * Số máy còn kho của cả trang bảng tồn kho, gộp trong MỘT query.
 *
 * `queryKey` gồm danh sách id đã sắp xếp: đổi trang phải ra kết quả khác, nhưng
 * cùng một trang xem lại thì phải trúng cache.
 */
export const usePartUnitCounts = (
  partIds: string[],
  branchId: string | undefined
) => {
  const sortedIds = [...new Set(partIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["partUnits", "counts", branchId, sortedIds],
    queryFn: async () => {
      const res = await fetchUnitCountsByParts(sortedIds, branchId!);
      if (!res.ok) throw res.error;
      return res.data;
    },
    enabled: Boolean(branchId && sortedIds.length > 0),
    staleTime: 30_000,
  });
};

/**
 * Set id sản phẩm có máy ghi IMEI còn kho ở chi nhánh hiện tại.
 *
 * Trả `Set` chứ không phải mảng vì bên gọi (lưới bán hàng) chỉ hỏi "có hay không"
 * cho từng món trong vòng lặp render.
 */
export const useSerializedPartIds = (branchId: string | undefined) => {
  const query = useQuery({
    queryKey: ["partUnits", "serializedParts", branchId],
    queryFn: async () => {
      const res = await fetchSerializedPartIds(branchId!);
      if (!res.ok) throw res.error;
      return res.data;
    },
    enabled: Boolean(branchId),
    staleTime: 30_000,
  });
  return {
    ...query,
    serializedIds: new Set(query.data || []),
  };
};

export const useSearchUnitsByImei = (keyword: string, branchId?: string) =>
  useQuery({
    queryKey: ["partUnits", "search", keyword, branchId],
    queryFn: async () => {
      const res = await searchUnitsByImei(keyword, branchId);
      if (!res.ok) throw res.error;
      return res.data;
    },
    enabled: (keyword || "").trim().length >= 3,
  });

/**
 * Tiền kiểm IMEI trùng. Cố ý KHÔNG hiện toast: người dùng đang gõ dở, việc của
 * hook là trả dữ liệu để form tô đỏ đúng ô, không phải quăng thông báo.
 */
export const useCheckImeis = () =>
  useMutation({
    mutationFn: async (imeis: string[]) => {
      const res = await checkImeis(imeis);
      if (!res.ok) throw res.error;
      return res.data;
    },
  });

export const useMarkUnitsSold = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      unitIds: string[];
      saleId: string;
      soldAt?: string;
    }) => {
      const res = await markUnitsSold(params.unitIds, params.saleId, params.soldAt);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => invalidateUnitQueries(qc),
    onError: (e: any) =>
      showToast.error(e?.message || "Lỗi cập nhật trạng thái máy"),
  });
};

export const useReleaseUnits = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { unitIds: string[]; reason?: string }) => {
      const res = await releaseUnits(params.unitIds, params.reason);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => invalidateUnitQueries(qc),
    onError: (e: any) => showToast.error(e?.message || "Lỗi hoàn máy về kho"),
  });
};

export const useReleaseUnitsBySale = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { saleId: string; reason?: string }) => {
      const res = await releaseUnitsBySale(params.saleId, params.reason);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => invalidateUnitQueries(qc),
    onError: (e: any) => showToast.error(e?.message || "Lỗi hoàn máy của đơn bán"),
  });
};

export const useUpdatePartUnit = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      patch: Partial<Pick<PartUnit, "imei" | "color" | "sellingPrice" | "note" | "supplierId">>;
    }) => {
      const res = await updateUnit(params.id, params.patch);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      invalidateUnitQueries(qc);
      showToast.success("Đã cập nhật thông tin máy");
    },
    onError: (e: any) => showToast.error(e?.message || "Lỗi cập nhật máy"),
  });
};
