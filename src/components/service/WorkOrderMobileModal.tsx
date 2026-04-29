import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  X,
  Plus,
  Minus,
  Check,
  Search,
  AlertTriangle,
  Printer,
  Share2,
  User,
  Bike,
  Wrench,
  FileText,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  Smartphone,
  PhoneCall,
  ChevronRight,
  TrendingUp,
  UserPlus,
  Package,
  ScanBarcode,
  Lock,
  Grid3x3,
  DollarSign,
} from "lucide-react";
import { useCheckWarranty } from "../../hooks/useWarrantyRepository";
import { ScannerModal } from "../common/ScannerModal";
import { AndroidPatternLock } from "../common/AndroidPatternLock";
import { formatCurrency, formatWorkOrderId, normalizeSearchText } from "../../utils/format";
import { getCategoryColor } from "../../utils/categoryColors";
import type {
  Employee,
  ServiceConfig,
  WorkOrder,
  Part,
  Customer,
  Vehicle,
} from "../../types";
import {
  checkVehicleMaintenance,
  type MaintenanceWarning,
} from "../../utils/maintenanceReminder";
import { WORK_ORDER_STATUS, type WorkOrderStatus } from "../../constants";
import { NumberInput } from "../common/NumberInput";
import { showToast } from "../../utils/toast";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useServiceConfigs } from "../../hooks/useRepairLabor";
import {
  buildDefaultWorkerSplit,
  calculateLabor,
  splitWorkerAmount,
} from "../../lib/services/repairLaborService";
import CustomerModal from "../customer/CustomerModal";
import { POPULAR_DEVICES } from "../../constants/devices";
import { DevicePhotoGallery } from "../common/DevicePhotoGallery";
import { compressImage } from "../../utils/imageCompressor";
import { uploadDevicePhoto, deleteDevicePhoto } from "../../lib/storage/devicePhotosStorage";

interface WorkOrderMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workOrderData: any) => Promise<void> | void;
  workOrder?: WorkOrder | null;
  customers: Customer[];
  parts: Part[];
  employees: Employee[];
  currentBranchId: string;
  upsertCustomer?: (customer: any) => void;
  viewMode?: boolean; // true = xem chi tiết, false = chỉnh sửa
  onSwitchToEdit?: () => void; // callback khi bấm nút chỉnh sửa từ view mode
  canUpdateWorkOrderStatus?: boolean;
  canUpdateWorkOrderPayment?: boolean;
  canUpdateWorkOrderParts?: boolean;
  canUpdateWorkOrderLabor?: boolean;
  canUpdateWorkOrderDiscount?: boolean;
  canUpdateWorkOrderCustomer?: boolean;
  canUpdateWorkOrderVehicle?: boolean;
  canUpdateWorkOrderOutsourceService?: boolean;
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
  id: `mobile-labor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

export const WorkOrderMobileModal: React.FC<WorkOrderMobileModalProps> = ({
  isOpen,
  onClose,
  onSave,
  workOrder,
  customers,
  parts,
  employees,
  currentBranchId,
  upsertCustomer,
  viewMode = false,
  onSwitchToEdit,
  canUpdateWorkOrderStatus = true,
  canUpdateWorkOrderPayment = true,
  canUpdateWorkOrderParts = true,
  canUpdateWorkOrderLabor = true,
  canUpdateWorkOrderDiscount = true,
  canUpdateWorkOrderCustomer = true,
  canUpdateWorkOrderVehicle = true,
  canUpdateWorkOrderOutsourceService = true,
}) => {
  const { profile } = useAuth();
  const { data: serviceConfigs = [] } = useServiceConfigs();
  const showLegacyRepairSection =
    import.meta.env.VITE_ENABLE_MOBILE_REPAIR_SECTION === "1";
  // POPULAR_DEVICES is imported from ../../constants/devices

  const [isPatternMode, setIsPatternMode] = useState(false);

  // Find customer and vehicle from workOrder data
  const initialCustomer = useMemo(() => {
    if (!workOrder) return null;
    const foundCustomer = customers.find(
      (c) =>
        c.phone === workOrder.customerPhone || c.name === workOrder.customerName
    );

    // If not found, create a temporary customer object from workOrder data
    if (!foundCustomer && workOrder.customerName) {
      return {
        id: `temp-${Date.now()}`,
        name: workOrder.customerName,
        phone: workOrder.customerPhone || "",
        vehicles: workOrder.licensePlate
          ? [
            {
              id: `temp-veh-${Date.now()}`,
              licensePlate: workOrder.licensePlate, // Will be displayed as Serial/IMEI
              model: workOrder.vehicleModel || "", // Will be displayed as Device Name
            },
          ]
          : [],
      } as Customer;
    }

    // If found customer, check if workOrder's vehicle exists in customer's vehicles
    // If not, add it as a temporary vehicle
    if (foundCustomer && workOrder.licensePlate) {
      const vehicleExists = foundCustomer.vehicles?.some(
        (v) => v.licensePlate === workOrder.licensePlate
      );

      if (!vehicleExists) {
        // Clone customer and add temp vehicle
        return {
          ...foundCustomer,
          vehicles: [
            ...(foundCustomer.vehicles || []),
            {
              id: `temp-veh-${Date.now()}`,
              licensePlate: workOrder.licensePlate,
              model: workOrder.vehicleModel || "",
            },
          ],
        } as Customer;
      }
    }

    return foundCustomer || null;
  }, [workOrder, customers]);

  const initialVehicles = useMemo(() => {
    if (!initialCustomer?.vehicles) return [];
    return initialCustomer.vehicles;
  }, [initialCustomer]);

  const initialVehicle = useMemo(() => {
    if (!workOrder) return null;
    if (!initialVehicles.length) return null;

    // Try to find by license plate first
    let foundVehicle = initialVehicles.find(
      (v) => v.licensePlate === workOrder.licensePlate
    );

    // If not found by license plate, try by model
    if (!foundVehicle && workOrder.vehicleModel) {
      foundVehicle = initialVehicles.find(
        (v) => v.model === workOrder.vehicleModel
      );
    }

    // If still not found, use first vehicle or create temp vehicle from workOrder data
    if (!foundVehicle) {
      if (workOrder.licensePlate || workOrder.vehicleModel) {
        return {
          id: `temp-veh-${Date.now()}`,
          licensePlate: workOrder.licensePlate || "",
          model: workOrder.vehicleModel || "",
          customerId: initialCustomer?.id || "",
        } as Vehicle;
      }
      return initialVehicles[0] || null;
    }

    return foundVehicle;
  }, [workOrder, initialVehicles, initialCustomer]);

  // States
  const [status, setStatus] = useState<WorkOrderStatus>(
    (workOrder?.status as WorkOrderStatus) || WORK_ORDER_STATUS.RECEIVED
  );
  const isStaffRole =
    String(profile?.role || "").trim().toLowerCase() === "staff";
  const defaultTechnicianId = useMemo(() => {
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
    if (matchedByEmail?.id) return matchedByEmail.id;

    const matchedByName = activeEmployees.find(
      (emp) =>
        String(emp?.name || "")
          .trim()
          .toLowerCase() === normalizedProfileName
    );
    return matchedByName?.id || "";
  }, [employees, profile?.email, profile?.name, profile?.full_name]);
  const technicianIdFromWorkOrder = useMemo(
    () => employees.find((e) => e.name === workOrder?.technicianName)?.id || "",
    [employees, workOrder?.technicianName]
  );
  const isTechnicianLockedForStaff = isStaffRole && !!defaultTechnicianId;
  const [selectedTechnicianId, setSelectedTechnicianId] = useState(
    technicianIdFromWorkOrder || defaultTechnicianId || ""
  );
  const effectiveSelectedTechnicianId =
    (isTechnicianLockedForStaff ? defaultTechnicianId : selectedTechnicianId) || "";
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Update selectedCustomer and selectedVehicle when workOrder changes
  React.useEffect(() => {

    if (workOrder) {
      setSelectedCustomer(initialCustomer);
      setSelectedVehicle(initialVehicle);
      setSelectedTechnicianId(technicianIdFromWorkOrder || defaultTechnicianId || "");

      // Load Password/Pattern from issueDescription/notes
      let password = "";
      let description = workOrder.issueDescription || "";

      const pwdMatch = description.match(/\[Mật khẩu\/Pattern\]:\s*(.*)/);
      if (pwdMatch) {
        password = pwdMatch[1];
        // Optional: Remove password from displayed description if you want to hide it from the textarea
        description = description.replace(/(\n)*\[Mật khẩu\/Pattern\]:.*$/s, "").trim();
        setIssueDescription(description); // Update description state without the password tag
      } else {
        setIssueDescription(description);
      }

      if (password) {
        setCurrentKm(password);
        if (password.startsWith("Pattern:")) {
          setIsPatternMode(true);
        }
      } else if (workOrder.currentKm) {
        setCurrentKm(workOrder.currentKm.toString());
      } else if (initialVehicle?.currentKm) {
        setCurrentKm(initialVehicle.currentKm.toString());
      }
      // Nếu đang edit và có initialCustomer, ẩn form tìm kiếm
      setShowCustomerSearch(!initialCustomer);

      // Sync deposit amount từ workOrder (để hiển thị số tiền đã đặt cọc)
      if (workOrder.depositAmount && workOrder.depositAmount > 0) {
        setDepositAmount(workOrder.depositAmount);
        setIsDeposit(true);
      } else {
        setDepositAmount(0);
        setIsDeposit(false);
      }

      // Sync additional payment from existing order (desktop parity)
      if (workOrder.additionalPayment && workOrder.additionalPayment > 0) {
        setPartialAmount(workOrder.additionalPayment);
        setShowPaymentInput(true);
      } else {
        setPartialAmount(0);
        setShowPaymentInput(false);
      }

      setIncludeIntegratedLabor(true);
    } else {
      setSelectedCustomer(null);
      setSelectedVehicle(null);
      setSelectedTechnicianId(defaultTechnicianId || "");
      setCurrentKm("");
      setShowCustomerSearch(true);
      setDepositAmount(0);
      setIsDeposit(false);
      setPartialAmount(0);
      setShowPaymentInput(false);
      setIncludeIntegratedLabor(true);
    }
  }, [
    workOrder,
    initialCustomer,
    initialVehicle,
    technicianIdFromWorkOrder,
    defaultTechnicianId,
  ]);

  useEffect(() => {
    if (!isTechnicianLockedForStaff) return;
    if (selectedTechnicianId === defaultTechnicianId) return;
    setSelectedTechnicianId(defaultTechnicianId);
  }, [
    isTechnicianLockedForStaff,
    selectedTechnicianId,
    defaultTechnicianId,
  ]);

  const [currentKm, setCurrentKm] = useState(
    workOrder?.currentKm?.toString() || ""
  );
  const [issueDescription, setIssueDescription] = useState(
    workOrder?.issueDescription || ""
  );
  
  const [devicePhotos, setDevicePhotos] = useState<string[]>(
    workOrder?.devicePhotos || []
  );
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const [selectedParts, setSelectedParts] = useState<
    Array<{
      partId: string;
      partName: string;
      quantity: number;
      sellingPrice: number;
      costPrice?: number;
      sku?: string;
      category?: string;
      warrantyPeriod?: string;
    }>
  >(
    workOrder?.partsUsed?.map((p) => ({
      partId: p.partId || `manual-loaded-${Math.random().toString(36).substr(2, 9)}`,
      partName: p.partName,
      quantity: p.quantity,
      sellingPrice: p.price || 0,
      costPrice: p.costPrice || 0,
      sku: p.sku || "",
      category: p.category || "",
      warrantyPeriod: String(
        (p as any).warrantyPeriod ??
          (p as any).warrantyperiod ??
          (p as any).warranty_period ??
          (p as any).warranty ??
          ""
      ).trim(),
    })) || []
  );
  const [additionalServices, setAdditionalServices] = useState<
    Array<{
      id: string;
      name: string;
      quantity: number;
      costPrice: number;
      sellingPrice: number;
    }>
  >(
    workOrder?.additionalServices?.map((s) => ({
      id: s.id || `srv-${Date.now()}-${Math.random()}`,
      name: s.description || "",
      quantity: s.quantity || 1,
      costPrice: s.costPrice || 0,
      sellingPrice: s.price || 0,
    })) || []
  );
  const [repairServices, setRepairServices] = useState<RepairServiceDraft[]>(
    workOrder?.repairServices?.map((service) => ({
      id: service.id,
      serviceId: service.serviceId,
      serviceName: service.serviceName,
      laborCalcType: service.laborCalcType,
      laborFixedAmount: service.laborFixedAmount,
      laborPercentOfCost: service.laborPercentOfCost,
      minimumLaborAmount: service.minimumLaborAmount,
      defaultWorkerSharePercent: service.workerSharePercent || 30,
      manualLabor: service.laborCalcType === "manual" ? service.laborAmount : 0,
      relatedItemIds: (service.relatedItems || []).map((item) => item.partId),
      workers: (service.workers || []).map((worker) => ({
        worker_id: worker.workerId,
        worker_name: worker.workerName || "",
        share_percent: worker.sharePercent,
      })),
      isBillable: service.isBillable,
      isPayableToWorker: service.isPayableToWorker,
      note: service.note || "",
    })) || []
  );
  const [newRepairServiceDraft, setNewRepairServiceDraft] = useState<RepairServiceDraft>(
    createEmptyRepairServiceDraft()
  );
  const [includeIntegratedLabor, setIncludeIntegratedLabor] = useState(true);
  const [, setLaborCost] = useState(workOrder?.laborCost || 0);
  const [discount, setDiscount] = useState(workOrder?.discount || 0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  );
  const [isDeposit, setIsDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [partialAmount, setPartialAmount] = useState(0);

  // UI States - khởi tạo showCustomerSearch dựa trên initialCustomer để đảm bảo đúng khi edit
  const [showCustomerSearch, setShowCustomerSearch] = useState(
    !initialCustomer
  );
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  // Server-side search state
  const [serverCustomers, setServerCustomers] = useState<Customer[]>([]);
  const debouncedCustomerSearch = useDebouncedValue(customerSearchTerm, 500);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerPage, setCustomerPage] = useState(0);
  const [hasMoreCustomers, setHasMoreCustomers] = useState(true);

  // Warranty checker
  const { data: activeWarranty } = useCheckWarranty(
    selectedVehicle?.licensePlate, // IMEI/Serial
    selectedCustomer?.phone,
    selectedVehicle?.model
  );

  const CUSTOMER_PAGE_SIZE = 20;
  const [showPartSearch, setShowPartSearch] = useState(false);
  const [partSearchTerm, setPartSearchTerm] = useState("");
  const [activeScanField, setActiveScanField] = useState<"part" | "vehicle" | "customer" | null>(null);

  // Ref for part search results scrolling
  const partResultsRef = useRef<HTMLDivElement>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState(0);
  const [newServiceQuantity, setNewServiceQuantity] = useState(1);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehiclePlate, setNewVehiclePlate] = useState("");
  const [newVehicleName, setNewVehicleName] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerVehicleModel, setNewCustomerVehicleModel] = useState("");
  const [newCustomerLicensePlate, setNewCustomerLicensePlate] = useState("");

  // State for manual parts entry
  const [showAddManualPart, setShowAddManualPart] = useState(false);
  const [newManualPartName, setNewManualPartName] = useState("");
  const [newManualPartCost, setNewManualPartCost] = useState(0);
  const [newManualPartPrice, setNewManualPartPrice] = useState(0);
  const [newManualPartQuantity, setNewManualPartQuantity] = useState(1);

  // State for vehicle model dropdowns
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [showCustomerVehicleDropdown, setShowCustomerVehicleDropdown] =
    useState(false);

  // State for editing existing customer
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");

  // State for preventing duplicate submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper functions for number formatting
  const formatNumberWithDots = (value: number | string): string => {
    if (value === 0 || value === "0") return "0";
    if (!value) return "";
    const numStr = value.toString().replace(/\D/g, "");
    if (!numStr) return "";
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseFormattedNumber = (value: string): number => {
    const cleaned = value.replace(/\./g, "");
    return cleaned ? Number(cleaned) : 0;
  };

  // Tabs state for mobile form
  const [activeSection, setActiveSection] = useState<"info" | "issue" | "parts" | "payment">("info");

  // Intentionally re-initialize only when modal opens or switching to another work order.
  useEffect(() => {
    if (!isOpen) return;

    setStatus((workOrder?.status as WorkOrderStatus) || WORK_ORDER_STATUS.RECEIVED);

    setSelectedParts(
      (workOrder?.partsUsed || []).map((p) => ({
        partId: p.partId || `manual-loaded-${Math.random().toString(36).substr(2, 9)}`,
        partName: p.partName,
        quantity: p.quantity,
        sellingPrice: p.price || 0,
        costPrice: p.costPrice || 0,
        sku: p.sku || "",
        category: p.category || "",
      }))
    );

    setAdditionalServices(
      (workOrder?.additionalServices || []).map((s) => ({
        id: s.id || `srv-${Date.now()}-${Math.random()}`,
        name: s.description || "",
        quantity: s.quantity || 1,
        costPrice: s.costPrice || 0,
        sellingPrice: s.price || 0,
      }))
    );

    setRepairServices(
      (workOrder?.repairServices || []).map((service) => ({
        id: service.id,
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        laborCalcType: service.laborCalcType,
        laborFixedAmount: service.laborFixedAmount,
        laborPercentOfCost: service.laborPercentOfCost,
        minimumLaborAmount: service.minimumLaborAmount,
        defaultWorkerSharePercent: service.workerSharePercent || 30,
        manualLabor: service.laborCalcType === "manual" ? service.laborAmount : 0,
        relatedItemIds: (service.relatedItems || []).map((item) => item.partId),
        workers: (service.workers || []).map((worker) => ({
          worker_id: worker.workerId,
          worker_name: worker.workerName || "",
          share_percent: worker.sharePercent,
        })),
        isBillable: service.isBillable,
        isPayableToWorker: service.isPayableToWorker,
        note: service.note || "",
      }))
    );

    setLaborCost(workOrder?.laborCost || 0);
    setDiscount(workOrder?.discount || 0);
    setDiscountType("amount");
    setPaymentMethod(
      workOrder?.paymentMethod === "bank" || workOrder?.paymentMethod === "cash"
        ? workOrder.paymentMethod
        : "cash"
    );
    setNewRepairServiceDraft(createEmptyRepairServiceDraft());
    setActiveSection("info");
  }, [isOpen, workOrder?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSelectedPartCost = useCallback((partId: string) => {
    const part = selectedParts.find((item) => item.partId === partId);
    if (!part) return 0;
    return Number(part.costPrice || 0) * Number(part.quantity || 0);
  }, [selectedParts]);

  const getPartLaborBase = useCallback((partId: string) => {
    const partRef = parts.find((p) => p.id === partId);
    return (
      Number((partRef as any)?.laborCost?.[currentBranchId]) ||
      Number(partRef?.wholesalePrice?.[currentBranchId]) ||
      0
    );
  }, [parts, currentBranchId]);

  const getPartWarranty = (partId: string) => {
    const partRef = parts.find((p) => p.id === partId);
    return getWarrantyText(partRef);
  };

  const getWarrantyForWorkOrderPart = (part: any): string => {
    const ownWarranty = String(
      part?.warrantyPeriod ??
        part?.warrantyperiod ??
        part?.warranty_period ??
        part?.warranty ??
        ""
    ).trim();
    if (ownWarranty) return ownWarranty;

    const rawPartId = String(part?.partId ?? part?.partid ?? "").trim();
    if (rawPartId) {
      const partById = parts.find((item) => String(item.id) === rawPartId);
      const byIdWarranty = getWarrantyText(partById);
      if (byIdWarranty) return byIdWarranty;
    }

    const rawSku = String(part?.sku || "").trim();
    if (rawSku) {
      const partBySku = parts.find(
        (item) => String(item.sku || "").trim() === rawSku
      );
      const bySkuWarranty = getWarrantyText(partBySku);
      if (bySkuWarranty) return bySkuWarranty;
    }

    const rawName = String(part?.partName || "").trim().toLowerCase();
    if (rawName) {
      const partByName = parts.find(
        (item) => String(item.name || "").trim().toLowerCase() === rawName
      );
      const byNameWarranty = getWarrantyText(partByName);
      if (byNameWarranty) return byNameWarranty;
    }

    return "";
  };

  // Keep rule same as desktop: qty1=100%, qty2=150%, qty3=200%...
  const getIntegratedLaborByQuantity = (laborBase: number, quantity: number) => {
    if (laborBase <= 0 || quantity <= 0) return 0;
    return laborBase * (1 + 0.5 * (quantity - 1));
  };

  const getRepairServiceLaborAmount = useCallback((service: RepairServiceDraft) =>
    calculateLabor(
      {
        labor_calc_type: service.laborCalcType,
        labor_fixed_amount: service.laborFixedAmount,
        labor_percent_of_cost: service.laborPercentOfCost,
        minimum_labor_amount: service.minimumLaborAmount,
      },
      service.relatedItemIds.reduce((sum, partId) => sum + getSelectedPartCost(partId), 0),
      service.manualLabor
    ), [getSelectedPartCost]);

  const getRepairServiceWorkers = (service: RepairServiceDraft) => {
    if (service.workers.length > 0) return service.workers;
    const mainTechnician = employees.find(
      (employee) => employee.id === effectiveSelectedTechnicianId
    )?.name;
    return buildDefaultWorkerSplit(
      employees,
      mainTechnician,
      service.defaultWorkerSharePercent
    );
  };

  const _repairLaborTotal = useMemo(
    () =>
      repairServices.reduce(
        (sum, service) =>
          sum + (service.isBillable ? getRepairServiceLaborAmount(service) : 0),
        0
      ),
    [repairServices, getRepairServiceLaborAmount]
  );

  // Combined fetch function
  const fetchCustomers = async (page: number, searchTerm: string, isLoadMore = false) => {
    if (!searchTerm || !searchTerm.trim()) {
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
            return [...filteredPrev, ...data as Customer[]];
          });
        } else {
          setServerCustomers(data as Customer[]);
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
    // Reset page when search term changes
    setCustomerPage(0);
    setHasMoreCustomers(true);

    // Only fetch if has search term
    if (debouncedCustomerSearch && debouncedCustomerSearch.trim()) {
      fetchCustomers(0, debouncedCustomerSearch.trim(), false);
    } else {
      setServerCustomers([]);
    }
  }, [debouncedCustomerSearch]);

  // Handler for Load More button
  const handleLoadMoreCustomers = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextPage = customerPage + 1;
    setCustomerPage(nextPage);
    fetchCustomers(nextPage, debouncedCustomerSearch.trim(), true);
  };

  // Filtered customers (combining local and server results)
  const filteredCustomers = useMemo(() => {
    // Merge local customers and server customers, removing duplicates by ID
    const allCandidates = [...customers, ...serverCustomers];
    const uniqueCandidates = Array.from(new Map(allCandidates.map(c => [c.id, c])).values());

    if (!customerSearchTerm) return uniqueCandidates;
    const term = normalizeSearchText(customerSearchTerm);
    const filtered = uniqueCandidates.filter(
      (c) =>
        normalizeSearchText(c.name).includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        (c.vehicles &&
          c.vehicles.some((v: any) =>
            normalizeSearchText(v.licensePlate).includes(term) ||
            v.licensePlate?.toLowerCase().includes(term.toLowerCase())
          ))
    );
    return filtered;
  }, [customers, serverCustomers, customerSearchTerm]);

  // Filtered parts
  const filteredParts = useMemo(() => {
    if (!partSearchTerm) return parts;
    const term = partSearchTerm.toLowerCase();
    return parts.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term)
    );
  }, [parts, partSearchTerm]);

  // Auto-scroll to top of part results when search term changes and has results
  useEffect(() => {
    if (partSearchTerm && filteredParts.length > 0 && partResultsRef.current) {
      // Scroll to top of results with smooth animation
      partResultsRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [partSearchTerm, filteredParts.length]);

  // Customer vehicles - bao gồm cả xe từ workOrder nếu đang edit
  const customerVehicles = useMemo(() => {
    if (!selectedCustomer) return [];
    const existingVehicles = selectedCustomer.vehicles || [];

    // Nếu đang edit workOrder và có selectedVehicle là temp vehicle (không có trong danh sách)
    // thì thêm nó vào để hiển thị
    if (
      selectedVehicle &&
      !existingVehicles.find((v) => v.id === selectedVehicle.id)
    ) {
      return [...existingVehicles, selectedVehicle];
    }

    return existingVehicles;
  }, [selectedCustomer, selectedVehicle]);

  // Check maintenance warnings for selected vehicle
  const _maintenanceWarnings = useMemo((): MaintenanceWarning[] => {
    if (!selectedVehicle) return [];
    // Update currentKm in vehicle for accurate check
    const vehicleWithKm = {
      ...selectedVehicle,
      currentKm: currentKm ? parseInt(currentKm) : selectedVehicle.currentKm,
    };
    return checkVehicleMaintenance(vehicleWithKm);
  }, [selectedVehicle, currentKm]);

  // Auto-select vehicle if customer has only one and load km
  React.useEffect(() => {
    if (customerVehicles.length === 1 && !selectedVehicle) {
      const vehicle = customerVehicles[0];
      setSelectedVehicle(vehicle);
      // Load currentKm from vehicle if exists
      if (vehicle.currentKm) {
        setCurrentKm(vehicle.currentKm.toString());
      }
    }
  }, [customerVehicles, selectedVehicle]);

  // Calculations
  const partsTotal = useMemo(() => {
    return selectedParts.reduce(
      (sum, p) => sum + p.quantity * p.sellingPrice,
      0
    );
  }, [selectedParts]);

  const servicesTotal = useMemo(() => {
    return additionalServices.reduce((sum, s) => sum + s.sellingPrice * s.quantity, 0);
  }, [additionalServices]);
  const partsLaborInfoTotal = useMemo(() => {
    return selectedParts.reduce((sum, item) => {
      const laborBase = getPartLaborBase(item.partId);
      return sum + getIntegratedLaborByQuantity(laborBase, Number(item.quantity || 0));
    }, 0);
  }, [selectedParts, getPartLaborBase]);

  const effectiveLaborCost = includeIntegratedLabor ? partsLaborInfoTotal : 0;

  const subtotal = partsTotal + servicesTotal + effectiveLaborCost;

  const discountAmount = useMemo(() => {
    if (discountType === "percent") {
      return (subtotal * discount) / 100;
    }
    return discount;
  }, [subtotal, discount, discountType]);

  const total = Math.max(0, subtotal - discountAmount);
  const additionalPaymentPreview =
    status === "Trả máy" && showPaymentInput ? partialAmount : 0;
  const remainingPreview = Math.max(
    0,
    total - (isDeposit ? depositAmount : 0) - additionalPaymentPreview
  );

  useEffect(() => {
    if (status !== "Trả máy") {
      if (showPaymentInput) setShowPaymentInput(false);
      if (partialAmount !== 0) setPartialAmount(0);
      return;
    }

    if (!workOrder) return;

    const hasExistingAdditional = Number(workOrder.additionalPayment || 0) > 0;
    if (hasExistingAdditional) return;

    const fullAmount = Math.max(0, total - (isDeposit ? depositAmount : 0));
    if (!showPaymentInput) setShowPaymentInput(true);
    if (partialAmount !== fullAmount) setPartialAmount(fullAmount);
  }, [
    status,
    workOrder,
    total,
    isDeposit,
    depositAmount,
    showPaymentInput,
    partialAmount,
  ]);

  // Handlers
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomerSearch(false);
    setCustomerSearchTerm("");
    setSelectedVehicle(null);
    setCurrentKm(""); // Reset km when changing customer
    // Reset edit mode
    setIsEditingCustomer(false);
    setEditCustomerName(customer.name);
    setEditCustomerPhone(customer.phone || "");
  };

  // Handle save edited customer info
  const handleSaveEditedCustomer = () => {
    if (!selectedCustomer) return;
    if (!editCustomerName.trim()) {
      alert("Vui lòng nhập tên khách hàng");
      return;
    }
    if (!editCustomerPhone.trim()) {
      alert("Vui lòng nhập số điện thoại");
      return;
    }

    const updatedCustomer = {
      ...selectedCustomer,
      name: editCustomerName.trim(),
      phone: editCustomerPhone.trim(),
    };

    // Save to database if upsertCustomer is available
    if (upsertCustomer) {
      upsertCustomer(updatedCustomer);
    }

    // Update local state
    setSelectedCustomer(updatedCustomer);
    setIsEditingCustomer(false);
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    // Load currentKm from vehicle if exists
    if (vehicle.currentKm) {
      setCurrentKm(vehicle.currentKm.toString());
    } else {
      setCurrentKm("");
    }
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
          quantity: 1,
          sellingPrice: part.retailPrice?.[currentBranchId] || 0,
          costPrice: part.costPrice?.[currentBranchId] || 0,
          sku: part.sku || "",
          category: part.category || "",
          warrantyPeriod: getWarrantyText(part),
        },
      ]);
    }
    setShowPartSearch(false);
    setPartSearchTerm("");
  };

  const handleUpdatePartQuantity = (partId: string, delta: number) => {
    setSelectedParts((prev) =>
      prev
        .map((p) =>
          p.partId === partId ? { ...p, quantity: p.quantity + delta } : p
        )
        .filter((p) => p.quantity > 0)
    );
  };

  const handleRemovePart = (partId: string) => {
    setSelectedParts((prev) => prev.filter((p) => p.partId !== partId));
  };

  const handleAddService = () => {
    if (!newServiceName) return;
    setAdditionalServices([
      ...additionalServices,
      {
        id: `srv-${Date.now()}`,
        name: newServiceName,
        quantity: newServiceQuantity,
        costPrice: 0,
        sellingPrice: newServicePrice,
      },
    ]);
    setNewServiceName("");
    setNewServicePrice(0);
    setNewServiceQuantity(1);
    setShowAddService(false);
  };

  const handleRemoveService = (id: string) => {
    setAdditionalServices(additionalServices.filter((s) => s.id !== id));
  };

  const handleAddManualPart = () => {
    if (!newManualPartName) return;

    setSelectedParts([
      ...selectedParts,
      {
        partId: `manual-${Date.now()}`,
        partName: newManualPartName,
        quantity: newManualPartQuantity,
        sellingPrice: newManualPartPrice,
        costPrice: newManualPartCost,
        sku: "",
        category: "Linh kiện ngoài",
      },
    ]);

    // Reset form
    setNewManualPartName("");
    setNewManualPartCost(0);
    setNewManualPartPrice(0);
    setNewManualPartQuantity(1);
    setShowAddManualPart(false);
  };

  const handleAddVehicle = () => {
    if (!newVehiclePlate || !newVehicleName) return;
    const newVehicle: Vehicle = {
      id: `veh-${Date.now()}`,
      licensePlate: newVehiclePlate,
      model: newVehicleName,
    };

    // Add to customer vehicles
    if (selectedCustomer) {
      const updatedVehicles = [
        ...(selectedCustomer.vehicles || []),
        newVehicle,
      ];

      // Update customer with new vehicle and save to database
      const updatedCustomer = {
        ...selectedCustomer,
        vehicles: updatedVehicles,
      };

      // Save to database via upsertCustomer
      if (upsertCustomer) {
        upsertCustomer(updatedCustomer);
      }

      // Update local state
      setSelectedCustomer(updatedCustomer);
      setSelectedVehicle(newVehicle);
    }

    setNewVehiclePlate("");
    setNewVehicleName("");
    setShowAddVehicle(false);
  };

  const handleAddNewCustomer = () => {
    // Validate required fields (Name, Phone, and Device Name are mandatory for Work Order)
    if (!newCustomerName || !newCustomerPhone || !newCustomerVehicleModel) {
      alert("Vui lòng nhập Tên khách hàng, Số điện thoại và Tên thiết bị");
      return;
    }

    const customerId = `CUST-${Date.now()}`;
    const vehicleId = `VEH-${Date.now()}`;

    // Create vehicles array if vehicle info provided
    const vehicles: Vehicle[] = [];
    if (newCustomerVehicleModel || newCustomerLicensePlate) {
      vehicles.push({
        id: vehicleId,
        model: newCustomerVehicleModel || "",
        licensePlate: newCustomerLicensePlate || "",
        isPrimary: true,
      } as Vehicle);
    }

    // Create new customer object
    const newCustomerObj: Customer = {
      id: customerId,
      name: newCustomerName,
      phone: newCustomerPhone,
      vehicles: vehicles,
      vehicleModel: newCustomerVehicleModel,
      licensePlate: newCustomerLicensePlate,
      status: "active",
      segment: "New",
      loyaltyPoints: 0,
      totalSpent: 0,
      visitCount: 1,
      lastVisit: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    // Save to database if upsertCustomer is available
    if (upsertCustomer) {
      upsertCustomer(newCustomerObj);
    }

    // Set selected customer and vehicle
    setSelectedCustomer(newCustomerObj);
    if (vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }

    // Reset form and close modal
    setShowCustomerSearch(false);
    setShowAddCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerVehicleModel("");
    setNewCustomerLicensePlate("");
    setCustomerSearchTerm("");
  };

  const handleAddDevicePhoto = async (file: File) => {
    try {
      setIsUploadingPhoto(true);
      const compressedBlob = await compressImage(file);
      const tempId = workOrder?.id || `temp_${Date.now()}`;
      const photoUrl = await uploadDevicePhoto(tempId, compressedBlob);
      
      setDevicePhotos(prev => [...prev, photoUrl]);
    } catch (error: any) {
      showToast.error(error.message || "Không thể upload ảnh thiết bị");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemoveDevicePhoto = async (photoUrl: string) => {
    try {
      await deleteDevicePhoto(photoUrl);
      setDevicePhotos(prev => prev.filter(url => url !== photoUrl));
    } catch (error: any) {
      // Still remove from UI even if backend delete fails
      setDevicePhotos(prev => prev.filter(url => url !== photoUrl));
      showToast.error("Không thể xóa ảnh từ hệ thống, đã gỡ khỏi phiếu hiện tại.");
    }
  };

  const handleSave = async (forceFullPayment = false) => {
    // Prevent duplicate submissions
    if (isSubmitting) return;

    if (!selectedCustomer || !selectedVehicle) {
      alert("Vui lòng chọn khách hàng và thiết bị");
      return;
    }

    // Set submitting state to disable buttons
    setIsSubmitting(true);
    const failSafeUnlockTimer = window.setTimeout(() => {
      setIsSubmitting(false);
    }, 20000);

    // Desktop parity: additional payment only applies when status is "Trả máy"
    const totalDeposit = isDeposit ? depositAmount : 0;
    const additionalPayment =
      status === "Trả máy"
        ? forceFullPayment
          ? Math.max(0, total - totalDeposit)
          : showPaymentInput
            ? partialAmount
            : 0
        : 0;
    const totalPaid = totalDeposit + additionalPayment;
    const remainingAmount = Math.max(0, total - totalPaid);

    // Transform parts to use 'price' field (as expected by SQL/types)
    const transformedParts = selectedParts.map((p) => ({
      // If partId is a manual/temp one, send null/undefined to DB to avoid UUID errors if triggered
      partId: p.partId.startsWith("manual-") ? undefined : p.partId,
      partName: p.partName,
      quantity: p.quantity,
      price: p.sellingPrice, // Map sellingPrice to price for SQL
      costPrice: p.costPrice || 0, // Cost price for profit calculation
      sku: p.sku || "",
      category: p.category || "",
      warrantyPeriod: p.warrantyPeriod || getPartWarranty(p.partId) || undefined,
    }));

    // Transform additional services to use 'price' field
    const transformedServices = additionalServices.map((s) => ({
      id: s.id,
      description: s.name,
      quantity: s.quantity,
      price: s.sellingPrice, // Map sellingPrice to price
      costPrice: s.costPrice,
    }));

    const transformedRepairServices = repairServices.map((service) => {
      const laborAmount = getRepairServiceLaborAmount(service);
      const workerSplits = splitWorkerAmount(
        laborAmount,
        getRepairServiceWorkers(service)
      );

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
          return {
            part_id: partId,
            part_name: selectedPart?.partName || "",
            quantity: Number(selectedPart?.quantity || 0),
            unit_cost: Number(selectedPart?.costPrice || 0),
            line_cost: getSelectedPartCost(partId),
          };
        }),
      };
    });

    if (workOrder?.id) {
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
            serviceId: String(item.service_id || item.serviceId || ""),
            serviceName: String(item.service_name || item.serviceName || ""),
            laborAmount: normalizeNumber(item.labor_amount || item.laborAmount),
            relatedItemIds: (item.related_items || item.relatedItems || [])
              .map((related: any) => String(related.part_id || related.partId || ""))
              .sort(),
          }))
          .sort((a, b) =>
            `${a.serviceId}|${a.serviceName}`.localeCompare(
              `${b.serviceId}|${b.serviceName}`
            )
          );

      const statusChanged = status !== workOrder.status;

      const previousDeposit = normalizeNumber(workOrder.depositAmount);
      const previousAdditionalPayment = normalizeNumber(workOrder.additionalPayment);
      const previousPaymentMethod = String(workOrder.paymentMethod || "");
      const currentPaymentMethod = String(paymentMethod || "");
      const paymentChanged =
        previousDeposit !== totalDeposit ||
        previousAdditionalPayment !== additionalPayment ||
        previousPaymentMethod !== currentPaymentMethod;

      const existingPartsSignature = JSON.stringify(
        normalizePartsForCompare(workOrder.partsUsed as any[])
      );
      const currentPartsSignature = JSON.stringify(
        normalizePartsForCompare(transformedParts)
      );

      const existingServicesSignature = JSON.stringify(
        normalizeServicesForCompare(workOrder.additionalServices as any[])
      );
      const currentServicesSignature = JSON.stringify(
        normalizeServicesForCompare(transformedServices)
      );

      const existingRepairServicesSignature = JSON.stringify(
        normalizeRepairServicesForCompare(workOrder.repairServices as any[])
      );
      const currentRepairServicesSignature = JSON.stringify(
        normalizeRepairServicesForCompare(transformedRepairServices)
      );

      const customerChanged =
        String(workOrder.customerName || "") !== String(selectedCustomer?.name || "") ||
        String(workOrder.customerPhone || "") !== String(selectedCustomer?.phone || "");

      const vehicleChanged =
        String(workOrder.vehicleId || "") !== String(selectedVehicle?.id || "") ||
        String(workOrder.vehicleModel || "") !== String(selectedVehicle?.model || "") ||
        String(workOrder.licensePlate || "") !== String(selectedVehicle?.licensePlate || "");

      const partsChanged =
        existingPartsSignature !== currentPartsSignature ||
        existingRepairServicesSignature !== currentRepairServicesSignature;

      const outsourceServicesChanged =
        existingServicesSignature !== currentServicesSignature;

      const laborChanged =
        normalizeNumber(workOrder.laborCost) !== normalizeNumber(effectiveLaborCost);

      const discountChanged =
        normalizeNumber(workOrder.discount) !== normalizeNumber(discountAmount);

      if (statusChanged && !canUpdateWorkOrderStatus) {
        showToast.error("Bạn không có quyền đổi trạng thái phiếu sửa chữa");
        setIsSubmitting(false);
        return;
      }

      if (paymentChanged && !canUpdateWorkOrderPayment) {
        showToast.error("Bạn không có quyền cập nhật thanh toán phiếu sửa chữa");
        setIsSubmitting(false);
        return;
      }

      if (partsChanged && !canUpdateWorkOrderParts) {
        showToast.error("Bạn không có quyền sửa phụ tùng trong phiếu sửa chữa");
        setIsSubmitting(false);
        return;
      }

      if (laborChanged && !canUpdateWorkOrderLabor) {
        showToast.error("Bạn không có quyền sửa tiền công (labor) phiếu sửa chữa");
        setIsSubmitting(false);
        return;
      }

      if (discountChanged && !canUpdateWorkOrderDiscount) {
        showToast.error("Bạn không có quyền sửa giảm giá phiếu sửa chữa");
        setIsSubmitting(false);
        return;
      }

      if (customerChanged && !canUpdateWorkOrderCustomer) {
        showToast.error("Bạn không có quyền sửa thông tin khách hàng trong phiếu sửa chữa");
        setIsSubmitting(false);
        return;
      }

      if (vehicleChanged && !canUpdateWorkOrderVehicle) {
        showToast.error("Bạn không có quyền sửa thông tin thiết bị/xe trong phiếu sửa chữa");
        setIsSubmitting(false);
        return;
      }

      if (outsourceServicesChanged && !canUpdateWorkOrderOutsourceService) {
        showToast.error("Bạn không có quyền tạo/sửa dịch vụ gia công ngoài");
        setIsSubmitting(false);
        return;
      }
    }

    const workOrderData = {
      status,
      technicianId: effectiveSelectedTechnicianId,
      customer: selectedCustomer,
      vehicle: selectedVehicle,
      // FIX: 'currentKm' stores Password/Pattern (string), but DB expects Integer for Odometer.
      // Solution: Do not save to currentKm (pass undefined), instead append to issueDescription.
      currentKm: undefined,
      issueDescription: currentKm
        ? issueDescription + `\n\n[Mật khẩu/Pattern]: ${currentKm}`
        : issueDescription,
      devicePhotos: devicePhotos,
      parts: transformedParts,
      additionalServices: transformedServices,
      repairServices: transformedRepairServices,
      laborCost: effectiveLaborCost,
      discount: discountAmount,
      total: total,
      depositAmount: totalDeposit,
      paymentMethod,
      totalPaid: totalPaid > 0 ? totalPaid : 0,
      remainingAmount,
    };



    // Execute save callback with offline fallback
    try {
      await onSave(workOrderData);
    } catch (error: any) {
      console.error("Error saving work order:", error);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      });

      // Fallback: Save to Local Storage as draft
      const drafts = JSON.parse(localStorage.getItem("offline_drafts") || "[]");
      drafts.push({
        ...workOrderData,
        tempId: `draft-${Date.now()}`,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem("offline_drafts", JSON.stringify(drafts));

      // Show detailed error message
      let errorMessage = "Có lỗi khi lưu";
      if (error?.message) {
        const msg = error.message.toUpperCase();
        if (msg.includes("UNAUTHORIZED")) {
          errorMessage = "❌ Bạn không có quyền tạo phiếu sửa chữa. Vui lòng liên hệ quản lý để được cấp quyền.";
        } else if (msg.includes("BRANCH_MISMATCH")) {
          errorMessage = "❌ Chi nhánh không khớp. Bạn chỉ có thể tạo phiếu cho chi nhánh của mình.";
        } else if (msg.includes("INSUFFICIENT_STOCK") || msg.includes("THIẾU TỒN KHO")) {
          errorMessage = "❌ Tồn kho không đủ cho một hoặc nhiều phụ tùng.";
        } else if (msg.includes("PART_NOT_FOUND")) {
          errorMessage = "❌ Không tìm thấy phụ tùng trong kho.";
        } else {
          errorMessage = `❌ ${error.message}`;
        }
      } else {
        errorMessage = "❌ Lỗi kết nối (Timeout/Mạng). Vui lòng kiểm tra kết nối mạng.";
      }

      alert(errorMessage + "\n\nDữ liệu đã được lưu tạm. Bạn có thể thử lại hoặc chụp màn hình.");
      // onClose(); // Don't close so user can retry
    } finally {
      clearTimeout(failSafeUnlockTimer);
      setIsSubmitting(false);
    }
  };

  const handlePayFull = async () => {
    const remainingToPay = Math.max(0, total - (isDeposit ? depositAmount : 0));
    setShowPaymentInput(true);
    setPartialAmount(remainingToPay);
    await handleSave(true);
  };
  const getStatusColor = (s: WorkOrderStatus) => {
    switch (s) {
      case WORK_ORDER_STATUS.RECEIVED:
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case WORK_ORDER_STATUS.IN_PROGRESS:
        return "bg-orange-500/10 text-orange-400 border-orange-500/30";
      case WORK_ORDER_STATUS.COMPLETED:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case WORK_ORDER_STATUS.DELIVERED:
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  // Hide bottom navigation when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("hide-bottom-nav");
    } else {
      document.body.classList.remove("hide-bottom-nav");
    }

    return () => {
      document.body.classList.remove("hide-bottom-nav");
    };
  }, [isOpen]);

  // Reset submit lock when modal is reopened/closed so next create flow is never stuck.
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
  }, [isOpen, workOrder?.id]);

  if (!isOpen) return null;

  // VIEW MODE - Hiển thị chi tiết phiếu (không cho chỉnh sửa)
  if (viewMode && workOrder) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center">
        {/* Mobile Full Screen */}
        <div className="md:hidden w-full h-full bg-slate-50 dark:bg-[#151521] flex flex-col transition-colors">
          {/* Header */}
          <div className="flex-shrink-0 bg-white dark:bg-[#1e1e2d] px-4 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Chi tiết phiếu
                </h2>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-medium">
                  #{formatWorkOrderId(workOrder.id)}
                </div>
              </div>
            </div>
            {onSwitchToEdit && (
              <button
                onClick={onSwitchToEdit}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Sửa phiếu
              </button>
            )}
          </div>

          {/* Scrollable Content - View Only */}
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#151521]">
            {/* Trạng thái & Thời gian */}
            <div className="p-3 bg-white dark:bg-[#1e1e2d] border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getStatusColor(
                    workOrder.status as any
                  )}`}
                >
                  {workOrder.status}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(workOrder.creationDate).toLocaleDateString("vi-VN")}{" "}
                  {new Date(workOrder.creationDate).toLocaleTimeString(
                    "vi-VN",
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </span>
              </div>
              {workOrder.technicianName && (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  KTV:{" "}
                  <span className="font-medium text-slate-900 dark:text-white">
                    {workOrder.technicianName}
                  </span>
                </div>
              )}
            </div>

            {/* Thông tin khách hàng */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                KHÁCH HÀNG
              </h3>
              <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 space-y-2 border border-slate-200 dark:border-transparent">
                <div className="flex items-center justify-between">
                  <span className="text-slate-900 dark:text-white font-medium">
                    {workOrder.customerName || "—"}
                  </span>
                  {workOrder.customerPhone && (
                    <a
                      href={`tel:${workOrder.customerPhone}`}
                      className="text-blue-600 dark:text-blue-400 text-sm flex items-center gap-1.5"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      {workOrder.customerPhone}
                    </a>
                  )}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-slate-400" />
                  {workOrder.vehicleModel || "—"} •{" "}
                  <span className="text-yellow-600 dark:text-yellow-400 font-mono">
                    {workOrder.licensePlate || "—"}
                  </span>
                </div>
                {/* Số km removed/hidden for electronics */}
              </div>
            </div>

            {/* Mô tả vấn đề & Pattern (Merged) */}
            {workOrder.notes && (
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  MÔ TẢ VẤN ĐỀ
                </h3>
                <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 border border-slate-200 dark:border-transparent">
                  {(() => {
                    // Regex allows flexible whitespace
                    const pwdMatch = workOrder.notes.match(/\[Mật khẩu\/Pattern\]:\s*(.*)/);
                    let displayNotes = workOrder.notes;
                    let pattern = "";

                    if (pwdMatch) {
                      const fullMatch = pwdMatch[0];
                      const pwdValue = pwdMatch[1];
                      // Remove the pattern tag from text description
                      displayNotes = workOrder.notes.replace(fullMatch, "").trim();

                      if (pwdValue.startsWith("Pattern:")) {
                        pattern = pwdValue.replace("Pattern:", "").trim();
                      }
                    }

                    return (
                      <>
                        {/* Display Cleaned Text */}
                        {displayNotes && (
                          <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-3">
                            {displayNotes}
                          </div>
                        )}

                        {/* Display Pattern Visual */}
                        {pattern && (
                          <div className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                              Mô phỏng hình vẽ mở khóa
                            </div>
                            <AndroidPatternLock
                              initialValue={pattern}
                              readOnly={true}
                              className="pointer-events-none"
                            />
                          </div>
                        )}

                        {/* Display Text Link if not pattern */}
                        {pwdMatch && !pattern && (
                          <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-600 dark:text-slate-400">
                            <strong>Mật khẩu:</strong> {pwdMatch[1]}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Phụ tùng */}
            {workOrder.partsUsed && workOrder.partsUsed.length > 0 && (
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  LINH KIỆN ({workOrder.partsUsed.length})
                </h3>
                <div className="space-y-2">
                  {workOrder.partsUsed.map((part, idx) => {
                    const warrantyText = getWarrantyForWorkOrderPart(part);
                    return (
                    <div key={idx} className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 border border-slate-200 dark:border-transparent">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm text-slate-900 dark:text-white font-medium truncate">
                            {part.partName || "Linh kiện"}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            SL: {part.quantity} {part.sku && `• ${part.sku}`}
                          </div>
                          {warrantyText && (
                            <div className="text-[11px] text-emerald-500 dark:text-emerald-400 font-semibold mt-0.5">
                              Bảo hành: {warrantyText}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(part.price * part.quantity)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatCurrency(part.price)}/cái
                          </div>
                        </div>
                      </div>
                      {/* Hiển thị giá vốn để debug */}
                      <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 flex justify-between">
                        <span>
                          Giá vốn: {formatCurrency(part.costPrice || 0)}/cái
                        </span>
                        <span className="text-yellow-600 dark:text-yellow-400">
                          Lãi:{" "}
                          {formatCurrency(
                            (part.price - (part.costPrice || 0)) * part.quantity
                          )}
                        </span>
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            )}

            {/* Dịch vụ */}
            {workOrder.additionalServices &&
              workOrder.additionalServices.length > 0 && (
                <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    DỊCH VỤ ({workOrder.additionalServices.length})
                  </h3>
                  <div className="space-y-2">
                    {workOrder.additionalServices.map((svc, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 flex items-center justify-between border border-slate-200 dark:border-transparent"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm text-slate-900 dark:text-white font-medium truncate">
                            {svc.description || "Dịch vụ"}
                          </div>
                          {svc.quantity > 1 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              SL: {svc.quantity}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-bold text-purple-600 dark:text-purple-400 flex-shrink-0">
                          {formatCurrency(svc.price * (svc.quantity || 1))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {workOrder.repairServices && workOrder.repairServices.length > 0 && (
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  CONG SUA ({workOrder.repairServices.length})
                </h3>
                <div className="space-y-2">
                  {workOrder.repairServices.map((service) => (
                    <div
                      key={service.id}
                      className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 border border-slate-200 dark:border-transparent"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-900 dark:text-white font-medium truncate">
                            {service.serviceName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {service.laborCalcType}
                          </div>
                          {(service.workers || []).length > 0 && (
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {(service.workers || [])
                                .map(
                                  (worker) =>
                                    `${worker.workerName || worker.workerId}: ${worker.sharePercent}%`
                                )
                                .join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(service.laborAmount)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Tho: {formatCurrency(
                              (service.workers || []).length > 0
                                ? (service.workers || []).reduce(
                                  (sum, worker) => sum + Number(worker.workerAmount || 0),
                                  0
                                )
                                : Number(service.workerAmount || 0)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}



            {/* Tổng tiền */}
            <div className="p-3">
              <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Tổng linh kiện</span>
                  <span className="text-slate-900 dark:text-white font-medium text-sm">
                    {formatCurrency(
                      workOrder.partsUsed?.reduce(
                        (s, p) => s + p.price * p.quantity,
                        0
                      ) || 0
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Tổng dịch vụ</span>
                  <span className="text-slate-900 dark:text-white font-medium text-sm">
                    {formatCurrency(
                      workOrder.additionalServices?.reduce(
                        (s, svc) => s + svc.price * (svc.quantity || 1),
                        0
                      ) || 0
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Tiền công sửa</span>
                  <span className="text-slate-900 dark:text-white font-medium text-sm">
                    {formatCurrency(workOrder.laborTotal || workOrder.laborCost || 0)}
                  </span>
                </div>
                {(workOrder.discount || 0) > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 dark:text-slate-400 text-xs">Giảm giá</span>
                    <span className="text-red-500 dark:text-red-400 font-medium text-sm">
                      -{formatCurrency(workOrder.discount || 0)}
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-2 flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900 dark:text-white uppercase">
                    TỔNG CỘNG
                  </span>
                  <span className="text-xl font-black text-blue-600 dark:text-blue-500">
                    {formatCurrency(workOrder.total)}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/30 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Trạng thái thanh toán</span>
                  <span
                    className={`font-bold flex items-center gap-1.5 ${workOrder.paymentStatus === "paid"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                      }`}
                  >
                    {workOrder.paymentStatus === "paid" ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Đã thanh toán
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        Chưa thanh toán
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Nút chỉnh sửa */}
          {onSwitchToEdit && (
            <div className="flex-shrink-0 p-3 bg-white dark:bg-[#1e1e2d] border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={onSwitchToEdit}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                ✏️ Chỉnh sửa phiếu
              </button>
            </div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block max-w-2xl w-full max-h-[90vh] bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
          {/* Similar content for desktop - simplified */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
            <h2 className="text-base font-bold">
              Chi tiết phiếu #{formatWorkOrderId(workOrder.id)}
            </h2>
            <div className="flex items-center gap-2">
              {onSwitchToEdit && (
                <button
                  onClick={onSwitchToEdit}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  ✏️ Chỉnh sửa
                </button>
              )}
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
            {/* Desktop content similar to mobile */}
            <div className="text-center text-slate-500 py-8">
              Vui lòng bấm "Chỉnh sửa" để xem và sửa chi tiết phiếu
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EDIT MODE - Form chỉnh sửa (code cũ)
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center">
      {/* Mobile Full Screen */}
      <div className="md:hidden w-full h-full bg-slate-50 dark:bg-[#151521] flex flex-col transition-colors">
        {/* Header */}
        <div className="flex-shrink-0 bg-white dark:bg-[#1e1e2d] px-3 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">
              {workOrder
                ? `Sửa phiếu #${formatWorkOrderId(workOrder.id)}`
                : "Tạo phiếu mới"}
            </h2>
          </div>
          <div className="w-9"></div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-24 bg-slate-50 dark:bg-[#151521]">
          {/* Tabs Navigation */}
          <div className="sticky top-0 z-10 bg-white dark:bg-[#1e1e2d] border-b border-slate-200 dark:border-slate-800 px-1.5 pt-1 flex items-center justify-between shadow-sm overflow-x-auto scrollbar-hide">
            {[
              { id: "info", label: "Thông tin", icon: User },
              { id: "issue", label: "Sự cố", icon: AlertTriangle },
              { id: "parts", label: "Linh kiện", icon: Package },
              { id: "payment", label: "T.Toán", icon: DollarSign },
            ].map((tab) => {
              const isActive = activeSection === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as any)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 border-b-2 transition-all ${isActive
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "fill-current/10" : ""}`} />
                  <span className="text-[10px] font-bold uppercase">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="p-2.5 space-y-3">

            {/* SECTION: INFO */}
            {activeSection === "info" && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* KHỐI 1: TRẠNG THÁI & KỸ THUẬT VIÊN */}
                <div className="p-2.5 space-y-3">
                  {/* Status Segmented Control */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Trạng thái sửa chữa
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 p-1 bg-white dark:bg-[#1e1e2d] rounded-xl border border-slate-200 dark:border-slate-700/50">
                      {[
                        { id: WORK_ORDER_STATUS.RECEIVED, label: "Nhận", icon: FileText },
                        { id: WORK_ORDER_STATUS.IN_PROGRESS, label: "Sửa", icon: Wrench },
                        { id: WORK_ORDER_STATUS.COMPLETED, label: "Xong", icon: CheckCircle },
                        { id: WORK_ORDER_STATUS.DELIVERED, label: "Trả", icon: Smartphone },
                      ].map((item) => {
                        const isActive = status === item.id;
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setStatus(item.id as WorkOrderStatus)}
                            className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${isActive
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]"
                              : "text-slate-500 hover:text-slate-300"
                              }`}
                          >
                            <Icon className={`w-3.5 h-3.5 mb-0.5 ${isActive ? "text-white" : "text-slate-500"}`} />
                            <span className="text-[10px] font-bold">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Technician Selection - Premium Chips */}
                  <div className="space-y-2.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                      Kỹ thuật viên phụ trách
                    </label>
                    {isTechnicianLockedForStaff && (
                      <p className="text-[10px] font-semibold text-blue-500 ml-1">
                        Tài khoản nhân viên: kỹ thuật viên được cố định theo đăng nhập.
                      </p>
                    )}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                      {employees
                        .filter(emp => !["Nguyễn Xuân Nhạn", "Võ Thanh Lâm"].includes(emp.name))
                        .map((emp) => {
                          const isActive = effectiveSelectedTechnicianId === emp.id;
                          return (
                            <button
                              key={emp.id}
                              type="button"
                              disabled={isTechnicianLockedForStaff}
                              onClick={() => {
                                if (isTechnicianLockedForStaff) return;
                                setSelectedTechnicianId(emp.id);
                              }}
                              className={`flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all ${isActive
                                ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.02]"
                                : "bg-white dark:bg-[#1e1e2d] border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600"
                                }`}
                            >
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                }`}>
                                {emp.name.split(" ").pop()?.charAt(0) || "T"}
                              </div>
                              <span className="text-xs font-bold whitespace-nowrap">{emp.name}</span>
                              {isActive && <Check className="w-3 h-3" />}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* KHỐI 2: KHÁCH HÀNG & THIẾT BỊ */}
                <div className="px-2.5 pb-3 space-y-2.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                    Thông tin khách hàng
                  </label>

                  {/* Customer Selection */}
                  {showCustomerSearch ? (
                    <div className="space-y-2.5">
                      <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          value={customerSearchTerm}
                          onChange={(e) => setCustomerSearchTerm(e.target.value)}
                          placeholder="Tìm tên hoặc số điện thoại..."
                          className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white text-[13px] placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                          autoFocus
                        />
                      </div>

                      {/* Customer List */}
                      <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {filteredCustomers.map((customer) => {
                          const primaryVehicle =
                            customer.vehicles?.find((v: any) => v.isPrimary) ||
                            customer.vehicles?.[0];

                          return (
                            <div
                              key={customer.id}
                              onClick={() => handleSelectCustomer(customer)}
                              className="p-3 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/30 rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-all active:scale-[0.98]"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold">
                                    {customer.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="text-slate-900 dark:text-white font-bold text-sm">
                                      {customer.name}
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                      <Smartphone className="w-3 h-3" />
                                      {customer.phone}
                                    </div>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-600" />
                              </div>

                              {(primaryVehicle?.model || customer.vehicleModel) && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl">
                                  <Bike className="w-3.5 h-3.5 text-blue-400" />
                                  <span className="text-xs text-slate-300 font-medium truncate">
                                    {primaryVehicle?.model || customer.vehicleModel}
                                  </span>
                                  {(primaryVehicle?.licensePlate || customer.licensePlate) && (
                                    <span className="text-[10px] font-mono font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                                      {primaryVehicle?.licensePlate || customer.licensePlate}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Load More Button */}
                        {hasMoreCustomers && customerSearchTerm && (
                          <button
                            type="button"
                            onClick={handleLoadMoreCustomers}
                            className="w-full py-3 text-blue-500 font-medium text-xs bg-blue-500/10 rounded-xl active:scale-[0.98] transition-transform"
                          >
                            {isSearchingCustomer
                              ? "Đang tải..."
                              : "⬇️ Tải thêm khách hàng..."}
                          </button>
                        )}

                        {/* Show add new customer when no results or always at bottom */}
                        {customerSearchTerm && filteredCustomers.length === 0 && (
                          <div className="text-center py-3 text-slate-400 text-xs">
                            Không tìm thấy khách hàng
                          </div>
                        )}

                        {/* Add new customer button */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCustomer(true);
                            // Pre-fill phone if search term looks like a phone number
                            if (/^[0-9]+$/.test(customerSearchTerm)) {
                              setNewCustomerPhone(customerSearchTerm);
                              setNewCustomerName("");
                            } else {
                              setNewCustomerName(customerSearchTerm);
                              setNewCustomerPhone("");
                            }
                          }}
                          className="w-full p-3 bg-green-500/20 border-2 border-dashed border-green-500/50 rounded-lg text-green-400 font-medium flex items-center justify-center gap-2 hover:bg-green-500/30 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Thêm khách hàng mới
                        </button>
                      </div>
                    </div>
                  ) : selectedCustomer ? (
                    <div className="p-4 bg-white dark:bg-[#1e1e2d] border border-blue-200 dark:border-blue-500/30 rounded-2xl shadow-lg shadow-blue-500/5">
                      {isEditingCustomer ? (
                        // Edit mode - show input fields
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                              Tên khách hàng
                            </label>
                            <input
                              type="text"
                              value={editCustomerName}
                              onChange={(e) => setEditCustomerName(e.target.value)}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all"
                              placeholder="Nhập tên khách hàng"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                              Số điện thoại
                            </label>
                            <input
                              type="tel"
                              value={editCustomerPhone}
                              onChange={(e) => setEditCustomerPhone(e.target.value)}
                              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all"
                              placeholder="Nhập số điện thoại"
                            />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => {
                                setIsEditingCustomer(false);
                                setEditCustomerName(selectedCustomer.name);
                                setEditCustomerPhone(selectedCustomer.phone || "");
                              }}
                              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                            >
                              Hủy
                            </button>
                            <button
                              onClick={handleSaveEditedCustomer}
                              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                            >
                              Lưu thay đổi
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View mode - show customer info with edit button
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-lg shadow-inner">
                              {selectedCustomer.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-slate-900 dark:text-white font-bold text-base">
                                {selectedCustomer.name}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                                <PhoneCall className="w-3 h-3 text-blue-400" />
                                {selectedCustomer.phone}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditCustomerName(selectedCustomer.name);
                                setEditCustomerPhone(selectedCustomer.phone || "");
                                setIsEditingCustomer(true);
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl active:scale-95 transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedCustomer(null);
                                setSelectedVehicle(null);
                                setShowCustomerSearch(true);
                                setIsEditingCustomer(false);
                              }}
                              className="w-9 h-9 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl active:scale-95 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Vehicle Selection */}
                  {selectedCustomer && (
                    <div className="space-y-3 pt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                        Chọn thiết bị sửa chữa
                      </label>

                      <div className="grid grid-cols-1 gap-2.5">
                        {customerVehicles.map((vehicle) => {
                          const isActive = selectedVehicle?.id === vehicle.id;
                          return (
                            <div
                              key={vehicle.id}
                              onClick={() => handleSelectVehicle(vehicle)}
                              className={`p-4 rounded-2xl cursor-pointer transition-all border ${isActive
                                ? "bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20"
                                : "bg-white dark:bg-[#1e1e2d] border-slate-200 dark:border-slate-700/30 hover:border-slate-400 dark:hover:border-slate-600"
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                                    }`}>
                                    <Bike className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <div className={`font-bold text-sm ${isActive ? "text-white" : "text-slate-900 dark:text-slate-200"}`}>
                                      {vehicle.model}
                                    </div>
                                    <div className={`text-xs font-mono ${isActive ? "text-blue-100" : "text-slate-500"}`}>
                                      {vehicle.licensePlate}
                                    </div>
                                  </div>
                                </div>
                                {isActive && <CheckCircle className="w-5 h-5 text-white" />}
                              </div>
                            </div>
                          );
                        })}

                        {/* Add New Vehicle Button */}
                        <button
                          onClick={() => setShowAddVehicle(true)}
                          className="w-full py-3.5 border-2 border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-2xl text-slate-500 hover:text-blue-400 transition-all flex items-center justify-center gap-2 text-xs font-bold"
                        >
                          <Plus className="w-4 h-4" />
                          Thêm thiết bị mới
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Warranty Status Badge - Show when device selected and has active warranty */}
                  {selectedVehicle && activeWarranty && (
                    <div className="px-4 pb-4">
                      <div className="p-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-2 border-emerald-500 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
                            <span className="text-lg">🛡️</span>
                          </div>
                          <div>
                            <div className="text-emerald-400 font-bold text-sm">CÒN BẢO HÀNH</div>
                            <div className="text-emerald-300 text-xs">
                              Còn {activeWarranty.days_remaining} ngày • Hết hạn: {new Date(activeWarranty.warranty_end_date).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>
                        {showLegacyRepairSection && (
                        <div className="px-4 pb-4 space-y-3">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Cong sua / luong tho
                            </label>
                            {repairServices.length > 0 && (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                {repairServices.length} muc
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={newRepairServiceDraft.serviceId || ""}
                              onChange={(e) => {
                                const selectedService = serviceConfigs.find((service) => service.id === e.target.value);
                                if (!selectedService) {
                                  setNewRepairServiceDraft(createEmptyRepairServiceDraft());
                                  return;
                                }
                                const technicianName =
                                  employees.find((employee) => employee.id === effectiveSelectedTechnicianId)?.name;
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
                                    employees,
                                    technicianName,
                                    selectedService.defaultWorkerSharePercent
                                  ),
                                });
                              }}
                              className="px-3 py-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700/40 rounded-xl text-xs text-slate-900 dark:text-white"
                            >
                              <option value="">Chon mau DV</option>
                              {serviceConfigs.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {service.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={newRepairServiceDraft.serviceName}
                              onChange={(e) =>
                                setNewRepairServiceDraft({
                                  ...newRepairServiceDraft,
                                  serviceName: e.target.value,
                                })
                              }
                              placeholder="Ten cong sua"
                              className="px-3 py-3 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/30 rounded-xl text-xs text-slate-900 dark:text-white"
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={formatNumberWithDots(newRepairServiceDraft.laborFixedAmount)}
                              onChange={(e) =>
                                setNewRepairServiceDraft({
                                  ...newRepairServiceDraft,
                                  laborFixedAmount: parseFormattedNumber(e.target.value),
                                })
                              }
                              placeholder="Co dinh"
                              className="px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                            />
                            <input
                              type="text"
                              value={formatNumberWithDots(newRepairServiceDraft.laborPercentOfCost)}
                              onChange={(e) =>
                                setNewRepairServiceDraft({
                                  ...newRepairServiceDraft,
                                  laborPercentOfCost: parseFormattedNumber(e.target.value),
                                })
                              }
                              placeholder="% gia nhap"
                              className="px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                            />
                            <input
                              type="text"
                              value={formatNumberWithDots(
                                newRepairServiceDraft.laborCalcType === "manual"
                                  ? newRepairServiceDraft.manualLabor
                                  : newRepairServiceDraft.minimumLaborAmount
                              )}
                              onChange={(e) => {
                                const value = parseFormattedNumber(e.target.value);
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
                                });
                              }}
                              placeholder="Min / tay"
                              className="px-3 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                            />
                          </div>
                          <button
                            onClick={() => {
                              if (!newRepairServiceDraft.serviceName.trim()) {
                                showToast.error("Vui long nhap ten cong sua");
                                return;
                              }
                              setRepairServices([...repairServices, newRepairServiceDraft]);
                              setNewRepairServiceDraft(createEmptyRepairServiceDraft());
                            }}
                            className="w-full py-3.5 bg-emerald-600/10 border border-emerald-500/30 hover:bg-emerald-600/20 rounded-2xl text-emerald-400 transition-all flex items-center justify-center gap-2 text-xs font-bold active:scale-[0.98]"
                          >
                            <Plus className="w-4 h-4" />
                            Them cong sua
                          </button>
                          {repairServices.length > 0 && (
                            <div className="space-y-2.5">
                              {repairServices.map((service) => {
                                const laborAmount = getRepairServiceLaborAmount(service);
                                const workerSplits = splitWorkerAmount(
                                  laborAmount,
                                  getRepairServiceWorkers(service)
                                );
                                return (
                                  <div
                                    key={service.id}
                                    className="p-4 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/30 rounded-2xl shadow-sm"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                                          {service.serviceName}
                                        </div>
                                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                          {service.laborCalcType} • {formatCurrency(laborAmount)}
                                        </div>
                                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                          {workerSplits.length === 0
                                            ? "Chua gan tho"
                                            : workerSplits
                                              .map((worker) => `${worker.worker_name || worker.worker_id}: ${worker.share_percent}%`)
                                              .join(", ")}
                                        </div>
                                      </div>
                                      <button
                                        onClick={() =>
                                          setRepairServices(repairServices.filter((item) => item.id !== service.id))
                                        }
                                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 active:scale-95 transition-all"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        )}
                        <button
                          onClick={() => {
                            // Set as warranty claim - just set labor to 0
                            setLaborCost(0);
                            showToast.success("Đã chuyển sang chế độ Bảo hành - Miễn phí công!");
                          }}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg"
                        >
                          ✓ Tạo Phiếu Bảo Hành (Miễn phí)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show link to Issue tab if vehicle selected but not in issue tab */}
                  {selectedVehicle && (
                    <button
                      onClick={() => setActiveSection("issue")}
                      className="w-full py-3 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 mt-2"
                    >
                      Tiếp tục: Nhập mô tả sự cố <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* SECTION: ISSUE */}
            {activeSection === "issue" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                {!selectedVehicle ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center">
                    <Bike className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">Vui lòng chọn khách hàng và thiết bị ở tab <strong>Thông tin</strong> trước.</p>
                    <button onClick={() => setActiveSection("info")} className="mt-4 text-blue-500 text-xs font-bold">
                      Quay lại chọn thiết bị
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                          Mật khẩu màn hình
                        </label>
                        <button
                          onClick={() => {
                            if (currentKm.startsWith("Pattern:")) {
                              setCurrentKm("");
                            }
                            setIsPatternMode(!isPatternMode);
                          }}
                          className="text-[10px] font-bold text-blue-500 flex items-center gap-1 active:scale-95 transition-transform"
                        >
                          {isPatternMode ? (
                            <>
                              <Lock className="w-3 h-3" /> Nhập số/chữ
                            </>
                          ) : (
                            <>
                              <Grid3x3 className="w-3 h-3" /> Vẽ hình (Android)
                            </>
                          )}
                        </button>
                      </div>

                      {isPatternMode ? (
                        <div className="bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 flex flex-col items-center">
                          <div className="mb-2 text-xs font-bold text-slate-500">Vẽ mật khẩu mở khóa</div>
                          <AndroidPatternLock
                            initialValue={currentKm.startsWith("Pattern:") ? currentKm.replace("Pattern:", "").trim() : ""}
                            onPatternComplete={(pattern) => {
                              if (pattern) {
                                setCurrentKm(`Pattern: ${pattern}`);
                                if (navigator.vibrate) navigator.vibrate(50);
                              }
                            }}
                          />
                          {currentKm.startsWith("Pattern:") ? (
                            <div className="mt-2 text-xs font-mono text-emerald-500 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Đã lưu hình vẽ
                            </div>
                          ) : (
                            <div className="mt-2 text-[10px] text-slate-400 italic">
                              Vẽ hình để lưu mật khẩu
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                          <input
                            type="text"
                            value={currentKm}
                            onChange={(e) => setCurrentKm(e.target.value)}
                            placeholder="Mật khẩu (nếu có)..."
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all font-mono"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                        Mô tả sự cố
                      </label>
                      <div className="relative">
                        <Wrench className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                        <textarea
                          value={issueDescription}
                          onChange={(e) => setIssueDescription(e.target.value)}
                          placeholder="Mô tả các vấn đề cần sửa chữa..."
                          rows={3}
                          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white text-sm resize-none focus:border-blue-500 transition-all"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <DevicePhotoGallery
                        photos={devicePhotos}
                        onAddPhoto={handleAddDevicePhoto}
                        onRemovePhoto={handleRemoveDevicePhoto}
                        isUploading={isUploadingPhoto}
                      />
                    </div>

                    <button
                      onClick={() => setActiveSection("parts")}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/20"
                    >
                      Tiếp tục: Thêm linh kiện <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SECTION: PARTS */}
            {activeSection === "parts" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                {!selectedVehicle ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center">
                    <Bike className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">Vui lòng chọn khách hàng và thiết bị ở tab <strong>Thông tin</strong> trước.</p>
                    <button onClick={() => setActiveSection("info")} className="mt-4 text-blue-500 text-xs font-bold">
                      Quay lại chọn thiết bị
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col">

                    {/* KHỐI 3A: PHỤ TÙNG & 3B: DỊCH VỤ */}
                    {selectedCustomer && selectedVehicle && (
                      <div className="space-y-4">
                        <div className="px-4 pb-4 space-y-3">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Linh kiện sử dụng
                            </label>
                            {selectedParts.length > 0 && (
                              <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                                {selectedParts.length} món
                              </span>
                            )}
                          </div>

                          {/* Parts List */}
                          {selectedParts.length > 0 && (
                            <div className="space-y-2.5">
                              {selectedParts.map((part, _index) => (
                                <div
                                  key={part.partId}
                                  className="p-4 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/30 rounded-2xl shadow-sm"
                                >
                                  {(() => {
                                    const laborBase = getPartLaborBase(part.partId);
                                    const warrantyText = getPartWarranty(part.partId);
                                    const lineLabor = getIntegratedLaborByQuantity(
                                      laborBase,
                                      Number(part.quantity || 0)
                                    );
                                    return (
                                      <>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                        {part.partName}
                                      </div>
                                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                        {part.sku}
                                      </div>
                                      <div className="text-[10px] text-cyan-500 font-semibold mt-1">
                                        Công: {formatCurrency(laborBase)} / món
                                      </div>
                                      <div className="text-[10px] text-cyan-400 mt-0.5">
                                        Công theo SL: {formatCurrency(lineLabor)}
                                      </div>
                                      {warrantyText && (
                                        <div className="text-[10px] text-emerald-500 font-semibold mt-0.5">
                                          Bảo hành: {warrantyText}
                                        </div>
                                      )}
                                      <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[10px] text-slate-500">Giá:</span>
                                        <input
                                          type="text"
                                          value={formatNumberWithDots(part.sellingPrice)}
                                          onChange={(e) => {
                                            const newPrice = parseFormattedNumber(e.target.value);
                                            setSelectedParts(
                                              selectedParts.map((p) =>
                                                p.partId === part.partId
                                                  ? { ...p, sellingPrice: newPrice }
                                                  : p
                                              )
                                            );
                                          }}
                                          inputMode="numeric"
                                          className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-blue-600 dark:text-blue-400 text-xs font-bold focus:border-blue-500 focus:outline-none transition-all"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-3">
                                      <button
                                        onClick={() => handleRemovePart(part.partId)}
                                        className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-red-400 active:scale-95 transition-all"
                                      >
                                        <Trash2 className="w-5 h-5" />
                                      </button>
                                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50">
                                        <button
                                          onClick={() => handleUpdatePartQuantity(part.partId, -1)}
                                          className="w-9 h-9 flex items-center justify-center text-slate-400 active:bg-slate-200 dark:active:bg-slate-700 rounded-lg transition-all"
                                        >
                                          <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="w-8 text-center text-sm font-bold text-slate-900 dark:text-white">
                                          {part.quantity}
                                        </span>
                                        <button
                                          onClick={() => handleUpdatePartQuantity(part.partId, 1)}
                                          className="w-9 h-9 flex items-center justify-center text-blue-400 active:bg-slate-700 rounded-lg transition-all"
                                        >
                                          <Plus className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                      </>
                                    );
                                  })()}
                                  <div className="mt-3 pt-3 border-t border-slate-700/30 flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Thành tiền</span>
                                    <span className="text-sm font-bold text-emerald-400">
                                      {formatCurrency(part.quantity * part.sellingPrice)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Part Button */}
                          <button
                            onClick={() => setShowPartSearch(true)}
                            className="w-full py-3.5 bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 rounded-2xl text-blue-400 transition-all flex items-center justify-center gap-2 text-xs font-bold active:scale-[0.98]"
                          >
                            <Plus className="w-4 h-4" />
                            Thêm linh kiện
                          </button>

                          {/* Add Manual Part Button */}
                          <button
                            onClick={() => setShowAddManualPart(true)}
                            className="w-full py-3.5 bg-purple-600/10 border border-purple-500/30 hover:bg-purple-600/20 rounded-2xl text-purple-400 transition-all flex items-center justify-center gap-2 text-xs font-bold active:scale-[0.98]"
                          >
                            <Plus className="w-4 h-4" />
                            Thêm linh kiện tự do
                          </button>
                        </div>

                        {/* 3B: DỊCH VỤ (GIA CÔNG) */}
                        <div className="px-4 pb-4 space-y-3">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              Dịch vụ bên ngoài
                            </label>
                            {additionalServices.length > 0 && (
                              <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                                {additionalServices.length} mục
                              </span>
                            )}
                          </div>

                          {/* Services List */}
                          {additionalServices.length > 0 && (
                            <div className="space-y-2.5">
                              {additionalServices.map((service) => (
                                <div
                                  key={service.id}
                                  className="p-4 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/30 rounded-2xl shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                        {service.name}
                                      </div>
                                      <div className="mt-2 flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] text-slate-500 w-8">Bán:</span>
                                          <input
                                            type="text"
                                            value={formatNumberWithDots(service.sellingPrice)}
                                            onChange={(e) => {
                                              const newPrice = parseFormattedNumber(e.target.value);
                                              setAdditionalServices(
                                                additionalServices.map((s) =>
                                                  s.id === service.id
                                                    ? { ...s, sellingPrice: newPrice }
                                                    : s
                                                )
                                              );
                                            }}
                                            inputMode="numeric"
                                            className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-orange-600 dark:text-orange-400 text-xs font-bold focus:border-blue-500 focus:outline-none transition-all"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveService(service.id)}
                                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 active:scale-95 transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-slate-700/30 flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                      SL: {service.quantity} x {formatCurrency(service.sellingPrice)}
                                    </span>
                                    <span className="text-sm font-bold text-orange-400">
                                      {formatCurrency(service.sellingPrice * service.quantity)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Service Button */}
                          <button
                            onClick={() => setShowAddService(true)}
                            className="w-full py-3.5 bg-orange-600/10 border border-orange-500/30 hover:bg-orange-600/20 rounded-2xl text-orange-400 transition-all flex items-center justify-center gap-2 text-xs font-bold active:scale-[0.98]"
                          >
                            <Plus className="w-4 h-4" />
                            Thêm dịch vụ bên ngoài
                          </button>
                        </div>
                        <button
                          onClick={() => setActiveSection("payment")}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/20"
                        >
                          Tiếp tục: Thanh toán <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SECTION: PAYMENT */}
            {activeSection === "payment" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                {!selectedVehicle ? (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center">
                    <Bike className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">Vui lòng chọn khách hàng và thiết bị ở tab <strong>Thông tin</strong> trước.</p>
                    <button onClick={() => setActiveSection("info")} className="mt-4 text-blue-500 text-xs font-bold">
                      Quay lại chọn thiết bị
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="px-3 pb-3 space-y-2.5">
                      <h3 className="text-xs font-semibold text-white uppercase tracking-wide">
                        THANH TOÁN
                      </h3>

                      <div className="p-4 bg-[#1e1e2d] rounded-lg space-y-2">

                        {/* Deposit Toggle */}
                        <div className="pt-2">
                          <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-[#2b2b40] rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                <span className="text-lg">💳</span>
                              </div>
                              <span className="text-slate-900 dark:text-white font-medium text-sm">
                                Đặt cọc trước
                              </span>
                            </div>
                            <button
                              onClick={() => setIsDeposit(!isDeposit)}
                              className={`relative w-12 h-6 rounded-full transition-colors ${isDeposit ? "bg-[#009ef7]" : "bg-slate-600"
                                }`}
                            >
                              <div
                                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${isDeposit ? "right-0.5" : "left-0.5"
                                  }`}
                              >
                                {isDeposit && (
                                  <span className="absolute inset-0 flex items-center justify-center text-[#009ef7] text-[10px] font-bold">
                                    ON
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>

                          {isDeposit && (
                            <div className="mt-3 p-3 bg-slate-50 dark:bg-[#151521] border-2 border-[#009ef7] rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">💵</span>
                                <span className="text-slate-500 dark:text-slate-400 text-xs">
                                  Nhập số tiền cọc...
                                </span>
                              </div>
                              <input
                                type="text"
                                value={formatNumberWithDots(depositAmount)}
                                onChange={(e) =>
                                  setDepositAmount(
                                    parseFormattedNumber(e.target.value)
                                  )
                                }
                                placeholder="0"
                                inputMode="numeric"
                                className="w-full px-3 py-2.5 bg-white dark:bg-[#2b2b40] border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:border-[#009ef7] focus:outline-none transition-colors"
                              />
                            </div>
                          )}
                        </div>

                        {/* Payment Method */}
                        <div className="pt-2">
                          <label className="block text-xs font-medium text-slate-400 mb-2">
                            Phương thức thanh toán
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setPaymentMethod("cash")}
                              className={`relative p-3 rounded-lg transition-all border-2 ${paymentMethod === "cash"
                                ? "bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/20"
                                : "bg-slate-100 dark:bg-[#2b2b40] border-transparent hover:border-slate-400 dark:hover:border-slate-600"
                                }`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <div
                                  className={`text-xl ${paymentMethod === "cash" ? "scale-110" : ""
                                    } transition-transform`}
                                >
                                  💵
                                </div>
                                <span
                                  className={`text-xs font-medium ${paymentMethod === "cash"
                                    ? "text-emerald-400"
                                    : "text-slate-400"
                                    }`}
                                >
                                  Tiền mặt
                                </span>
                              </div>
                              {paymentMethod === "cash" && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-2.5 h-2.5 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </div>
                              )}
                            </button>
                            <button
                              onClick={() => setPaymentMethod("bank")}
                              className={`relative p-3 rounded-lg transition-all border-2 ${paymentMethod === "bank"
                                ? "bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/20"
                                : "bg-slate-100 dark:bg-[#2b2b40] border-transparent hover:border-slate-400 dark:hover:border-slate-600"
                                }`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <div
                                  className={`text-xl ${paymentMethod === "bank" ? "scale-110" : ""
                                    } transition-transform`}
                                >
                                  🏦
                                </div>
                                <span
                                  className={`text-xs font-medium ${paymentMethod === "bank"
                                    ? "text-blue-400"
                                    : "text-slate-400"
                                    }`}
                                >
                                  Chuyển khoản
                                </span>
                              </div>
                              {paymentMethod === "bank" && (
                                <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-2.5 h-2.5 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={3}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </div>
                              )}
                            </button>
                          </div>

                          {/* Payment at return - only show when EDITING existing order with status "Trả máy" */}
                          {status === "Trả máy" && workOrder && (
                            <div className="mt-3">
                              {/* Checkbox to enable payment */}
                              <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-[#2b2b40] rounded-lg">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <span className="text-lg">✅</span>
                                  </div>
                                  <span className="text-slate-900 dark:text-white font-medium text-sm">
                                    Thanh toán khi trả thiết bị
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    const newValue = !showPaymentInput;
                                    setShowPaymentInput(newValue);
                                    if (!newValue) {
                                      setPartialAmount(0);
                                    } else {
                                      const fullAmount = Math.max(
                                        0,
                                        total - (isDeposit ? depositAmount : 0)
                                      );
                                      setPartialAmount(fullAmount);
                                    }
                                  }}
                                  className={`relative w-12 h-6 rounded-full transition-colors ${showPaymentInput
                                    ? "bg-emerald-500"
                                    : "bg-slate-600"
                                    }`}
                                >
                                  <div
                                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${showPaymentInput ? "right-0.5" : "left-0.5"
                                      }`}
                                  >
                                    {showPaymentInput && (
                                      <span className="absolute inset-0 flex items-center justify-center text-emerald-500 text-[10px] font-bold">
                                        ON
                                      </span>
                                    )}
                                  </div>
                                </button>
                              </div>

                              {/* Payment Input - show when checkbox is enabled */}
                              {showPaymentInput && (
                                <div className="mt-3 p-3 bg-slate-50 dark:bg-[#151521] border-2 border-emerald-500 rounded-lg">
                                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                                    Số tiền thanh toán thêm:
                                  </label>
                                  <input
                                    type="text"
                                    value={formatNumberWithDots(partialAmount)}
                                    onChange={(e) =>
                                      setPartialAmount(
                                        parseFormattedNumber(e.target.value)
                                      )
                                    }
                                    placeholder="0"
                                    inputMode="numeric"
                                    className="w-full px-3 py-2.5 bg-white dark:bg-[#2b2b40] border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none transition-colors mb-2"
                                  />
                                  {/* Quick amount buttons */}
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setPartialAmount(0)}
                                      className="flex-1 px-3 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-white rounded-lg text-xs font-medium transition-colors"
                                    >
                                      0%
                                    </button>
                                    <button
                                      onClick={() => {
                                        const remainingToPay =
                                          total - (isDeposit ? depositAmount : 0);
                                        setPartialAmount(
                                          Math.round(remainingToPay * 0.5)
                                        );
                                      }}
                                      className="flex-1 px-3 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-white rounded-lg text-xs font-medium transition-colors"
                                    >
                                      50%
                                    </button>
                                    <button
                                      onClick={() => {
                                        const remainingToPay =
                                          total - (isDeposit ? depositAmount : 0);
                                        setPartialAmount(remainingToPay);
                                      }}
                                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                                    >
                                      100%
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Info Note */}
                          {!workOrder && (
                            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-2">
                              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                                <span className="text-blue-400 text-xs">ℹ️</span>
                              </div>
                              <p className="text-blue-300 text-xs leading-relaxed">
                                <span className="font-semibold">Lưu ý:</span> Khi tạo phiếu mới, chọn trạng thái "Tiếp nhận" hoặc "Đang sửa".
                                Thanh toán khi trả thiết bị chỉ khả dụng khi chỉnh sửa phiếu đã có sẵn.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Summary Section - Premium Redesign */}
                        <div className="mt-6 p-4 bg-white dark:bg-[#1e1e2d] rounded-2xl border border-slate-200 dark:border-slate-700/30 space-y-4">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-blue-400" />
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                              Tổng kết chi phí
                            </h3>
                          </div>

                          <div className="space-y-2.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-500 dark:text-slate-400">Tiền linh kiện:</span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {formatCurrency(partsTotal)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-slate-500 dark:text-slate-400">Gia công/Đặt hàng:</span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {formatCurrency(servicesTotal)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-cyan-600 dark:text-cyan-400 font-bold">Tiền công tích hợp:</span>
                              <span
                                className={`text-xs font-bold ${includeIntegratedLabor
                                  ? "text-cyan-600 dark:text-cyan-400"
                                  : "text-slate-400 dark:text-slate-500"
                                  }`}
                              >
                                {formatCurrency(effectiveLaborCost)}
                              </span>
                            </div>
                            <label className="flex items-center justify-between gap-2">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Không tính tiền công (khách mang về)
                              </span>
                              <input
                                type="checkbox"
                                checked={!includeIntegratedLabor}
                                onChange={(e) => setIncludeIntegratedLabor(!e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                            </label>

                            {/* Discount Row */}
                            <div className="pt-2.5 border-t border-slate-700/50 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-red-400 font-bold">Giảm giá:</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#2b2b40] p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                <input
                                  type="text"
                                  value={formatNumberWithDots(discount)}
                                  onChange={(e) =>
                                    setDiscount(parseFormattedNumber(e.target.value))
                                  }
                                  placeholder="0"
                                  className="w-16 bg-transparent text-slate-900 dark:text-white text-xs font-bold text-right focus:outline-none px-1"
                                />
                                <div className="flex bg-white dark:bg-slate-800 rounded-lg p-0.5">
                                  <button
                                    onClick={() => setDiscountType("amount")}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${discountType === "amount"
                                      ? "bg-blue-600 text-white shadow-sm"
                                      : "text-slate-400 dark:text-slate-500"
                                      }`}
                                  >
                                    ₫
                                  </button>
                                  <button
                                    onClick={() => setDiscountType("percent")}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${discountType === "percent"
                                      ? "bg-blue-600 text-white shadow-sm"
                                      : "text-slate-400 dark:text-slate-500"
                                      }`}
                                  >
                                    %
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Quick percent buttons - only show in percent mode */}
                            {discountType === "percent" && (
                              <div className="flex gap-1.5 justify-end">
                                {[5, 10, 15, 20].map((percent) => (
                                  <button
                                    key={percent}
                                    onClick={() => setDiscount(percent)}
                                    className="px-2.5 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors font-bold"
                                  >
                                    {percent}%
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Show discount amount if in percent mode */}
                            {discountType === "percent" && discount > 0 && (
                              <div className="text-[10px] text-slate-500 text-right font-mono">
                                = -{formatCurrency(discountAmount)}
                              </div>
                            )}
                          </div>

                          {/* Total Section */}
                          <div className="pt-4 border-t-2 border-slate-700/50">
                            <div className="flex justify-between items-end mb-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tổng thanh toán</span>
                                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                  {formatCurrency(total)}
                                </span>
                              </div>
                              {remainingPreview <= 0 && (
                                <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center gap-1.5 mb-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Đã trả đủ</span>
                                </div>
                              )}
                            </div>

                            {/* Payment breakdown */}
                            {((isDeposit && depositAmount > 0) || additionalPaymentPreview > 0) && (
                              <div className="p-3 bg-slate-50 dark:bg-[#151521] rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-2">
                                {isDeposit && depositAmount > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-purple-400 uppercase">Đã đặt cọc</span>
                                    <span className="text-xs font-bold text-purple-400">
                                      -{formatCurrency(depositAmount)}
                                    </span>
                                  </div>
                                )}
                                {additionalPaymentPreview > 0 && (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-blue-400 uppercase">Thanh toán thêm</span>
                                    <span className="text-xs font-bold text-blue-400">
                                      -{formatCurrency(additionalPaymentPreview)}
                                    </span>
                                  </div>
                                )}

                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">Còn lại:</span>
                                  <span className={`text-lg font-black ${remainingPreview > 0
                                    ? "text-amber-400"
                                    : "text-green-400"
                                    }`}>
                                    {formatCurrency(remainingPreview)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* STICKY FOOTER - Action Buttons */}
        <div className="flex-shrink-0 bg-white dark:bg-[#1e1e2d] border-t border-slate-200 dark:border-slate-700 p-2">
          {/* Row 1: Print/Share buttons - only show when editing existing order */}
          {workOrder?.id && (
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => {
                  // Trigger print functionality
                  window.print();
                }}
                className="flex-1 py-2 bg-slate-100 dark:bg-[#2b2b40] text-slate-500 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                In phiếu
              </button>
              <button
                onClick={() => {
                  // Share functionality
                  if (navigator.share) {
                    navigator
                      .share({
                        title: `Phiếu sửa chữa #${workOrder!.id}`,
                        text: `Phiếu sửa chữa cho ${selectedCustomer?.name || workOrder!.customerName
                          } - ${selectedVehicle?.licensePlate ||
                          workOrder!.licensePlate
                          }`,
                      })
                      .catch(() => { });
                  } else {
                    alert(
                      "Chức năng chia sẻ không khả dụng trên trình duyệt này"
                    );
                  }
                }}
                className="flex-1 py-2 bg-slate-100 dark:bg-[#2b2b40] text-slate-500 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                Chia sẻ
              </button>
            </div>
          )}
          {/* Row 2: Main action buttons */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2.5 bg-slate-100 dark:bg-[#2b2b40] text-slate-500 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs"
            >
              Hủy
            </button>
            {/* Nút Lưu Phiếu - luôn hiển thị */}
            <button
              onClick={() => {
                void handleSave();
              }}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium text-white transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "⏳ Đang lưu..." : "💾 LƯU"}
            </button>
            {/* Nút Đặt cọc - chỉ hiển thị khi có đặt cọc và không phải trạng thái Trả máy */}
            {status !== "Trả máy" && isDeposit && depositAmount > 0 && (
              <button
                onClick={() => {
                  void handleSave();
                }}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "⏳ Đang xử lý..." : "💰 ĐẶT CỌC"}
              </button>
            )}
            {/* Nút Thanh toán - chỉ hiển thị khi trạng thái Trả máy */}
            {status === "Trả máy" && (
              <button
                onClick={handlePayFull}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-white transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "⏳ Đang xử lý..." : "✅ THANH TOÁN"}
              </button>
            )}
          </div>
        </div>
      </div>


      {/* Desktop - Keep Original (Not Changed) */}
      <div className="hidden md:block">
        {/* Desktop modal would go here - keeping original unchanged */}
      </div>

      {/* Part Search Top Sheet - Fixed at top for keyboard visibility */}
      {
        showPartSearch && (
          <div className="fixed inset-0 bg-black/70 z-[110] flex flex-col">
            {/* Top Sheet Container - positioned at TOP so input is always visible above keyboard */}
            <div
              className="w-full bg-slate-50 dark:bg-[#151521] rounded-b-2xl flex flex-col transition-colors"
              style={{ maxHeight: "60vh" }}
            >
              {/* Header */}
              <div className="flex-shrink-0 p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-slate-900 dark:text-white font-semibold text-sm">
                  🔍 Tìm linh kiện
                </h3>
                <button
                  onClick={() => {
                    setShowPartSearch(false);
                    setPartSearchTerm("");
                  }}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Input - Always visible at top */}
              <div className="flex-shrink-0 p-3 bg-slate-50 dark:bg-[#151521]">
                {/* Part Search Input */}
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={partSearchTerm}
                      onChange={(e) => setPartSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && partSearchTerm.trim()) {
                          e.preventDefault();
                          // Auto-add first matching part when Enter is pressed
                          const firstMatch = filteredParts[0];
                          if (firstMatch) {
                            const stock = firstMatch.stock?.[currentBranchId] || 0;
                            if (stock <= 0) {
                              showToast.error("Sản phẩm đã hết hàng!");
                              return;
                            }
                            handleAddPart(firstMatch);
                          }
                        }
                      }}
                      placeholder="Quét hoặc nhập mã phụ tùng..."
                      className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#2b2b40] border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => setActiveScanField("part")}
                    className="p-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white flex items-center justify-center transition-colors"
                    title="Quét bằng camera"
                  >
                    <ScanBarcode className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Nhấn Enter để thêm nhanh phụ tùng đầu tiên • Dùng camera để quét mã vạch
                </p>

                {/* Barcode Scanner Overlay */}

              </div>

              {/* Results Count & List - Scrollable */}
              <div
                ref={partResultsRef}
                className="flex-1 overflow-y-auto px-3 pb-3 overscroll-contain"
              >
                {/* Show result count when searching */}
                {partSearchTerm && (
                  <div className="mb-2 px-1 text-xs text-slate-400">
                    Tìm thấy{" "}
                    <span className="text-emerald-400 font-semibold">
                      {filteredParts.length}
                    </span>{" "}
                    phụ tùng
                    {filteredParts.length > 50 && " (hiển thị 50 đầu tiên)"}
                  </div>
                )}
                <div className="space-y-2">
                  {filteredParts.slice(0, 50).map((part) => {
                    const stock = part.stock?.[currentBranchId] || 0;
                    const price = part.retailPrice?.[currentBranchId] || 0;
                    const warrantyText = getWarrantyText(part);
                    const partLaborCost =
                      Number((part as any)?.laborCost?.[currentBranchId]) ||
                      Number(part.wholesalePrice?.[currentBranchId]) ||
                      0;
                    return (
                      <div
                        key={part.id}
                        onClick={() => {
                          if (stock <= 0) {
                            showToast.error("Sản phẩm đã hết hàng!");
                            return;
                          }
                          handleAddPart(part);
                        }}
                        className="p-2.5 bg-white dark:bg-[#1e1e2d] rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2b2b40] active:bg-blue-600/20 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-slate-900 dark:text-white font-medium text-xs">
                              {part.name}
                            </div>
                            <div className="text-[11px] text-blue-400 font-mono mt-0.5">
                              SKU: {part.sku} • Tồn: {stock}
                            </div>
                            <div className="text-[11px] text-cyan-400 mt-0.5">
                              Công: {formatCurrency(partLaborCost)}
                            </div>
                            {warrantyText && (
                              <div className="text-[11px] text-emerald-400 mt-0.5 font-semibold">
                                Bảo hành: {warrantyText}
                              </div>
                            )}
                            {part.category && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 mt-1 rounded-full text-[9px] font-medium ${getCategoryColor(part.category).bg
                                  } ${getCategoryColor(part.category).text}`}
                              >
                                {part.category}
                              </span>
                            )}
                          </div>
                          <div className="text-[#50cd89] font-bold text-xs flex-shrink-0">
                            {formatCurrency(price)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredParts.length > 50 && (
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500 italic border-t border-slate-100 dark:border-slate-600 rounded-b-lg">
                      Đang hiển thị 50/{filteredParts.length} kết quả. Vui lòng tìm kiếm chi tiết hơn.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tap outside to close */}
            <div
              className="flex-1"
              onClick={() => {
                setShowPartSearch(false);
                setPartSearchTerm("");
              }}
            />
          </div>
        )
      }

      {/* Add Service Modal - Bottom Sheet Design */}
      {
        showAddService && (
          <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center md:justify-center">
            <div className="w-full md:max-w-md bg-white dark:bg-[#1e1e2d] rounded-t-2xl md:rounded-xl overflow-hidden transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-slate-900 dark:text-white font-semibold text-base">
                  THÊM DỊCH VỤ BÊN NGOÀI
                </h3>
                <button
                  onClick={() => {
                    setShowAddService(false);
                    setNewServiceName("");
                    setNewServicePrice(0);
                    setNewServiceQuantity(1);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Service Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-300 mb-2">
                    Tên dịch vụ / Mô tả:
                  </label>
                  <input
                    type="text"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                    placeholder="VD: Unlock iCloud, Flash ROM, Jailbreak..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-[#009ef7] focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>

                {/* Quantity Stepper */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Số lượng:
                  </label>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() =>
                        setNewServiceQuantity(Math.max(1, newServiceQuantity - 1))
                      }
                      className="w-12 h-12 bg-slate-100 dark:bg-[#2b2b40] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold transition-colors"
                    >
                      −
                    </button>
                    <div className="w-20 h-12 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center">
                      <span className="text-slate-900 dark:text-white text-xl font-bold">
                        {newServiceQuantity}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setNewServiceQuantity(newServiceQuantity + 1)
                      }
                      className="w-12 h-12 bg-slate-100 dark:bg-[#2b2b40] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Price Section */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-300 mb-3 uppercase tracking-wide">
                    GIÁ BÁN
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Selling Price */}
                    <div>
                      <label className="block text-xs text-[#ffc700] mb-1.5 font-medium">
                        Đơn giá (Báo khách):
                      </label>
                      <div className="relative">
                        <NumberInput
                          value={newServicePrice}
                          onChange={(val: number) => setNewServicePrice(val)}
                          allowNegative={true}
                          placeholder="0"
                          className="w-full px-3 py-3 pr-8 bg-slate-50 dark:bg-[#151521] border-2 border-[#009ef7] rounded-lg text-slate-900 dark:text-white text-sm font-semibold focus:border-[#0077c7] focus:outline-none transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#009ef7] text-xs font-bold pointer-events-none">
                          đ
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Amount - Auto Calculate */}
                <div className="p-4 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">
                      Thành tiền (Tự tính):
                    </span>
                    <span className="text-[#50cd89] text-xl font-bold">
                      {formatCurrency(newServicePrice * newServiceQuantity)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Button */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={handleAddService}
                  disabled={!newServiceName.trim()}
                  className="w-full py-4 bg-gradient-to-r from-[#009ef7] to-purple-600 hover:from-[#0077c7] hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-all shadow-lg"
                >
                  LƯU VÀO PHIẾU
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Manual Part Modal - Similar to Add Service */}
      {
        showAddManualPart && (
          <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center md:justify-center">
            <div className="w-full md:max-w-md bg-white dark:bg-[#1e1e2d] rounded-t-2xl md:rounded-xl overflow-hidden transition-colors">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-slate-900 dark:text-white font-semibold text-base">
                  THÊM LINH KIỆN TỰ DO
                </h3>
                <button
                  onClick={() => {
                    setShowAddManualPart(false);
                    setNewManualPartName("");
                    setNewManualPartCost(0);
                    setNewManualPartPrice(0);
                    setNewManualPartQuantity(1);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Part Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-300 mb-2">
                    Tên linh kiện:
                  </label>
                  <input
                    type="text"
                    value={newManualPartName}
                    onChange={(e) => setNewManualPartName(e.target.value)}
                    placeholder="Nhập tên (VD: Màn hình iPhone 14, Pin Samsung...)"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-purple-500 focus:outline-none transition-colors"
                    autoFocus
                  />
                </div>

                {/* Quantity Stepper */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Số lượng:
                  </label>
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() =>
                        setNewManualPartQuantity(Math.max(1, newManualPartQuantity - 1))
                      }
                      className="w-12 h-12 bg-slate-100 dark:bg-[#2b2b40] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold transition-colors"
                    >
                      −
                    </button>
                    <div className="w-20 h-12 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center">
                      <span className="text-slate-900 dark:text-white text-xl font-bold">
                        {newManualPartQuantity}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setNewManualPartQuantity(newManualPartQuantity + 1)
                      }
                      className="w-12 h-12 bg-slate-100 dark:bg-[#2b2b40] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Cost & Price Section */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-300 mb-3 uppercase tracking-wide">
                    CHI PHÍ & GIÁ BÁN
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Cost Price */}
                    <div>
                      <label className="block text-xs text-slate-500 mb-1.5">
                        Giá nhập (Vốn):
                      </label>
                      <div className="relative">
                        <NumberInput
                          value={newManualPartCost}
                          onChange={(val: number) => setNewManualPartCost(val)}
                          placeholder="0"
                          className="w-full px-3 py-3 pr-8 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 text-sm focus:border-slate-400 dark:focus:border-slate-600 focus:outline-none transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                          ₫
                        </span>
                      </div>
                    </div>

                    {/* Selling Price */}
                    <div>
                      <label className="block text-xs text-purple-400 mb-1.5">
                        Giá bán (Khách):
                      </label>
                      <div className="relative">
                        <NumberInput
                          value={newManualPartPrice}
                          onChange={(val: number) => setNewManualPartPrice(val)}
                          placeholder="0"
                          className="w-full px-3 py-3 pr-8 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/30 rounded-lg text-purple-600 dark:text-purple-400 font-semibold text-sm focus:border-purple-500 focus:outline-none transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs">
                          ₫
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Preview */}
                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/30 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      Tổng cộng:
                    </span>
                    <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCurrency(newManualPartPrice * newManualPartQuantity)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                <button
                  onClick={() => {
                    setShowAddManualPart(false);
                    setNewManualPartName("");
                    setNewManualPartCost(0);
                    setNewManualPartPrice(0);
                    setNewManualPartQuantity(1);
                  }}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddManualPart}
                  disabled={!newManualPartName}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-500/20"
                >
                  ✓ Thêm
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Vehicle Modal - Premium Redesign */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1e1e2d] rounded-3xl p-5 border border-slate-200 dark:border-slate-700/50 shadow-2xl transition-colors">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-bold text-base">Thêm thiết bị mới</h3>
              </div>
              <button
                onClick={() => setShowAddVehicle(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  IMEI / SERIAL NUMBER
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVehiclePlate}
                    onChange={(e) => setNewVehiclePlate(e.target.value)}
                    placeholder="VD: 123456789012345"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all font-mono uppercase"
                  />
                  <button
                    onClick={() => setActiveScanField("vehicle")}
                    className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl active:scale-95 transition-all"
                  >
                    <ScanBarcode className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  Tên thiết bị / Model
                </label>
                <input
                  type="text"
                  value={newVehicleName}
                  onChange={(e) => {
                    setNewVehicleName(e.target.value);
                    setShowVehicleDropdown(true);
                  }}
                  onFocus={() => setShowVehicleDropdown(true)}
                  placeholder="Chọn hoặc nhập tên thiết bị"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all"
                />
                {/* Vehicle Model Dropdown */}
                {showVehicleDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-[200px] overflow-y-auto scrollbar-hide">
                    {POPULAR_DEVICES.filter((model) =>
                      model.toLowerCase().includes(newVehicleName.toLowerCase())
                    )
                      .slice(0, 10)
                      .map((model) => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => {
                            setNewVehicleName(model);
                            setShowVehicleDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700/50 last:border-0 transition-colors"
                        >
                          {model}
                        </button>
                      ))}
                    {POPULAR_DEVICES.filter((model) =>
                      model.toLowerCase().includes(newVehicleName.toLowerCase())
                    ).length === 0 && (
                        <div className="px-4 py-3 text-xs text-slate-500 text-center italic">
                          Không tìm thấy - nhập tên thiết bị mới
                        </div>
                      )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddVehicle(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-bold text-xs active:scale-95 transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddVehicle}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  Thêm thiết bị
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal - Unified */}
      {showAddCustomer && (
        <CustomerModal
          customer={{} as any}
          existingCustomers={customers}
          onSave={(savedCustomer) => {
            const customerId = savedCustomer.id || `CUST-${Date.now()}`;
            const primaryVehicle = savedCustomer.vehicles?.find((v: any) => v.isPrimary) || savedCustomer.vehicles?.[0];

            const vehicles: Vehicle[] = savedCustomer.vehicles || [];
            if (vehicles.length === 0 && (savedCustomer.vehicleModel || savedCustomer.licensePlate)) {
              vehicles.push({
                id: `VEH-${Date.now()}`,
                model: savedCustomer.vehicleModel || "",
                licensePlate: savedCustomer.licensePlate || "",
                isPrimary: true,
              } as Vehicle);
            }

            const newCustomerObj: Customer = {
              id: customerId,
              name: savedCustomer.name || "",
              phone: savedCustomer.phone || "",
              vehicles: vehicles,
              vehicleModel: primaryVehicle?.model || savedCustomer.vehicleModel || "",
              licensePlate: primaryVehicle?.licensePlate || savedCustomer.licensePlate || "",
              status: "active",
              segment: "New",
              loyaltyPoints: 0,
              totalSpent: 0,
              visitCount: 1,
              lastVisit: new Date().toISOString(),
              created_at: new Date().toISOString(),
            };

            if (upsertCustomer) {
              upsertCustomer(newCustomerObj);
            }

            setSelectedCustomer(newCustomerObj);
            if (vehicles.length > 0) {
              setSelectedVehicle(vehicles[0]);
            }

            setShowCustomerSearch(false);
            setShowAddCustomer(false);
            setCustomerSearchTerm("");
          }}
          onClose={() => setShowAddCustomer(false)}
        />
      )}

      {/* Barcode Scanner Overlay - Global for Part/Vehicle/Customer */}
      <ScannerModal
        isOpen={!!activeScanField}
        onClose={() => setActiveScanField(null)}
        onScan={(barcode: string) => {
          if (activeScanField === "part") {
            setPartSearchTerm(barcode);
            // Auto-add first matching part if exact SKU found
            const exactMatch = filteredParts.find(
              (p) => p.sku?.toLowerCase() === barcode.toLowerCase() ||
                p.barcode?.toLowerCase() === barcode.toLowerCase()
            );
            if (exactMatch) {
              const stock = exactMatch.stock?.[currentBranchId] || 0;
              if (stock <= 0) {
                showToast.error("Sản phẩm đã hết hàng!");
                return;
              }
              handleAddPart(exactMatch);
            }
          } else if (activeScanField === "vehicle") {
            setNewVehiclePlate(barcode);
            showToast.success("Đã quét S/N thành công!");
          } else if (activeScanField === "customer") {
            setNewCustomerLicensePlate(barcode);
            showToast.success("Đã quét S/N thành công!");
          }
        }}
        title={activeScanField === "part" ? "Quét mã phụ tùng" : "Quét IMEI/Serial"}
      />
    </div>
  );
};
