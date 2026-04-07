import React, { useState } from "react";
import { Shield, Plus, Search, Calendar, Wrench, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import {
    useWarrantyCards,
    useWarrantyClaims,
    useCreateWarrantyClaim,
    useUpdateWarrantyStatus,
    useUpdateWarrantyClaimStatus,
    type WarrantyCard,
    type WarrantyClaim,
} from "../../hooks/useWarrantyRepository";
import { WarrantyCardModal } from "../warranty/WarrantyCardModal";
import { formatDate } from "../../utils/format";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";

// eslint-disable-next-line max-lines-per-function
export const WarrantyManager: React.FC = () => {
    const { profile } = useAuth();
    const { data: warrantyCards, isLoading } = useWarrantyCards();
    const { data: warrantyClaims, isLoading: claimsLoading } = useWarrantyClaims();
    const createClaimMutation = useCreateWarrantyClaim();
    const updateWarrantyStatusMutation = useUpdateWarrantyStatus();
    const updateWarrantyClaimStatusMutation = useUpdateWarrantyClaimStatus();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "claimed" | "voided">("all");
    const [activeTab, setActiveTab] = useState<"cards" | "claims">("cards");
    const [claimingCard, setClaimingCard] = useState<WarrantyCard | null>(null);
    const [claimIssueText, setClaimIssueText] = useState("");
    const canCreateClaim = canDo(profile, "warranty.claim.create");
    const canManageClaim = canDo(profile, "warranty.claim.manage");

    const actorName =
        profile?.name ||
        profile?.full_name ||
        profile?.email ||
        "Người dùng";

    // Filter warranty cards
    const filteredCards = warrantyCards?.filter((card) => {
        const isExpired = new Date(card.warranty_end_date) < new Date();
        const effectiveStatus = isExpired ? "expired" : card.status;

        const matchesSearch =
            !searchQuery ||
            card.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.customer_phone?.includes(searchQuery) ||
            card.device_model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.imei_serial?.includes(searchQuery);

        const matchesStatus =
            statusFilter === "all" || effectiveStatus === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const filteredClaims = warrantyClaims?.filter((claim: any) => {
        if (!searchQuery) return true;
        const keyword = searchQuery.toLowerCase();
        return (
            String(claim?.warranty_cards?.customer_name || "").toLowerCase().includes(keyword) ||
            String(claim?.warranty_cards?.customer_phone || "").toLowerCase().includes(keyword) ||
            String(claim?.warranty_cards?.device_model || "").toLowerCase().includes(keyword) ||
            String(claim?.warranty_cards?.imei_serial || "").toLowerCase().includes(keyword) ||
            String(claim?.id || "").toLowerCase().includes(keyword)
        );
    });

    const getStatusBadge = (status: string, endDate: string) => {
        const isExpired = new Date(endDate) < new Date();

        if (status === "active" && !isExpired) {
            return (
                <span className="px-2 py-1 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-full text-xs font-bold">
                    ✓ Còn hạn
                </span>
            );
        }

        return (
            <span className="px-2 py-1 bg-slate-500/20 border border-slate-500 text-slate-400 rounded-full text-xs font-bold">
                Hết hạn
            </span>
        );
    };

    const getDaysRemaining = (endDate: string) => {
        const days = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    const getActionHistory = (claim: WarrantyClaim): Array<{ label: string; at?: string; by?: string; note?: string }> => {
        const rows: Array<{ label: string; at?: string; by?: string; note?: string }> = [
            {
                label: "Tiếp nhận yêu cầu",
                at: claim.created_at,
                note: claim.issue_description,
            },
        ];

        if (claim.approved_by && (claim.status === "approved" || claim.status === "completed")) {
            rows.push({
                label: "Đã duyệt",
                at: claim.updated_at,
                by: claim.approved_by,
            });
        }

        if (claim.status === "rejected") {
            rows.push({
                label: "Đã từ chối",
                at: claim.updated_at,
                by: claim.approved_by,
                note: claim.denial_reason,
            });
        }

        if (claim.status === "completed") {
            rows.push({
                label: "Đã hoàn tất",
                at: claim.completed_at,
                by: claim.completed_by,
            });
        }

        return rows;
    };

    const handleCreateClaim = async () => {
        if (!canCreateClaim) {
            showToast.error("Bạn không có quyền tiếp nhận bảo hành.");
            return;
        }
        if (!claimingCard) return;
        if (!claimIssueText.trim()) {
            showToast.warning("Vui lòng nhập mô tả lỗi khách báo.");
            return;
        }

        try {
            await createClaimMutation.mutateAsync({
                warrantyCardId: claimingCard.id,
                issueDescription: claimIssueText.trim(),
            });

            await updateWarrantyStatusMutation.mutateAsync({
                id: claimingCard.id,
                status: "claimed",
                notes: `Đã tiếp nhận bảo hành: ${claimIssueText.trim()}`,
            });

            showToast.success("Đã tiếp nhận yêu cầu bảo hành.");
            setClaimingCard(null);
            setClaimIssueText("");
            setActiveTab("claims");
        } catch (error) {
            console.error("Create warranty claim failed", error);
            showToast.error("Không thể tạo yêu cầu bảo hành.");
        }
    };

    const handleClaimStatus = async (
        claimId: string,
        status: "pending" | "approved" | "rejected" | "completed",
        warrantyCardId?: string
    ) => {
        if (!canManageClaim) {
            showToast.error("Bạn không có quyền xử lý yêu cầu bảo hành.");
            return;
        }
        try {
            await updateWarrantyClaimStatusMutation.mutateAsync({
                id: claimId,
                status,
                actor: actorName,
            });

            if (warrantyCardId) {
                if (status === "completed") {
                    await updateWarrantyStatusMutation.mutateAsync({
                        id: warrantyCardId,
                        status: "active",
                    });
                }
                if (status === "rejected") {
                    await updateWarrantyStatusMutation.mutateAsync({
                        id: warrantyCardId,
                        status: "active",
                    });
                }
            }

            showToast.success("Đã cập nhật trạng thái yêu cầu bảo hành.");
        } catch (error) {
            console.error("Update warranty claim status failed", error);
            showToast.error("Không thể cập nhật trạng thái yêu cầu.");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#151521] pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-700 dark:to-teal-700 text-white px-4 py-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold">Quản Lý Bảo Hành</h1>
                            <p className="text-xs text-emerald-100">
                                {activeTab === "cards"
                                    ? `${filteredCards?.length || 0} phiếu bảo hành`
                                    : `${filteredClaims?.length || 0} yêu cầu bảo hành`}
                            </p>
                        </div>
                    </div>
                    {activeTab === "cards" && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            Tạo mới
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                        onClick={() => setActiveTab("cards")}
                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === "cards"
                                ? "bg-white text-emerald-700"
                                : "bg-white/20 text-white hover:bg-white/30"
                        }`}
                    >
                        Phiếu bảo hành
                    </button>
                    <button
                        onClick={() => setActiveTab("claims")}
                        className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeTab === "claims"
                                ? "bg-white text-emerald-700"
                                : "bg-white/20 text-white hover:bg-white/30"
                        }`}
                    >
                        Tiếp nhận bảo hành
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo tên, SĐT, thiết bị, IMEI..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/60 focus:bg-white/30 focus:border-white/50 transition-all text-sm"
                    />
                </div>

                {/* Status Filter */}
                {activeTab === "cards" && (
                <div className="flex gap-2 mt-3">
                    {[
                        { value: "all", label: "Tất cả" },
                        { value: "active", label: "Còn hạn" },
                        { value: "expired", label: "Hết hạn" },
                        { value: "claimed", label: "Đang xử lý" },
                        { value: "voided", label: "Vô hiệu" },
                    ].map((filter) => (
                        <button
                            key={filter.value}
                            onClick={() => setStatusFilter(filter.value as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === filter.value
                                    ? "bg-white text-emerald-600"
                                    : "bg-white/20 text-white hover:bg-white/30"
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
                )}
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {activeTab === "cards" && (isLoading ? (
                    <div className="text-center py-12 text-slate-500">
                        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"></div>
                        Đang tải...
                    </div>
                ) : filteredCards && filteredCards.length > 0 ? (
                    filteredCards.map((card) => (
                        <div
                            key={card.id}
                            className="bg-white dark:bg-[#1e1e2d] rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            {card.device_model}
                                        </h3>
                                        {getStatusBadge(card.status, card.warranty_end_date)}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        IMEI: {card.imei_serial || "N/A"}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            if (!canCreateClaim) {
                                                showToast.error("Bạn không có quyền tiếp nhận bảo hành.");
                                                return;
                                            }
                                            setClaimingCard(card);
                                            setClaimIssueText("");
                                        }}
                                        disabled={!canCreateClaim}
                                        className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 dark:border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                                    >
                                        Tiếp nhận BH
                                    </button>
                                    {card.status !== "voided" && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await updateWarrantyStatusMutation.mutateAsync({ id: card.id, status: "voided" });
                                                    showToast.success("Đã vô hiệu phiếu bảo hành.");
                                                } catch {
                                                    showToast.error("Không thể cập nhật trạng thái phiếu.");
                                                }
                                            }}
                                            disabled={!canManageClaim}
                                            className="px-2 py-1 text-[11px] font-semibold rounded-lg border border-rose-300 text-rose-700 dark:text-rose-300 dark:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                                        >
                                            Vô hiệu
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Customer Info */}
                            <div className="flex items-center gap-2 mb-3 text-sm">
                                <span className="text-slate-500 dark:text-slate-400">👤</span>
                                <span className="text-slate-900 dark:text-white font-medium">
                                    {card.customer_name || "N/A"}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-600 dark:text-slate-300">
                                    {card.customer_phone || "N/A"}
                                </span>
                            </div>

                            {/* Warranty Info */}
                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        Thời hạn
                                    </div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                                        {card.warranty_period_months} tháng
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        Hết hạn
                                    </div>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(card.warranty_end_date)}
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                        Còn lại
                                    </div>
                                    <div className={`text-sm font-bold ${getDaysRemaining(card.warranty_end_date) > 30
                                            ? "text-emerald-500"
                                            : getDaysRemaining(card.warranty_end_date) > 0
                                                ? "text-orange-500"
                                                : "text-slate-400"
                                        }`}>
                                        {getDaysRemaining(card.warranty_end_date) > 0
                                            ? `${getDaysRemaining(card.warranty_end_date)} ngày`
                                            : "Đã hết hạn"}
                                    </div>
                                </div>
                            </div>

                            {/* Covered Parts */}
                            {card.covered_parts && card.covered_parts.length > 0 && (
                                <div className="mt-3">
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                        Phạm vi bảo hành:
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {card.covered_parts.map((part: string, idx: number) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg text-xs"
                                            >
                                                {part}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Shield className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            Chưa có phiếu bảo hành nào
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold"
                        >
                            Tạo phiếu đầu tiên
                        </button>
                    </div>
                ))}

                {activeTab === "claims" && (
                    claimsLoading ? (
                        <div className="text-center py-12 text-slate-500">
                            <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3"></div>
                            Đang tải yêu cầu...
                        </div>
                    ) : filteredClaims && filteredClaims.length > 0 ? (
                        filteredClaims.map((claim: any) => (
                            <div
                                key={claim.id}
                                className="bg-white dark:bg-[#1e1e2d] rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            {claim?.warranty_cards?.device_model || "Thiết bị"}
                                        </h3>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            {claim?.warranty_cards?.customer_name || "Khách lẻ"} - {claim?.warranty_cards?.customer_phone || "Không có SĐT"}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">Mã yêu cầu: {claim.id}</div>
                                    </div>
                                    <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                        {claim.status}
                                    </span>
                                </div>

                                <div className="mt-3 text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                                    {claim.issue_description || "Không có mô tả lỗi"}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleClaimStatus(claim.id, "approved", claim.warranty_card_id)}
                                        disabled={!canManageClaim || claim.status === "approved" || claim.status === "completed"}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-blue-300 text-blue-700 dark:text-blue-300 dark:border-blue-500/40 disabled:opacity-50 inline-flex items-center gap-1"
                                    >
                                        <Clock3 className="w-3.5 h-3.5" /> Duyệt
                                    </button>
                                    <button
                                        onClick={() => handleClaimStatus(claim.id, "completed", claim.warranty_card_id)}
                                        disabled={!canManageClaim || claim.status === "completed"}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-700 dark:text-emerald-300 dark:border-emerald-500/40 disabled:opacity-50 inline-flex items-center gap-1"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn tất
                                    </button>
                                    <button
                                        onClick={() => handleClaimStatus(claim.id, "rejected", claim.warranty_card_id)}
                                        disabled={!canManageClaim || claim.status === "rejected" || claim.status === "completed"}
                                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-rose-300 text-rose-700 dark:text-rose-300 dark:border-rose-500/40 disabled:opacity-50 inline-flex items-center gap-1"
                                    >
                                        <XCircle className="w-3.5 h-3.5" /> Từ chối
                                    </button>
                                </div>

                                <div className="mt-3 border-t border-slate-200 dark:border-slate-700 pt-3 space-y-2">
                                    <div className="text-xs font-semibold text-slate-500">Lịch sử thao tác</div>
                                    {getActionHistory(claim).map((entry, idx) => (
                                        <div key={`${claim.id}-history-${idx}`} className="text-[11px] text-slate-600 dark:text-slate-300 rounded-lg bg-slate-50 dark:bg-slate-800/40 px-2.5 py-2">
                                            <div className="font-semibold text-slate-700 dark:text-slate-200">{entry.label}</div>
                                            {entry.at && <div>Thời gian: {new Date(entry.at).toLocaleString("vi-VN")}</div>}
                                            {entry.by && <div>Người xử lý: {entry.by}</div>}
                                            {entry.note && <div>Ghi chú: {entry.note}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Wrench className="w-8 h-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Chưa có yêu cầu bảo hành nào
                            </p>
                        </div>
                    )
                )}
            </div>

            {/* Create Modal */}
            <WarrantyCardModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />

            {claimingCard && (
                <div className="fixed inset-0 z-[130] bg-black/60 flex items-end md:items-center md:justify-center">
                    <div className="w-full md:max-w-lg bg-white dark:bg-[#1e1e2d] rounded-t-2xl md:rounded-2xl p-4 space-y-3">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                            Tiếp nhận bảo hành
                        </h3>
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            {claimingCard.device_model} - {claimingCard.customer_name || "Khách lẻ"}
                        </div>
                        <textarea
                            value={claimIssueText}
                            onChange={(e) => setClaimIssueText(e.target.value)}
                            rows={4}
                            placeholder="Mô tả lỗi khách báo..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setClaimingCard(null)}
                                className="flex-1 h-10 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleCreateClaim}
                                disabled={createClaimMutation.isPending}
                                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
                            >
                                {createClaimMutation.isPending ? "Đang lưu..." : "Xác nhận tiếp nhận"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
