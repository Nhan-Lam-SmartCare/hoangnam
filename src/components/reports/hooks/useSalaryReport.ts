import { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { showToast } from "../../../utils/toast";
import {
  getWorkerMonthlyLaborDetails,
  getWorkerMonthlySalary,
  upsertEmployeeBonusPenalty,
  type WorkerLaborDetailRow,
} from "../../../lib/repository/repairLaborRepository";
import { useSupabaseClient } from "../../../hooks/useSupabaseClient";

export const useSalaryReport = (
  initialEmployees: any[], // Fallback, not strictly used
  salaryMonth: number,
  salaryYear: number,
  activeTab: string
) => {
  const supabase = useSupabaseClient();
  const [employees, setEmployees] = useState<any[]>([]);
  const [staffSalaryRows, setStaffSalaryRows] = useState<any[]>([]);
  const [loadingSalaryRows, setLoadingSalaryRows] = useState(false);
  const [selectedSalaryWorker, setSelectedSalaryWorker] = useState<any | null>(null);
  const [editingBonusPenalty, setEditingBonusPenalty] = useState<any | null>(null);
  const [salaryDetailRows, setSalaryDetailRows] = useState<WorkerLaborDetailRow[]>([]);
  const [loadingSalaryDetails, setLoadingSalaryDetails] = useState(false);
  const salaryRowsCacheRef = useRef<Record<string, any[]>>({});

  useEffect(() => {
    let active = true;
    const fetchStaff = async () => {
      if (activeTab !== "payroll") return;
      try {
        let usersToMap: any[] = [];
        const { data: employeesData } = await supabase.from("employees").select("id, name, email, base_salary, branch_id");
        
        if (employeesData && employeesData.length > 0) {
           usersToMap = employeesData;
        } else {
           const { data, error } = await supabase.rpc("get_all_users_for_owner");
           if (!error && data && data.length > 0) {
              usersToMap = data;
           } else {
              const { data: profilesData } = await supabase.from("profiles").select("*");
              if (profilesData) {
                 usersToMap = profilesData;
              }
           }
        }

        if (usersToMap.length === 0) {
          if (active) setEmployees([]);
          return;
        }
        
        let overrides: any = {};
        try {
          const raw = localStorage.getItem("staff_overrides_v1");
          if (raw) overrides = JSON.parse(raw) || {};
        } catch {}
        
        const merged = usersToMap.map((staff: any) => ({
           ...staff,
           baseSalary: overrides[staff.id]?.base_salary || staff.base_salary || 0
        }));
        
        if (active) setEmployees(merged);
      } catch (err) {
        if (active) setEmployees([]);
      }
    };
    fetchStaff();
    return () => { active = false; };
  }, [activeTab]);

  const salaryStaffIdsKey = useMemo(
    () => employees.map((staff) => staff.id).sort().join("|"),
    [employees]
  );

  useEffect(() => {
    let active = true;

    const loadSalaryRows = async () => {
      const salaryCacheKey = `${salaryYear}-${String(salaryMonth).padStart(2, "0")}::${salaryStaffIdsKey}`;

      if (activeTab !== "payroll" || employees.length === 0) {
        if (active) setStaffSalaryRows([]);
        return;
      }

      const cachedRows = salaryRowsCacheRef.current[salaryCacheKey];
      if (cachedRows && active) {
        setStaffSalaryRows(cachedRows);
      }

      if (!cachedRows) {
        setLoadingSalaryRows(true);
      }

      try {
        const rows = await Promise.all(
          employees.map(async (staff) => {
            const workerNameStr = staff.name || staff.email || "Chưa đặt tên";
            const salaryResult = await getWorkerMonthlySalary(
              staff.id,
              salaryMonth,
              salaryYear,
              workerNameStr
            );

            if (!salaryResult.ok) {
              return {
                workerId: staff.id,
                workerName: staff.name || staff.email || "Chưa đặt tên",
                totalServiceCount: 0,
                totalWorkerAmount: 0,
                baseSalary: Number(staff.base_salary || staff.baseSalary || 0),
                bonus: 0,
                penalty: 0,
                finalSalary: Number(staff.base_salary || staff.baseSalary || 0),
              };
            }

            return salaryResult.data;
          })
        );

        if (active) {
          salaryRowsCacheRef.current[salaryCacheKey] = rows;
          setStaffSalaryRows(rows);
        }
      } finally {
        if (active) {
          setLoadingSalaryRows(false);
        }
      }
    };

    void loadSalaryRows();

    return () => {
      active = false;
    };
  }, [activeTab, employees, salaryMonth, salaryYear, salaryStaffIdsKey]);

  const handleOpenSalaryDetails = async (row: any) => {
    setSelectedSalaryWorker(row);
    setSalaryDetailRows([]);
    setLoadingSalaryDetails(true);
    try {
      const result = await getWorkerMonthlyLaborDetails(
        row.workerId,
        salaryMonth,
        salaryYear,
        row.workerName
      );
      if (!result.ok) {
        showToast.error(result.error?.message || "Không thể tải chi tiết công sửa");
        return;
      }
      setSalaryDetailRows(result.data || []);
    } finally {
      setLoadingSalaryDetails(false);
    }
  };

  const handleSaveBonusPenalty = async (workerId: string, bonus: number, penalty: number) => {
    const res = await upsertEmployeeBonusPenalty(workerId, salaryMonth, salaryYear, bonus, penalty);
    if (!res.ok) {
      showToast.error(res.error?.message || "Không thể lưu thưởng/phạt");
      return false;
    }
    
    // Invalidate cache and trigger reload
    const salaryCacheKey = `${salaryYear}-${String(salaryMonth).padStart(2, "0")}::${salaryStaffIdsKey}`;
    delete salaryRowsCacheRef.current[salaryCacheKey];
    setStaffSalaryRows((prev) => prev.map(r => r.workerId === workerId ? { ...r, bonus, penalty, finalSalary: (r.baseSalary || 0) + (r.totalWorkerAmount || 0) + bonus - penalty - (r.advance || 0) } : r));
    
    showToast.success("Đã cập nhật thưởng/phạt thành công");
    return true;
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "--";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "--";
    return dt.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleExportSalaryDetailsExcel = () => {
    if (!selectedSalaryWorker) return;

    const header = [
      "Thời gian",
      "Mã phiếu",
      "Khách hàng",
      "Thiết bị",
      "Hạng mục",
      "Nguồn công",
      "Tiền công",
    ];

    const rows = salaryDetailRows.map((detail) => [
      formatDateTime(detail.date),
      detail.workOrderId,
      detail.customerName || "Khách lẻ",
      detail.vehicleModel || "",
      detail.serviceName || "Tiền công phiếu",
      detail.type === "service_split" ? "Chia công dịch vụ" : "Tiền công theo phiếu",
      Number(detail.amount || 0),
    ]);

    const totalAmount = salaryDetailRows.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const sheetData = [
      ["Chi tiết công sửa"],
      [
        `Nhân viên: ${selectedSalaryWorker.workerName} - Kỳ: Tháng ${salaryMonth}/${salaryYear}`,
      ],
      [],
      header,
      ...rows,
      [],
      ["Tổng tiền công", "", "", "", "", "", totalAmount],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 26 },
      { wch: 28 },
      { wch: 20 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chi tiết công");

    const safeName = String(selectedSalaryWorker.workerName || "NhanVien")
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "");
    const fileName = `ChiTietCong_${safeName}_T${salaryMonth}_${salaryYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return {
    staffSalaryRows,
    loadingSalaryRows,
    employees, // expose internal employees (with branch_id from DB)
    selectedSalaryWorker,
    setSelectedSalaryWorker,
    salaryDetailRows,
    loadingSalaryDetails,
    handleOpenSalaryDetails,
    handleExportSalaryDetailsExcel,
    editingBonusPenalty,
    setEditingBonusPenalty,
    handleSaveBonusPenalty,
  };
};
