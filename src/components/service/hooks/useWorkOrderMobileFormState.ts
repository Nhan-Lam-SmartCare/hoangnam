import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useCheckWarranty } from "../../../hooks/useWarrantyRepository";
import { useAuth } from "../../../contexts/AuthContext";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useServiceConfigs } from "../../../hooks/useRepairLabor";
import {
  buildDefaultWorkerSplit,
  calculateLabor,
  splitWorkerAmount,
} from "../../../lib/services/repairLaborService";
import { compressImage } from "../../../utils/imageCompressor";
import { uploadDevicePhoto, deleteDevicePhoto } from "../../../lib/storage/devicePhotosStorage";
import { supabase } from "../../../supabaseClient";
import { formatCurrency, formatWorkOrderId, normalizeSearchText } from "../../../utils/format";
import {
  checkVehicleMaintenance,
  type MaintenanceWarning,
} from "../../../utils/maintenanceReminder";
import { WORK_ORDER_STATUS, type WorkOrderStatus } from "../../../constants";
import { showToast } from "../../../utils/toast";
import type {
  Employee,
  ServiceConfig,
  WorkOrder,
  Part,
  Customer,
  Vehicle,
} from "../../../types";

import {
  RepairServiceDraftWorker,
  RepairServiceDraft,
  createEmptyRepairServiceDraft,
  getWarrantyText,
  getPartLaborBase as sharedGetPartLaborBase,
  getPartWarranty as sharedGetPartWarranty,
  getIntegratedLaborByQuantity as sharedGetIntegratedLaborByQuantity,
} from "./useWorkOrderSharedLogic";

export interface UseWorkOrderMobileFormStateProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workOrderData: any) => Promise<void> | void;
  workOrder?: WorkOrder | null;
  customers: Customer[];
  parts: Part[];
  employees: Employee[];
  currentBranchId: string;
  upsertCustomer?: (customer: any) => void;
  canUpdateWorkOrderStatus?: boolean;
  canUpdateWorkOrderPayment?: boolean;
  canUpdateWorkOrderParts?: boolean;
  canUpdateWorkOrderLabor?: boolean;
  canUpdateWorkOrderDiscount?: boolean;
  canUpdateWorkOrderCustomer?: boolean;
  canUpdateWorkOrderVehicle?: boolean;
  canUpdateWorkOrderOutsourceService?: boolean;
}

export function useWorkOrderMobileFormState({
  isOpen,
  onClose,
  onSave,
  workOrder,
  customers,
  parts,
  employees,
  currentBranchId,
  upsertCustomer,
  canUpdateWorkOrderStatus = true,
  canUpdateWorkOrderPayment = true,
  canUpdateWorkOrderParts = true,
  canUpdateWorkOrderLabor = true,
  canUpdateWorkOrderDiscount = true,
  canUpdateWorkOrderCustomer = true,
  canUpdateWorkOrderVehicle = true,
  canUpdateWorkOrderOutsourceService = true,
}: UseWorkOrderMobileFormStateProps) {
  const { profile } = useAuth();
  const { data: serviceConfigs = [] } = useServiceConfigs();
  const showLegacyRepairSection = import.meta.env.VITE_ENABLE_MOBILE_REPAIR_SECTION === "1";

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
  >([]);
  const [additionalServices, setAdditionalServices] = useState<
    Array<{
      id: string;
      name: string;
      quantity: number;
      costPrice: number;
      sellingPrice: number;
    }>
  >([]);
  const [repairServices, setRepairServices] = useState<RepairServiceDraft[]>([]);
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

  // UI States
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
        description = description.replace(/(\n)*\[Mật khẩu\/Pattern\]:.*$/s, "").trim();
        setIssueDescription(description);
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
      setShowCustomerSearch(!initialCustomer);

      if (workOrder.depositAmount && workOrder.depositAmount > 0) {
        setDepositAmount(workOrder.depositAmount);
        setIsDeposit(true);
      } else {
        setDepositAmount(0);
        setIsDeposit(false);
      }

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
    return sharedGetPartLaborBase(partId, parts, currentBranchId);
  }, [parts, currentBranchId]);

  const getPartWarranty = useCallback((partId: string) => {
    return sharedGetPartWarranty(partId, parts);
  }, [parts]);

  const getWarrantyForWorkOrderPart = useCallback((part: any): string => {
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
  }, [parts]);

  const getIntegratedLaborByQuantity = useCallback((laborBase: number, quantity: number) => {
    return sharedGetIntegratedLaborByQuantity(laborBase, quantity);
  }, []);

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

  const getRepairServiceWorkers = useCallback((service: RepairServiceDraft) => {
    if (service.workers.length > 0) return service.workers;
    const mainTechnician = employees.find(
      (employee) => employee.id === effectiveSelectedTechnicianId
    )?.name;
    return buildDefaultWorkerSplit(
      employees,
      mainTechnician,
      service.defaultWorkerSharePercent
    );
  }, [employees, effectiveSelectedTechnicianId]);

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

      const { data, error, count } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: false })
        .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .range(from, to);

      if (!error && data) {
        if (isLoadMore) {
          setServerCustomers((prev) => {
            const newIds = new Set(data.map(c => c.id));
            const filteredPrev = prev.filter(c => !newIds.has(c.id));
            return [...filteredPrev, ...data as Customer[]];
          });
        } else {
          setServerCustomers(data as Customer[]);
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
    setCustomerPage(0);
    setHasMoreCustomers(true);

    if (debouncedCustomerSearch && debouncedCustomerSearch.trim()) {
      fetchCustomers(0, debouncedCustomerSearch.trim(), false);
    } else {
      setServerCustomers([]);
    }
  }, [debouncedCustomerSearch]);

  const handleLoadMoreCustomers = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextPage = customerPage + 1;
    setCustomerPage(nextPage);
    fetchCustomers(nextPage, debouncedCustomerSearch.trim(), true);
  };

  const filteredCustomers = useMemo(() => {
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

  const filteredParts = useMemo(() => {
    if (!partSearchTerm) return parts;
    const term = partSearchTerm.toLowerCase();
    return parts.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term)
    );
  }, [parts, partSearchTerm]);

  useEffect(() => {
    if (partSearchTerm && filteredParts.length > 0 && partResultsRef.current) {
      partResultsRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [partSearchTerm, filteredParts.length]);

  const customerVehicles = useMemo(() => {
    if (!selectedCustomer) return [];
    const existingVehicles = selectedCustomer.vehicles || [];

    if (
      selectedVehicle &&
      !existingVehicles.find((v) => v.id === selectedVehicle.id)
    ) {
      return [...existingVehicles, selectedVehicle];
    }

    return existingVehicles;
  }, [selectedCustomer, selectedVehicle]);

  const _maintenanceWarnings = useMemo((): MaintenanceWarning[] => {
    if (!selectedVehicle) return [];
    const vehicleWithKm = {
      ...selectedVehicle,
      currentKm: currentKm ? parseInt(currentKm) : selectedVehicle.currentKm,
    };
    return checkVehicleMaintenance(vehicleWithKm);
  }, [selectedVehicle, currentKm]);

  React.useEffect(() => {
    if (customerVehicles.length === 1 && !selectedVehicle) {
      const vehicle = customerVehicles[0];
      setSelectedVehicle(vehicle);
      if (vehicle.currentKm) {
        setCurrentKm(vehicle.currentKm.toString());
      }
    }
  }, [customerVehicles, selectedVehicle]);

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
  }, [selectedParts, getPartLaborBase, getIntegratedLaborByQuantity]);

  const effectiveLaborCost = includeIntegratedLabor ? partsLaborInfoTotal : 0;

  const subtotal = partsTotal + servicesTotal + effectiveLaborCost + _repairLaborTotal;

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

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowCustomerSearch(false);
    setCustomerSearchTerm("");
    setSelectedVehicle(null);
    setCurrentKm("");
    setIsEditingCustomer(false);
    setEditCustomerName(customer.name);
    setEditCustomerPhone(customer.phone || "");
  };

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

    if (upsertCustomer) {
      upsertCustomer(updatedCustomer);
    }

    setSelectedCustomer(updatedCustomer);
    setIsEditingCustomer(false);
  };

  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
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

    if (selectedCustomer) {
      const updatedVehicles = [
        ...(selectedCustomer.vehicles || []),
        newVehicle,
      ];

      const updatedCustomer = {
        ...selectedCustomer,
        vehicles: updatedVehicles,
      };

      if (upsertCustomer) {
        upsertCustomer(updatedCustomer);
      }

      setSelectedCustomer(updatedCustomer);
      setSelectedVehicle(newVehicle);
    }

    setNewVehiclePlate("");
    setNewVehicleName("");
    setShowAddVehicle(false);
  };

  const handleAddNewCustomer = () => {
    if (!newCustomerName || !newCustomerPhone || !newCustomerVehicleModel) {
      alert("Vui lòng nhập Tên khách hàng, Số điện thoại và Tên thiết bị");
      return;
    }

    const customerId = `CUST-${Date.now()}`;
    const vehicleId = `VEH-${Date.now()}`;

    const vehicles: Vehicle[] = [];
    if (newCustomerVehicleModel || newCustomerLicensePlate) {
      vehicles.push({
        id: vehicleId,
        model: newCustomerVehicleModel || "",
        licensePlate: newCustomerLicensePlate || "",
        isPrimary: true,
      } as Vehicle);
    }

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

    if (upsertCustomer) {
      upsertCustomer(newCustomerObj);
    }

    setSelectedCustomer(newCustomerObj);
    if (vehicles.length > 0) {
      setSelectedVehicle(vehicles[0]);
    }

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
      setDevicePhotos(prev => prev.filter(url => url !== photoUrl));
      showToast.error("Không thể xóa ảnh từ hệ thống, đã gỡ khỏi phiếu hiện tại.");
    }
  };

  const handleSave = async (forceFullPayment = false) => {
    if (isSubmitting) return;

    if (!selectedCustomer || !selectedVehicle) {
      alert("Vui lòng chọn khách hàng và thiết bị");
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

    setIsSubmitting(true);
    const failSafeUnlockTimer = window.setTimeout(() => {
      setIsSubmitting(false);
    }, 20000);

    const totalDeposit = isDeposit ? depositAmount : 0;
    const maxAdditionalPayment = Math.max(0, total - totalDeposit);
    const additionalPayment =
      status === "Trả máy"
        ? forceFullPayment
          ? maxAdditionalPayment
          : showPaymentInput
            ? Math.min(partialAmount, maxAdditionalPayment)
            : 0
        : 0;
    const totalPaid = totalDeposit + additionalPayment;
    const remainingAmount = Math.max(0, total - totalPaid);

    const transformedParts = selectedParts.map((p) => ({
      partId: p.partId.startsWith("manual-") ? undefined : p.partId,
      partName: p.partName,
      quantity: p.quantity,
      price: p.sellingPrice,
      costPrice: p.costPrice || 0,
      sku: p.sku || "",
      category: p.category || "",
      warrantyPeriod: p.warrantyPeriod || getPartWarranty(p.partId) || undefined,
    }));

    const transformedServices = additionalServices.map((s) => ({
      id: s.id,
      description: s.name,
      quantity: s.quantity,
      price: s.sellingPrice,
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
      currentKm: undefined,
      issueDescription: currentKm
        ? issueDescription + `\\n\\n[Mật khẩu/Pattern]: ${currentKm}`
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

    try {
      await onSave(workOrderData);
    } catch (error: any) {
      console.error("Error saving work order:", error);

      const drafts = JSON.parse(localStorage.getItem("offline_drafts") || "[]");
      drafts.push({
        ...workOrderData,
        tempId: `draft-${Date.now()}`,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem("offline_drafts", JSON.stringify(drafts));

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

      alert(errorMessage + "\\n\\nDữ liệu đã được lưu tạm. Bạn có thể thử lại hoặc chụp màn hình.");
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

  // Reset submit lock when modal is reopened/closed
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      return;
    }
    setIsSubmitting(false);
  }, [isOpen, workOrder?.id]);

  return {
    isPatternMode,
    setIsPatternMode,
    status,
    setStatus,
    isStaffRole,
    isTechnicianLockedForStaff,
    selectedTechnicianId,
    setSelectedTechnicianId,
    effectiveSelectedTechnicianId,
    selectedCustomer,
    setSelectedCustomer,
    selectedVehicle,
    setSelectedVehicle,
    currentKm,
    setCurrentKm,
    issueDescription,
    setIssueDescription,
    devicePhotos,
    setDevicePhotos,
    isUploadingPhoto,
    selectedParts,
    setSelectedParts,
    additionalServices,
    setAdditionalServices,
    repairServices,
    setRepairServices,
    newRepairServiceDraft,
    setNewRepairServiceDraft,
    includeIntegratedLabor,
    setIncludeIntegratedLabor,
    discount,
    setDiscount,
    discountType,
    setDiscountType,
    isDeposit,
    setIsDeposit,
    depositAmount,
    setDepositAmount,
    paymentMethod,
    setPaymentMethod,
    showPaymentInput,
    setShowPaymentInput,
    partialAmount,
    setPartialAmount,
    showCustomerSearch,
    setShowCustomerSearch,
    customerSearchTerm,
    setCustomerSearchTerm,
    isSearchingCustomer,
    hasMoreCustomers,
    activeWarranty,
    showPartSearch,
    setShowPartSearch,
    partSearchTerm,
    setPartSearchTerm,
    activeScanField,
    setActiveScanField,
    partResultsRef,
    showAddService,
    setShowAddService,
    newServiceName,
    setNewServiceName,
    newServicePrice,
    setNewServicePrice,
    newServiceQuantity,
    setNewServiceQuantity,
    showAddVehicle,
    setShowAddVehicle,
    newVehiclePlate,
    setNewVehiclePlate,
    newVehicleName,
    setNewVehicleName,
    showAddCustomer,
    setShowAddCustomer,
    newCustomerName,
    setNewCustomerName,
    newCustomerPhone,
    setNewCustomerPhone,
    newCustomerVehicleModel,
    setNewCustomerVehicleModel,
    newCustomerLicensePlate,
    setNewCustomerLicensePlate,
    showAddManualPart,
    setShowAddManualPart,
    newManualPartName,
    setNewManualPartName,
    newManualPartCost,
    setNewManualPartCost,
    newManualPartPrice,
    setNewManualPartPrice,
    newManualPartQuantity,
    setNewManualPartQuantity,
    showVehicleDropdown,
    setShowVehicleDropdown,
    showCustomerVehicleDropdown,
    setShowCustomerVehicleDropdown,
    isEditingCustomer,
    setIsEditingCustomer,
    editCustomerName,
    setEditCustomerName,
    editCustomerPhone,
    setEditCustomerPhone,
    isSubmitting,
    activeSection,
    setActiveSection,
    
    // Calculated values
    initialCustomer,
    initialVehicles,
    initialVehicle,
    customerVehicles,
    _maintenanceWarnings,
    partsTotal,
    servicesTotal,
    partsLaborInfoTotal,
    effectiveLaborCost,
    subtotal,
    discountAmount,
    total,
    additionalPaymentPreview,
    remainingPreview,
    filteredCustomers,
    filteredParts,
    _repairLaborTotal,
    showLegacyRepairSection,

    // Handlers
    formatNumberWithDots,
    parseFormattedNumber,
    handleSelectCustomer,
    handleSaveEditedCustomer,
    handleSelectVehicle,
    handleAddPart,
    handleUpdatePartQuantity,
    handleRemovePart,
    handleAddService,
    handleRemoveService,
    handleAddManualPart,
    handleAddVehicle,
    handleAddNewCustomer,
    handleAddDevicePhoto,
    handleRemoveDevicePhoto,
    handleSave,
    handlePayFull,
    getPartLaborBase,
    getPartWarranty,
    getWarrantyForWorkOrderPart,
    getIntegratedLaborByQuantity,
    getRepairServiceLaborAmount,
    getRepairServiceWorkers,
    handleLoadMoreCustomers,
  };
}
