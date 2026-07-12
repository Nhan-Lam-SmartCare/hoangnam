import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import type {
  Employee,
  RepairOrderService,
  ServiceConfig,
  WorkOrder,
  Part,
  WorkOrderPart,
} from "../../../types";
import {
  formatWorkOrderId,
  generateWorkOrderId,
  normalizeSearchText,
  formatCurrency,
} from "../../../utils/format";
import {
  useCreateWorkOrderAtomicRepo,
  useUpdateWorkOrderAtomicRepo,
} from "../../../hooks/useWorkOrdersRepository";
import { useCreateCustomerDebtRepo } from "../../../hooks/useDebtsRepository";
import { completeWorkOrderPayment } from "../../../lib/repository/workOrdersRepository";

import { showToast } from "../../../utils/toast";
import { supabase } from "../../../supabaseClient";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useWarrantyCards } from "../../../hooks/useWarrantyRepository";
import { useServiceConfigs } from "../../../hooks/useRepairLabor";
import { syncRepairOrderServices } from "../../../lib/repository/repairLaborRepository";
import {
  buildDefaultWorkerSplit,
  calculateLabor,
  splitWorkerAmount,
} from "../../../lib/services/repairLaborService";
import { compressImage } from "../../../utils/imageCompressor";
import { uploadDevicePhoto, deleteDevicePhoto } from "../../../lib/storage/devicePhotosStorage";

import {
  RepairServiceDraftWorker,
  RepairServiceDraft,
  createEmptyRepairServiceDraft,
  mapRepairServiceToDraft,
  getWarrantyText,
  getPartLaborBase as sharedGetPartLaborBase,
  getPartWarranty as sharedGetPartWarranty,
  getIntegratedLaborByQuantity as sharedGetIntegratedLaborByQuantity,
} from "./useWorkOrderSharedLogic";

export interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  bank_qr_url?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
  work_order_prefix?: string;
}

export interface UseWorkOrderFormStateProps {
  order: WorkOrder;
  onClose: () => void;
  onSave: (order: WorkOrder) => void;
  parts: Part[];
  customers: any[];
  employees: any[];
  upsertCustomer: (customer: any) => void;
  setCashTransactions: (fn: (prev: any[]) => any[]) => void;
  setPaymentSources: (fn: (prev: any[]) => any[]) => void;
  currentBranchId: string;
  storeSettings?: StoreSettings | null;
  canUpdateWorkOrderStatus?: boolean;
  canUpdateWorkOrderPayment?: boolean;
  canUpdateWorkOrderParts?: boolean;
  canUpdateWorkOrderLabor?: boolean;
  canUpdateWorkOrderDiscount?: boolean;
  canUpdateWorkOrderCustomer?: boolean;
  canUpdateWorkOrderVehicle?: boolean;
  canUpdateWorkOrderOutsourceService?: boolean;
  invalidateWorkOrders?: () => void;
}

export function useWorkOrderFormState({
  order,
  onClose,
  onSave,
  parts,
  customers,
  employees,
  upsertCustomer,
  setCashTransactions,
  setPaymentSources,
  currentBranchId,
  storeSettings,
  canUpdateWorkOrderStatus = true,
  canUpdateWorkOrderPayment = true,
  canUpdateWorkOrderParts = true,
  canUpdateWorkOrderLabor = true,
  canUpdateWorkOrderDiscount = true,
  canUpdateWorkOrderCustomer = true,
  canUpdateWorkOrderVehicle = true,
  canUpdateWorkOrderOutsourceService = true,
  invalidateWorkOrders,
}: UseWorkOrderFormStateProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { mutateAsync: createWorkOrderAtomicAsync } = useCreateWorkOrderAtomicRepo();
  const { mutateAsync: updateWorkOrderAtomicAsync } = useUpdateWorkOrderAtomicRepo();
  const { data: warrantyCards } = useWarrantyCards();
  const { data: serviceConfigs = [] } = useServiceConfigs();

  const employeeOptions = employees as Employee[];
  
  const defaultTechnicianName = useMemo(() => {
    const normalizedProfileEmail = String(profile?.email || "").trim().toLowerCase();
    const normalizedProfileName = String(profile?.name || profile?.full_name || "").trim().toLowerCase();

    if (!normalizedProfileEmail && !normalizedProfileName) return "";

    const activeEmployees = (employees || []).filter((emp) => emp?.status === "active");

    const matchedByEmail = activeEmployees.find(
      (emp) => String(emp?.email || "").trim().toLowerCase() === normalizedProfileEmail
    );
    if (matchedByEmail?.name) return matchedByEmail.name;

    const matchedByName = activeEmployees.find(
      (emp) => String(emp?.name || "").trim().toLowerCase() === normalizedProfileName
    );
    return matchedByName?.name || "";
  }, [employees, profile?.email, profile?.name, profile?.full_name]);

  const isStaffRole = String(profile?.role || "").trim().toLowerCase() === "staff";
  const isTechnicianLockedForStaff = isStaffRole && !!defaultTechnicianName;

  const [formData, setFormData] = useState<Partial<WorkOrder>>(() => {
    if (order?.id) return order;
    return {
      id: order?.id || "",
      customerName: order?.customerName || "",
      customerPhone: order?.customerPhone || "",
      vehicleModel: order?.vehicleModel || "",
      licensePlate: order?.licensePlate || "",
      vehicleId: order?.vehicleId || "",
      currentKm: order?.currentKm || undefined,
      issueDescription: order?.issueDescription || "",
      technicianName: order?.technicianName || defaultTechnicianName,
      status: order?.status || "Tiếp nhận",
      laborCost: order?.laborCost || 0,
      discount: order?.discount || 0,
      partsUsed: order?.partsUsed || [],
      total: order?.total || 0,
      branchId: order?.branchId || currentBranchId,
      paymentStatus: order?.paymentStatus || "unpaid",
      creationDate: order?.creationDate || new Date().toISOString(),
    };
  });

  const resolvedTechnicianName = isTechnicianLockedForStaff
    ? defaultTechnicianName
    : formData.technicianName || "";

  const [searchPart, setSearchPart] = useState("");
  const [devicePassword, setDevicePassword] = useState("");
  const [isPatternMode, setIsPatternMode] = useState(false);
  const [selectedParts, setSelectedParts] = useState<WorkOrderPart[]>([]);
  const [includeIntegratedLabor, setIncludeIntegratedLabor] = useState(true);
  const [showPartSearch, setShowPartSearch] = useState(false);
  const [partialPayment, setPartialPayment] = useState(0);
  const [showPartialPayment, setShowPartialPayment] = useState(false);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showAddVehicleModelDropdown, setShowAddVehicleModelDropdown] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [showDepositInput, setShowDepositInput] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    vehicleModel: "",
    licensePlate: "",
  });

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [serverCustomers, setServerCustomers] = useState<any[]>([]);
  const debouncedCustomerSearch = useDebouncedValue(customerSearch, 500);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerPage, setCustomerPage] = useState(0);
  const [hasMoreCustomers, setHasMoreCustomers] = useState(true);
  const CUSTOMER_PAGE_SIZE = 20;

  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    model: "",
    licensePlate: "",
  });

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");

  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editVehicleModel, setEditVehicleModel] = useState("");
  const [editVehicleLicensePlate, setEditVehicleLicensePlate] = useState("");

  const isOrderPaid = order?.paymentStatus === "paid" && (order?.status === "Trả máy" || formData.status === "Trả máy");
  const isOrderRefunded = order?.refunded === true;
  const canEditPriceAndParts = (!isOrderPaid || formData.status !== "Trả máy") && !isOrderRefunded;

  const currentCustomer = customers.find((c: any) => c.phone === formData.customerPhone);
  const customerVehicles = currentCustomer?.vehicles || [];

  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountPercent, setDiscountPercent] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const [additionalServices, setAdditionalServices] = useState<
    Array<{
      id: string;
      description: string;
      quantity: number;
      price: number;
      costPrice?: number;
    }>
  >([]);
  const [newService, setNewService] = useState({
    description: "",
    quantity: 1,
    price: 0,
    costPrice: 0,
  });
  
  const [repairServices, setRepairServices] = useState<RepairServiceDraft[]>(
    order?.repairServices?.map(mapRepairServiceToDraft) || []
  );
  const [newRepairServiceDraft, setNewRepairServiceDraft] = useState<RepairServiceDraft>(
    createEmptyRepairServiceDraft()
  );

  useEffect(() => {
    if (order?.partsUsed) {
      setSelectedParts(order.partsUsed);
    } else {
      setSelectedParts([]);
    }

    if (order?.customerName) {
      setCustomerSearch(order.customerName);
    } else {
      setCustomerSearch("");
    }

    if (order?.additionalServices && Array.isArray(order.additionalServices) && order.additionalServices.length > 0) {
      setAdditionalServices(order.additionalServices);
    } else {
      setAdditionalServices([]);
    }

    if (order?.repairServices && Array.isArray(order.repairServices) && order.repairServices.length > 0) {
      setRepairServices(order.repairServices.map(mapRepairServiceToDraft));
    } else {
      setRepairServices([]);
    }
    setNewRepairServiceDraft(createEmptyRepairServiceDraft());

    if (order?.depositAmount) {
      setDepositAmount(order.depositAmount);
      setShowDepositInput(true);
    } else {
      setDepositAmount(0);
      setShowDepositInput(false);
    }

    if (order?.additionalPayment) {
      setPartialPayment(order.additionalPayment);
      setShowPartialPayment(true);
    } else {
      setPartialPayment(0);
      setShowPartialPayment(false);
    }

    setDiscountType("amount");
    setDiscountPercent(0);

    setIsEditingCustomer(false);
    setEditCustomerName("");
    setEditCustomerPhone("");
  }, [order]);

  useEffect(() => {
    if (order?.id) return;
    if (!defaultTechnicianName) return;

    setFormData((prev: any) => {
      if (String(prev.technicianName || "").trim()) return prev;
      return {
        ...prev,
        technicianName: defaultTechnicianName,
      };
    });
  }, [order?.id, defaultTechnicianName]);

  useEffect(() => {
    if (!isTechnicianLockedForStaff) return;

    setFormData((prev: any) => {
      if (String(prev.technicianName || "").trim() === defaultTechnicianName) {
        return prev;
      }
      return {
        ...prev,
        technicianName: defaultTechnicianName,
      };
    });
  }, [isTechnicianLockedForStaff, defaultTechnicianName]);

  useEffect(() => {
    setCustomerPage(0);
    setHasMoreCustomers(true);
  }, [debouncedCustomerSearch]);

  const fetchCustomers = async (page: number, searchTerm: string, isLoadMore = false) => {
    if (!searchTerm.trim()) {
      if (!isLoadMore) setServerCustomers([]);
      return;
    }

    setIsSearchingCustomer(true);
    try {
      const from = page * CUSTOMER_PAGE_SIZE;
      const to = from + CUSTOMER_PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: false })
        .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .range(from, to);

      if (!error && data) {
        if (isLoadMore) {
          setServerCustomers((prev: any[]) => {
            const newIds = new Set(data.map((c: any) => c.id));
            const filteredPrev = prev.filter((c: any) => !newIds.has(c.id));
            return [...filteredPrev, ...data];
          });
        } else {
          setServerCustomers(data);
        }

        if (data.length < CUSTOMER_PAGE_SIZE || (count !== null && from + data.length >= count)) {
          setHasMoreCustomers(false);
        } else {
          setHasMoreCustomers(true);
        }
      }
    } catch (err) {
      console.error("Error searching customers:", err);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  useEffect(() => {
    if (debouncedCustomerSearch.trim()) {
      fetchCustomers(0, debouncedCustomerSearch.trim(), false);
    } else {
      setServerCustomers([]);
    }
  }, [debouncedCustomerSearch]);

  useEffect(() => {
    if (order?.issueDescription) {
      const match = order.issueDescription.match(/\[MK: (.+?)\]/);
      if (match) {
        const pass = match[1];
        setDevicePassword(pass);
        setIsPatternMode(pass.startsWith("Pattern:"));
      } else {
        setDevicePassword("");
        setIsPatternMode(false);
      }
    } else {
      setDevicePassword("");
      setIsPatternMode(false);
    }
  }, [order]);

  const handleLoadMoreCustomers = () => {
    const nextPage = customerPage + 1;
    setCustomerPage(nextPage);
    fetchCustomers(nextPage, debouncedCustomerSearch.trim(), true);
  };

  const filteredCustomers = useMemo(() => {
    const allCandidates = [...customers, ...serverCustomers];
    const uniqueCandidates = Array.from(new Map(allCandidates.map(c => [c.id, c])).values());

    if (!customerSearch.trim()) {
      return uniqueCandidates.slice(0, 10);
    }

    const q = normalizeSearchText(customerSearch);
    return uniqueCandidates.filter(
      (c: any) =>
        normalizeSearchText(c.name).includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        (c.vehicles &&
          c.vehicles.some((v: any) =>
            normalizeSearchText(v.licensePlate).includes(q) ||
            v.licensePlate?.toLowerCase().includes(q.toLowerCase())
          ))
    );
  }, [customers, serverCustomers, customerSearch]);

  const handleSelectVehicle = (vehicle: any) => {
    setFormData((prev: any) => ({
      ...prev,
      vehicleId: vehicle.id,
      vehicleModel: vehicle.model,
      licensePlate: vehicle.licensePlate,
    }));
    setShowVehicleDropdown(false);
  };

  const handleAddVehicle = () => {
    if (!currentCustomer) return;
    if (!newVehicle.model.trim() || !newVehicle.licensePlate.trim()) {
      showToast.error("Vui lòng nhập đầy đủ tên thiết bị và Serial/IMEI");
      return;
    }

    const vehicleId = `VEH-${Date.now()}`;
    const existingVehicles = currentCustomer.vehicles || [];

    const updatedVehicles = [
      ...existingVehicles,
      {
        id: vehicleId,
        model: newVehicle.model.trim(),
        licensePlate: newVehicle.licensePlate.trim(),
        isPrimary: existingVehicles.length === 0,
      },
    ];

    upsertCustomer({
      ...currentCustomer,
      vehicles: updatedVehicles,
    });

    setFormData((prev: any) => ({
      ...prev,
      vehicleId: vehicleId,
      vehicleModel: newVehicle.model.trim(),
      licensePlate: newVehicle.licensePlate.trim(),
    }));

    setNewVehicle({ model: "", licensePlate: "" });
    setShowAddVehicleModal(false);
    showToast.success("Đã thêm thiết bị mới");
  };

  const handleSaveEditedCustomer = async () => {
    if (!currentCustomer) return;
    if (!editCustomerName.trim() || !editCustomerPhone.trim()) {
      showToast.error("Vui lòng nhập đầy đủ tên và số điện thoại");
      return;
    }

    try {
      await upsertCustomer({
        ...currentCustomer,
        name: editCustomerName.trim(),
        phone: editCustomerPhone.trim(),
      });

      setFormData((prev: any) => ({
        ...prev,
        customerName: editCustomerName.trim(),
        customerPhone: editCustomerPhone.trim(),
      }));

      setCustomerSearch(editCustomerName.trim());
      setIsEditingCustomer(false);
      showToast.success("Đã cập nhật thông tin khách hàng");
    } catch (error) {
      console.error("Error updating customer:", error);
      showToast.error("Có lỗi khi cập nhật thông tin");
    }
  };

  const handleSaveEditedVehicle = async () => {
    if (!currentCustomer || !editingVehicleId) return;
    if (!editVehicleModel.trim() && !editVehicleLicensePlate.trim()) {
      showToast.error("Vui lòng nhập ít nhất tên thiết bị hoặc Serial/IMEI");
      return;
    }

    try {
      const updatedVehicles =
        currentCustomer.vehicles?.map((v: any) =>
          v.id === editingVehicleId
            ? {
                ...v,
                model: editVehicleModel.trim(),
                licensePlate: editVehicleLicensePlate.trim(),
              }
            : v
        ) || [];

      await upsertCustomer({
        ...currentCustomer,
        vehicles: updatedVehicles,
      });

      if (formData.vehicleId === editingVehicleId) {
        setFormData((prev: any) => ({
          ...prev,
          vehicleModel: editVehicleModel.trim(),
          licensePlate: editVehicleLicensePlate.trim(),
        }));
      }

      setEditingVehicleId(null);
      setEditVehicleModel("");
      setEditVehicleLicensePlate("");
      showToast.success("Đã cập nhật thông tin thiết bị");
    } catch (error) {
      console.error("Error updating vehicle:", error);
      showToast.error("Có lỗi khi cập nhật thông tin thiết bị");
    }
  };

  const getSelectedPartCost = (partId: string) => {
    const part = selectedParts.find((item: any) => item.partId === partId);
    if (!part) return 0;
    return Number(part.costPrice || 0) * Number(part.quantity || 0);
  };

  const getRepairServiceLaborAmount = (service: RepairServiceDraft) =>
    calculateLabor(
      {
        labor_calc_type: service.laborCalcType,
        labor_fixed_amount: service.laborFixedAmount,
        labor_percent_of_cost: service.laborPercentOfCost,
        minimum_labor_amount: service.minimumLaborAmount,
      },
      service.relatedItemIds.reduce((sum: number, partId: string) => sum + getSelectedPartCost(partId), 0),
      service.manualLabor
    );

  const getRepairServiceWorkers = (service: RepairServiceDraft) => {
    if (service.workers.length > 0) return service.workers;
    return buildDefaultWorkerSplit(
      employeeOptions,
      resolvedTechnicianName,
      service.defaultWorkerSharePercent
    );
  };

  const buildRepairServicePayloads = () =>
    repairServices.map((service: RepairServiceDraft) => {
      const laborAmount = getRepairServiceLaborAmount(service);
      const effectiveWorkers = getRepairServiceWorkers(service);
      const workerSplits = splitWorkerAmount(laborAmount, effectiveWorkers);

      return {
        service_id: service.serviceId,
        service_name: service.serviceName,
        labor_calc_type: service.laborCalcType,
        labor_fixed_amount: service.laborFixedAmount,
        labor_percent_of_cost: service.laborPercentOfCost,
        minimum_labor_amount: service.minimumLaborAmount,
        related_product_cost: service.relatedItemIds.reduce(
          (sum: number, partId: string) => sum + getSelectedPartCost(partId),
          0
        ),
        labor_amount: laborAmount,
        worker_share_percent:
          workerSplits.length === 1
            ? Number(workerSplits[0].share_percent || 0)
            : Number(service.defaultWorkerSharePercent || 0),
        worker_amount:
          workerSplits.length === 1 ? Number(workerSplits[0].worker_amount || 0) : 0,
        is_billable: service.isBillable,
        is_payable_to_worker: service.isPayableToWorker,
        note: service.note,
        workers: workerSplits,
        related_items: service.relatedItemIds.map((partId: string) => {
          const selectedPart = selectedParts.find((part: any) => part.partId === partId);
          const lineCost = getSelectedPartCost(partId);

          return {
            part_id: partId,
            part_name: selectedPart?.partName || "",
            quantity: Number(selectedPart?.quantity || 0),
            unit_cost: Number(selectedPart?.costPrice || 0),
            line_cost: lineCost,
          };
        }),
      };
    });

  const syncRepairServicesForOrder = async (repairOrderId: string) => {
    const payloads = buildRepairServicePayloads().filter(
      (service: any) => service.service_name.trim().length > 0
    );

    const result = await syncRepairOrderServices(repairOrderId, payloads);
    if ("ok" in result && !result.ok) {
      throw (result as { error: any }).error;
    }

    return result.data;
  };

  const getPartLaborBase = (partId: string) => sharedGetPartLaborBase(partId, parts, currentBranchId);
  const getPartWarranty = (partId: string) => sharedGetPartWarranty(partId, parts);
  const getIntegratedLaborByQuantity = (laborBase: number, quantity: number) => sharedGetIntegratedLaborByQuantity(laborBase, quantity);

  const partsTotal = selectedParts.reduce(
    (sum: number, p: any) => sum + (p.price || 0) * (p.quantity || 0),
    0
  );
  
  const repairLaborTotal = repairServices.reduce(
    (sum: number, service: RepairServiceDraft) => sum + (service.isBillable ? getRepairServiceLaborAmount(service) : 0),
    0
  );
  
  const servicesTotal = additionalServices.reduce(
    (sum: number, s: any) => sum + (s.price || 0) * (s.quantity || 0),
    0
  );
  
  const partsLaborInfoTotal = selectedParts.reduce((sum: number, item: any) => {
    const laborBase = getPartLaborBase(item.partId);
    return sum + getIntegratedLaborByQuantity(laborBase, Number(item.quantity || 0));
  }, 0);
  
  const effectiveLaborCost = includeIntegratedLabor ? partsLaborInfoTotal : 0;
  const subtotal = partsTotal + servicesTotal + effectiveLaborCost + repairLaborTotal;
  const discount = formData.discount || 0;
  const total = Math.max(0, subtotal - discount);

  const totalDeposit = depositAmount || order.depositAmount || 0;
  
  const totalAdditionalPayment =
    formData.status === "Trả máy" && showPartialPayment ? partialPayment : 0;
  const totalPaid = totalDeposit + totalAdditionalPayment;
  const remainingAmount = Math.max(0, total - totalPaid);

  const createCustomerDebt = useCreateCustomerDebtRepo();
  const createCustomerDebtIfNeeded = async (
    workOrder: WorkOrder,
    remainingAmount: number,
    totalAmount: number,
    paidAmount: number
  ) => {
    if (remainingAmount <= 0) return;

    try {
      const safeCustomerId =
        workOrder.customerPhone || workOrder.id || `CUST-ANON-${Date.now()}`;
      const safeCustomerName =
        workOrder.customerName?.trim() ||
        workOrder.customerPhone ||
        "Khách vãng lai";

      const workOrderNumber = formatWorkOrderId(
        workOrder.id,
        storeSettings?.work_order_prefix
      );

      let description = `${workOrder.vehicleModel || "Xe"} (Phiếu sửa chữa #${workOrderNumber})`;

      if (workOrder.issueDescription) {
        description += `\nVấn đề: ${workOrder.issueDescription}`;
      }

      if (workOrder.partsUsed && workOrder.partsUsed.length > 0) {
        description += "\n\nPhụ tùng đã thay:";
        workOrder.partsUsed.forEach((part: any) => {
          description += `\n  - ${part.quantity} x ${part.partName} - ${formatCurrency(part.price * part.quantity)}`;
        });
      }

      if (workOrder.additionalServices && workOrder.additionalServices.length > 0) {
        description += "\n\nDịch vụ:";
        workOrder.additionalServices.forEach((service: any) => {
          description += `\n  - ${service.quantity} x ${service.description} - ${formatCurrency(service.price * service.quantity)}`;
        });
      }

      if (workOrder.laborCost && workOrder.laborCost > 0) {
        description += `\n\nCông lao động: ${formatCurrency(workOrder.laborCost)}`;
      }

      if (workOrder.discount && workOrder.discount > 0) {
        description += `\nGiảm giá: -${formatCurrency(workOrder.discount)}`;
      }

      const createdByDisplay = profile?.name || profile?.full_name || "N/A";
      description += `\n\nNV: ${createdByDisplay}`;

      if (workOrder.technicianName) {
        description += `\nNVKỹ thuật: ${workOrder.technicianName}`;
      }

      const payload = {
        customerId: safeCustomerId,
        customerName: safeCustomerName,
        phone: workOrder.customerPhone || null,
        licensePlate: workOrder.licensePlate || null,
        description: description,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        createdDate: new Date().toISOString().split("T")[0],
        branchId: currentBranchId,
        workOrderId: workOrder.id,
      };

      const result = await createCustomerDebt.mutateAsync(payload as any);
      showToast.success(
        `Đã tạo/cập nhật công nợ ${remainingAmount.toLocaleString()}đ (Mã: ${result?.id || "N/A"})`
      );
    } catch (error) {
      console.error("Error creating/updating customer debt:", error);
      showToast.error("Không thể tạo/cập nhật công nợ tự động");
    }
  };

  const parseMissingWorkOrderColumn = (error: any): string | null => {
    if (!error || String(error.code || "").toUpperCase() !== "PGRST204") {
      return null;
    }
    const message = String(error.message || "");
    const match = message.match(/'([^']+)'\s+column\s+of\s+'work_orders'/i);
    return match?.[1] || null;
  };

  const normalizeColumnKey = (key: string): string =>
    String(key || "")
      .trim()
      .toLowerCase()
      .replace(/[_\s-]/g, "");

  const removeMissingColumnFromPayload = (
    payload: Record<string, any>,
    missingColumn: string
  ): { nextPayload: Record<string, any>; removedCount: number } => {
    const nextPayload = { ...payload };

    if (Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
      delete nextPayload[missingColumn];
      return { nextPayload, removedCount: 1 };
    }

    const target = normalizeColumnKey(missingColumn);
    const keyToDelete = Object.keys(nextPayload).find(
      (key) => normalizeColumnKey(key) === target
    );

    if (keyToDelete) {
      delete nextPayload[keyToDelete];
      return { nextPayload, removedCount: 1 };
    }

    return { nextPayload, removedCount: 0 };
  };

  const parseNotNullColumn = (error: any): string | null => {
    if (!error || String(error.code || "") !== "23502") {
      return null;
    }
    const message = String(error.message || "");
    const match = message.match(/null\s+value\s+in\s+column\s+"([^"]+)"/i);
    return match?.[1] || null;
  };

  const insertWorkOrderWithSchemaFallback = async (payload: Record<string, any>) => {
    let attemptPayload: Record<string, any> = { ...payload };
    let lastError: any = null;

    for (let i = 0; i < 20; i++) {
      const { data, error } = await supabase
        .from("work_orders")
        .insert(attemptPayload)
        .select();

      if (!error) {
        return { data, error: null, payload: attemptPayload };
      }

      lastError = error;

      const notNullColumn = parseNotNullColumn(error);
      if (notNullColumn && normalizeColumnKey(notNullColumn) === normalizeColumnKey("creationDate")) {
        attemptPayload = {
          ...attemptPayload,
          creationDate:
            attemptPayload.creationDate ||
            attemptPayload.creationdate ||
            new Date().toISOString(),
        };
        if (!Object.prototype.hasOwnProperty.call(attemptPayload, "creationdate")) {
          attemptPayload.creationdate = attemptPayload.creationDate;
        }
        continue;
      }

      const missingColumn = parseMissingWorkOrderColumn(error);
      if (!missingColumn) {
        break;
      }

      const { nextPayload, removedCount } = removeMissingColumnFromPayload(
        attemptPayload,
        missingColumn
      );
      if (removedCount === 0) {
        break;
      }

      attemptPayload = nextPayload;
    }

    return { data: null, error: lastError, payload: attemptPayload };
  };

  const updateWorkOrderWithSchemaFallback = async (
    orderId: string,
    payload: Record<string, any>
  ) => {
    let attemptPayload: Record<string, any> = { ...payload };
    let lastError: any = null;

    for (let i = 0; i < 20; i++) {
      const { data, error } = await supabase
        .from("work_orders")
        .update(attemptPayload)
        .eq("id", orderId)
        .select();

      if (!error) {
        return { data, error: null, payload: attemptPayload };
      }

      lastError = error;

      const notNullColumn = parseNotNullColumn(error);
      if (notNullColumn && normalizeColumnKey(notNullColumn) === normalizeColumnKey("creationDate")) {
        attemptPayload = {
          ...attemptPayload,
          creationDate:
            attemptPayload.creationDate ||
            attemptPayload.creationdate ||
            new Date().toISOString(),
        };
        if (!Object.prototype.hasOwnProperty.call(attemptPayload, "creationdate")) {
          attemptPayload.creationdate = attemptPayload.creationDate;
        }
        continue;
      }

      const missingColumn = parseMissingWorkOrderColumn(error);
      if (!missingColumn) {
        break;
      }

      const { nextPayload, removedCount } = removeMissingColumnFromPayload(
        attemptPayload,
        missingColumn
      );
      if (removedCount === 0) {
        break;
      }

      attemptPayload = nextPayload;
    }

    return { data: null, error: lastError, payload: attemptPayload };
  };

  const getBlockedDeepEditMessage = (nextAdditionalPayment: number): string | null => {
    if (!order?.id) return null;

    const normalizeNumber = (value: unknown): number => Number(value || 0);

    const normalizePartsForCompare = (items: any[] = []) =>
      items
        .map((item) => ({
          partId: String(item.partId || ""),
          partName: String(item.partName || ""),
          quantity: normalizeNumber(item.quantity),
          price: normalizeNumber(item.price ?? item.sellingPrice),
          costPrice: normalizeNumber(item.costPrice),
        }))
        .sort((a, b) =>
          `${a.partId}|${a.partName}`.localeCompare(`${b.partId}|${b.partName}`)
        );

    const normalizeServicesForCompare = (items: any[] = []) =>
      items
        .map((item) => ({
          description: String(item.description || item.name || ""),
          quantity: normalizeNumber(item.quantity),
          price: normalizeNumber(item.price ?? item.sellingPrice),
          costPrice: normalizeNumber(item.costPrice),
        }))
        .sort((a, b) => a.description.localeCompare(b.description));

    const normalizeRepairServicesForCompare = (items: any[] = []) =>
      items
        .map((item) => ({
          serviceId: String(item.serviceId || item.service_id || ""),
          serviceName: String(item.serviceName || item.service_name || ""),
          laborAmount: normalizeNumber(item.laborAmount || item.labor_amount),
          relatedItemIds: (item.relatedItemIds || item.related_items || item.relatedItems || [])
            .map((related: any) => String(related.partId || related.part_id || ""))
            .sort(),
        }))
        .sort((a, b) =>
          `${a.serviceId}|${a.serviceName}`.localeCompare(
            `${b.serviceId}|${b.serviceName}`
          )
        );

    const statusChanged = formData.status !== order.status;

    const previousDeposit = normalizeNumber(order.depositAmount);
    const previousAdditionalPayment = normalizeNumber(order.additionalPayment);
    const previousPaymentMethod = String(order.paymentMethod || "");
    const currentPaymentMethod = String(formData.paymentMethod || "");
    const paymentChanged =
      previousDeposit !== normalizeNumber(totalDeposit) ||
      previousAdditionalPayment !== normalizeNumber(nextAdditionalPayment) ||
      previousPaymentMethod !== currentPaymentMethod;

    const existingPartsSignature = JSON.stringify(
      normalizePartsForCompare(order.partsUsed as any[])
    );
    const currentPartsSignature = JSON.stringify(
      normalizePartsForCompare(selectedParts as any[])
    );

    const existingServicesSignature = JSON.stringify(
      normalizeServicesForCompare(order.additionalServices as any[])
    );
    const currentServicesSignature = JSON.stringify(
      normalizeServicesForCompare(additionalServices as any[])
    );

    const existingRepairServicesSignature = JSON.stringify(
      normalizeRepairServicesForCompare(order.repairServices as any[])
    );
    const currentRepairServicesSignature = JSON.stringify(
      normalizeRepairServicesForCompare(repairServices as any[])
    );

    const customerChanged =
      String(order.customerName || "") !== String(formData.customerName || "") ||
      String(order.customerPhone || "") !== String(formData.customerPhone || "");

    const vehicleChanged =
      String(order.vehicleId || "") !== String(formData.vehicleId || "") ||
      String(order.vehicleModel || "") !== String(formData.vehicleModel || "") ||
      String(order.licensePlate || "") !== String(formData.licensePlate || "") ||
      normalizeNumber(order.currentKm) !== normalizeNumber(formData.currentKm);

    const partsChanged =
      existingPartsSignature !== currentPartsSignature ||
      existingRepairServicesSignature !== currentRepairServicesSignature;

    const outsourceServicesChanged =
      existingServicesSignature !== currentServicesSignature;

    const laborChanged =
      normalizeNumber(order.laborCost) !== normalizeNumber(effectiveLaborCost);

    const discountChanged =
      normalizeNumber(order.discount) !== normalizeNumber(discount);

    if (statusChanged && !canUpdateWorkOrderStatus) {
      return "Bạn không có quyền đổi trạng thái phiếu sửa chữa";
    }

    if (paymentChanged && !canUpdateWorkOrderPayment) {
      return "Bạn không có quyền cập nhật thanh toán phiếu sửa chữa";
    }

    if (partsChanged && !canUpdateWorkOrderParts) {
      return "Bạn không có quyền sửa phụ tùng trong phiếu sửa chữa";
    }

    if (laborChanged && !canUpdateWorkOrderLabor) {
      return "Bạn không có quyền sửa tiền công (labor) phiếu sửa chữa";
    }

    if (discountChanged && !canUpdateWorkOrderDiscount) {
      return "Bạn không có quyền sửa giảm giá phiếu sửa chữa";
    }

    if (customerChanged && !canUpdateWorkOrderCustomer) {
      return "Bạn không có quyền sửa thông tin khách hàng trong phiếu sửa chữa";
    }

    if (vehicleChanged && !canUpdateWorkOrderVehicle) {
      return "Bạn không có quyền sửa thông tin thiết bị/xe trong phiếu sửa chữa";
    }

    if (outsourceServicesChanged && !canUpdateWorkOrderOutsourceService) {
      return "Bạn không có quyền tạo/sửa dịch vụ gia công ngoài";
    }

    return null;
  };

  const handleSaveOnly = async () => {
    if (!formData.customerName?.trim()) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return;
    }
    if (!formData.customerPhone?.trim()) {
      showToast.error("Vui lòng nhập số điện thoại");
      return;
    }

    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(formData.customerPhone.trim())) {
      showToast.error("Số điện thoại không hợp lệ! (cần 10-11 chữ số)");
      return;
    }

    // Validate workers' share percent total does not exceed 100%
    for (const service of repairServices || []) {
      const workers = service.workers || [];
      const totalShare = workers.reduce((sum: number, w: any) => sum + Number(w.share_percent || w.sharePercent || 0), 0);
      if (totalShare > 100) {
        showToast.error(`Tổng phần trăm chia thợ cho dịch vụ "${service.serviceName}" vượt quá 100% (${totalShare}%)`);
        return;
      }
    }

    const blockedMessageEarly = getBlockedDeepEditMessage(Number(order?.additionalPayment || 0));
    if (blockedMessageEarly) {
      showToast.error(blockedMessageEarly);
      return;
    }

    if (formData.customerName && formData.customerPhone) {
      const existingCustomer = customers.find((c) => c.phone === formData.customerPhone);

      if (!existingCustomer) {
        const vehicleId = `VEH-${Date.now()}`;
        const vehicles = [];
        if (formData.vehicleModel || formData.licensePlate) {
          vehicles.push({
            id: vehicleId,
            model: formData.vehicleModel || "",
            licensePlate: formData.licensePlate || "",
            isPrimary: true,
          });
        }

        await upsertCustomer({
          id: `CUST-${Date.now()}`,
          name: formData.customerName,
          phone: formData.customerPhone,
          vehicles: vehicles.length > 0 ? vehicles : undefined,
          vehicleModel: formData.vehicleModel,
          licensePlate: formData.licensePlate,
          created_at: new Date().toISOString(),
        });
      } else {
        if (formData.vehicleModel && existingCustomer.vehicleModel !== formData.vehicleModel) {
          await upsertCustomer({
            ...existingCustomer,
            vehicleModel: formData.vehicleModel,
            licensePlate: formData.licensePlate,
          });
        }
      }
    }

    let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
    const existingPaid = (order?.depositAmount || 0) + (order?.additionalPayment || 0);
    if (existingPaid >= total) {
      paymentStatus = "paid";
    } else if (existingPaid > 0) {
      paymentStatus = "partial";
    }

    try {
      const orderId = order?.id || generateWorkOrderId(storeSettings?.work_order_prefix);
      const resolvedCreationDate = order?.creationDate || new Date().toISOString();

      let finalIssueDescription = formData.issueDescription || "";
      finalIssueDescription = finalIssueDescription.replace(/\[MK: .+?\]\s*/g, "").trim();
      if (devicePassword && devicePassword.trim()) {
        finalIssueDescription = `[MK: ${devicePassword.trim()}] ${finalIssueDescription}`;
      }

      const workOrderData = {
        id: orderId,
        customerName: formData.customerName || "",
        customername: formData.customerName || "",
        customerPhone: formData.customerPhone || "",
        customerphone: formData.customerPhone || "",
        vehicleId: formData.vehicleId,
        vehicleid: formData.vehicleId,
        vehicleModel: formData.vehicleModel || "",
        vehiclemodel: formData.vehicleModel || "",
        licensePlate: formData.licensePlate || "",
        licenseplate: formData.licensePlate || "",
        currentKm: formData.currentKm,
        currentkm: formData.currentKm,
        issueDescription: finalIssueDescription,
        issuedescription: finalIssueDescription,
        technicianName: resolvedTechnicianName,
        technicianname: resolvedTechnicianName,
        status: formData.status || "Tiếp nhận",
        laborCost: effectiveLaborCost,
        laborcost: effectiveLaborCost,
        discount: discount,
        partsUsed: selectedParts,
        partsused: selectedParts,
        additionalServices: additionalServices.length > 0 ? additionalServices : undefined,
        additionalservices: additionalServices.length > 0 ? additionalServices : undefined,
        total: total,
        branchId: currentBranchId,
        branchid: currentBranchId,
        paymentStatus: paymentStatus,
        paymentstatus: paymentStatus,
        paymentMethod: formData.paymentMethod || null,
        paymentmethod: formData.paymentMethod || null,
        depositAmount: order?.depositAmount || null,
        depositamount: order?.depositAmount || null,
        totalPaid: existingPaid > 0 ? existingPaid : null,
        totalpaid: existingPaid > 0 ? existingPaid : null,
        remainingAmount: total - existingPaid,
        remainingamount: total - existingPaid,
        creationDate: resolvedCreationDate,
        creationdate: resolvedCreationDate,
      };

      if (order?.id) {
        const { error } = await updateWorkOrderWithSchemaFallback(order.id, workOrderData);
        if (error) {
          console.error("[UPDATE ERROR]", error);
          throw error;
        }

        if (formData.currentKm && formData.vehicleId && formData.customerPhone) {
          const customer = customers.find((c) => c.phone === formData.customerPhone);
          if (customer) {
            const existingVehicles = customer.vehicles || [];
            const vehicleExists = existingVehicles.some((v: any) => v.id === formData.vehicleId);

            if (vehicleExists) {
              const updatedVehicles = existingVehicles.map((v: any) =>
                v.id === formData.vehicleId
                  ? { ...v, currentKm: formData.currentKm }
                  : v
              );

              const { error: updateError } = await supabase
                .from("customers")
                .update({ vehicles: updatedVehicles })
                .eq("id", customer.id);

              if (updateError) {
                console.error(`[WorkOrderFormState UPDATE] Failed to update km in DB:`, updateError);
              } else {
                upsertCustomer({
                  ...customer,
                  vehicles: updatedVehicles,
                });
              }
            }
          }
        }
      } else {
        const { error } = await insertWorkOrderWithSchemaFallback(workOrderData);
        if (error) {
          console.error("[INSERT ERROR]", error);
          throw error;
        }

        if (formData.currentKm && formData.vehicleId && formData.customerPhone) {
          const customer = customers.find((c) => c.phone === formData.customerPhone);
          if (customer) {
            const existingVehicles = customer.vehicles || [];
            const vehicleExists = existingVehicles.some((v: any) => v.id === formData.vehicleId);

            let updatedVehicles;
            if (vehicleExists) {
              updatedVehicles = existingVehicles.map((v: any) =>
                v.id === formData.vehicleId
                  ? { ...v, currentKm: formData.currentKm }
                  : v
              );
            } else {
              const newVehicleObj = {
                id: formData.vehicleId,
                licensePlate: formData.licensePlate,
                model: formData.vehicleModel,
                currentKm: formData.currentKm,
              };
              updatedVehicles = [...existingVehicles, newVehicleObj];
            }

            const { error: updateError } = await supabase
              .from("customers")
              .update({ vehicles: updatedVehicles })
              .eq("id", customer.id);

            if (updateError) {
              console.error(`[WorkOrderFormState CREATE] Failed to update km in DB:`, updateError);
            } else {
              upsertCustomer({
                ...customer,
                vehicles: updatedVehicles,
              });
            }
          }
        }
      }

      const syncedRepairServices = await syncRepairServicesForOrder(orderId);
      (workOrderData as any).repairServices = syncedRepairServices;
      (workOrderData as any).laborTotal = syncedRepairServices.reduce(
        (sum: number, service: any) => sum + Number(service.laborAmount || 0),
        0
      );
      (workOrderData as any).workerTotal = syncedRepairServices.reduce(
        (sum: number, service: any) =>
          sum +
          (service.workers && service.workers.length > 0
            ? service.workers.reduce(
                (workerSum: number, worker: any) => workerSum + Number(worker.workerAmount || 0),
                0
              )
            : Number(service.workerAmount || 0)),
        0
      );

      if (invalidateWorkOrders) {
        invalidateWorkOrders();
      }

      if (workOrderData.status === "Trả máy" && workOrderData.remainingAmount > 0) {
        await createCustomerDebtIfNeeded(
          workOrderData as unknown as WorkOrder,
          workOrderData.remainingAmount,
          workOrderData.total,
          existingPaid
        );
      }

      onSave(workOrderData as unknown as WorkOrder);
      showToast.success(order?.id ? "Đã cập nhật phiếu" : "Đã lưu phiếu thành công");
      onClose();
    } catch (error: any) {
      console.error("Error saving work order:", error);
      showToast.error("Lỗi khi lưu phiếu: " + (error.message || error.hint || "Không xác định"));
    }
  };

  const handleSave = async (forceFullPayment = false) => {
    if (submittingRef.current || isSubmitting) {
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      if (!formData.customerName?.trim()) {
        showToast.error("Vui lòng nhập tên khách hàng");
        return;
      }
      if (!formData.customerPhone?.trim()) {
        showToast.error("Vui lòng nhập số điện thoại");
        return;
      }

      const phoneRegex = /^[0-9]{10,11}$/;
      if (!phoneRegex.test(formData.customerPhone.trim())) {
        showToast.error("Số điện thoại không hợp lệ! (cần 10-11 chữ số)");
        return;
      }

      // Validate workers' share percent total does not exceed 100%
      for (const service of repairServices || []) {
        const workers = service.workers || [];
        const totalShare = workers.reduce((sum: number, w: any) => sum + Number(w.share_percent || w.sharePercent || 0), 0);
        if (totalShare > 100) {
          showToast.error(`Tổng phần trăm chia thợ cho dịch vụ "${service.serviceName}" vượt quá 100% (${totalShare}%)`);
          return;
        }
      }

      const additionalPaymentPreview =
        formData.status === "Trả máy"
          ? forceFullPayment
            ? Math.max(0, total - totalDeposit)
            : showPartialPayment
              ? partialPayment
              : 0
          : 0;

      const blockedMessageEarly = getBlockedDeepEditMessage(additionalPaymentPreview);
      if (blockedMessageEarly) {
        showToast.error(blockedMessageEarly);
        return;
      }

      if (total <= 0 && formData.status === "Trả máy") {
        showToast.error("Tổng tiền phải lớn hơn 0 khi trả máy");
        return;
      }

      if (formData.customerName && formData.customerPhone) {
        const existingCustomer = customers.find((c) => c.phone === formData.customerPhone);

        if (!existingCustomer) {
          const vehicleId = `VEH-${Date.now()}`;
          const vehicles = [];
          if (formData.vehicleModel || formData.licensePlate) {
            vehicles.push({
              id: vehicleId,
              model: formData.vehicleModel || "",
              licensePlate: formData.licensePlate || "",
              isPrimary: true,
            });
          }

          await upsertCustomer({
            id: `CUST-${Date.now()}`,
            name: formData.customerName,
            phone: formData.customerPhone,
            vehicles: vehicles.length > 0 ? vehicles : undefined,
            vehicleModel: formData.vehicleModel,
            licensePlate: formData.licensePlate,
            created_at: new Date().toISOString(),
          });
        } else {
          if (formData.vehicleModel && existingCustomer.vehicleModel !== formData.vehicleModel) {
            await upsertCustomer({
              ...existingCustomer,
              vehicleModel: formData.vehicleModel,
              licensePlate: formData.licensePlate,
            });
          }
        }
      }

      const maxAdditionalPayment = Math.max(0, total - totalDeposit);
      const additionalPaymentToApply =
        formData.status === "Trả máy"
          ? forceFullPayment
            ? maxAdditionalPayment
            : showPartialPayment
              ? Math.min(partialPayment, maxAdditionalPayment)
              : 0
          : 0;

      const totalPaidToApply = totalDeposit + additionalPaymentToApply;
      const remainingAmountToApply = Math.max(0, total - totalPaidToApply);

      let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
      if (totalPaidToApply >= total) {
        paymentStatus = "paid";
      } else if (totalPaidToApply > 0) {
        paymentStatus = "partial";
      }

      let finalIssueDescription = formData.issueDescription || "";
      finalIssueDescription = finalIssueDescription.replace(/\[MK: .+?\]\s*/g, "").trim();
      if (devicePassword && devicePassword.trim()) {
        finalIssueDescription = `[MK: ${devicePassword.trim()}] ${finalIssueDescription}`;
      }

      if (!order?.id) {
        try {
          const orderId = generateWorkOrderId(storeSettings?.work_order_prefix);

          const responseData = await createWorkOrderAtomicAsync({
            id: orderId,
            customerName: formData.customerName || "",
            customerPhone: formData.customerPhone || "",
            vehicleModel: formData.vehicleModel || "",
            licensePlate: formData.licensePlate || "",
            currentKm: formData.currentKm,
            issueDescription: finalIssueDescription,
            technicianName: resolvedTechnicianName,
            status: formData.status || "Tiếp nhận",
            laborCost: effectiveLaborCost,
            discount: discount,
            partsUsed: selectedParts,
            additionalServices: additionalServices.length > 0 ? additionalServices : undefined,
            total: total,
            branchId: currentBranchId,
            paymentStatus: paymentStatus,
            paymentMethod: formData.paymentMethod,
            depositAmount: depositAmount > 0 ? depositAmount : undefined,
            additionalPayment: additionalPaymentToApply > 0 ? additionalPaymentToApply : undefined,
            totalPaid: totalPaidToApply > 0 ? totalPaidToApply : undefined,
            remainingAmount: remainingAmountToApply,
            creationDate: new Date().toISOString(),
          } as any);

          const syncedRepairServices = await syncRepairServicesForOrder(orderId);
          const finalOrder = {
            ...(responseData as any),
            repairServices: syncedRepairServices,
          };

          // 🔹 FIX Desktop: completeWorkOrderPayment to deduct stock
          if (
            (paymentStatus === "paid" || (formData.status || "Tiếp nhận") === "Trả máy") &&
            selectedParts.length > 0 &&
            !(responseData as any)?.inventoryDeducted
          ) {
            try {
              const deductResult = await completeWorkOrderPayment(
                orderId,
                formData.paymentMethod || "cash",
                0
              );
              if (deductResult.ok && deductResult.data.usedFallback) {
                showToast.warning(
                  "Đã lưu phiếu nhưng KHO CHƯA ĐƯỢC TRỪ tự động (thiếu RPC trên database). Vui lòng liên hệ quản trị để chạy migration."
                );
              }
            } catch (err) {
              console.error("[handleSave] Error in completeWorkOrderPayment:", err);
            }
          }

          if (invalidateWorkOrders) {
            invalidateWorkOrders();
          }

          if (finalOrder.status === "Trả máy" && remainingAmountToApply > 0) {
            await createCustomerDebtIfNeeded(
              finalOrder,
              remainingAmountToApply,
              total,
              totalPaidToApply
            );
          }

          onSave(finalOrder);
          onClose();
        } catch (error: any) {
          console.error("Error creating work order (atomic):", error);
        }
        return;
      }

      if (order?.id) {
        try {
          const responseData = await updateWorkOrderAtomicAsync({
            id: order.id,
            customerName: formData.customerName || "",
            customerPhone: formData.customerPhone || "",
            vehicleModel: formData.vehicleModel || "",
            licensePlate: formData.licensePlate || "",
            issueDescription: finalIssueDescription,
            technicianName: resolvedTechnicianName,
            status: formData.status || "Tiếp nhận",
            laborCost: effectiveLaborCost,
            discount: discount,
            partsUsed: selectedParts,
            additionalServices: additionalServices.length > 0 ? additionalServices : undefined,
            total: total,
            branchId: currentBranchId,
            paymentStatus: paymentStatus,
            paymentMethod: formData.paymentMethod,
            depositAmount: depositAmount > 0 ? depositAmount : undefined,
            additionalPayment: additionalPaymentToApply > 0 ? additionalPaymentToApply : undefined,
            totalPaid: totalPaidToApply > 0 ? totalPaidToApply : undefined,
            remainingAmount: remainingAmountToApply,
          } as any);

          const syncedRepairServices = await syncRepairServicesForOrder(order.id);
          const finalOrder = {
            ...((responseData as any)?.workOrder || responseData as any),
            repairServices: syncedRepairServices,
          };

          // 🔹 FIX Desktop: completeWorkOrderPayment to deduct stock if paid or completed
          const wasUnpaidOrPartial = order.paymentStatus !== "paid";
          const wasNotInventoryDeducted = !order.inventoryDeducted;
          if (
            (paymentStatus === "paid" || (formData.status || "Tiếp nhận") === "Trả máy") &&
            (wasUnpaidOrPartial || wasNotInventoryDeducted) &&
            selectedParts.length > 0
          ) {
            try {
              const deductResult = await completeWorkOrderPayment(
                order.id,
                formData.paymentMethod || "cash",
                0
              );
              if (deductResult.ok && deductResult.data.usedFallback) {
                showToast.warning(
                  "Đã cập nhật phiếu nhưng KHO CHƯA ĐƯỢC TRỪ tự động (thiếu RPC trên database). Vui lòng liên hệ quản trị để chạy migration."
                );
              }
            } catch (err: any) {
              console.error("[handleSave] Error in completeWorkOrderPayment (update):", err);
            }
          }

          if (invalidateWorkOrders) {
            invalidateWorkOrders();
          }

          if (finalOrder.status === "Trả máy" && remainingAmountToApply > 0) {
            await createCustomerDebtIfNeeded(
              finalOrder,
              remainingAmountToApply,
              total,
              totalPaidToApply
            );
          }

          onSave(finalOrder);
          onClose();
        } catch (error: any) {
          console.error("[handleSave] Error updating work order (atomic):", error);
        }
        return;
      }
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const handleAddDevicePhoto = async (file: File) => {
    try {
      setIsUploadingPhoto(true);
      const compressedBlob = await compressImage(file);
      const tempId = order?.id || `temp_${Date.now()}`;
      const photoUrl = await uploadDevicePhoto(tempId, compressedBlob);
      
      setFormData((prev: any) => ({
        ...prev,
        devicePhotos: [...(prev.devicePhotos || []), photoUrl]
      }));
    } catch (error: any) {
      showToast.error(error.message || "Không thể upload ảnh thiết bị");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemoveDevicePhoto = async (photoUrl: string) => {
    try {
      await deleteDevicePhoto(photoUrl);
      setFormData((prev: any) => ({
        ...prev,
        devicePhotos: (prev.devicePhotos || []).filter((url: string) => url !== photoUrl)
      }));
    } catch (error: any) {
      setFormData((prev: any) => ({
        ...prev,
        devicePhotos: (prev.devicePhotos || []).filter((url: string) => url !== photoUrl)
      }));
      showToast.error("Không thể xóa ảnh từ hệ thống, đã gỡ khỏi phiếu hiện tại.");
    }
  };

  const handlePayFull = async () => {
    const fullPayment = Math.max(0, total - totalDeposit);
    setShowPartialPayment(true);
    setPartialPayment(fullPayment);
    await handleSave(true);
  };

  const handleAddPart = (part: Part) => {
    const customerWarranties = (warrantyCards || []).filter((c: any) => 
      c.customer_phone === formData.customerPhone && 
      c.status === 'active' &&
      new Date(c.warranty_end_date) >= new Date()
    );
    
    const isUnderWarranty = customerWarranties.some((c: any) => 
      c.device_model?.toLowerCase().trim() === part.name.toLowerCase().trim()
    );
    
    const priceToApply = isUnderWarranty ? 0 : (part.retailPrice[currentBranchId] || 0);
    
    if (isUnderWarranty) {
      showToast.info(`Phụ tùng "${part.name}" đang trong thời gian bảo hành. Đã tự động miễn phí!`);
    }

    const existing = selectedParts.find((p) => p.partId === part.id);
    if (existing) {
      setSelectedParts(
        selectedParts.map((p) =>
          p.partId === part.id ? { ...p, quantity: p.quantity + 1, price: priceToApply } : p
        )
      );
    } else {
      setSelectedParts([
        ...selectedParts,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku || "",
          category: part.category || "",
          quantity: 1,
          price: priceToApply,
          costPrice: part.costPrice?.[currentBranchId] || 0,
        },
      ]);
    }
    setShowPartSearch(false);
    setSearchPart("");
  };

  const availableParts = useMemo(() => {
    return parts.filter((part) => {
      const stock = part.stock?.[currentBranchId] || 0;
      return stock > 0;
    });
  }, [parts, currentBranchId]);

  const filteredParts = useMemo(() => {
    if (!searchPart.trim()) return availableParts;

    return availableParts.filter(
      (p) =>
        p.name.toLowerCase().includes(searchPart.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchPart.toLowerCase())
    );
  }, [availableParts, searchPart]);

  return {
    formData,
    setFormData,
    resolvedTechnicianName,
    isTechnicianLockedForStaff,
    searchPart,
    setSearchPart,
    devicePassword,
    setDevicePassword,
    isPatternMode,
    setIsPatternMode,
    selectedParts,
    setSelectedParts,
    includeIntegratedLabor,
    setIncludeIntegratedLabor,
    showPartSearch,
    setShowPartSearch,
    partialPayment,
    setPartialPayment,
    showPartialPayment,
    setShowPartialPayment,
    showVehicleDropdown,
    setShowVehicleDropdown,
    showAddVehicleModelDropdown,
    setShowAddVehicleModelDropdown,
    depositAmount,
    setDepositAmount,
    showDepositInput,
    setShowDepositInput,
    showAddCustomerModal,
    setShowAddCustomerModal,
    newCustomer,
    setNewCustomer,
    customerSearch,
    setCustomerSearch,
    isSearchingCustomer,
    hasMoreCustomers,
    showCustomerDropdown,
    setShowCustomerDropdown,
    showAddVehicleModal,
    setShowAddVehicleModal,
    newVehicle,
    setNewVehicle,
    isEditingCustomer,
    setIsEditingCustomer,
    editCustomerName,
    setEditCustomerName,
    editCustomerPhone,
    setEditCustomerPhone,
    editingVehicleId,
    setEditingVehicleId,
    editVehicleModel,
    setEditVehicleModel,
    editVehicleLicensePlate,
    setEditVehicleLicensePlate,
    isUploadingPhoto,
    discountType,
    setDiscountType,
    discountPercent,
    setDiscountPercent,
    isSubmitting,
    additionalServices,
    setAdditionalServices,
    newService,
    setNewService,
    repairServices,
    setRepairServices,
    newRepairServiceDraft,
    setNewRepairServiceDraft,
    isOrderPaid,
    isOrderRefunded,
    canEditPriceAndParts,
    currentCustomer,
    customerVehicles,
    partsTotal,
    repairLaborTotal,
    servicesTotal,
    partsLaborInfoTotal,
    effectiveLaborCost,
    subtotal,
    discount,
    total,
    totalDeposit,
    totalAdditionalPayment,
    totalPaid,
    remainingAmount,
    availableParts,
    filteredParts,
    filteredCustomers,
    employeeOptions,
    serviceConfigs,
    handleLoadMoreCustomers,
    handleSelectVehicle,
    handleAddVehicle,
    handleSaveEditedCustomer,
    handleSaveEditedVehicle,
    getPartLaborBase,
    getPartWarranty,
    getIntegratedLaborByQuantity,
    getRepairServiceLaborAmount,
    getRepairServiceWorkers,
    getSelectedPartCost,
    handleSaveOnly,
    handleSave,
    handlePayFull,
    handleAddPart,
    handleAddDevicePhoto,
    handleRemoveDevicePhoto,
  };
}
