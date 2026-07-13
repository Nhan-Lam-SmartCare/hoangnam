import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Search,
  Plus,
  Scale,
  Calendar,
  DollarSign,
  User,
  Trash2,
  Edit2,
  Printer,
  ChevronDown,
  X,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import {
  usePawnRecordsRepo,
  useCreatePawnRecordRepo,
  useUpdatePawnRecordRepo,
  useDeletePawnRecordRepo,
} from "../../hooks/usePawnRepository";
import { useAppContext } from "../../contexts/AppContext";
import { supabase } from "../../supabaseClient";
import { formatCurrency } from "../../utils/format";
import { showToast } from "../../utils/toast";
import { printElementById } from "../../utils/print";
import { PawnReceiptTemplate } from "./PawnReceiptTemplate";
import PrintPawnPreviewModal from "./modals/PrintPawnPreviewModal";

export default function PawnManager() {
  const { currentBranchId } = useAppContext();
  const { data: pawnRecords = [], isLoading } = usePawnRecordsRepo(currentBranchId);
  const createMutation = useCreatePawnRecordRepo();
  const updateMutation = useUpdatePawnRecordRepo();
  const deleteMutation = useDeletePawnRecordRepo();

  const [activeTab, setActiveTab] = useState<"all" | "active" | "redeemed" | "liquidated">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [showStatusModal, setShowStatusModal] = useState<any>(null);
  const [printRecord, setPrintRecord] = useState<any>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerCccd: "",
    customerAddress: "",
    assetType: "",
    assetModel: "",
    assetSerial: "",
    loanAmount: 0,
    interestRate: 0,
    interestPeriod: "day" as "day" | "month",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    minInterest: 0,
    notes: "",
  });

  // Fetch store settings for printing
  const { data: storeSettings } = useQuery({
    queryKey: ["storeSettings"],
    queryFn: async () => {
      const { data } = await supabase.from("store_settings").select("*").maybeSingle();
      return data;
    },
  });

  const filteredRecords = useMemo(() => {
    return pawnRecords.filter((record) => {
      // Tab filter
      if (activeTab !== "all" && record.status !== activeTab) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const customerName = (record.customerName || "").toLowerCase();
        const customerPhone = (record.customerPhone || "").toLowerCase();
        const assetType = (record.assetType || "").toLowerCase();
        const assetModel = (record.assetModel || "").toLowerCase();
        const assetSerial = (record.assetSerial || "").toLowerCase();
        const id = (record.id || "").toLowerCase();

        return (
          customerName.includes(query) ||
          customerPhone.includes(query) ||
          assetType.includes(query) ||
          assetModel.includes(query) ||
          assetSerial.includes(query) ||
          id.includes(query)
        );
      }

      return true;
    });
  }, [pawnRecords, activeTab, searchQuery]);

  const handleOpenAdd = () => {
    setFormData({
      customerName: "",
      customerPhone: "",
      customerCccd: "",
      customerAddress: "",
      assetType: "",
      assetModel: "",
      assetSerial: "",
      loanAmount: 0,
      interestRate: 0,
      interestPeriod: "day",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      minInterest: 0,
      notes: "",
    });
    setEditingRecord(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (record: any) => {
    setFormData({
      customerName: record.customerName || "",
      customerPhone: record.customerPhone || "",
      customerCccd: record.customerCccd || "",
      customerAddress: record.customerAddress || "",
      assetType: record.assetType || "",
      assetModel: record.assetModel || "",
      assetSerial: record.assetSerial || "",
      loanAmount: record.loanAmount || 0,
      interestRate: record.interestRate || 0,
      interestPeriod: record.interestPeriod || "day",
      startDate: record.startDate ? new Date(record.startDate).toISOString().split("T")[0] : "",
      endDate: record.endDate ? new Date(record.endDate).toISOString().split("T")[0] : "",
      minInterest: record.minInterest || 0,
      notes: record.notes || "",
    });
    setEditingRecord(record);
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerName.trim()) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return;
    }
    if (!formData.assetType.trim()) {
      showToast.error("Vui lòng nhập loại tài sản cầm");
      return;
    }
    if (formData.loanAmount <= 0) {
      showToast.error("Vui lòng nhập số tiền cầm lớn hơn 0");
      return;
    }

    try {
      if (editingRecord) {
        await updateMutation.mutateAsync({
          id: editingRecord.id,
          updates: {
            customerName: formData.customerName.trim(),
            customerPhone: formData.customerPhone.trim(),
            customerCccd: formData.customerCccd.trim(),
            customerAddress: formData.customerAddress.trim(),
            assetType: formData.assetType.trim(),
            assetModel: formData.assetModel.trim(),
            assetSerial: formData.assetSerial.trim(),
            loanAmount: formData.loanAmount,
            interestRate: formData.interestRate,
            interestPeriod: formData.interestPeriod,
            startDate: new Date(formData.startDate).toISOString(),
            endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
            minInterest: formData.minInterest,
            notes: formData.notes.trim(),
          },
        });
      } else {
        const today = new Date();
        const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
        const recordId = `CD-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;

        await createMutation.mutateAsync({
          id: recordId,
          customerName: formData.customerName.trim(),
          customerPhone: formData.customerPhone.trim(),
          customerCccd: formData.customerCccd.trim(),
          customerAddress: formData.customerAddress.trim(),
          assetType: formData.assetType.trim(),
          assetModel: formData.assetModel.trim(),
          assetSerial: formData.assetSerial.trim(),
          loanAmount: formData.loanAmount,
          interestRate: formData.interestRate,
          interestPeriod: formData.interestPeriod,
          startDate: new Date(formData.startDate).toISOString(),
          endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
          minInterest: formData.minInterest,
          status: "active",
          notes: formData.notes.trim(),
          branchId: currentBranchId || "CN1",
        });
      }
      setShowAddModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa hợp đồng cầm đồ này?")) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleUpdateStatus = async (id: string, status: "active" | "redeemed" | "liquidated") => {
    try {
      await updateMutation.mutateAsync({
        id,
        updates: { status },
      });
      setShowStatusModal(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDoPrint = (record: any) => {
    setPrintRecord(record);
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-4 mx-auto w-full max-w-[1800px] px-3 sm:px-4 xl:px-6 2xl:px-8 py-4">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Scale className="w-6 h-6 text-red-500" />
            Dịch vụ Cầm đồ
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý hợp đồng cầm đồ, tài sản thế chấp và tính lãi suất
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Lập biên nhận</span>
        </button>
      </div>

      {/* Tabs and search bar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-thin">
          {[
            { key: "all", label: "Tất cả", count: pawnRecords.length },
            { key: "active", label: "Đang cầm", count: pawnRecords.filter((r) => r.status === "active").length },
            { key: "redeemed", label: "Đã chuộc", count: pawnRecords.filter((r) => r.status === "redeemed").length },
            { key: "liquidated", label: "Đã thanh lý", count: pawnRecords.filter((r) => r.status === "liquidated").length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition border ${
                activeTab === tab.key
                  ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:border-white dark:text-slate-900"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {tab.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                }`}>
                  {tab.count}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên KH, SĐT, tài sản, số sê-ri..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm shadow-inner"
          />
        </div>
      </div>

      {/* Main Records Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Tài sản cầm</th>
                <th className="px-4 py-3 text-right">Số tiền cầm</th>
                <th className="px-4 py-3 text-right">Lãi suất</th>
                <th className="px-4 py-3 text-center">Thời hạn</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-700">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 dark:text-slate-400 italic">
                    Chưa có dữ liệu hợp đồng cầm đồ nào
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  return (
                    <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                        {record.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {record.customerName}
                        </div>
                        <div className="text-slate-500 mt-0.5">{record.customerPhone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {record.assetType}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {record.assetModel} {record.assetSerial ? `| S/N: ${record.assetSerial}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400 font-mono">
                        {formatCurrency(record.loanAmount)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-slate-300 font-mono">
                        {record.interestRate}% / {record.interestPeriod === "day" ? "Ngày" : "Tháng"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-slate-800 dark:text-slate-200 font-semibold">
                          {record.startDate ? new Date(record.startDate).toLocaleDateString("vi-VN") : "..."}
                        </div>
                        <div className="text-slate-400 mt-0.5">đến</div>
                        <div className="text-slate-800 dark:text-slate-200 font-semibold mt-0.5">
                          {record.endDate ? new Date(record.endDate).toLocaleDateString("vi-VN") : "..."}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          record.status === "active"
                            ? "bg-green-50 text-green-600 border border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-800"
                            : record.status === "redeemed"
                            ? "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600"
                            : "bg-red-50 text-red-650 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800"
                        }`}>
                          {record.status === "active" ? "Đang cầm" : record.status === "redeemed" ? "Đã chuộc" : "Đã thanh lý"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setShowStatusModal(record)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-bold"
                            title="Đổi trạng thái"
                          >
                            Đổi trạng thái
                          </button>
                          <button
                            onClick={() => handleDoPrint(record)}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition"
                            title="In biên nhận"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(record)}
                            className="p-1.5 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition"
                            title="Sửa biên nhận"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition"
                            title="Xóa biên nhận"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PrintPawnPreviewModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        printRecord={printRecord}
        storeSettings={storeSettings}
        onPrint={(paperSizeKey: string) => {
          printElementById("pawn-receipt", {
            pageStyle: `
              @page { size: ${paperSizeKey === "80mm" || paperSizeKey === "58mm" ? paperSizeKey + " auto" : paperSizeKey + " portrait"}; margin: 0; }
              body { margin: 0; padding: 0; display: flex; justify-content: center; }
              @media print {
                #pawn-receipt { 
                  transform: ${paperSizeKey === "80mm" ? "scale(0.54)" : paperSizeKey === "58mm" ? "scale(0.39)" : "none"}; 
                  transform-origin: top left;
                }
              }
            `
          });
          setIsPrintModalOpen(false);
        }}
      >
        <PawnReceiptTemplate record={printRecord} storeSettings={storeSettings} forceVisible={true} />
      </PrintPawnPreviewModal>

      {/* Hidden print rendering block */}
      {printRecord && (
        <PawnReceiptTemplate record={printRecord} storeSettings={storeSettings} forceVisible={false} />
      )}

      {/* Add / Edit Pawn Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-t-2xl">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-5 h-5" />
                {editingRecord ? "Cập nhật biên nhận cầm đồ" : "Lập biên nhận cầm đồ mới"}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-white hover:text-red-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer Section */}
                <div className="border border-slate-100 dark:border-slate-700 p-4 rounded-xl space-y-3 bg-slate-50/50 dark:bg-slate-900/10">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Thông tin khách hàng
                  </h3>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Họ tên khách hàng <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="Nguyễn Văn A"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="0901234567"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Số CCCD
                    </label>
                    <input
                      type="text"
                      value={formData.customerCccd}
                      onChange={(e) => setFormData({ ...formData, customerCccd: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="091090123456"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Địa chỉ
                    </label>
                    <input
                      type="text"
                      value={formData.customerAddress}
                      onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="Vĩnh Lập, An Cư, An Giang"
                    />
                  </div>
                </div>

                {/* Asset Section */}
                <div className="border border-slate-100 dark:border-slate-700 p-4 rounded-xl space-y-3 bg-slate-50/50 dark:bg-slate-900/10">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                    Thông tin tài sản cầm cố
                  </h3>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Loại tài sản <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.assetType}
                      onChange={(e) => setFormData({ ...formData, assetType: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="Điện thoại, Xe máy, Máy tính..."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Model / Nhãn hiệu
                    </label>
                    <input
                      type="text"
                      value={formData.assetModel}
                      onChange={(e) => setFormData({ ...formData, assetModel: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="iPhone 15 Pro Max, Honda SH..."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Số Seri / IMEI / Biển số xe
                    </label>
                    <input
                      type="text"
                      value={formData.assetSerial}
                      onChange={(e) => setFormData({ ...formData, assetSerial: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="356988..."
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Ghi chú thêm tài sản (Lỗi, vết xước...)
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none"
                      placeholder="Bị trầy xước nhẹ ở viền, không kèm cáp sạc..."
                    />
                  </div>
                </div>
              </div>

              {/* Loan and interest settings */}
              <div className="border border-slate-100 dark:border-slate-700 p-4 rounded-xl space-y-4 bg-slate-50/50 dark:bg-slate-900/10">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Thỏa thuận khoản vay & Lãi suất
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Số tiền cầm vay (VNĐ) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.loanAmount || ""}
                      onChange={(e) => setFormData({ ...formData, loanAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                      placeholder="5,000,000"
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Lãi suất (%)
                    </label>
                    <input
                      type="number"
                      value={formData.interestRate || ""}
                      onChange={(e) => setFormData({ ...formData, interestRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="0.2"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Chu kỳ tính lãi
                    </label>
                    <select
                      value={formData.interestPeriod}
                      onChange={(e) => setFormData({ ...formData, interestPeriod: e.target.value as any })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="day">Theo ngày (% / Ngày)</option>
                      <option value="month">Theo tháng (% / Tháng)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Ngày bắt đầu vay cầm
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Ngày đáo hạn chuộc
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                      Lãi tối thiểu / Lần chuộc
                    </label>
                    <input
                      type="number"
                      value={formData.minInterest || ""}
                      onChange={(e) => setFormData({ ...formData, minInterest: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      placeholder="50,000"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-350 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 text-white rounded-lg text-sm font-bold shadow-lg"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Đang xử lý..." : "✓ Xác nhận lập"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-xl p-5 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Cập nhật trạng thái phiếu {showStatusModal.id}
              </h3>
              <button onClick={() => setShowStatusModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-xs text-slate-500">
                Lựa chọn trạng thái hiện tại của hợp đồng cầm đồ này:
              </p>

              <button
                type="button"
                onClick={() => handleUpdateStatus(showStatusModal.id, "active")}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  showStatusModal.status === "active"
                    ? "border-green-500 bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-bold"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <AlertCircle className="w-5 h-5 text-green-500" />
                <div>
                  <div className="text-xs">Đang cầm cố (Active)</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">Tài sản vẫn đang nằm tại kho cửa hàng</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateStatus(showStatusModal.id, "redeemed")}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  showStatusModal.status === "redeemed"
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 font-bold"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <CheckCircle className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="text-xs">Đã chuộc tài sản (Redeemed)</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">Khách đã hoàn trả đủ gốc + lãi, nhận lại máy</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleUpdateStatus(showStatusModal.id, "liquidated")}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  showStatusModal.status === "liquidated"
                    ? "border-red-500 bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-400 font-bold"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <Trash2 className="w-5 h-5 text-red-500" />
                <div>
                  <div className="text-xs">Đã thanh lý tài sản (Liquidated)</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5">Quá hạn, cửa hàng đã bán tài sản để thu hồi vốn</div>
                </div>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowStatusModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
