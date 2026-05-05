import React, { useState } from "react";
import { Shield, Plus, Search, Calendar, Wrench, CheckCircle2, XCircle, Clock3, Printer, Smartphone, MoreVertical, ChevronDown, ChevronUp, User, Phone, History } from "lucide-react";
import PrintWarrantyPreviewModal from "./PrintWarrantyPreviewModal";
import {
    useWarrantyCards,
    useWarrantyClaims,
    useCreateWarrantyClaim,
    useUpdateWarrantyStatus,
    useDeleteWarrantyCard,
    useUpdateWarrantyClaimStatus,
    type WarrantyCard,
    type WarrantyClaim,
} from "../../hooks/useWarrantyRepository";
import { WarrantyCardModal } from "../warranty/WarrantyCardModal";
import { formatDate } from "../../utils/format";
import { showToast } from "../../utils/toast";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";
import { useStoreSettings } from "../../hooks/useStoreSettings";

// eslint-disable-next-line max-lines-per-function
export const WarrantyManager: React.FC = () => {
    const { profile } = useAuth();
    const { data: storeSettings } = useStoreSettings();
    const { data: warrantyCards, isLoading } = useWarrantyCards();
    const { data: warrantyClaims, isLoading: claimsLoading } = useWarrantyClaims();
    const createClaimMutation = useCreateWarrantyClaim();
    const updateWarrantyStatusMutation = useUpdateWarrantyStatus();
    const deleteWarrantyCardMutation = useDeleteWarrantyCard();
    const updateWarrantyClaimStatusMutation = useUpdateWarrantyClaimStatus();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "claimed" | "voided">("all");
    const [activeTab, setActiveTab] = useState<"cards" | "claims">("cards");
    const [claimingCard, setClaimingCard] = useState<WarrantyCard | null>(null);
    const [claimIssueText, setClaimIssueText] = useState("");
    const [printPreviewCard, setPrintPreviewCard] = useState<WarrantyCard | null>(null);
    const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(20);
    const [visibleClaimsCount, setVisibleClaimsCount] = useState(20);
    const [expandedCustomerKeys, setExpandedCustomerKeys] = useState<Record<string, boolean>>({});
    
    const canCreateClaim = canDo(profile, "warranty.claim.create");
    const canManageClaim = canDo(profile, "warranty.claim.manage");
    const canDeleteCard = canDo(profile, "warranty.card.delete");

    const actorName = profile?.name || profile?.full_name || profile?.email || "Người dùng";

    const escapeHtml = (raw?: string | null): string =>
        String(raw || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    const handlePrintWarrantyReceipt = (card: WarrantyCard) => {
        setPrintPreviewCard(card);
    };

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

        const matchesStatus = statusFilter === "all" || effectiveStatus === statusFilter;

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

    const displayedCards = filteredCards?.slice(0, visibleCount);
    const displayedClaims = filteredClaims?.slice(0, visibleClaimsCount);

    const groupedCards = (displayedCards || []).reduce(
        (acc, card) => {
            const name = (card.customer_name || "Khách lẻ").trim();
            const phone = (card.customer_phone || "Không có SĐT").trim();
            // Group by name and phone to merge duplicate entries if customer_id is sometimes missing
            const key = `${name.toLowerCase()}__${phone}`;
            if (!acc.has(key)) {
                acc.set(key, { key, name: card.customer_name || "Khách lẻ", phone: card.customer_phone || "Không có SĐT", cards: [] as WarrantyCard[] });
            }
            acc.get(key)?.cards.push(card);
            return acc;
        },
        new Map<string, { key: string; name: string; phone: string; cards: WarrantyCard[] }>()
    );
    const groupedCardEntries = Array.from(groupedCards.values());

    const getStatusBadge = (status: string, endDate: string) => {
        const isExpired = new Date(endDate) < new Date();

        if (status === "active" && !isExpired) {
            return (
                <span className="px-2 py-0.5 bg-emerald-100/50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                    ✓ Còn hạn
                </span>
            );
        }
        if (status === "voided") {
            return (
                <span className="px-2 py-0.5 bg-slate-100/50 border border-slate-200 text-slate-700 dark:bg-slate-500/10 dark:border-slate-500/20 dark:text-slate-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                    Vô hiệu
                </span>
            );
        }
        if (status === "claimed") {
            return (
                <span className="px-2 py-0.5 bg-amber-100/50 border border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                    Đang xử lý
                </span>
            );
        }

        return (
            <span className="px-2 py-0.5 bg-rose-100/50 border border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                Hết hạn
            </span>
        );
    };

    const getDaysRemaining = (endDate: string) => {
        const days = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    const getEffectiveStatus = (card: WarrantyCard) => {
        const isExpired = new Date(card.warranty_end_date) < new Date();
        return isExpired ? "expired" : card.status;
    };

    const renderCard = (card: WarrantyCard, quantity: number = 1) => (
        <div
            key={card.id}
            className="bg-white dark:bg-[#232334] rounded-xl p-4 border border-slate-200 dark:border-slate-700 hover:border-emerald-400/50 dark:hover:border-emerald-500/50 transition-all shadow-sm"
        >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 shrink-0 bg-slate-100 dark:bg-slate-800/80 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700">
                        <Smartphone className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-bold text-slate-900 dark:text-white text-base truncate max-w-[200px] sm:max-w-xs">
                                {card.device_model}
                            </h3>
                            {quantity > 1 && (
                                <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-bold">
                                    x{quantity}
                                </span>
                            )}
                            {getStatusBadge(card.status, card.warranty_end_date)}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                            IMEI/Serial: <span className="font-medium text-slate-700 dark:text-slate-300">{card.imei_serial || "N/A"}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-slate-50 dark:bg-[#1a1a27] rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Ngày mua</div>
                                <div className="font-bold text-slate-900 dark:text-white text-sm">
                                    {card.warranty_start_date ? formatDate(card.warranty_start_date) : "N/A"}
                                    <span className="text-[10px] font-medium text-slate-500 ml-1">({card.warranty_period_months}T)</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-[#1a1a27] rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Ngày hết hạn</div>
                                <div className="font-bold text-slate-900 dark:text-white text-sm">{formatDate(card.warranty_end_date)}</div>
                            </div>
                            <div className="bg-slate-50 dark:bg-[#1a1a27] rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Còn lại</div>
                                <div className={`font-bold text-sm ${getDaysRemaining(card.warranty_end_date) > 30 ? "text-emerald-600 dark:text-emerald-400" : getDaysRemaining(card.warranty_end_date) > 0 ? "text-orange-500" : "text-rose-500"}`}>
                                    {getDaysRemaining(card.warranty_end_date) > 0 ? `${getDaysRemaining(card.warranty_end_date)} ngày` : "Đã hết hạn"}
                                </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-[#1a1a27] rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Trạng thái</div>
                                <div className="font-bold text-slate-900 dark:text-white text-sm">
                                    {getEffectiveStatus(card) === "active" ? "Còn hạn" : getEffectiveStatus(card) === "expired" ? "Hết hạn" : getEffectiveStatus(card) === "claimed" ? "Đang xử lý" : "Vô hiệu"}
                                </div>
                            </div>
                        </div>

                        {card.covered_parts && card.covered_parts.length > 0 && (
                            <div className="mt-3">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1 uppercase tracking-wider">Phạm vi:</span>
                                    {card.covered_parts.map((part: string, idx: number) => (
                                        <span key={idx} className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 rounded-md text-[11px] font-semibold">
                                            {part}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex sm:flex-col items-center justify-end gap-2 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-3 sm:pt-0 shrink-0">
                    <button
                        onClick={() => handlePrintWarrantyReceipt(card)}
                        className="flex-1 sm:flex-none sm:w-full h-9 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-200 dark:border-slate-700"
                    >
                        <Printer className="w-4 h-4" /> <span className="sm:hidden lg:inline">In phiếu</span>
                    </button>
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
                        className="flex-1 sm:flex-none sm:w-full h-9 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors border border-emerald-200 dark:border-emerald-500/30"
                    >
                        <Wrench className="w-4 h-4" /> Tiếp nhận
                    </button>
                    
                    <div className="relative sm:w-full">
                        <button
                            onClick={() => setActiveDropdownId(activeDropdownId === card.id ? null : card.id)}
                            className="h-9 w-9 sm:w-full rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                        >
                            <MoreVertical className="w-4 h-4 sm:hidden" />
                            <span className="hidden sm:inline text-[13px] font-semibold text-slate-600 dark:text-slate-400">Tùy chọn</span>
                        </button>

                        {activeDropdownId === card.id && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setActiveDropdownId(null)}
                                />
                                <div className="absolute right-0 sm:left-0 sm:right-auto mt-1 w-36 bg-white dark:bg-[#2a2a3c] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                                    {card.status !== "voided" && (
                                        <button
                                            onClick={async () => {
                                                setActiveDropdownId(null);
                                                try {
                                                    await updateWarrantyStatusMutation.mutateAsync({ id: card.id, status: "voided" });
                                                    showToast.success("Đã vô hiệu phiếu bảo hành.");
                                                } catch {
                                                    showToast.error("Không thể cập nhật trạng thái phiếu.");
                                                }
                                            }}
                                            disabled={!canManageClaim}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                        >
                                            Vô hiệu phiếu
                                        </button>
                                    )}
                                    {canDeleteCard && (
                                        <button
                                            onClick={async () => {
                                                setActiveDropdownId(null);
                                                const confirmed = window.confirm("Xóa vĩnh viễn phiếu bảo hành này?");
                                                if (!confirmed) return;
                                                try {
                                                    await deleteWarrantyCardMutation.mutateAsync(card.id);
                                                    showToast.success("Đã xóa phiếu bảo hành.");
                                                } catch (error) {
                                                    console.error("Delete warranty card failed", error);
                                                    showToast.error("Không thể xóa phiếu bảo hành.");
                                                }
                                            }}
                                            disabled={deleteWarrantyCardMutation.isPending}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                        >
                                            Xóa phiếu
                                        </button>
                                    )}
                                    {(card.status === "voided" && !canDeleteCard) && (
                                        <div className="px-4 py-2.5 text-xs text-slate-400">Không có quyền thao tác</div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

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
                if (status === "completed" || status === "rejected") {
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
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-[#1e1e2d]/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-4 py-4">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                Quản Lý Bảo Hành
                            </h1>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 ml-[50px]">
                                {activeTab === "cards"
                                    ? `Tổng cộng ${filteredCards?.length || 0} phiếu`
                                    : `Tổng cộng ${filteredClaims?.length || 0} yêu cầu`}
                            </p>
                        </div>
                        {activeTab === "cards" && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="shrink-0 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-sm shadow-emerald-500/20 active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                Tạo phiếu mới
                            </button>
                        )}
                    </div>

                    {/* Tabs & Search Row */}
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="flex bg-slate-100 dark:bg-[#151521] p-1 rounded-xl shrink-0 border border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setActiveTab("cards")}
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex-1 md:flex-none text-center ${
                                    activeTab === "cards"
                                        ? "bg-white dark:bg-[#2a2a3c] text-emerald-600 dark:text-emerald-400 shadow-sm"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                }`}
                            >
                                Phiếu bảo hành
                            </button>
                            <button
                                onClick={() => setActiveTab("claims")}
                                className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex-1 md:flex-none text-center ${
                                    activeTab === "claims"
                                        ? "bg-white dark:bg-[#2a2a3c] text-emerald-600 dark:text-emerald-400 shadow-sm"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                }`}
                            >
                                Tiếp nhận
                            </button>
                        </div>

                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm theo tên khách, SĐT, thiết bị, IMEI..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm font-medium"
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    {activeTab === "cards" && (
                        <div className="flex flex-wrap gap-2 mt-4 pl-1">
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
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                        statusFilter === filter.value
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-400"
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-[#1e1e2d] dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                                    }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
                {activeTab === "cards" && (isLoading ? (
                    <div className="text-center py-20 text-slate-500 flex flex-col items-center">
                        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                        <span className="font-medium text-sm">Đang tải dữ liệu...</span>
                    </div>
                ) : displayedCards && displayedCards.length > 0 ? (
                    <div className="space-y-4">
                        {groupedCardEntries.map((group) => {
                            const isExpanded = expandedCustomerKeys[group.key] ?? true;
                            
                            const counts = group.cards.reduce(
                                (acc, card) => {
                                    const status = getEffectiveStatus(card);
                                    acc[status] = (acc[status] || 0) + 1;
                                    return acc;
                                },
                                {} as Record<string, number>
                            );

                            return (
                                <div key={group.key} className="bg-white dark:bg-[#1e1e2d] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all duration-200">
                                    <button
                                        onClick={() => setExpandedCustomerKeys(prev => ({...prev, [group.key]: !isExpanded}))}
                                        className="w-full px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-[#151521] border border-emerald-100 dark:border-slate-700 flex items-center justify-center shrink-0">
                                                <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                                                    {group.name}
                                                </div>
                                                <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                    <Phone className="w-3.5 h-3.5" />
                                                    {group.phone}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pl-16 sm:pl-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {counts.active ? <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 text-xs font-bold">{counts.active} còn hạn</span> : null}
                                                {counts.expired ? <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs font-bold">{counts.expired} hết hạn</span> : null}
                                                {counts.claimed ? <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-xs font-bold">{counts.claimed} đang xử lý</span> : null}
                                            </div>
                                            <div className="text-slate-400 bg-slate-100 dark:bg-[#151521] rounded-full p-1.5 border border-slate-200 dark:border-slate-700 shrink-0">
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </div>
                                        </div>
                                    </button>
                                    
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 dark:border-slate-800 p-4 sm:p-5 bg-slate-50/50 dark:bg-[#151521]/30 space-y-3">
                                            {Array.from(
                                                group.cards.reduce((acc, card) => {
                                                    const itemKey = `${card.device_model}__${card.imei_serial}__${card.warranty_period_months}__${card.warranty_end_date}__${card.status}`;
                                                    if (!acc.has(itemKey)) acc.set(itemKey, []);
                                                    acc.get(itemKey)!.push(card);
                                                    return acc;
                                                }, new Map<string, WarrantyCard[]>()).values()
                                            ).map(cards => renderCard(cards[0], cards.length))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredCards && visibleCount < filteredCards.length && (
                            <div className="pt-4 pb-6 text-center">
                                <button
                                    onClick={() => setVisibleCount(v => v + 20)}
                                    className="px-6 py-2.5 bg-white dark:bg-[#1e1e2d] text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all shadow-sm active:scale-95"
                                >
                                    Hiển thị thêm
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-20 px-4 bg-white dark:bg-[#1e1e2d] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="w-24 h-24 bg-slate-50 dark:bg-[#151521] rounded-full flex items-center justify-center mx-auto mb-5 border-8 border-white dark:border-[#1e1e2d] shadow-sm">
                            <Shield className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">
                            Không tìm thấy phiếu bảo hành
                        </h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-sm mx-auto font-medium">
                            {searchQuery ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái." : "Hiện chưa có phiếu bảo hành nào trong hệ thống. Hãy tạo phiếu mới để bắt đầu."}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95 flex items-center gap-2 mx-auto"
                            >
                                <Plus className="w-5 h-5" />
                                Tạo phiếu đầu tiên
                            </button>
                        )}
                    </div>
                ))}

                {activeTab === "claims" && (
                    claimsLoading ? (
                        <div className="text-center py-20 text-slate-500 flex flex-col items-center">
                            <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                            <span className="font-medium text-sm">Đang tải yêu cầu...</span>
                        </div>
                    ) : displayedClaims && displayedClaims.length > 0 ? (
                        <div className="space-y-4">
                            {displayedClaims.map((claim: any) => (
                                <div
                                    key={claim.id}
                                    className="bg-white dark:bg-[#1e1e2d] rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-start justify-between gap-4 mb-3">
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                                        <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-[#151521] dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                                                            #{claim.id.slice(0, 8)}
                                                        </span>
                                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                                            claim.status === 'pending' ? 'bg-amber-100/50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400' :
                                                            claim.status === 'approved' ? 'bg-blue-100/50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400' :
                                                            claim.status === 'completed' ? 'bg-emerald-100/50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' :
                                                            'bg-rose-100/50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400'
                                                        }`}>
                                                            {claim.status === 'pending' ? 'Chờ duyệt' :
                                                             claim.status === 'approved' ? 'Đã duyệt' :
                                                             claim.status === 'completed' ? 'Hoàn tất' : 'Từ chối'}
                                                        </span>
                                                    </div>
                                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                                        {claim?.warranty_cards?.device_model || "Thiết bị"}
                                                    </h3>
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400 mb-5">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{claim?.warranty_cards?.customer_name || "Khách lẻ"}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                                    <span className="font-semibold">{claim?.warranty_cards?.customer_phone || "Không có SĐT"}</span>
                                                </div>
                                            </div>

                                            <div className="bg-slate-50 dark:bg-[#151521] rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                                                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                    <History className="w-3.5 h-3.5" /> Mô tả lỗi từ khách
                                                </div>
                                                <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                                    {claim.issue_description || "Không có mô tả chi tiết."}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-full md:w-64 shrink-0 flex flex-col gap-4 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 pt-5 md:pt-0 md:pl-6">
                                            <div>
                                                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Thao tác xử lý</div>
                                                
                                                {claim.status === 'pending' && (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={() => handleClaimStatus(claim.id, "approved", claim.warranty_card_id)}
                                                            disabled={!canManageClaim}
                                                            className="w-full py-2.5 px-3 rounded-xl text-[13px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-blue-400 transition-colors flex items-center justify-center gap-1.5 border border-blue-200/50 dark:border-blue-500/20"
                                                        >
                                                            <Clock3 className="w-4 h-4" /> Duyệt
                                                        </button>
                                                        <button
                                                            onClick={() => handleClaimStatus(claim.id, "rejected", claim.warranty_card_id)}
                                                            disabled={!canManageClaim}
                                                            className="w-full py-2.5 px-3 rounded-xl text-[13px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 transition-colors flex items-center justify-center gap-1.5 border border-rose-200/50 dark:border-rose-500/20"
                                                        >
                                                            <XCircle className="w-4 h-4" /> Từ chối
                                                        </button>
                                                    </div>
                                                )}
                                                
                                                {claim.status === 'approved' && (
                                                    <button
                                                        onClick={() => handleClaimStatus(claim.id, "completed", claim.warranty_card_id)}
                                                        disabled={!canManageClaim}
                                                        className="w-full py-2.5 px-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                                                    >
                                                        <CheckCircle2 className="w-5 h-5" /> Hoàn tất bảo hành
                                                    </button>
                                                )}

                                                {(claim.status === 'completed' || claim.status === 'rejected') && (
                                                    <div className="py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-800 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                                                        Yêu cầu đã đóng
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Lịch sử cập nhật</div>
                                                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-1.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:to-transparent dark:before:from-slate-700">
                                                    {getActionHistory(claim).map((entry, idx) => (
                                                        <div key={`${claim.id}-history-${idx}`} className="relative pl-6">
                                                            <div className="absolute left-0 top-1 w-3 h-3 rounded-full border-2 border-white dark:border-[#1e1e2d] bg-slate-300 dark:bg-slate-500"></div>
                                                            <div className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                                                                {entry.label}
                                                            </div>
                                                            {entry.at && <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{new Date(entry.at).toLocaleString("vi-VN")}</div>}
                                                            {entry.by && <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">Bởi: {entry.by}</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {filteredClaims && visibleClaimsCount < filteredClaims.length && (
                                <div className="pt-4 pb-6 text-center">
                                    <button
                                        onClick={() => setVisibleClaimsCount(v => v + 20)}
                                        className="px-6 py-2.5 bg-white dark:bg-[#1e1e2d] text-emerald-600 dark:text-emerald-400 text-sm font-bold rounded-xl border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all shadow-sm active:scale-95"
                                    >
                                        Hiển thị thêm
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-20 px-4 bg-white dark:bg-[#1e1e2d] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="w-24 h-24 bg-slate-50 dark:bg-[#151521] rounded-full flex items-center justify-center mx-auto mb-5 border-8 border-white dark:border-[#1e1e2d] shadow-sm">
                                <Wrench className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">
                                Chưa có yêu cầu bảo hành
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto font-medium">
                                {searchQuery ? "Không tìm thấy yêu cầu nào khớp với từ khóa." : "Hiện chưa có yêu cầu tiếp nhận bảo hành nào cần xử lý."}
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

            {/* Print Preview Modal */}
            <PrintWarrantyPreviewModal
                isOpen={!!printPreviewCard}
                onClose={() => setPrintPreviewCard(null)}
                warrantyCard={printPreviewCard}
                storeSettings={storeSettings}
            />

            {/* Claiming Modal */}
            {claimingCard && (
                <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 transition-all">
                    <div className="w-full md:max-w-lg bg-white dark:bg-[#1e1e2d] rounded-t-3xl md:rounded-3xl p-5 md:p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-200">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
                                <Wrench className="w-5 h-5 text-emerald-500" />
                                Tiếp nhận bảo hành
                            </h3>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                {claimingCard.device_model} - {claimingCard.customer_name || "Khách lẻ"}
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-[13px] font-bold text-slate-700 dark:text-slate-300">
                                Mô tả lỗi từ khách hàng <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                value={claimIssueText}
                                onChange={(e) => setClaimIssueText(e.target.value)}
                                rows={4}
                                placeholder="Nhập chi tiết tình trạng lỗi, dấu hiệu nhận biết..."
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#151521] text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all resize-none font-medium placeholder:text-slate-400"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setClaimingCard(null)}
                                className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold transition-colors"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleCreateClaim}
                                disabled={createClaimMutation.isPending}
                                className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                            >
                                {createClaimMutation.isPending ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Đang xử lý...
                                    </>
                                ) : "Xác nhận tiếp nhận"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
