import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import type {
  Employee,
  RepairOrderService,
  ServiceConfig,
  WorkOrder,
  Part,
  WorkOrderPart,
  Vehicle,
} from "../../../types";
import {
  formatCurrency,
  formatWorkOrderId,
  generateWorkOrderId,
  normalizeSearchText,
} from "../../../utils/format";
import { NumberInput } from "../../common/NumberInput";
import { getCategoryColor } from "../../../utils/categoryColors";
import { AndroidPatternLock } from "../../common/AndroidPatternLock";
import { Lock, Grid3x3, CheckCircle } from "lucide-react";
import {
  useCreateWorkOrderAtomicRepo,
  useUpdateWorkOrderAtomicRepo,
} from "../../../hooks/useWorkOrdersRepository";
import { completeWorkOrderPayment } from "../../../lib/repository/workOrdersRepository";

import { showToast } from "../../../utils/toast";
import { supabase } from "../../../supabaseClient";
import {
  validatePhoneNumber,
  validateDepositAmount,
} from "../../../utils/validation";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useCreateCustomerDebtRepo } from "../../../hooks/useDebtsRepository";
import { useServiceConfigs } from "../../../hooks/useRepairLabor";
import { syncRepairOrderServices } from "../../../lib/repository/repairLaborRepository";
import {
  buildDefaultWorkerSplit,
  calculateLabor,
  splitWorkerAmount,
} from "../../../lib/services/repairLaborService";
import { WorkOrderCustomerSection } from "./WorkOrderCustomerSection";
import { WorkOrderVehicleSection } from "./WorkOrderVehicleSection";

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

interface RepairServiceDraftWorker {
  worker_id: string;
  worker_name?: string;
  share_percent: number;
}

interface RepairServiceDraft {
  id: string;
  serviceId?: string;
  serviceName: string;
  laborCalcType: ServiceConfig["laborCalcType"];
  laborFixedAmount: number;
  laborPercentOfCost: number;
  minimumLaborAmount: number;
  defaultWorkerSharePercent: number;
  manualLabor: number;
  relatedItemIds: string[];
  workers: RepairServiceDraftWorker[];
  isBillable: boolean;
  isPayableToWorker: boolean;
  note: string;
}

const createEmptyRepairServiceDraft = (): RepairServiceDraft => ({
  id: `labor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  serviceName: "",
  laborCalcType: "fixed",
  laborFixedAmount: 0,
  laborPercentOfCost: 0,
  minimumLaborAmount: 0,
  defaultWorkerSharePercent: 30,
  manualLabor: 0,
  relatedItemIds: [],
  workers: [],
  isBillable: true,
  isPayableToWorker: true,
  note: "",
});

const mapRepairServiceToDraft = (service: RepairOrderService): RepairServiceDraft => ({
  id: service.id,
  serviceId: service.serviceId,
  serviceName: service.serviceName,
  laborCalcType: service.laborCalcType,
  laborFixedAmount: service.laborFixedAmount,
  laborPercentOfCost: service.laborPercentOfCost,
  minimumLaborAmount: service.minimumLaborAmount,
  defaultWorkerSharePercent: service.workerSharePercent || 30,
  manualLabor: service.laborCalcType === "manual" ? service.laborAmount : service.laborFixedAmount,
  relatedItemIds: (service.relatedItems || []).map((item) => item.partId),
  workers: (service.workers || []).map((worker) => ({
    worker_id: worker.workerId,
    worker_name: worker.workerName || "",
    share_percent: worker.sharePercent,
  })),
  isBillable: service.isBillable,
  isPayableToWorker: service.isPayableToWorker,
  note: service.note || "",
});

const getWarrantyText = (part: Part | null | undefined): string => {
  if (!part) return "";
  return String(
    (part as any).warrantyPeriod ??
      (part as any).warrantyperiod ??
      (part as any).warranty_period ??
      (part as any).warranty ??
      ""
  ).trim();
};

const WorkOrderModal: React.FC<{
  order: WorkOrder;
  onClose: () => void;
  onSave: (order: WorkOrder) => void;
  parts: Part[];
  partsLoading: boolean;
  customers: any[];
  employees: any[];
  upsertCustomer: (customer: any) => void;
  setCashTransactions: (fn: (prev: any[]) => any[]) => void;
  setPaymentSources: (fn: (prev: any[]) => any[]) => void;
  paymentSources: any[];
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
}> = ({
  order,
  onClose,
  onSave,
  parts,
  partsLoading,
  customers,
  employees,
  upsertCustomer,
  setCashTransactions,
  setPaymentSources,
  paymentSources: _paymentSources,
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
}) => {
    // Popular electronics devices
    const POPULAR_DEVICES = [
      // === APPLE ===
      "iPhone 15 Pro Max",
      "iPhone 15 Pro",
      "iPhone 15 Plus",
      "iPhone 15",
      "iPhone 14 Pro Max",
      "iPhone 14 Pro",
      "iPhone 13 Pro Max",
      "iPhone 13 Pro",
      "iPhone 13",
      "iPhone 12 Pro Max",
      "iPhone 12",
      "iPhone 11 Pro Max",
      "iPhone 11",
      "iPhone XS Max",
      "iPhone X/XS",
      "iPhone 8 Plus",
      "iPad Pro 12.9",
      "iPad Pro 11",
      "iPad Air 5",
      "iPad Gen 10",
      "MacBook Pro 14 M1/M2/M3",
      "MacBook Pro 16",
      "MacBook Air M1/M2",

      // === SAMSUNG ===
      "Samsung S24 Ultra",
      "Samsung S24 Plus",
      "Samsung S23 Ultra",
      "Samsung S22 Ultra",
      "Samsung Z Fold 5",
      "Samsung Z Flip 5",
      "Samsung A55",
      "Samsung A35",
      "Samsung A25",
      "Samsung A15",
      "Samsung A05s",
      "Samsung Tab S9",

      // === XIAOMI / OPPO / VIVO ===
      "Xiaomi 14 Ultra",
      "Xiaomi 13T",
      "Redmi Note 13 Pro",
      "Redmi Note 12",
      "Oppo Find N3",
      "Oppo Reno 10",
      "Vivo X100",
      "Vivo V29",

      // === LAPTOPS ===
      "Dell XPS 13",
      "Dell XPS 15",
      "Dell Inspiron",
      "Dell Latitude",
      "HP Spectre",
      "HP Envy",
      "HP Pavilion",
      "Asus ROG Strix",
      "Asus TUF Gaming",
      "Asus ZenBook",
      "Asus VivoBook",
      "Lenovo ThinkPad X1",
      "Lenovo Legion",
      "Lenovo IdeaPad",
      "Acer Nitro 5",
      "Acer Swift",
      "MSI Katana",
      "MSI Modern",

      // === OTHER ===
      "Apple Watch Series 9",
      "Apple Watch Ultra",
      "AirPods Pro 2",
      "Sony WH-1000XM5",
      "JBL Speaker",
      "Máy tính để bàn (PC)",
      "Màn hình máy tính",
      "Máy in",
      "Khác"
    ];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const queryClient = useQueryClient();
    const { profile } = useAuth();
    const { mutateAsync: createWorkOrderAtomicAsync } =
      useCreateWorkOrderAtomicRepo();
    const { mutateAsync: updateWorkOrderAtomicAsync } =
      useUpdateWorkOrderAtomicRepo();
    const { data: serviceConfigs = [] } = useServiceConfigs();
    const employeeOptions = employees as Employee[];
    const defaultTechnicianName = useMemo(() => {
      const normalizedProfileEmail = String(profile?.email || "")
        .trim()
        .toLowerCase();
      const normalizedProfileName = String(profile?.name || profile?.full_name || "")
        .trim()
        .toLowerCase();

      if (!normalizedProfileEmail && !normalizedProfileName) return "";

      const activeEmployees = (employees || []).filter(
        (emp) => emp?.status === "active"
      );

      const matchedByEmail = activeEmployees.find(
        (emp) =>
          String(emp?.email || "")
            .trim()
            .toLowerCase() === normalizedProfileEmail
      );
      if (matchedByEmail?.name) return matchedByEmail.name;

      const matchedByName = activeEmployees.find(
        (emp) =>
          String(emp?.name || "")
            .trim()
            .toLowerCase() === normalizedProfileName
      );
      return matchedByName?.name || "";
    }, [employees, profile?.email, profile?.name, profile?.full_name]);
    const isStaffRole =
      String(profile?.role || "").trim().toLowerCase() === "staff";
    const isTechnicianLockedForStaff =
      isStaffRole && !!defaultTechnicianName;

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
    const resolvedTechnicianName =
      isTechnicianLockedForStaff
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
    const [showAddVehicleModelDropdown, setShowAddVehicleModelDropdown] =
      useState(false);
    const [depositAmount, setDepositAmount] = useState(0);
    const [showDepositInput, setShowDepositInput] = useState(false);
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
      name: "",
      phone: "",
      vehicleModel: "",
      licensePlate: "",
    });
    const [_expandedSections, _setExpandedSections] = useState({
      customer: true,
      vehicle: true,
      issue: true,
      parts: true,
      services: true,
      payment: true,
    });

    // Manual parts entry state
    const [_showAddManualPart, _setShowAddManualPart] = useState(false);
    const [_newManualPartName, _setNewManualPartName] = useState("");
    const [_newManualPartCost, _setNewManualPartCost] = useState(0);
    const [_newManualPartPrice, _setNewManualPartPrice] = useState(0);
    const [_newManualPartQuantity, _setNewManualPartQuantity] = useState(1);
    const [customerSearch, setCustomerSearch] = useState("");

    // Server-side search state
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

    // Edit customer state
    const [isEditingCustomer, setIsEditingCustomer] = useState(false);
    const [editCustomerName, setEditCustomerName] = useState("");
    const [editCustomerPhone, setEditCustomerPhone] = useState("");

    // Edit vehicle state
    const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
    const [editVehicleModel, setEditVehicleModel] = useState("");
    const [editVehicleLicensePlate, setEditVehicleLicensePlate] = useState("");

    // 🔹 Check if order is paid AND completed (lock sensitive fields)
    // Chỉ khóa khi đã thanh toán ĐẦY ĐỦ VÀ đã trả máy
    const isOrderPaid = order?.paymentStatus === "paid" && (order?.status === "Trả máy" || formData.status === "Trả máy");
    const isOrderRefunded = order?.refunded === true;
    // Allow editing if order is not refunded AND (not paid OR status is not "Trả máy")
    // This allows adding parts to a "paid" order if it's still being repaired
    const canEditPriceAndParts = (!isOrderPaid || formData.status !== "Trả máy") && !isOrderRefunded;

    // Get customer's vehicles
    const currentCustomer = customers.find(
      (c) => c.phone === formData.customerPhone
    );
    const customerVehicles = currentCustomer?.vehicles || [];

    // Discount state
    const [discountType, setDiscountType] = useState<"amount" | "percent">(
      "amount"
    );
    const [discountPercent, setDiscountPercent] = useState(0);

    // Submission guard to prevent duplicate submissions
    const [isSubmitting, setIsSubmitting] = useState(false);
    const submittingRef = useRef(false); // Synchronous guard for double-click prevention

    // Additional services state (Báo giá - Gia công/ Đặt hàng)
    const [additionalServices, setAdditionalServices] = useState<
      Array<{
        id: string;
        description: string;
        quantity: number;
        price: number;
        costPrice?: number; // Giá nhập (chi phí gia công bên ngoài)
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

    // Sync selectedParts and deposit with formData on order change
    useEffect(() => {
      if (order?.partsUsed) {
        setSelectedParts(order.partsUsed);
      } else {
        setSelectedParts([]);
      }

      // Sync customer search
      if (order?.customerName) {
        setCustomerSearch(order.customerName);
      } else {
        setCustomerSearch("");
      }

      // Sync additional services (Báo giá)
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

      // Sync deposit amount
      if (order?.depositAmount) {
        setDepositAmount(order.depositAmount);
        setShowDepositInput(true);
      } else {
        setDepositAmount(0);
        setShowDepositInput(false);
      }

      // Sync partial payment
      if (order?.additionalPayment) {
        setPartialPayment(order.additionalPayment);
        setShowPartialPayment(true);
      } else {
        setPartialPayment(0);
        setShowPartialPayment(false);
      }

      // Reset discount type to amount when opening/changing order
      setDiscountType("amount");
      setDiscountPercent(0);

      // Reset edit customer state
      setIsEditingCustomer(false);
      setEditCustomerName("");
      setEditCustomerPhone("");
    }, [order]);

    useEffect(() => {
      if (order?.id) return;
      if (!defaultTechnicianName) return;

      setFormData((prev) => {
        if (String(prev.technicianName || "").trim()) return prev;
        return {
          ...prev,
          technicianName: defaultTechnicianName,
        };
      });
    }, [order?.id, defaultTechnicianName]);

    useEffect(() => {
      if (!isTechnicianLockedForStaff) return;

      setFormData((prev) => {
        if (String(prev.technicianName || "").trim() === defaultTechnicianName) {
          return prev;
        }
        return {
          ...prev,
          technicianName: defaultTechnicianName,
        };
      });
    }, [isTechnicianLockedForStaff, defaultTechnicianName]);

    // Search customers from Supabase when search term changes
    useEffect(() => {
      // Reset page when search term changes
      setCustomerPage(0);
      setHasMoreCustomers(true);
      // Logic handled in fetchCustomers
    }, [debouncedCustomerSearch]);

    // Combined fetch function
    const fetchCustomers = async (page: number, searchTerm: string, isLoadMore = false) => {
      if (!searchTerm.trim()) {
        if (!isLoadMore) setServerCustomers([]);
        return;
      }

      setIsSearchingCustomer(true);
      try {
        const from = page * CUSTOMER_PAGE_SIZE;
        const to = from + CUSTOMER_PAGE_SIZE - 1;

        // Use a simple OR query on name and phone
        const { data, error, count } = await supabase
          .from("customers")
          .select("*", { count: "exact", head: false })
          .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
          .range(from, to);

        if (!error && data) {
          if (isLoadMore) {
            setServerCustomers((prev) => {
              // Deduplicate just in case
              const newIds = new Set(data.map(c => c.id));
              const filteredPrev = prev.filter(c => !newIds.has(c.id));
              return [...filteredPrev, ...data];
            });
          } else {
            setServerCustomers(data);
          }

          // Check if we reached the end
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

    // Effect to trigger search when debounced term changes
    useEffect(() => {
      // Only fetch if has search term
      if (debouncedCustomerSearch.trim()) {
        fetchCustomers(0, debouncedCustomerSearch.trim(), false);
      } else {
        setServerCustomers([]);
      }
    }, [debouncedCustomerSearch]);

    // Effect to parse password from issue description
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

    // Handler for Load More button
    const handleLoadMoreCustomers = (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      const nextPage = customerPage + 1;
      setCustomerPage(nextPage);
      fetchCustomers(nextPage, debouncedCustomerSearch.trim(), true);
    };

    // Filter customers based on search - show all if search is empty
    // COMBINE local customers and server results
    const filteredCustomers = useMemo(() => {
      // Merge local customers and server customers, removing duplicates by ID
      const allCandidates = [...customers, ...serverCustomers];
      const uniqueCandidates = Array.from(new Map(allCandidates.map(c => [c.id, c])).values());

      if (!customerSearch.trim()) {
        // Show all customers when no search term
        return uniqueCandidates.slice(0, 10); // Limit to first 10 for performance
      }

      const q = normalizeSearchText(customerSearch);
      return uniqueCandidates.filter(
        (c) =>
          normalizeSearchText(c.name).includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          (c.vehicles &&
            c.vehicles.some((v: any) =>
              normalizeSearchText(v.licensePlate).includes(q) ||
              v.licensePlate?.toLowerCase().includes(q.toLowerCase())
            ))
      );
    }, [customers, serverCustomers, customerSearch]);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest(".customer-search-container")) {
          setShowCustomerDropdown(false);
        }
        if (!target.closest(".vehicle-search-container")) {
          setShowVehicleDropdown(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle vehicle selection
    const handleSelectVehicle = (vehicle: any) => {
      setFormData({
        ...formData,
        vehicleId: vehicle.id,
        vehicleModel: vehicle.model,
        licensePlate: vehicle.licensePlate,
      });
      setShowVehicleDropdown(false);
    };

    // Handler: Add new vehicle to current customer
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
          isPrimary: existingVehicles.length === 0, // First vehicle is primary
        },
      ];

      // Update customer with new vehicle
      upsertCustomer({
        ...currentCustomer,
        vehicles: updatedVehicles,
      });

      // Auto-select the newly added vehicle
      setFormData({
        ...formData,
        vehicleId: vehicleId,
        vehicleModel: newVehicle.model.trim(),
        licensePlate: newVehicle.licensePlate.trim(),
      });

      // Reset and close modal
      setNewVehicle({ model: "", licensePlate: "" });
      setShowAddVehicleModal(false);
      showToast.success("Đã thêm thiết bị mới");
    };

    // Handler: Save edited customer info
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

        // Update formData with new customer info
        setFormData({
          ...formData,
          customerName: editCustomerName.trim(),
          customerPhone: editCustomerPhone.trim(),
        });

        // Update customer search
        setCustomerSearch(editCustomerName.trim());

        setIsEditingCustomer(false);
        showToast.success("Đã cập nhật thông tin khách hàng");
      } catch (error) {
        console.error("Error updating customer:", error);
        showToast.error("Có lỗi khi cập nhật thông tin");
      }
    };

    // Handler: Save edited vehicle info
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

        // Update formData if this is the selected vehicle
        if (formData.vehicleId === editingVehicleId) {
          setFormData({
            ...formData,
            vehicleModel: editVehicleModel.trim(),
            licensePlate: editVehicleLicensePlate.trim(),
          });
        }

        setEditingVehicleId(null);
        setEditVehicleModel("");
        setEditVehicleLicensePlate("");
        showToast.success("Đã cập nhật thông tin xe");
      } catch (error) {
        console.error("Error updating vehicle:", error);
        showToast.error("Có lỗi khi cập nhật thông tin xe");
      }
    };

    const getSelectedPartCost = (partId: string) => {
      const part = selectedParts.find((item) => item.partId === partId);
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
        service.relatedItemIds.reduce((sum, partId) => sum + getSelectedPartCost(partId), 0),
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
      repairServices.map((service) => {
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
            (sum, partId) => sum + getSelectedPartCost(partId),
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
          related_items: service.relatedItemIds.map((partId) => {
            const selectedPart = selectedParts.find((part) => part.partId === partId);
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
        (service) => service.service_name.trim().length > 0
      );

      const result = await syncRepairOrderServices(repairOrderId, payloads);
      if ("ok" in result && !result.ok) {
        throw (result as { error: any }).error;
      }

      return result.data;
    };

    const getPartLaborBase = (partId: string) => {
      const partRef = parts.find((p) => p.id === partId);
      return (
        Number((partRef as any)?.laborCost?.[currentBranchId]) ||
        Number(partRef?.wholesalePrice?.[currentBranchId]) ||
        0
      );
    };

    const getPartWarranty = (partId: string) => {
      const partRef = parts.find((p) => p.id === partId);
      return getWarrantyText(partRef);
    };

    // Rule: qty 1 = 100% labor, qty 2 = 150%, qty 3 = 200%, ...
    const getIntegratedLaborByQuantity = (laborBase: number, quantity: number) => {
      if (laborBase <= 0 || quantity <= 0) return 0;
      return laborBase * (1 + 0.5 * (quantity - 1));
    };

    // Calculate totals
    const partsTotal = selectedParts.reduce(
      (sum, p) => sum + (p.price || 0) * (p.quantity || 0),
      0
    );
    const repairLaborTotal = repairServices.reduce(
      (sum, service) => sum + (service.isBillable ? getRepairServiceLaborAmount(service) : 0),
      0
    );
    const servicesTotal = additionalServices.reduce(
      (sum, s) => sum + (s.price || 0) * (s.quantity || 0),
      0
    );
    const partsLaborInfoTotal = selectedParts.reduce((sum, item) => {
      const laborBase = getPartLaborBase(item.partId);
      return sum + getIntegratedLaborByQuantity(laborBase, Number(item.quantity || 0));
    }, 0);
    const effectiveLaborCost = includeIntegratedLabor ? partsLaborInfoTotal : 0;
    const subtotal = partsTotal + servicesTotal + effectiveLaborCost;
    const discount = formData.discount || 0;
    const total = Math.max(0, subtotal - discount);

    // Debug log

    // Calculate payment summary
    const totalDeposit = depositAmount || order.depositAmount || 0;
    // 🔹 FIX: Chỉ tính additionalPayment MỚI khi checkbox được check
    // Không lấy giá trị cũ để tránh thanh toán 2 lần
    // 🔹 CHỈ TÍNH THANH TOÁN KHI STATUS LÀ "TRẢ MÁY"
    const totalAdditionalPayment =
      formData.status === "Trả máy" && showPartialPayment ? partialPayment : 0;
    const totalPaid = totalDeposit + totalAdditionalPayment;
    const remainingAmount = Math.max(0, total - totalPaid);

    // Helper: Auto-create customer debt if there's remaining amount
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

        // Tạo nội dung chi tiết từ phiếu sửa chữa
        const workOrderNumber = formatWorkOrderId(
          workOrder.id,
          storeSettings?.work_order_prefix
        );

        let description = `${workOrder.vehicleModel || "Xe"
          } (Phiếu sửa chữa #${workOrderNumber})`;

        // Mô tả vấn đề
        if (workOrder.issueDescription) {
          description += `\nVấn đề: ${workOrder.issueDescription}`;
        }

        // Danh sách phụ tùng đã sử dụng
        if (workOrder.partsUsed && workOrder.partsUsed.length > 0) {
          description += "\n\nPhụ tùng đã thay:";
          workOrder.partsUsed.forEach((part) => {
            description += `\n  - ${part.quantity} x ${part.partName
              } - ${formatCurrency(part.price * part.quantity)}`;
          });
        }

        // Danh sách dịch vụ bổ sung (gia công, đặt hàng)
        if (
          workOrder.additionalServices &&
          workOrder.additionalServices.length > 0
        ) {
          description += "\n\nDịch vụ:";
          workOrder.additionalServices.forEach((service) => {
            description += `\n  - ${service.quantity} x ${service.description
              } - ${formatCurrency(service.price * service.quantity)}`;
          });
        }

        // Công lao động
        if (workOrder.laborCost && workOrder.laborCost > 0) {
          description += `\n\nCông lao động: ${formatCurrency(
            workOrder.laborCost
          )}`;
        }

        // Giảm giá (nếu có)
        if (workOrder.discount && workOrder.discount > 0) {
          description += `\nGiảm giá: -${formatCurrency(workOrder.discount)}`;
        }

        // Thông tin nhân viên tạo phiếu
        const createdByDisplay = profile?.name || profile?.full_name || "N/A";
        description += `\n\nNV: ${createdByDisplay}`;

        // Thông tin nhân viên kỹ thuật
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
          workOrderId: workOrder.id, // 🔹 Link debt với work order
        };

        const result = await createCustomerDebt.mutateAsync(payload as any);
        showToast.success(
          `Đã tạo/cập nhật công nợ ${remainingAmount.toLocaleString()}đ (Mã: ${result?.id || "N/A"
          })`
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

      // 1. Try exact match first
      if (Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
        delete nextPayload[missingColumn];
        return { nextPayload, removedCount: 1 };
      }

      // 2. Case-insensitive fallback (only delete ONE key to avoid destroying both camelCase and lowercase variants of a required column)
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
          // Keep retrying by force-filling creationDate variants if an earlier fallback removed one.
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

    // 🔹 Function to handle deposit (Đặt cọc để đặt hàng)
    const _handleDeposit = async () => {
      // Validation
      if (!formData.customerName?.trim()) {
        showToast.error("Vui lòng nhập tên khách hàng");
        return;
      }
      if (!formData.customerPhone?.trim()) {
        showToast.error("Vui lòng nhập số điện thoại");
        return;
      }

      // Validate phone number format using utility
      const phoneValidation = validatePhoneNumber(formData.customerPhone);
      if (!phoneValidation.ok) {
        showToast.error(phoneValidation.error || "Số điện thoại không hợp lệ!");
        return;
      }

      if (depositAmount <= 0) {
        showToast.error("Vui lòng nhập số tiền đặt cọc");
        return;
      }

      // Validate deposit amount using utility
      const depositValidation = validateDepositAmount(depositAmount, total);
      if (!depositValidation.ok) {
        showToast.error(depositValidation.error || "Tiền đặt cọc không hợp lệ!");
        return;
      }

      if (!formData.paymentMethod) {
        showToast.error("Vui lòng chọn phương thức thanh toán");
        return;
      }

      try {
        const orderId =
          formData.id ||
          generateWorkOrderId(storeSettings?.work_order_prefix);

        // Prepare work order data with deposit
        const workOrderData: WorkOrder = {
          id: orderId,
          customerName: formData.customerName || "",
          customerPhone: formData.customerPhone || "",
          vehicleId: formData.vehicleId,
          vehicleModel: formData.vehicleModel || "",
          licensePlate: formData.licensePlate || "",
          currentKm: formData.currentKm,
          issueDescription: formData.issueDescription || "",
          technicianName: resolvedTechnicianName,
          status: formData.status || "Tiếp nhận",
          laborCost: effectiveLaborCost,
          laborTotal: effectiveLaborCost,
          discount: discount,
          partsUsed: selectedParts,
          repairServices: undefined,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          depositAmount: depositAmount,
          depositDate: new Date().toISOString(),
          paymentStatus: "partial",
          paymentMethod: formData.paymentMethod,
          totalPaid: depositAmount,
          remainingAmount: total - depositAmount,
          creationDate: formData.creationDate || new Date().toISOString(),
        };

        // Save to database using Supabase
        if (formData.id) {
          // Update existing work order
          await updateWorkOrderWithSchemaFallback(formData.id, {
              customername: workOrderData.customerName,
              customerphone: workOrderData.customerPhone,
              vehicleid: workOrderData.vehicleId,
              vehiclemodel: workOrderData.vehicleModel,
              licenseplate: workOrderData.licensePlate,
              issuedescription: workOrderData.issueDescription,
              technicianname: workOrderData.technicianName,
              status: workOrderData.status,
              laborcost: workOrderData.laborCost,
              discount: workOrderData.discount,
              partsused: workOrderData.partsUsed,
              additionalservices: workOrderData.additionalServices,
              total: workOrderData.total,
              depositamount: workOrderData.depositAmount,
              depositdate: workOrderData.depositDate,
              paymentstatus: workOrderData.paymentStatus,
              paymentmethod: workOrderData.paymentMethod,
              totalpaid: workOrderData.totalPaid,
              remainingamount: workOrderData.remainingAmount,
            });
        } else {
          // Insert new work order
          await insertWorkOrderWithSchemaFallback({
            id: workOrderData.id,
            customername: workOrderData.customerName,
            customerphone: workOrderData.customerPhone,
            vehicleid: workOrderData.vehicleId,
            vehiclemodel: workOrderData.vehicleModel,
            licenseplate: workOrderData.licensePlate,
            issuedescription: workOrderData.issueDescription,
            technicianname: workOrderData.technicianName,
            status: workOrderData.status,
            laborcost: workOrderData.laborCost,
            discount: workOrderData.discount,
            partsused: workOrderData.partsUsed,
            additionalservices: workOrderData.additionalServices,
            total: workOrderData.total,
            branchid: workOrderData.branchId,
            depositamount: workOrderData.depositAmount,
            depositdate: workOrderData.depositDate,
            paymentstatus: workOrderData.paymentStatus,
            paymentmethod: workOrderData.paymentMethod,
            totalpaid: workOrderData.totalPaid,
            remainingamount: workOrderData.remainingAmount,
            creationDate: workOrderData.creationDate,
          });
        }

        const syncedRepairServices = await syncRepairServicesForOrder(orderId);
        workOrderData.repairServices = syncedRepairServices;
        workOrderData.laborTotal = syncedRepairServices.reduce(
          (sum, service) => sum + Number(service.laborAmount || 0),
          0
        );
        workOrderData.workerTotal = syncedRepairServices.reduce(
          (sum, service) =>
            sum +
            (service.workers && service.workers.length > 0
              ? service.workers.reduce(
                (workerSum, worker) => workerSum + Number(worker.workerAmount || 0),
                0
              )
              : Number(service.workerAmount || 0)),
          0
        );

        // Create deposit cash transaction (Thu tiền cọc vào quỹ)
        const depositTxId = `TX-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}-DEP`;
        await supabase.from("cash_transactions").insert({
          id: depositTxId,
          type: "income",
          category: "service_deposit",
          amount: depositAmount,
          date: new Date().toISOString(),
          description: `Đặt cọc sửa chữa #${formatWorkOrderId(
            orderId,
            storeSettings?.work_order_prefix
          )} - ${formData.customerName}`,
          branchid: currentBranchId,
          paymentsource: formData.paymentMethod,
          reference: orderId,
        });

        // Create expense transaction (Phiếu chi để đặt hàng)
        const expenseTxId = `TX-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}-EXP`;
        await supabase.from("cash_transactions").insert({
          id: expenseTxId,
          type: "expense",
          category: "parts_purchase",
          amount: depositAmount,
          date: new Date().toISOString(),
          description: `Đặt hàng phụ tùng cho #${formatWorkOrderId(
            orderId,
            storeSettings?.work_order_prefix
          )} - ${formData.customerName}`,
          branchid: currentBranchId,
          paymentsource: formData.paymentMethod,
          reference: orderId,
        });

        // Update UI state
        workOrderData.depositTransactionId = depositTxId;
        onSave(workOrderData);

        showToast.success(
          "Đã đặt cọc thành công! Phiếu chi đặt hàng đã được tạo."
        );
        onClose();
      } catch (error: any) {
        console.error("Error processing deposit:", error);
        showToast.error("Lỗi khi xử lý đặt cọc");
      }
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

    // 🔹 Function to save work order without payment processing
    const handleSaveOnly = async () => {
      // Validation
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

      const blockedMessageEarly = getBlockedDeepEditMessage(
        Number(order?.additionalPayment || 0)
      );
      if (blockedMessageEarly) {
        showToast.error(blockedMessageEarly);
        return;
      }

      // Note: Không validate total > 0 vì có thể chỉ tiếp nhận thông tin, chưa báo giá

      // Add/update customer
      if (formData.customerName && formData.customerPhone) {
        const existingCustomer = customers.find(
          (c) => c.phone === formData.customerPhone
        );

        if (!existingCustomer) {
          // Chỉ tạo khách hàng mới nếu SĐT chưa tồn tại


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
          // Khách hàng đã tồn tại - chỉ cập nhật thông tin xe nếu cần

          if (
            formData.vehicleModel &&
            existingCustomer.vehicleModel !== formData.vehicleModel
          ) {
            await upsertCustomer({
              ...existingCustomer,
              vehicleModel: formData.vehicleModel,
              licensePlate: formData.licensePlate,
            });
          }
        }
      }

      // Determine payment status based on existing payments only (not new ones)
      let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
      const existingPaid =
        (order?.depositAmount || 0) + (order?.additionalPayment || 0);
      if (existingPaid >= total) {
        paymentStatus = "paid";
      } else if (existingPaid > 0) {
        paymentStatus = "partial";
      }

      try {
        const orderId =
          order?.id ||
          generateWorkOrderId(storeSettings?.work_order_prefix);

        const resolvedCreationDate =
          order?.creationDate || new Date().toISOString();

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
          issueDescription: formData.issueDescription || "",
          issuedescription: formData.issueDescription || "",
          technicianName: resolvedTechnicianName,
          technicianname: resolvedTechnicianName,
          status: formData.status || "Tiếp nhận",
          laborCost: effectiveLaborCost,
          laborcost: effectiveLaborCost,
          discount: discount,
          partsUsed: selectedParts,
          partsused: selectedParts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          additionalservices:
            additionalServices.length > 0 ? additionalServices : undefined,
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

        // Save to Supabase database
        if (order?.id) {
          // Update existing
          const { error } = await updateWorkOrderWithSchemaFallback(
            order.id,
            workOrderData
          );

          if (error) {
            console.error("[UPDATE ERROR]", error);
            throw error;
          }

          // Update vehicle currentKm if km was provided
          if (
            formData.currentKm &&
            formData.vehicleId &&
            formData.customerPhone
          ) {
            const customer = customers.find(
              (c) => c.phone === formData.customerPhone
            );
            if (customer) {
              const existingVehicles = customer.vehicles || [];
              const vehicleExists = existingVehicles.some(
                (v: any) => v.id === formData.vehicleId
              );

              if (vehicleExists) {
                // Update km for existing vehicle
                const updatedVehicles = existingVehicles.map((v: any) =>
                  v.id === formData.vehicleId
                    ? { ...v, currentKm: formData.currentKm }
                    : v
                );

                // Save to Supabase database
                const { error: updateError } = await supabase
                  .from("customers")
                  .update({ vehicles: updatedVehicles })
                  .eq("id", customer.id);

                if (updateError) {
                  console.error(
                    `[WorkOrderModal UPDATE] Failed to update km in DB:`,
                    updateError
                  );
                } else {
                  // Update local context
                  upsertCustomer({
                    ...customer,
                    vehicles: updatedVehicles,
                  });
                }
              } else {
                console.warn(
                  `[WorkOrderModal UPDATE] ⚠️ Vehicle ${formData.vehicleId} not found in customer vehicles`
                );
              }
            } else {
              console.warn(
                `[WorkOrderModal UPDATE] ⚠️ Customer not found: ${formData.customerPhone}`
              );
            }
          }
        } else {
          // Insert new
          const { error } = await insertWorkOrderWithSchemaFallback(
            workOrderData
          );

          if (error) {
            console.error("[INSERT ERROR]", error);
            console.error(
              "[INSERT ERROR DETAILS]",
              JSON.stringify(error, null, 2)
            );
            throw error;
          }

          // Update vehicle currentKm if km was provided
          if (
            formData.currentKm &&
            formData.vehicleId &&
            formData.customerPhone
          ) {
            const customer = customers.find(
              (c) => c.phone === formData.customerPhone
            );
            if (customer) {
              const existingVehicles = customer.vehicles || [];
              const vehicleExists = existingVehicles.some(
                (v: any) => v.id === formData.vehicleId
              );

              let updatedVehicles;
              if (vehicleExists) {
                // Update km for existing vehicle
                updatedVehicles = existingVehicles.map((v: any) =>
                  v.id === formData.vehicleId
                    ? { ...v, currentKm: formData.currentKm }
                    : v
                );
              } else {
                // Vehicle doesn't exist yet, add it with km
                const newVehicle = {
                  id: formData.vehicleId,
                  licensePlate: formData.licensePlate,
                  model: formData.vehicleModel,
                  currentKm: formData.currentKm,
                };
                updatedVehicles = [...existingVehicles, newVehicle];
              }

              // Save to Supabase database
              const { error: updateError } = await supabase
                .from("customers")
                .update({ vehicles: updatedVehicles })
                .eq("id", customer.id);

              if (updateError) {
                console.error(
                  `[WorkOrderModal CREATE] Failed to update km in DB:`,
                  updateError
                );
              } else {
                // Update local context
                upsertCustomer({
                  ...customer,
                  vehicles: updatedVehicles,
                });
              }
            } else {
              console.warn(
                `[WorkOrderModal CREATE] ⚠️ Customer not found: ${formData.customerPhone}`
              );
            }
          }
        }

        const syncedRepairServices = await syncRepairServicesForOrder(orderId);
        (workOrderData as any).repairServices = syncedRepairServices;
        (workOrderData as any).laborTotal = syncedRepairServices.reduce(
          (sum, service) => sum + Number(service.laborAmount || 0),
          0
        );
        (workOrderData as any).workerTotal = syncedRepairServices.reduce(
          (sum, service) =>
            sum +
            (service.workers && service.workers.length > 0
              ? service.workers.reduce(
                (workerSum, worker) => workerSum + Number(worker.workerAmount || 0),
                0
              )
              : Number(service.workerAmount || 0)),
          0
        );

        // Invalidate queries to refresh the list
        if (invalidateWorkOrders) {
          invalidateWorkOrders();
        }

        onSave(workOrderData as unknown as WorkOrder);
        showToast.success(
          order?.id ? "Đã cập nhật phiếu" : "Đã lưu phiếu thành công"
        );
        onClose();
      } catch (error: any) {
        console.error("Error saving work order:", error);
        showToast.error(
          "Lỗi khi lưu phiếu: " +
          (error.message || error.hint || "Không xác định")
        );
      }
    };

    // 🔹 Function to handle payment processing
    const handleSave = async (forceFullPayment = false) => {
      // 🔹 DEBUG - Log order info

      // 🔹 PREVENT DUPLICATE SUBMISSIONS (synchronous check with ref)
      if (submittingRef.current || isSubmitting) {
        return;
      }
      submittingRef.current = true; // Set immediately before async operations

      setIsSubmitting(true);

      try {
        // 🔹 VALIDATION FRONTEND
        // 1. Validate customer name & phone required
        if (!formData.customerName?.trim()) {
          showToast.error("Vui lòng nhập tên khách hàng");
          return;
        }
        if (!formData.customerPhone?.trim()) {
          showToast.error("Vui lòng nhập số điện thoại");
          return;
        }

        // 2. Validate phone format (10-11 digits)
        const phoneRegex = /^[0-9]{10,11}$/;
        if (!phoneRegex.test(formData.customerPhone.trim())) {
          showToast.error("Số điện thoại không hợp lệ! (cần 10-11 chữ số)");
          return;
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

        // 3. Validate total > 0 ONLY if status is "Trả máy"
        if (total <= 0 && formData.status === "Trả máy") {
          showToast.error("Tổng tiền phải lớn hơn 0 khi trả máy");
          return;
        }

        // Add/update customer with duplicate check
        if (formData.customerName && formData.customerPhone) {
          const existingCustomer = customers.find(
            (c) => c.phone === formData.customerPhone
          );

          // 🔹 VALIDATE DUPLICATE PHONE
          if (!existingCustomer) {
            // Chỉ tạo khách hàng mới nếu SĐT chưa tồn tại


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
            // Khách hàng đã tồn tại - chỉ cập nhật thông tin xe nếu cần

            if (
              formData.vehicleModel &&
              existingCustomer.vehicleModel !== formData.vehicleModel
            ) {
              await upsertCustomer({
                ...existingCustomer,
                vehicleModel: formData.vehicleModel,
                licensePlate: formData.licensePlate,
              });
            }
          }
        }

        const additionalPaymentToApply =
          formData.status === "Trả máy"
            ? forceFullPayment
              ? Math.max(0, total - totalDeposit)
              : showPartialPayment
                ? partialPayment
                : 0
            : 0;

        const totalPaidToApply = totalDeposit + additionalPaymentToApply;
        const remainingAmountToApply = Math.max(0, total - totalPaidToApply);

        // Determine payment status
        let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
        if (totalPaidToApply >= total) {
          paymentStatus = "paid";
        } else if (totalPaidToApply > 0) {
          paymentStatus = "partial";
        }

        // If this is a NEW work order, ALWAYS use atomic RPC
        if (!order?.id) {
          try {
            const orderId = generateWorkOrderId(storeSettings?.work_order_prefix);

            // Prepare issue description with password
            let finalIssueDescription = formData.issueDescription || "";
            finalIssueDescription = finalIssueDescription.replace(/\[MK: .+?\]\s*/g, "").trim();

            if (devicePassword && devicePassword.trim()) {
              finalIssueDescription = `[MK: ${devicePassword.trim()}] ${finalIssueDescription}`;
            }

            const responseData = await createWorkOrderAtomicAsync({
              id: orderId,
              customerName: formData.customerName || "",
              customerPhone: formData.customerPhone || "",
              vehicleModel: formData.vehicleModel || "",
              licensePlate: formData.licensePlate || "",
              currentKm: formData.currentKm,
              issueDescription: finalIssueDescription, // Use modified description
              technicianName: resolvedTechnicianName,
              status: formData.status || "Tiếp nhận",
              laborCost: effectiveLaborCost,
              discount: discount,
              partsUsed: selectedParts,
              additionalServices:
                additionalServices.length > 0 ? additionalServices : undefined,
              total: total,
              branchId: currentBranchId,
              paymentStatus: paymentStatus,
              paymentMethod: formData.paymentMethod,
              depositAmount: depositAmount > 0 ? depositAmount : undefined,
              additionalPayment:
                additionalPaymentToApply > 0 ? additionalPaymentToApply : undefined,
              totalPaid: totalPaidToApply > 0 ? totalPaidToApply : undefined,
              remainingAmount: remainingAmountToApply,
              creationDate: new Date().toISOString(),
            } as any);

            const syncedRepairServices = await syncRepairServicesForOrder(orderId);

            // Extract transaction IDs from response
            const depositTxId = responseData?.depositTransactionId;
            const paymentTxId = responseData?.paymentTransactionId;

            // Create the finalOrder object to update the UI state
            const finalOrder: WorkOrder = {
              id: orderId,
              customerName: formData.customerName || "",
              customerPhone: formData.customerPhone || "",
              vehicleModel: formData.vehicleModel || "",
              licensePlate: formData.licensePlate || "",
              currentKm: formData.currentKm,
              issueDescription: formData.issueDescription || "",
              technicianName: resolvedTechnicianName,
              status: formData.status || "Tiếp nhận",
              laborCost: effectiveLaborCost,
              laborTotal: syncedRepairServices.reduce(
                (sum, service) => sum + Number(service.laborAmount || 0),
                0
              ),
              workerTotal: syncedRepairServices.reduce(
                (sum, service) =>
                  sum +
                  (service.workers && service.workers.length > 0
                    ? service.workers.reduce(
                      (workerSum, worker) => workerSum + Number(worker.workerAmount || 0),
                      0
                    )
                    : Number(service.workerAmount || 0)),
                0
              ),
              discount: discount,
              partsUsed: selectedParts,
              repairServices: syncedRepairServices,
              additionalServices:
                additionalServices.length > 0 ? additionalServices : undefined,
              total: total,
              branchId: currentBranchId,
              depositAmount: depositAmount > 0 ? depositAmount : undefined,
              depositDate:
                depositAmount > 0 ? new Date().toISOString() : undefined,
              depositTransactionId: depositTxId,
              paymentStatus: paymentStatus,
              paymentMethod: formData.paymentMethod,
              additionalPayment:
                additionalPaymentToApply > 0 ? additionalPaymentToApply : undefined,
              totalPaid: totalPaidToApply > 0 ? totalPaidToApply : undefined,
              remainingAmount: remainingAmountToApply,
              cashTransactionId: paymentTxId,
              paymentDate: paymentTxId ? new Date().toISOString() : undefined,
              creationDate: new Date().toISOString(),
            };

            // Update cash transactions in context (for UI consistency)
            // 🔹 Also INSERT to database for persistence
            if (depositTxId && depositAmount > 0) {
              // INSERT deposit transaction to database
              try {
                const { error: depositDbError } = await supabase
                  .from("cash_transactions")
                  .insert({
                    id: depositTxId,
                    type: "income",
                    category: "service_deposit",
                    amount: depositAmount,
                    date: new Date().toISOString(),
                    description: `Dat coc sua chua #${(
                      formatWorkOrderId(
                        orderId,
                        storeSettings?.work_order_prefix
                      ) || ""
                    )
                      .split("-")
                      .pop()} - ${formData.customerName}`,
                    branchid: currentBranchId,
                    paymentsource: formData.paymentMethod,
                    workorderid: orderId,
                  });
                if (depositDbError) {
                  console.error(
                    "[WorkOrderModal] deposit insert error:",
                    depositDbError
                  );
                }
              } catch (e) {
                console.error("[WorkOrderModal] deposit insert exception:", e);
              }

              setCashTransactions((prev: any[]) => [
                ...prev,
                {
                  id: depositTxId,
                  type: "income",
                  category: "service_deposit",
                  amount: depositAmount,
                  date: new Date().toISOString(),
                  description: `Đặt cọc sửa chữa #${(
                    formatWorkOrderId(
                      orderId,
                      storeSettings?.work_order_prefix
                    ) || ""
                  )
                    .split("-")
                    .pop()} - ${formData.customerName}`,
                  branchId: currentBranchId,
                  paymentSource: formData.paymentMethod,
                  reference: orderId,
                },
              ]);

              setPaymentSources((prev: any[]) =>
                prev.map((ps) => {
                  if (ps.id === formData.paymentMethod) {
                    return {
                      ...ps,
                      balance: {
                        ...ps.balance,
                        [currentBranchId]:
                          (ps.balance[currentBranchId] || 0) + depositAmount,
                      },
                    };
                  }
                  return ps;
                })
              );
            }

            if (paymentTxId && additionalPaymentToApply > 0) {
              // INSERT payment transaction to database
              try {
                const { error: paymentDbError } = await supabase
                  .from("cash_transactions")
                  .insert({
                    id: paymentTxId,
                    type: "income",
                    category: "service_income",
                    amount: additionalPaymentToApply,
                    date: new Date().toISOString(),
                    description: `Thu tien sua chua #${(
                      formatWorkOrderId(
                        orderId,
                        storeSettings?.work_order_prefix
                      ) || ""
                    )
                      .split("-")
                      .pop()} - ${formData.customerName}`,
                    branchid: currentBranchId,
                    paymentsource: formData.paymentMethod,
                    workorderid: orderId,
                  });
                if (paymentDbError) {
                  console.error(
                    "[WorkOrderModal] payment insert error:",
                    paymentDbError
                  );
                }
              } catch (e) {
                console.error("[WorkOrderModal] payment insert exception:", e);
              }

              setCashTransactions((prev: any[]) => [
                ...prev,
                {
                  id: paymentTxId,
                  type: "income",
                  category: "service_income",
                  amount: additionalPaymentToApply,
                  date: new Date().toISOString(),
                  description: `Thu tiền sửa chữa #${(
                    formatWorkOrderId(
                      orderId,
                      storeSettings?.work_order_prefix
                    ) || ""
                  )
                    .split("-")
                    .pop()} - ${formData.customerName}`,
                  branchId: currentBranchId,
                  paymentSource: formData.paymentMethod,
                  reference: orderId,
                },
              ]);

              setPaymentSources((prev: any[]) =>
                prev.map((ps) => {
                  if (ps.id === formData.paymentMethod) {
                    return {
                      ...ps,
                      balance: {
                        ...ps.balance,
                        [currentBranchId]:
                          (ps.balance[currentBranchId] || 0) +
                          additionalPaymentToApply,
                      },
                    };
                  }
                  return ps;
                })
              );
            }

            // 🔹 Create cash transactions for outsourcing costs (Giá nhập từ gia công bên ngoài)
            if (additionalServices.length > 0) {
              const totalOutsourcingCost = additionalServices.reduce(
                (sum, service) =>
                  sum + (service.costPrice || 0) * service.quantity,
                0
              );

              // 🔹 TRƯỜNG HỢP ĐẶC BIỆT: Giá bán âm + Giá nhập = 0 → Tự động chi tiền
              const negativeSalesPayment = additionalServices.reduce(
                (sum, service) => {
                  // Chỉ tính các service có giá bán âm VÀ giá nhập = 0
                  if (service.price < 0 && (service.costPrice || 0) === 0) {
                    return sum + Math.abs(service.price * service.quantity);
                  }
                  return sum;
                },
                0
              );

              if (totalOutsourcingCost > 0) {
                const outsourcingTxId = `EXPENSE-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`;

                // Create expense transaction
                try {

                  // Check if transaction already exists
                  const { data: existingTx } = await supabase
                    .from("cash_transactions")
                    .select("id")
                    .eq("reference", orderId)
                    .eq("category", "outsourcing")
                    .maybeSingle();

                  if (!existingTx) {
                    const { error: expenseError } = await supabase
                      .from("cash_transactions")
                      .insert({
                        id: outsourcingTxId,
                        type: "expense",
                        category: "outsourcing",
                        amount: -totalOutsourcingCost, // Negative for expense
                        date: new Date().toISOString(),
                        description: `Chi phí gia công bên ngoài - Phiếu #${orderId
                          .split("-")
                          .pop()} - ${additionalServices
                            .map((s) => s.description)
                            .join(", ")}`,
                        branchid: currentBranchId,
                        paymentsource: "cash",
                        reference: orderId,
                      });

                    if (expenseError) {
                      console.error("[Outsourcing] Insert FAILED:", expenseError);
                      showToast.error(
                        `Lỗi tạo phiếu chi gia công: ${expenseError.message}`
                      );
                    } else {
                      // Update context
                      setCashTransactions((prev: any[]) => [
                        ...prev,
                        {
                          id: outsourcingTxId,
                          type: "expense",
                          category: "outsourcing",
                          amount: -totalOutsourcingCost,
                          date: new Date().toISOString(),
                          description: `Chi phí gia công bên ngoài - Phiếu #${orderId
                            .split("-")
                            .pop()}`,
                          branchId: currentBranchId,
                          paymentSource: "cash",
                          reference: orderId,
                        },
                      ]);

                      // Update payment sources balance
                      setPaymentSources((prev: any[]) =>
                        prev.map((ps) => {
                          if (ps.id === "cash") {
                            return {
                              ...ps,
                              balance: {
                                ...ps.balance,
                                [currentBranchId]:
                                  (ps.balance[currentBranchId] || 0) -
                                  totalOutsourcingCost,
                              },
                            };
                          }
                          return ps;
                        })
                      );

                      showToast.info(
                        `Đã tạo phiếu chi ${formatCurrency(
                          totalOutsourcingCost
                        )} cho gia công bên ngoài`
                      );
                    }
                  }
                } catch (err) {
                  console.error("Error creating outsourcing expense:", err);
                }
              }

              // 🔹 Xử lý khoản chi từ giá bán âm (costPrice = 0)
              if (negativeSalesPayment > 0) {
                const negativeSalesTxId = `EXPENSE-NEG-${Date.now()}-${Math.random()
                  .toString(36)
                  .substr(2, 9)}`;

                try {

                  const negativeServices = additionalServices.filter(
                    (s) => s.price < 0 && (s.costPrice || 0) === 0
                  );

                  // Check if transaction already exists
                  const { data: existingNegTx } = await supabase
                    .from("cash_transactions")
                    .select("id")
                    .eq("reference", orderId)
                    .eq("category", "refund")
                    .maybeSingle();

                  if (!existingNegTx) {
                    const { error: negExpenseError } = await supabase
                      .from("cash_transactions")
                      .insert({
                        id: negativeSalesTxId,
                        type: "expense",
                        category: "refund", // Hoặc category phù hợp
                        amount: -negativeSalesPayment, // Negative for expense
                        date: new Date().toISOString(),
                        description: `Chi tiền (giá bán âm) - Phiếu #${orderId
                          .split("-")
                          .pop()} - ${negativeServices
                            .map((s) => s.description)
                            .join(", ")}`,
                        branchid: currentBranchId,
                        paymentsource: "cash",
                        reference: orderId,
                      });

                    if (negExpenseError) {
                      console.error(
                        "[Negative Sales] Insert FAILED:",
                        negExpenseError
                      );
                      showToast.error(
                        `Lỗi tạo phiếu chi (giá bán âm): ${negExpenseError.message}`
                      );
                    } else {
                      // Update context
                      setCashTransactions((prev: any[]) => [
                        ...prev,
                        {
                          id: negativeSalesTxId,
                          type: "expense",
                          category: "refund",
                          amount: -negativeSalesPayment,
                          date: new Date().toISOString(),
                          description: `Chi tiền (giá bán âm) - Phiếu #${orderId
                            .split("-")
                            .pop()}`,
                          branchId: currentBranchId,
                          paymentSource: "cash",
                          reference: orderId,
                        },
                      ]);

                      // Update payment sources balance
                      setPaymentSources((prev: any[]) =>
                        prev.map((ps) => {
                          if (ps.id === "cash") {
                            return {
                              ...ps,
                              balance: {
                                ...ps.balance,
                                [currentBranchId]:
                                  (ps.balance[currentBranchId] || 0) -
                                  negativeSalesPayment,
                              },
                            };
                          }
                          return ps;
                        })
                      );

                      showToast.info(
                        `Đã tạo phiếu chi ${formatCurrency(
                          negativeSalesPayment
                        )} từ giá bán âm`
                      );
                    }
                  }
                } catch (err) {
                  console.error("Error creating negative sales expense:", err);
                }
              }
            }

            // Call onSave to update the workOrders state
            onSave(finalOrder);

            // 🔹 FIX: Nếu tạo phiếu mới với paymentStatus = 'paid', gọi complete_payment để trừ kho
            // FIXME: Đã cập nhật để kiểm tra flag inventoryDeducted từ response của atomic create
            // Nếu atomic create đã trừ kho rồi (inventoryDeducted = true) thì KHÔNG gọi complete_payment nữa
            if (
              paymentStatus === "paid" &&
              selectedParts.length > 0 &&
              !responseData?.inventoryDeducted
            ) {
              try {
                const result = await completeWorkOrderPayment(
                  orderId,
                  formData.paymentMethod || "cash",
                  0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
                );
                if ("ok" in result && !result.ok) {
                  showToast.warning(
                    "Đã lưu phiếu nhưng có lỗi khi trừ kho: " +
                    ((((result as { error: any }).error)?.message) || "Lỗi không xác định")
                  );
                }
              } catch (error: any) {
                console.error("[handleSave] Error deducting inventory:", error);
                showToast.warning(
                  "Đã lưu phiếu nhưng có lỗi khi trừ kho: " + error.message
                );
              }
            }

            // 🔹 Auto-create customer debt ONLY when status is "Trả máy" and there's remaining amount
            if (formData.status === "Trả máy" && remainingAmountToApply > 0) {
              await createCustomerDebtIfNeeded(
                finalOrder,
                remainingAmountToApply,
                total,
                totalPaidToApply
              );
            }

            // Close modal after successful save
            onClose();
          } catch (error: any) {
            console.error("Error creating work order (atomic):", error);
            // Error toast is already shown by the hook's onError
          }
          return;
        }

        // 🔹 If this is an UPDATE (with or without parts), use atomic RPC
        if (order?.id) {
          try {

            // Prepare issue description with password
            let finalIssueDescription = formData.issueDescription || "";
            finalIssueDescription = finalIssueDescription.replace(/\[MK: .+?\]\s*/g, "").trim();

            if (devicePassword.trim()) {
              finalIssueDescription = `[MK: ${devicePassword.trim()}] ${finalIssueDescription}`;
            }

            const responseData = await updateWorkOrderAtomicAsync({
              id: order.id,
              customerName: formData.customerName || "",
              customerPhone: formData.customerPhone || "",
              vehicleModel: formData.vehicleModel || "",
              licensePlate: formData.licensePlate || "",
              issueDescription: finalIssueDescription, // Use modified description
              technicianName: resolvedTechnicianName,
              status: formData.status || "Tiếp nhận",
              laborCost: effectiveLaborCost,
              discount: discount,
              partsUsed: selectedParts,
              additionalServices:
                additionalServices.length > 0 ? additionalServices : undefined,
              total: total,
              branchId: currentBranchId,
              paymentStatus: paymentStatus,
              paymentMethod: formData.paymentMethod,
              depositAmount: depositAmount > 0 ? depositAmount : undefined,
              additionalPayment:
                additionalPaymentToApply > 0 ? additionalPaymentToApply : undefined,
              totalPaid: totalPaidToApply > 0 ? totalPaidToApply : undefined,
              remainingAmount: remainingAmountToApply,
            } as any);

            const workOrderRow = (responseData as any).workOrder;
            const syncedRepairServices = await syncRepairServicesForOrder(order.id);
            const depositTxId = responseData?.depositTransactionId;
            const paymentTxId = responseData?.paymentTransactionId;

            // 🔹 Transform snake_case response to camelCase for WorkOrder interface
            // If workOrderRow is undefined, build from formData + order
            const finalOrder: WorkOrder = workOrderRow
              ? {
                id: (workOrderRow as any).id || order.id,
                customerName:
                  (workOrderRow as any).customername ||
                  (workOrderRow as any).customerName ||
                  order.customerName,
                customerPhone:
                  (workOrderRow as any).customerphone ||
                  (workOrderRow as any).customerPhone ||
                  order.customerPhone,
                vehicleModel:
                  (workOrderRow as any).vehiclemodel ||
                  (workOrderRow as any).vehicleModel ||
                  order.vehicleModel,
                licensePlate:
                  (workOrderRow as any).licenseplate ||
                  (workOrderRow as any).licensePlate ||
                  order.licensePlate,
                issueDescription:
                  (workOrderRow as any).issuedescription ||
                  (workOrderRow as any).issueDescription ||
                  order.issueDescription ||
                  "",
                technicianName:
                  (workOrderRow as any).technicianname ||
                  (workOrderRow as any).technicianName ||
                  formData.technicianName ||
                  order.technicianName ||
                  "",
                status: (workOrderRow as any).status || order.status,
                laborCost:
                  (workOrderRow as any).laborcost ||
                  (workOrderRow as any).laborCost ||
                  Number(formData.laborCost || 0) ||
                  effectiveLaborCost ||
                  0,
                laborTotal:
                  (workOrderRow as any).labor_total ||
                  (workOrderRow as any).laborTotal ||
                  syncedRepairServices.reduce(
                    (sum, service) => sum + Number(service.laborAmount || 0),
                    0
                  ),
                workerTotal:
                  (workOrderRow as any).worker_total ||
                  (workOrderRow as any).workerTotal ||
                  syncedRepairServices.reduce(
                    (sum, service) =>
                      sum +
                      (service.workers && service.workers.length > 0
                        ? service.workers.reduce(
                          (workerSum, worker) => workerSum + Number(worker.workerAmount || 0),
                          0
                        )
                        : Number(service.workerAmount || 0)),
                    0
                  ),
                discount: (workOrderRow as any).discount || order.discount || 0,
                partsUsed:
                  (workOrderRow as any).partsused ||
                  (workOrderRow as any).partsUsed ||
                  order.partsUsed ||
                  [],
                repairServices: syncedRepairServices,
                additionalServices:
                  additionalServices.length > 0 ? additionalServices : undefined,
                total: (workOrderRow as any).total || order.total,
                branchId:
                  (workOrderRow as any).branchid ||
                  (workOrderRow as any).branchId ||
                  order.branchId,
                depositAmount:
                  (workOrderRow as any).depositamount ||
                  (workOrderRow as any).depositAmount ||
                  order.depositAmount,
                depositDate:
                  (workOrderRow as any).depositdate ||
                  (workOrderRow as any).depositDate ||
                  order.depositDate,
                depositTransactionId: depositTxId || order.depositTransactionId,
                paymentStatus:
                  (workOrderRow as any).paymentstatus ||
                  (workOrderRow as any).paymentStatus ||
                  order.paymentStatus,
                paymentMethod:
                  (workOrderRow as any).paymentmethod ||
                  (workOrderRow as any).paymentMethod ||
                  order.paymentMethod,
                additionalPayment:
                  (workOrderRow as any).additionalpayment ||
                  (workOrderRow as any).additionalPayment ||
                  order.additionalPayment,
                totalPaid:
                  (workOrderRow as any).totalpaid ||
                  (workOrderRow as any).totalPaid ||
                  order.totalPaid,
                remainingAmount:
                  (workOrderRow as any).remainingamount ||
                  (workOrderRow as any).remainingAmount ||
                  order.remainingAmount,
                cashTransactionId: paymentTxId || order.cashTransactionId,
                paymentDate:
                  (workOrderRow as any).paymentdate ||
                  (workOrderRow as any).paymentDate ||
                  order.paymentDate,
                creationDate:
                  (workOrderRow as any).creationdate ||
                  (workOrderRow as any).creationDate ||
                  order.creationDate,
              }
              : {
                // Build from formData when workOrderRow is undefined
                ...order,
                customerName: formData.customerName || order.customerName,
                customerPhone: formData.customerPhone || order.customerPhone,
                vehicleModel: formData.vehicleModel || order.vehicleModel,
                licensePlate: formData.licensePlate || order.licensePlate,
                issueDescription:
                  formData.issueDescription || order.issueDescription,
                technicianName: resolvedTechnicianName || order.technicianName,
                status: formData.status || order.status,
                laborCost: effectiveLaborCost,
                laborTotal: syncedRepairServices.reduce(
                  (sum, service) => sum + Number(service.laborAmount || 0),
                  0
                ),
                workerTotal: syncedRepairServices.reduce(
                  (sum, service) =>
                    sum +
                    (service.workers && service.workers.length > 0
                      ? service.workers.reduce(
                        (workerSum, worker) => workerSum + Number(worker.workerAmount || 0),
                        0
                      )
                      : Number(service.workerAmount || 0)),
                  0
                ),
                discount: discount,
                partsUsed: selectedParts,
                repairServices: syncedRepairServices,
                additionalServices:
                  additionalServices.length > 0 ? additionalServices : undefined,
                total: total,
                depositAmount: depositAmount,
                depositTransactionId: depositTxId || order.depositTransactionId,
                paymentStatus: paymentStatus,
                paymentMethod: formData.paymentMethod || order.paymentMethod,
                additionalPayment: additionalPaymentToApply,
                totalPaid: totalPaidToApply,
                remainingAmount: remainingAmountToApply,
                cashTransactionId: paymentTxId || order.cashTransactionId,
                paymentDate: paymentTxId
                  ? new Date().toISOString()
                  : order.paymentDate,
              };

            // Update cash transactions in context AND database if new transactions created
            if (depositTxId && depositAmount > order.depositAmount!) {
              const additionalDeposit =
                depositAmount - (order.depositAmount || 0);
              // INSERT additional deposit to database
              try {
                const { error: addDepositErr } = await supabase
                  .from("cash_transactions")
                  .insert({
                    id: depositTxId,
                    type: "income",
                    category: "service_deposit",
                    amount: additionalDeposit,
                    date: new Date().toISOString(),
                    description: `Dat coc bo sung #${(
                      formatWorkOrderId(
                        order.id,
                        storeSettings?.work_order_prefix
                      ) || ""
                    )
                      .split("-")
                      .pop()} - ${formData.customerName}`,
                    branchid: currentBranchId,
                    paymentsource: formData.paymentMethod,
                    workorderid: order.id,
                  });
                if (addDepositErr) {
                  console.error(
                    "[WorkOrderModal-update] additional deposit error:",
                    addDepositErr
                  );
                }
              } catch (e) {
                console.error(
                  "[WorkOrderModal-update] additional deposit exception:",
                  e
                );
              }

              setCashTransactions((prev: any[]) => [
                ...prev,
                {
                  id: depositTxId,
                  type: "income",
                  category: "service_deposit",
                  amount: depositAmount - (order.depositAmount || 0),
                  date: new Date().toISOString(),
                  description: `Đặt cọc bổ sung #${(
                    formatWorkOrderId(
                      order.id,
                      storeSettings?.work_order_prefix
                    ) || ""
                  )
                    .split("-")
                    .pop()} - ${formData.customerName}`,
                  branchId: currentBranchId,
                  paymentSource: formData.paymentMethod,
                  reference: order.id,
                },
              ]);

              setPaymentSources((prev: any[]) =>
                prev.map((ps) => {
                  if (ps.id === formData.paymentMethod) {
                    return {
                      ...ps,
                      balance: {
                        ...ps.balance,
                        [currentBranchId]:
                          (ps.balance[currentBranchId] || 0) +
                          (depositAmount - (order.depositAmount || 0)),
                      },
                    };
                  }
                  return ps;
                })
              );
            }

            if (
              paymentTxId &&
              totalAdditionalPayment > (order.additionalPayment || 0)
            ) {
              const additionalPaymentAmount =
                totalAdditionalPayment - (order.additionalPayment || 0);

              // ✅ No need to INSERT - stored procedure already created the transaction
              // Just update local state for UI consistency
              setCashTransactions((prev: any[]) => [
                ...prev,
                {
                  id: paymentTxId,
                  type: "income",
                  category: "service_income",
                  amount: additionalPaymentAmount,
                  date: new Date().toISOString(),
                  description: `Thu tiền bổ sung #${(
                    formatWorkOrderId(
                      order.id,
                      storeSettings?.work_order_prefix
                    ) || ""
                  )
                    .split("-")
                    .pop()} - ${formData.customerName}`,
                  branchId: currentBranchId,
                  paymentSource: formData.paymentMethod,
                  reference: order.id,
                },
              ]);

              setPaymentSources((prev: any[]) =>
                prev.map((ps) => {
                  if (ps.id === formData.paymentMethod) {
                    return {
                      ...ps,
                      balance: {
                        ...ps.balance,
                        [currentBranchId]:
                          (ps.balance[currentBranchId] || 0) +
                          (totalAdditionalPayment -
                            (order.additionalPayment || 0)),
                      },
                    };
                  }
                  return ps;
                })
              );
            }


            // 🔹 Force invalidate queries để refresh data mới từ DB
            if (invalidateWorkOrders) {
              invalidateWorkOrders();
            }

            onSave(finalOrder);

            // 🔹 FIX: Nếu cập nhật phiếu thành paymentStatus = 'paid', gọi complete_payment để trừ kho
            const wasUnpaidOrPartial = order.paymentStatus !== "paid";
            if (
              paymentStatus === "paid" &&
              wasUnpaidOrPartial &&
              selectedParts.length > 0
            ) {
              try {
                const result = await completeWorkOrderPayment(
                  order.id,
                  formData.paymentMethod || "cash",
                  0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
                );
                if ("ok" in result && !result.ok) {
                  showToast.warning(
                    "Đã cập nhật phiếu nhưng có lỗi khi trừ kho: " +
                    ((((result as { error: any }).error)?.message) || "Lỗi không xác định")
                  );
                }
              } catch (error: any) {
                console.error("[handleSave] Error deducting inventory:", error);
                showToast.warning(
                  "Đã cập nhật phiếu nhưng có lỗi khi trừ kho: " + error.message
                );
              }
            }

            // 🔹 Auto-create customer debt ONLY when status is "Trả máy" and there's remaining amount
            if (formData.status === "Trả máy" && remainingAmountToApply > 0) {
              await createCustomerDebtIfNeeded(
                finalOrder,
                remainingAmountToApply,
                total,
                totalPaidToApply
              );
            }

            // Close modal after successful update
            onClose();
          } catch (error: any) {
            console.error(
              "[handleSave] Error updating work order (atomic):",
              error
            );
          }
          return;
        }


      } finally {
        setIsSubmitting(false);
        submittingRef.current = false; // Reset synchronous guard
      }
    };

    const handlePayFull = async () => {
      const fullPayment = Math.max(0, total - totalDeposit);
      setShowPartialPayment(true);
      setPartialPayment(fullPayment);
      await handleSave(true);
    };

    const handleAddPart = (part: Part) => {
      const existing = selectedParts.find((p) => p.partId === part.id);
      if (existing) {
        setSelectedParts(
          selectedParts.map((p) =>
            p.partId === part.id ? { ...p, quantity: p.quantity + 1 } : p
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
            price: part.retailPrice[currentBranchId] || 0,
            costPrice: part.costPrice?.[currentBranchId] || 0,
          },
        ]);
      }
      setShowPartSearch(false);
      setSearchPart("");
    };

    // Filter parts available at current branch with stock
    const availableParts = useMemo(() => {
      return parts.filter((part) => {
        const stock = part.stock?.[currentBranchId] || 0;
        return stock > 0;
      });
    }, [parts, currentBranchId]);

    // Filter parts based on search - show all available parts if search is empty
    const filteredParts = useMemo(() => {
      if (!searchPart.trim()) return availableParts;

      return availableParts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchPart.toLowerCase()) ||
          p.sku?.toLowerCase().includes(searchPart.toLowerCase())
      );
    }, [availableParts, searchPart]);

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-1.5 sm:p-2.5 md:p-4">
        <div className="bg-white dark:bg-slate-800 w-full max-h-[95vh] max-w-[99vw] lg:max-w-[96vw] xl:max-w-6xl rounded-xl shadow-2xl flex flex-col overflow-hidden text-[12px] sm:text-[13px]">
          {/* Header */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 md:px-5 md:py-2.5 flex items-center justify-between gap-2.5 rounded-t-xl flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/80 dark:bg-slate-900/30">
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    {
                      value: "Tiếp nhận",
                      label: "Tiếp nhận",
                      activeClass:
                        "bg-sky-600 text-white border-sky-500 shadow-sm shadow-sky-500/30",
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h8M8 17h5M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                        </svg>
                      ),
                    },
                    {
                      value: "Đang sửa",
                      label: "Đang sửa",
                      activeClass:
                        "bg-amber-500 text-white border-amber-400 shadow-sm shadow-amber-500/30",
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 01-5.4 5.4l-5 5a1.5 1.5 0 102.1 2.1l5-5a4 4 0 005.4-5.4l-2.1 2.1-1.4-1.4 2.1-2.1z" />
                        </svg>
                      ),
                    },
                    {
                      value: "Đã sửa xong",
                      label: "Đã xong",
                      activeClass:
                        "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/30",
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7L9 18l-5-5" />
                        </svg>
                      ),
                    },
                    {
                      value: "Trả máy",
                      label: "Trả máy",
                      activeClass:
                        "bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-500/30",
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14v10H5zM9 19h6M12 15v4" />
                        </svg>
                      ),
                    },
                  ].map((step) => {
                    const isActive = (formData.status || "Tiếp nhận") === step.value;
                    return (
                      <button
                        key={step.value}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            status: step.value as any,
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold border transition-all ${isActive
                          ? step.activeClass
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                          }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {step.icon}
                          {step.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Đóng"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* 🔹 Warning Banner for Paid Orders */}
          {isOrderPaid && (
            <div className="mx-4 mt-4 md:mx-6 md:mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    ⚠️ Phiếu đã thanh toán
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Phiếu đã thanh toán: Không thể thay đổi danh sách dịch vụ và giá bán (Revenue).
                      <br className="mb-1" />
                      Tuy nhiên, bạn chẫn có thể cập nhật <b>Giá vốn (Cost)</b> của các dịch vụ để tính lợi nhuận chính xác, cũng như thông tin khách hàng và ghi chú.
                    </p>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Scrollable Content */}
          <div className="px-3 py-3 md:px-5 md:py-5 grid gap-3.5 md:gap-5 grid-cols-[minmax(0,1fr)_minmax(200px,30%)] items-start overflow-auto flex-1 pb-4 [&_th]:px-2.5 [&_th]:py-1.5 [&_td]:px-2.5 [&_td]:py-1.5">
            {/* Customer & Vehicle Info */}
            <div className="grid gap-6 grid-cols-2 col-start-1">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                  Khách hàng & Xe
                </h3>

                <div>
                  <WorkOrderCustomerSection
                    customerSearch={customerSearch}
                    showCustomerDropdown={showCustomerDropdown}
                    filteredCustomers={filteredCustomers}
                    hasMoreCustomers={hasMoreCustomers}
                    isSearchingCustomer={isSearchingCustomer}
                    customersLength={customers.length}
                    formData={formData}
                    isEditingCustomer={isEditingCustomer}
                    editCustomerName={editCustomerName}
                    editCustomerPhone={editCustomerPhone}
                    onCustomerSearchChange={(value) => {
                      setCustomerSearch(value);
                      setShowCustomerDropdown(true);
                      setFormData({
                        ...formData,
                        customerName: value,
                      });
                    }}
                    onCustomerFocus={() => setShowCustomerDropdown(true)}
                    onSelectCustomer={(customer) => {
                      const primaryVehicle =
                        customer.vehicles?.find((v: Vehicle) => v.isPrimary) ||
                        customer.vehicles?.[0];

                      setFormData({
                        ...formData,
                        customerName: customer.name,
                        customerPhone: customer.phone,
                        vehicleId: primaryVehicle?.id,
                        vehicleModel:
                          primaryVehicle?.model || customer.vehicleModel || "",
                        licensePlate:
                          primaryVehicle?.licensePlate ||
                          customer.licensePlate ||
                          "",
                      });
                      setCustomerSearch(customer.name);
                      setShowCustomerDropdown(false);
                    }}
                    onLoadMoreCustomers={() => handleLoadMoreCustomers()}
                    onOpenAddCustomer={() => {
                      setShowAddCustomerModal(true);
                      if (customerSearch && /^[0-9]+$/.test(customerSearch)) {
                        setNewCustomer({
                          ...newCustomer,
                          phone: customerSearch,
                        });
                      }
                    }}
                    onStartEditCustomer={() => {
                      setEditCustomerName(formData.customerName || "");
                      setEditCustomerPhone(formData.customerPhone || "");
                      setIsEditingCustomer(true);
                    }}
                    onClearCustomer={() => {
                      setCustomerSearch("");
                      setFormData({
                        ...formData,
                        customerName: "",
                        customerPhone: "",
                        vehicleId: undefined,
                        vehicleModel: "",
                        licensePlate: "",
                      });
                    }}
                    onEditCustomerNameChange={setEditCustomerName}
                    onEditCustomerPhoneChange={setEditCustomerPhone}
                    onCancelEditCustomer={() => setIsEditingCustomer(false)}
                    onSaveEditedCustomer={handleSaveEditedCustomer}
                  />

                  {/* Vehicle Selection & Add Vehicle (for selected customer) */}
                  {currentCustomer && (
                    <WorkOrderVehicleSection
                      customerVehicles={customerVehicles}
                      selectedVehicleId={formData.vehicleId}
                      editingVehicleId={editingVehicleId}
                      editVehicleModel={editVehicleModel}
                      editVehicleLicensePlate={editVehicleLicensePlate}
                      onOpenAddVehicleModal={() => setShowAddVehicleModal(true)}
                      onSelectVehicle={(vehicle) => handleSelectVehicle(vehicle)}
                      onStartEditVehicle={(vehicle) => {
                        setEditingVehicleId(vehicle.id);
                        setEditVehicleModel(vehicle.model || "");
                        setEditVehicleLicensePlate(vehicle.licensePlate || "");
                      }}
                      onCancelEditVehicle={() => {
                        setEditingVehicleId(null);
                        setEditVehicleModel("");
                        setEditVehicleLicensePlate("");
                      }}
                      onSaveEditedVehicle={handleSaveEditedVehicle}
                      onEditVehicleModelChange={setEditVehicleModel}
                      onEditVehicleLicensePlateChange={setEditVehicleLicensePlate}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-0">
                      Mật khẩu màn hình
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (devicePassword.startsWith("Pattern:")) {
                          setDevicePassword("");
                        }
                        setIsPatternMode(!isPatternMode);
                      }}
                      className="text-sm font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1 active:scale-95 transition-transform"
                    >
                      {isPatternMode ? (
                        <>
                          <Lock className="w-4 h-4" /> Nhập số/chữ
                        </>
                      ) : (
                        <>
                          <Grid3x3 className="w-4 h-4" /> Vẽ hình (Android)
                        </>
                      )}
                    </button>
                  </div>

                  {isPatternMode ? (
                    <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center">
                      <div className="mb-2 text-sm font-medium text-slate-500">Vẽ mật khẩu mở khóa</div>
                      <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm">
                        <AndroidPatternLock
                          initialValue={devicePassword.startsWith("Pattern:") ? devicePassword.replace("Pattern:", "").trim() : ""}
                          onPatternComplete={(pattern) => {
                            if (pattern) {
                              setDevicePassword(`Pattern: ${pattern}`);
                              if (navigator.vibrate) navigator.vibrate(50);
                            }
                          }}
                        />
                      </div>
                      {devicePassword.startsWith("Pattern:") ? (
                        <div className="mt-3 text-sm font-mono text-emerald-500 font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle className="w-4 h-4" /> Đã lưu hình vẽ
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-slate-400 italic">
                          Vẽ hình để lưu mật khẩu
                        </div>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Nhập mật khẩu (VD: 123456...)"
                      value={devicePassword}
                      onChange={(e) => setDevicePassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono text-red-600 dark:text-red-400 font-bold focus:border-blue-500 focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mô tả sự cố
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Bảo dưỡng định kỳ, thay nhớt..."
                    value={formData.issueDescription || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        issueDescription: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
                  Chi tiết Dịch vụ
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Kỹ thuật viên
                    </label>
                    {isTechnicianLockedForStaff && (
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                        Tài khoản nhân viên: kỹ thuật viên được cố định theo đăng nhập.
                      </p>
                    )}
                    <select
                      value={resolvedTechnicianName}
                      disabled={isTechnicianLockedForStaff}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          technicianName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <option value="">-- Chọn kỹ thuật viên --</option>
                      {employees
                        .filter((emp) => emp.status === "active")
                        .map((emp) => (
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Ghi chú nội bộ
                  </label>
                  <textarea
                    rows={4}
                    placeholder="VD: Khách yêu cầu kiểm tra thêm hệ thống điện"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                  />
                </div>
                {import.meta.env.VITE_ENABLE_WORKORDER_REPAIR_SECTION === "1" && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Dich vu / Cong sua
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Tinh tien cong rieng voi tien phu tung. Luong tho chi lay tu phan nay.
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Tong cong khach tra</div>
                      <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(repairLaborTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Mau dich vu
                      </label>
                      <select
                        value={newRepairServiceDraft.serviceId || ""}
                        onChange={(e) => {
                          const selectedService = serviceConfigs.find((service) => service.id === e.target.value);
                          if (!selectedService) {
                            setNewRepairServiceDraft(createEmptyRepairServiceDraft());
                            return;
                          }

                          setNewRepairServiceDraft({
                            ...createEmptyRepairServiceDraft(),
                            serviceId: selectedService.id,
                            serviceName: selectedService.name,
                            laborCalcType: selectedService.laborCalcType,
                            laborFixedAmount: selectedService.laborFixedAmount,
                            laborPercentOfCost: selectedService.laborPercentOfCost,
                            minimumLaborAmount: selectedService.minimumLaborAmount,
                            defaultWorkerSharePercent: selectedService.defaultWorkerSharePercent,
                            manualLabor:
                              selectedService.laborCalcType === "manual"
                                ? selectedService.laborFixedAmount
                                : 0,
                            workers: buildDefaultWorkerSplit(
                              employeeOptions,
                              resolvedTechnicianName,
                              selectedService.defaultWorkerSharePercent
                            ),
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="">-- Chon dich vu --</option>
                        {serviceConfigs.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Kieu tinh cong
                      </label>
                      <select
                        value={newRepairServiceDraft.laborCalcType}
                        onChange={(e) =>
                          setNewRepairServiceDraft({
                            ...newRepairServiceDraft,
                            laborCalcType: e.target.value as RepairServiceDraft["laborCalcType"],
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      >
                        <option value="fixed">fixed</option>
                        <option value="percent_of_cost">percent_of_cost</option>
                        <option value="manual">manual</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Ten dich vu
                      </label>
                      <input
                        type="text"
                        value={newRepairServiceDraft.serviceName}
                        onChange={(e) =>
                          setNewRepairServiceDraft({
                            ...newRepairServiceDraft,
                            serviceName: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Cong co dinh
                      </label>
                      <NumberInput
                        value={newRepairServiceDraft.laborFixedAmount}
                        onChange={(value) =>
                          setNewRepairServiceDraft({
                            ...newRepairServiceDraft,
                            laborFixedAmount: value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        % theo gia nhap
                      </label>
                      <NumberInput
                        value={newRepairServiceDraft.laborPercentOfCost}
                        onChange={(value) =>
                          setNewRepairServiceDraft({
                            ...newRepairServiceDraft,
                            laborPercentOfCost: value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Cong toi thieu / cong tay
                      </label>
                      <NumberInput
                        value={
                          newRepairServiceDraft.laborCalcType === "manual"
                            ? newRepairServiceDraft.manualLabor
                            : newRepairServiceDraft.minimumLaborAmount
                        }
                        onChange={(value) =>
                          setNewRepairServiceDraft({
                            ...newRepairServiceDraft,
                            manualLabor:
                              newRepairServiceDraft.laborCalcType === "manual"
                                ? value
                                : newRepairServiceDraft.manualLabor,
                            minimumLaborAmount:
                              newRepairServiceDraft.laborCalcType === "manual"
                                ? newRepairServiceDraft.minimumLaborAmount
                                : value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                        Phu tung lien quan
                      </div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedParts.length === 0 && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Hay them phu tung o phan duoi truoc khi gan cho dich vu % gia nhap.
                          </div>
                        )}
                        {selectedParts.map((part) => {
                          const checked = newRepairServiceDraft.relatedItemIds.includes(part.partId);
                          return (
                            <label
                              key={part.partId}
                              className="flex items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-200"
                            >
                              <span className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    setNewRepairServiceDraft({
                                      ...newRepairServiceDraft,
                                      relatedItemIds: e.target.checked
                                        ? [...newRepairServiceDraft.relatedItemIds, part.partId]
                                        : newRepairServiceDraft.relatedItemIds.filter((id) => id !== part.partId),
                                    })
                                  }
                                />
                                <span>{part.partName}</span>
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">
                                {formatCurrency((part.costPrice || 0) * (part.quantity || 0))}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Gan tho va chia %
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setNewRepairServiceDraft({
                              ...newRepairServiceDraft,
                              workers: [
                                ...newRepairServiceDraft.workers,
                                { worker_id: "", worker_name: "", share_percent: 0 },
                              ],
                            })
                          }
                          className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                        >
                          + Tho
                        </button>
                      </div>
                      <div className="space-y-2">
                        {newRepairServiceDraft.workers.length === 0 && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Neu chua gan, he thong se dung ky thuat vien chinh va % mac dinh cua dich vu.
                          </div>
                        )}
                        {newRepairServiceDraft.workers.map((worker, index) => (
                          <div key={`${worker.worker_id}-${index}`} className="grid grid-cols-[1fr,120px,32px] gap-2">
                            <select
                              value={worker.worker_id}
                              onChange={(e) => {
                                const selectedEmployee = employeeOptions.find((employee) => employee.id === e.target.value);
                                setNewRepairServiceDraft({
                                  ...newRepairServiceDraft,
                                  workers: newRepairServiceDraft.workers.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                        ...item,
                                        worker_id: e.target.value,
                                        worker_name: selectedEmployee?.name || "",
                                      }
                                      : item
                                  ),
                                });
                              }}
                              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-slate-900 dark:text-slate-100"
                            >
                              <option value="">-- Chon tho --</option>
                              {employeeOptions
                                .filter((employee) => employee.status === "active")
                                .map((employee) => (
                                  <option key={employee.id} value={employee.id}>
                                    {employee.name}
                                  </option>
                                ))}
                            </select>
                            <NumberInput
                              value={worker.share_percent}
                              onChange={(value) =>
                                setNewRepairServiceDraft({
                                  ...newRepairServiceDraft,
                                  workers: newRepairServiceDraft.workers.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, share_percent: value } : item
                                  ),
                                })
                              }
                              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-slate-900 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setNewRepairServiceDraft({
                                  ...newRepairServiceDraft,
                                  workers: newRepairServiceDraft.workers.filter((_, itemIndex) => itemIndex !== index),
                                })
                              }
                              className="text-red-500 hover:text-red-700"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr,160px] gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Ghi chu / co tinh luong
                      </label>
                      <input
                        type="text"
                        value={newRepairServiceDraft.note}
                        onChange={(e) =>
                          setNewRepairServiceDraft({
                            ...newRepairServiceDraft,
                            note: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        placeholder="Bao hanh, hau mai, chu tu lam..."
                      />
                      <div className="mt-2 flex gap-4 text-xs text-slate-600 dark:text-slate-300">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newRepairServiceDraft.isBillable}
                            onChange={(e) =>
                              setNewRepairServiceDraft({
                                ...newRepairServiceDraft,
                                isBillable: e.target.checked,
                              })
                            }
                          />
                          Tinh bill khach
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newRepairServiceDraft.isPayableToWorker}
                            onChange={(e) =>
                              setNewRepairServiceDraft({
                                ...newRepairServiceDraft,
                                isPayableToWorker: e.target.checked,
                              })
                            }
                          />
                          Tinh luong tho
                        </label>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newRepairServiceDraft.serviceName.trim()) {
                          showToast.error("Vui long nhap ten dich vu cong sua");
                          return;
                        }

                        setRepairServices([...repairServices, newRepairServiceDraft]);
                        setNewRepairServiceDraft(createEmptyRepairServiceDraft());
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                    >
                      Them cong sua
                    </button>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Dich vu</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Gia nhap lien quan</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Cong khach tra</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Chia tho</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {repairServices.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                              Chua co cong sua nao trong phieu.
                            </td>
                          </tr>
                        )}
                        {repairServices.map((service) => {
                          const relatedCost = service.relatedItemIds.reduce(
                            (sum, partId) => sum + getSelectedPartCost(partId),
                            0
                          );
                          const laborAmount = getRepairServiceLaborAmount(service);
                          const workers = getRepairServiceWorkers(service);
                          const workerSplits = splitWorkerAmount(laborAmount, workers);

                          return (
                            <tr key={service.id} className="bg-white dark:bg-slate-900/30">
                              <td className="px-3 py-2 text-sm text-slate-800 dark:text-slate-200">
                                <div className="font-medium">{service.serviceName}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {service.laborCalcType}
                                  {service.note ? ` | ${service.note}` : ""}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                                {formatCurrency(relatedCost)}
                              </td>
                              <td className="px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(laborAmount)}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                                {workerSplits.length === 0
                                  ? "Chua gan"
                                  : workerSplits
                                    .map((worker) => `${worker.worker_name || worker.worker_id}: ${worker.share_percent}% (${formatCurrency(worker.worker_amount)})`)
                                    .join(", ")}
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRepairServices(repairServices.filter((item) => item.id !== service.id))
                                  }
                                  className="text-red-500 hover:text-red-700 text-sm"
                                >
                                  Xoa
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}
              </div>
            </div>

            {/* Parts Used */}
            <div className="space-y-3 col-start-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
                  Phụ tùng sử dụng
                </h3>
                <button
                  onClick={() => setShowPartSearch(!showPartSearch)}
                  disabled={!canEditPriceAndParts}
                  className={`px-3 py-1.5 text-white rounded text-sm flex items-center gap-1 ${canEditPriceAndParts
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-50"
                    }`}
                  title={
                    canEditPriceAndParts
                      ? "Thêm linh kiện"
                      : "Không thể thêm linh kiện cho phiếu đã thanh toán"
                  }
                >
                  + Thêm linh kiện
                </button>
              </div>

              {showPartSearch && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tìm kiếm phụ tùng theo tên hoặc SKU..."
                    value={searchPart}
                    onChange={(e) => setSearchPart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    autoFocus
                  />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
                    {partsLoading ? (
                      <div className="px-4 py-3 text-sm text-slate-500">
                        Đang tải phụ tùng...
                      </div>
                    ) : filteredParts.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">
                        Không tìm thấy phụ tùng
                      </div>
                    ) : (
                      <>
                        {filteredParts.slice(0, 50).map((part) => {
                          const stock = part.stock?.[currentBranchId] || 0;
                          const warrantyText = getWarrantyText(part);
                          const partLaborCost =
                            (part as any)?.laborCost?.[currentBranchId] ||
                            part.wholesalePrice?.[currentBranchId] ||
                            0;
                          return (
                            <button
                              key={part.id}
                              onClick={() => {
                                if (stock <= 0) {
                                  showToast.error("Sản phẩm đã hết hàng!");
                                  return;
                                }
                                handleAddPart(part);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center justify-between border-b border-slate-100 dark:border-slate-600 last:border-b-0"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {part.name}
                                </div>
                                <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium mt-0.5">
                                  Công: {formatCurrency(partLaborCost)}
                                </div>
                                {warrantyText && (
                                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                                    Bảo hành: {warrantyText}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                                    {part.sku}
                                  </span>
                                  <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                                    Tồn: {stock}
                                  </span>
                                  {part.category && (
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${getCategoryColor(part.category).bg
                                        } ${getCategoryColor(part.category).text}`}
                                    >
                                      {part.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(
                                  part.retailPrice[currentBranchId] || 0
                                )}
                              </div>
                            </button>
                          );
                        })}
                        {filteredParts.length > 50 && (
                          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500 italic border-t border-slate-100 dark:border-slate-600">
                            Đang hiển thị 50/{filteredParts.length} kết quả. Vui lòng tìm kiếm chi tiết hơn.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                        Tên
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                        SL
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                        Đ.Giá
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                        T.Tiền
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                    {selectedParts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-6 text-center text-sm text-slate-400"
                        >
                          Chưa có phụ tùng nào
                        </td>
                      </tr>
                    ) : (
                      selectedParts.map((part, idx) => (
                        <tr key={idx} className="bg-white dark:bg-slate-800">
                          <td className="px-4 py-2">
                            {(() => {
                              const laborPerUnit = getPartLaborBase(part.partId);
                              const integratedLaborLine = getIntegratedLaborByQuantity(
                                laborPerUnit,
                                Number(part.quantity || 0)
                              );
                              const warrantyText = getPartWarranty(part.partId);
                              return (
                                <>
                            <div className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                              {part.partName}
                            </div>
                            <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium mt-0.5">
                              Công: {formatCurrency(laborPerUnit)} / SP
                            </div>
                            <div className="text-[10px] text-cyan-500 dark:text-cyan-300 mt-0.5">
                              Công theo SL: {formatCurrency(integratedLaborLine)}
                            </div>
                            {warrantyText && (
                              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                                Bảo hành: {warrantyText}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              {part.sku && (
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                                  {part.sku}
                                </span>
                              )}
                              {part.category && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${getCategoryColor(part.category).bg
                                    } ${getCategoryColor(part.category).text}`}
                                >
                                  {part.category}
                                </span>
                              )}
                            </div>
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={part.quantity}
                              disabled={!canEditPriceAndParts}
                              onChange={(e) => {
                                const newQty = Number(e.target.value);
                                setSelectedParts(
                                  selectedParts.map((p, i) =>
                                    i === idx ? { ...p, quantity: newQty } : p
                                  )
                                );
                              }}
                              className={`w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${!canEditPriceAndParts
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                                }`}
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <NumberInput
                              placeholder="Đơn giá"
                              value={part.price || ""}
                              onChange={(val) => {
                                setSelectedParts(
                                  selectedParts.map((p, i) =>
                                    i === idx ? { ...p, price: val } : p
                                  )
                                );
                              }}
                              disabled={!canEditPriceAndParts}
                              className={`w-28 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm ${!canEditPriceAndParts
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                                }`}
                            />
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {formatCurrency(part.price * part.quantity)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() =>
                                setSelectedParts(
                                  selectedParts.filter((_, i) => i !== idx)
                                )
                              }
                              disabled={!canEditPriceAndParts}
                              className={`${canEditPriceAndParts
                                ? "text-red-500 hover:text-red-700"
                                : "text-slate-400 cursor-not-allowed"
                                }`}
                              aria-label="Xóa phụ tùng"
                              title={
                                canEditPriceAndParts
                                  ? "Xóa phụ tùng"
                                  : "Không thể xóa phụ tùng cho phiếu đã thanh toán"
                              }
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="w-4 h-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                                />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quote/Estimate Section */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 col-start-1">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">4</span>
                Báo giá (Gia công, Đặt hàng)
              </h3>

              <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                        Mô tả
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                        SL
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                        Đơn giá
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                        Thành tiền
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                        <button
                          onClick={() => {
                            if (newService.description) {
                              setAdditionalServices([
                                ...additionalServices,
                                { ...newService, id: `SRV-${Date.now()}` },
                              ]);
                              setNewService({
                                description: "",
                                quantity: 1,
                                price: 0,
                                costPrice: 0,
                              });
                            }
                          }}
                          className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                        >
                          Thêm
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Existing services */}
                    {additionalServices.map((service) => (
                      <tr
                        key={service.id}
                        className="border-b border-slate-200 dark:border-slate-700"
                      >
                        <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">
                          {service.description}
                        </td>
                        <td className="px-4 py-2 text-center text-sm text-slate-900 dark:text-slate-100">
                          <input
                            type="number"
                            value={service.quantity}
                            min="1"
                            onChange={(e) => {
                              const newQty = Math.max(1, Number(e.target.value));
                              setAdditionalServices(
                                additionalServices.map((s) =>
                                  s.id === service.id
                                    ? { ...s, quantity: newQty }
                                    : s
                                )
                              );
                            }}
                            className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 focus:border-blue-500 focus:outline-none"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <NumberInput
                            value={service.price}
                            onChange={(val) =>
                              setAdditionalServices(
                                additionalServices.map((s) =>
                                  s.id === service.id
                                    ? { ...s, price: val }
                                    : s
                                )
                              )
                            }
                            disabled={!canEditPriceAndParts}
                            className={`w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none text-sm ${!canEditPriceAndParts
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                              }`}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {formatCurrency(service.price * service.quantity)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={async () => {
                              const newServices = additionalServices.filter(
                                (s) => s.id !== service.id
                              );
                              setAdditionalServices(newServices);

                              // 🔹 FIX: Nếu xóa hết services VÀ đang edit order có sẵn → Update DB ngay
                              if (newServices.length === 0 && order?.id) {
                                try {
                                  await supabase
                                    .from('work_orders')
                                    .update({ additionalservices: null })
                                    .eq('id', order.id);
                                  showToast.success('Đã xóa phần gia công/đặt hàng');
                                } catch (error) {
                                  console.error('[WorkOrderModal] Error clearing additionalServices:', error);
                                }
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-sm"
                            aria-label="Xóa dịch vụ"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-4 h-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                              />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Input row */}
                    <tr className="bg-white dark:bg-slate-800">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          placeholder="Mô tả..."
                          value={newService.description}
                          onChange={(e) =>
                            setNewService({
                              ...newService,
                              description: e.target.value,
                            })
                          }
                          className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={newService.quantity}
                          onChange={(e) =>
                            setNewService({
                              ...newService,
                              quantity: Number(e.target.value),
                            })
                          }
                          className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <NumberInput
                          placeholder="Đơn giá"
                          value={newService.price ?? ""}
                          onChange={(val) =>
                            setNewService({
                              ...newService,
                              price: val, // Cho phép số âm
                            })
                          }
                          allowNegative={true}
                          className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-sm text-slate-400">
                        {newService.price > 0
                          ? formatCurrency(newService.price * newService.quantity)
                          : "Thành tiền"}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {/* Empty for add row */}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Section */}
            <div className="border-t border-slate-200 dark:border-slate-700 pt-0 mt-0 border-t-0 col-start-2 row-start-1 row-span-3 sticky top-0 space-y-4">
              <div className="grid gap-4 grid-cols-1">
                {/* Left: Payment Options */}
                <div className="space-y-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 order-2">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Thanh toán
                  </h3>

                  <div className="space-y-3">
                    {/* Deposit checkbox */}
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showDepositInput}
                        onChange={(e) => {
                          setShowDepositInput(e.target.checked);
                          if (!e.target.checked) setDepositAmount(0);
                        }}
                        disabled={!!order?.depositAmount} // Disable if already deposited
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        Đặt cọc{" "}
                        {order?.depositAmount
                          ? `(Đã cọc: ${formatCurrency(order.depositAmount)})`
                          : ""}
                      </span>
                    </label>

                    {/* Deposit input - only show when checkbox is checked and not already deposited */}
                    {showDepositInput && !order?.depositAmount && (
                      <div className="pl-6">
                        <NumberInput
                          placeholder="Số tiền đặt cọc"
                          value={depositAmount || ""}
                          onChange={(val) => setDepositAmount(val)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3"></div>

                    {/* Payment method selection */}
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                        Phương thức thanh toán:
                      </label>
                      <div className="flex items-center gap-4 pl-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="cash"
                            checked={formData.paymentMethod === "cash"}
                            onChange={(_e) =>
                              setFormData({ ...formData, paymentMethod: "cash" })
                            }
                            className="w-4 h-4"
                          />
                          <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-4 h-4"
                            >
                              <rect
                                x="2"
                                y="6"
                                width="20"
                                height="12"
                                rx="2"
                                ry="2"
                              />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            Tiền mặt
                          </span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="bank"
                            checked={formData.paymentMethod === "bank"}
                            onChange={(_e) =>
                              setFormData({ ...formData, paymentMethod: "bank" })
                            }
                            className="w-4 h-4"
                          />
                          <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-4 h-4"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 21h18M3 10h18M7 6h10l2 4H5l2-4Zm2 4v11m6-11v11"
                              />
                            </svg>
                            Chuyển khoản
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3"></div>

                    {/* Partial payment checkbox - only show if status is "Trả máy" */}
                    {formData.status === "Trả máy" && (
                      <>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={showPartialPayment}
                            onChange={(e) => {
                              setShowPartialPayment(e.target.checked);
                              if (e.target.checked) {
                                setPartialPayment(Math.max(0, remainingAmount));
                              } else {
                                setPartialPayment(0);
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            Thanh toán khi trả xe
                          </span>
                        </label>

                        {/* Partial Payment Input - only show when checkbox is checked */}
                        {showPartialPayment && (
                          <div className="pl-6 space-y-2">
                            <label className="text-xs text-slate-600 dark:text-slate-400">
                              Số tiền thanh toán thêm:
                            </label>
                            <div className="space-y-2">
                              <NumberInput
                                placeholder="0"
                                value={partialPayment || ""}
                                onChange={(val) => setPartialPayment(val)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right font-semibold"
                              />
                              <div className="grid grid-cols-3 gap-1.5 w-full">
                                <button
                                  onClick={() => setPartialPayment(0)}
                                  className="px-2 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                                >
                                  0%
                                </button>
                                <button
                                  onClick={() =>
                                    setPartialPayment(
                                      Math.round(remainingAmount * 0.5)
                                    )
                                  }
                                  className="px-2 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                                >
                                  50%
                                </button>
                                <button
                                  onClick={() => setPartialPayment(remainingAmount)}
                                  className="px-2 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                                >
                                  100%
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {formData.status !== "Trả máy" && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      * Thanh toán khi trả xe chỉ khả dụng khi trạng thái là "Trả
                      máy"
                    </p>
                  )}
                </div>

                {/* Right: Summary */}
                <div className="space-y-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4 order-1">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Tổng kết
                  </h3>

                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Tiền phụ tùng:
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(partsTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Gia công/Đặt hàng:
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(servicesTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-cyan-600 dark:text-cyan-400">
                      Tiền công tích hợp:
                    </span>
                    <span
                      className={`font-medium ${includeIntegratedLabor
                        ? "text-cyan-600 dark:text-cyan-400"
                        : "text-slate-400 dark:text-slate-500"
                        }`}
                    >
                      {formatCurrency(effectiveLaborCost)}
                    </span>
                  </div>
                  <label className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span>Không tính tiền công (khách mang về)</span>
                    <input
                      type="checkbox"
                      checked={!includeIntegratedLabor}
                      onChange={(e) => setIncludeIntegratedLabor(!e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  <div className="pt-2 border-t border-slate-300 dark:border-slate-600">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-red-600 font-medium">Giảm giá:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          placeholder="0"
                          value={
                            discountType === "amount"
                              ? formData.discount || ""
                              : discountPercent
                          }
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            if (discountType === "amount") {
                              const maxDiscount = subtotal;
                              setFormData({
                                ...formData,
                                discount: Math.min(value, maxDiscount),
                              });
                            } else {
                              const percent = Math.min(value, 100);
                              setDiscountPercent(percent);
                              setFormData({
                                ...formData,
                                discount: Math.round((subtotal * percent) / 100),
                              });
                            }
                          }}
                          className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                          min="0"
                          max={discountType === "amount" ? subtotal : 100}
                        />
                        <select
                          value={discountType}
                          onChange={(e) => {
                            const newType = e.target.value as
                              | "amount"
                              | "percent";
                            setDiscountType(newType);
                            setFormData({
                              ...formData,
                              discount: 0,
                            });
                            setDiscountPercent(0);
                          }}
                          className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                        >
                          <option value="amount">đ</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </div>

                    {/* Quick percent buttons */}
                    {discountType === "percent" && (
                      <div className="flex gap-1 justify-end mt-2">
                        {[5, 10, 15, 20].map((percent) => (
                          <button
                            key={percent}
                            onClick={() => {
                              setDiscountPercent(percent);
                              setFormData({
                                ...formData,
                                discount: Math.round((subtotal * percent) / 100),
                              });
                            }}
                            className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 rounded transition-colors"
                          >
                            {percent}%
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Show amount if percent mode */}
                    {discountType === "percent" && discountPercent > 0 && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 text-right mt-1">
                        = {formatCurrency(formData.discount || 0)}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t-2 border-slate-400 dark:border-slate-500">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                        Tổng cộng:
                      </span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(total)}
                      </span>
                    </div>

                    {/* Show payment breakdown if there's deposit or partial payment */}
                    {(totalDeposit > 0 || totalAdditionalPayment > 0) && (
                      <div className="space-y-1 pt-2 border-t border-slate-300 dark:border-slate-600">
                        {totalDeposit > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-green-600 dark:text-green-400">
                              Đã đặt cọc:
                            </span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              -{formatCurrency(totalDeposit)}
                            </span>
                          </div>
                        )}
                        {totalAdditionalPayment > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-green-600 dark:text-green-400">
                              Thanh toán thêm:
                            </span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              -{formatCurrency(totalAdditionalPayment)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-300 dark:border-slate-600">
                          <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {remainingAmount > 0
                              ? "Còn phải thu:"
                              : "Đã thanh toán đủ"}
                          </span>
                          <span
                            className={`text-lg font-bold ${remainingAmount > 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                              }`}
                          >
                            {formatCurrency(remainingAmount)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <button
                  onClick={handleSaveOnly}
                  className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium"
                >
                  Lưu Phiếu
                </button>

                {formData.status !== "Trả máy" && showDepositInput && (
                  <button
                    onClick={() => handleSave()}
                    className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  >
                    Đặt cọc
                  </button>
                )}

                {formData.status === "Trả máy" && (
                  <button
                    onClick={handlePayFull}
                    className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
                  >
                    Thanh toán
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg"
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="hidden border-t border-slate-200 dark:border-slate-700 px-4 py-4 md:px-6 items-center justify-end gap-3 bg-white md:bg-slate-50 dark:bg-slate-800/70 md:dark:bg-slate-800/50 rounded-b-xl flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg"
            >
              Hủy
            </button>

            {/* Always show "Lưu Phiếu" */}
            <button
              onClick={handleSaveOnly}
              className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium"
            >
              Lưu Phiếu
            </button>

            {/* Show "Đặt cọc" button only when status is NOT "Trả máy" and deposit input is shown */}
            {formData.status !== "Trả máy" && showDepositInput && (
              <button
                onClick={() => handleSave()}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Đặt cọc
              </button>
            )}

            {/* Show "Thanh toán" button only when status is "Trả máy" */}
            {formData.status === "Trả máy" && (
              <button
                onClick={handlePayFull}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Thanh toán
              </button>
            )}
          </div>
        </div>

        {/* Add Customer Modal */}
        {showAddCustomerModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md p-6 m-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Thêm khách hàng
                </h3>
                <button
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    setNewCustomer({
                      name: "",
                      phone: "",
                      vehicleModel: "",
                      licensePlate: "",
                    });
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Đóng"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tên khách
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập tên khách"
                    value={newCustomer.name}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    placeholder="VD: 09xxxx"
                    value={newCustomer.phone}
                    onChange={(e) =>
                      setNewCustomer({ ...newCustomer, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative vehicle-search-container">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Dòng xe
                    </label>
                    <input
                      type="text"
                      placeholder="Chọn hoặc nhập dòng xe"
                      value={newCustomer.vehicleModel}
                      onChange={(e) => {
                        setNewCustomer({
                          ...newCustomer,
                          vehicleModel: e.target.value,
                        });
                        setShowVehicleDropdown(true);
                      }}
                      onFocus={() => setShowVehicleDropdown(true)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    />

                    {/* Vehicle Model Dropdown */}
                    {showVehicleDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                        {POPULAR_DEVICES.filter((model) =>
                          model
                            .toLowerCase()
                            .includes(newCustomer.vehicleModel.toLowerCase())
                        ).map((model: string) => (
                          <button
                            key={model}
                            type="button"
                            onClick={() => {
                              setNewCustomer({
                                ...newCustomer,
                                vehicleModel: model,
                              });
                              setShowVehicleDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 text-sm border-b border-slate-200 dark:border-slate-600 last:border-0 text-slate-900 dark:text-slate-100"
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Serial Number / IMEI
                    </label>
                    <input
                      type="text"
                      placeholder="VD: SN12345678"
                      value={newCustomer.licensePlate}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          licensePlate: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    setNewCustomer({
                      name: "",
                      phone: "",
                      vehicleModel: "",
                      licensePlate: "",
                    });
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    if (newCustomer.name && newCustomer.phone) {
                      // Check if customer already exists
                      const existingCustomer = customers.find(
                        (c) => c.phone === newCustomer.phone
                      );

                      if (!existingCustomer) {
                        // Customer doesn't exist - create new one

                        const customerId = `CUST-${Date.now()}`;
                        const vehicleId = `VEH-${Date.now()}`;
                        const vehicles = [];
                        if (
                          newCustomer.vehicleModel ||
                          newCustomer.licensePlate
                        ) {
                          vehicles.push({
                            id: vehicleId,
                            model: newCustomer.vehicleModel || "",
                            licensePlate: newCustomer.licensePlate || "",
                            isPrimary: true,
                          });
                        }

                        upsertCustomer({
                          id: customerId,
                          name: newCustomer.name,
                          phone: newCustomer.phone,
                          vehicles: vehicles.length > 0 ? vehicles : undefined,
                          vehicleModel: newCustomer.vehicleModel,
                          licensePlate: newCustomer.licensePlate,
                          created_at: new Date().toISOString(),
                        });

                        // Set the new customer to the form AND search field
                        setFormData({
                          ...formData,
                          customerName: newCustomer.name,
                          customerPhone: newCustomer.phone,
                          vehicleId: vehicles.length > 0 ? vehicleId : undefined,
                          vehicleModel: newCustomer.vehicleModel,
                          licensePlate: newCustomer.licensePlate,
                        });
                      } else {
                        // Customer exists - just use existing customer and optionally update vehicle

                        const hasVehicleChange =
                          (newCustomer.vehicleModel &&
                            newCustomer.vehicleModel !==
                            existingCustomer.vehicleModel) ||
                          (newCustomer.licensePlate &&
                            newCustomer.licensePlate !==
                            existingCustomer.licensePlate);

                        let vehicleIdToUse = existingCustomer.vehicles?.[0]?.id;

                        if (hasVehicleChange) {
                          const vehicleId = `VEH-${Date.now()}`;
                          const vehicles = [...(existingCustomer.vehicles || [])];

                          // Check if vehicle with this license plate already exists
                          const existingVehicleIndex = vehicles.findIndex(
                            (v) => v.licensePlate === newCustomer.licensePlate
                          );

                          if (
                            existingVehicleIndex >= 0 &&
                            newCustomer.licensePlate
                          ) {
                            // Update existing vehicle
                            vehicles[existingVehicleIndex] = {
                              ...vehicles[existingVehicleIndex],
                              model:
                                newCustomer.vehicleModel ||
                                vehicles[existingVehicleIndex].model,
                            };
                            vehicleIdToUse = vehicles[existingVehicleIndex].id;
                          } else if (
                            newCustomer.vehicleModel ||
                            newCustomer.licensePlate
                          ) {
                            // Add new vehicle
                            vehicles.push({
                              id: vehicleId,
                              model: newCustomer.vehicleModel || "",
                              licensePlate: newCustomer.licensePlate || "",
                              isPrimary: vehicles.length === 0,
                            });
                            vehicleIdToUse = vehicleId;
                          }

                          upsertCustomer({
                            ...existingCustomer,
                            vehicles: vehicles.length > 0 ? vehicles : undefined,
                            vehicleModel:
                              newCustomer.vehicleModel ||
                              existingCustomer.vehicleModel,
                            licensePlate:
                              newCustomer.licensePlate ||
                              existingCustomer.licensePlate,
                          });
                        }

                        // Set the existing customer to the form
                        setFormData({
                          ...formData,
                          customerName: existingCustomer.name,
                          customerPhone: existingCustomer.phone,
                          vehicleId: vehicleIdToUse,
                          vehicleModel:
                            newCustomer.vehicleModel ||
                            existingCustomer.vehicleModel,
                          licensePlate:
                            newCustomer.licensePlate ||
                            existingCustomer.licensePlate,
                        });
                      }

                      // Update customer search to show the name
                      setCustomerSearch(newCustomer.name);

                      // Close modal and reset
                      setShowAddCustomerModal(false);
                      setNewCustomer({
                        name: "",
                        phone: "",
                        vehicleModel: "",
                        licensePlate: "",
                      });
                    }
                  }}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  disabled={!newCustomer.name || !newCustomer.phone}
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Vehicle Modal */}
        {showAddVehicleModal && currentCustomer && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Thêm thiết bị cho {currentCustomer.name}
              </h3>

              <div className="space-y-4 mb-6">
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Tên thiết bị (Model) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: iPhone 15 Pro, Dell XPS..."
                    value={newVehicle.model}
                    onChange={(e) => {
                      setNewVehicle({ ...newVehicle, model: e.target.value });
                      setShowAddVehicleModelDropdown(true);
                    }}
                    onFocus={() => setShowAddVehicleModelDropdown(true)}
                    onBlur={() =>
                      setTimeout(() => setShowAddVehicleModelDropdown(false), 200)
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    autoFocus
                  />
                  {showAddVehicleModelDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {POPULAR_DEVICES.filter((model) =>
                        model
                          .toLowerCase()
                          .includes(newVehicle.model.toLowerCase())
                      )
                        .slice(0, 20)
                        .map((model, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setNewVehicle({ ...newVehicle, model });
                              setShowAddVehicleModelDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 text-sm border-b border-slate-200 dark:border-slate-600 last:border-0 text-slate-900 dark:text-slate-100"
                          >
                            {model}
                          </button>
                        ))}
                      {POPULAR_DEVICES.filter((model) =>
                        model
                          .toLowerCase()
                          .includes(newVehicle.model.toLowerCase())
                      ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                            Không tìm thấy - nhập tên thiết bị mới
                          </div>
                        )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Serial Number / IMEI <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 356988..."
                    value={newVehicle.licensePlate}
                    onChange={(e) =>
                      setNewVehicle({
                        ...newVehicle,
                        licensePlate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                  🔹 Xe mới sẽ tự động được chọn sau khi thêm
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowAddVehicleModal(false);
                    setNewVehicle({ model: "", licensePlate: "" });
                    setShowAddVehicleModelDropdown(false);
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddVehicle}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  disabled={
                    !newVehicle.model.trim() || !newVehicle.licensePlate.trim()
                  }
                >
                  Thêm xe
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

export default WorkOrderModal;
