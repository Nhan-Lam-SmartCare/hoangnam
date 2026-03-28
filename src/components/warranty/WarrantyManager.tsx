import React, { useState } from "react";
import { Shield, Plus, Search, Filter, Calendar, X } from "lucide-react";
import { useWarrantyCards } from "../../hooks/useWarrantyRepository";
import { WarrantyCardModal } from "../warranty/WarrantyCardModal";
import { formatDate } from "../../utils/format";

export const WarrantyManager: React.FC = () => {
    const { data: warrantyCards, isLoading } = useWarrantyCards();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired">("all");

    // Filter warranty cards
    const filteredCards = warrantyCards?.filter((card) => {
        const matchesSearch =
            !searchQuery ||
            card.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.customer_phone?.includes(searchQuery) ||
            card.device_model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            card.imei_serial?.includes(searchQuery);

        const matchesStatus =
            statusFilter === "all" || card.status === statusFilter;

        return matchesSearch && matchesStatus;
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
                                {filteredCards?.length || 0} phiếu bảo hành
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Tạo mới
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
                <div className="flex gap-2 mt-3">
                    {[
                        { value: "all", label: "Tất cả" },
                        { value: "active", label: "Còn hạn" },
                        { value: "expired", label: "Hết hạn" },
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
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
                {isLoading ? (
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
                )}
            </div>

            {/* Create Modal */}
            <WarrantyCardModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
        </div>
    );
};
