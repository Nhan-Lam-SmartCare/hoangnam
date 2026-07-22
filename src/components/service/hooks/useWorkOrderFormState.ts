import { useState, useMemo, useEffect, useRef } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import type {
  Employee,
  WorkOrder,
  Part,
  WorkOrderPart,
} from "../../../types";
import {
  normalizeSearchText,
} from "../../../utils/format";
import { useWorkOrderSave } from "../../../hooks/useWorkOrderSave";
import { searchCustomers } from "../../../lib/repository/customersRepository";
import { showToast } from "../../../utils/toast";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import { useWarrantyCards } from "../../../hooks/useWarrantyRepository";
import { useServiceConfigs } from "../../../hooks/useRepairLabor";
import {
  buildDefaultWorkerSplit,
  calculateLabor,
  splitWorkerAmount,
} from "../../../lib/services/repairLaborService";
import {
  calculateWorkOrderTotals,
  getAdditionalPaymentToApply,
  calculateRemainingAmount,
  derivePaymentStatus,
} from "../../../lib/services/workOrderCalculations";
import { compressImage } from "../../../utils/imageCompressor";
import { uploadDevicePhoto, deleteDevicePhoto } from "../../../lib/storage/devicePhotosStorage";
import { getSelectableEmployees } from "../../../utils/employees";

import {
  RepairServiceDraft,
  createEmptyRepairServiceDraft,
  mapRepairServiceToDraft,
  getPartLaborBase as sharedGetPartLaborBase,
  getPartWarranty as sharedGetPartWarranty,
  getIntegratedLaborByQuantity as sharedGetIntegratedLaborByQuantity,
} from "./useWorkOrderSharedLogic";

import type { StoreSettings } from "../types/service.types";

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
  const { profile } = useAuth();
  const { data: warrantyCards } = useWarrantyCards(currentBranchId);
  const { data: serviceConfigs = [] } = useServiceConfigs();
  const { mutateAsync: saveWorkOrderAsync } = useWorkOrderSave(
    upsertCustomer as (customer: any) => Promise<any>
  );

  const employeeOptions = getSelectableEmployees(employees as Employee[], currentBranchId);
  
  const defaultTechnicianName = useMemo(() => {
    const normalizedProfileEmail = String(profile?.email || "").trim().toLowerCase();
    const normalizedProfileName = String(profile?.name || profile?.full_name || "").trim().toLowerCase();

    if (!normalizedProfileEmail && !normalizedProfileName) return "";

    const activeEmployees = getSelectableEmployees(employees || [], currentBranchId);

    const matchedByEmail = activeEmployees.find(
      (emp) => String(emp?.email || "").trim().toLowerCase() === normalizedProfileEmail
    );
    if (matchedByEmail?.name) return matchedByEmail.name;

    const matchedByName = activeEmployees.find(
      (emp) => String(emp?.name || "").trim().toLowerCase() === normalizedProfileName
    );
    return matchedByName?.name || "";
  }, [employees, currentBranchId, profile?.email, profile?.name, profile?.full_name]);

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
      laborPrice?: number;
      costPrice?: number;
    }>
  >([]);
  const [newService, setNewService] = useState({
    description: "",
    quantity: 1,
    price: 0,
    laborPrice: 0,
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
      const res = await searchCustomers(searchTerm, page, CUSTOMER_PAGE_SIZE);
      if (!res.ok) throw res.error;
      const { data, count } = res.data;
      const from = page * CUSTOMER_PAGE_SIZE;

      if (data) {
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

  const buildRepairServicePayloads = () => {
    const repairPayloads = repairServices.map((service: RepairServiceDraft) => {
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

    const outsourcePayloads = additionalServices
      .filter((s: any) => (s.laborPrice || 0) > 0)
      .map((s: any) => {
        const laborAmount = (s.laborPrice || 0) * (s.quantity || 1);
        const effectiveWorkers = buildDefaultWorkerSplit(
          employeeOptions,
          resolvedTechnicianName,
          100
        );
        const workerSplits = splitWorkerAmount(laborAmount, effectiveWorkers);

        return {
          service_id: undefined,
          service_name: `[Gia công] ${s.description}`,
          labor_calc_type: "fixed" as const,
          labor_fixed_amount: laborAmount,
          labor_percent_of_cost: 0,
          minimum_labor_amount: 0,
          related_product_cost: (s.costPrice || 0) * (s.quantity || 1),
          labor_amount: laborAmount,
          worker_share_percent: workerSplits.length === 1 ? Number(workerSplits[0].share_percent || 0) : 100,
          worker_amount: workerSplits.length === 1 ? Number(workerSplits[0].worker_amount || 0) : 0,
          is_billable: false,
          is_payable_to_worker: true,
          note: "Tiền công gia công ngoài",
          workers: workerSplits,
          related_items: [],
        };
      });

    return [...repairPayloads, ...outsourcePayloads];
  };

  const getPartLaborBase = (partId: string) => sharedGetPartLaborBase(partId, parts, currentBranchId);
  const getPartWarranty = (partId: string) => sharedGetPartWarranty(partId, parts);
  const getIntegratedLaborByQuantity = (laborBase: number, quantity: number) => sharedGetIntegratedLaborByQuantity(laborBase, quantity);

  const repairLaborTotal = repairServices.reduce(
    (sum: number, service: RepairServiceDraft) => sum + (service.isBillable ? getRepairServiceLaborAmount(service) : 0),
    0
  );

  const partsLaborInfoTotal = selectedParts.reduce((sum: number, item: WorkOrderPart) => {
    const laborBase = getPartLaborBase(item.partId);
    return sum + getIntegratedLaborByQuantity(laborBase, Number(item.quantity || 0));
  }, 0);

  const discount = formData.discount || 0;
  const { partsTotal, servicesTotal, effectiveLaborCost, subtotal, total } =
    calculateWorkOrderTotals({
      parts: selectedParts.map((p) => ({
        quantity: p.quantity || 0,
        unitPrice: p.price || 0,
      })),
      services: additionalServices.map((s) => ({
        quantity: s.quantity || 0,
        unitPrice: s.price || 0,
        unitLaborPrice: s.laborPrice || 0,
      })),
      repairLaborTotal,
      integratedLaborTotal: partsLaborInfoTotal,
      includeIntegratedLabor,
      discount,
      discountType: "amount", // desktop chỉ hỗ trợ giảm giá theo số tiền
    });

  const totalDeposit = depositAmount || order.depositAmount || 0;

  const totalAdditionalPayment = getAdditionalPaymentToApply({
    status: formData.status,
    forceFullPayment: false,
    showPartialPayment,
    partialPayment,
    total,
    totalDeposit,
    clampToRemaining: false, // preview hiển thị không clamp (giữ hành vi cũ)
  });
  const totalPaid = totalDeposit + totalAdditionalPayment;
  const remainingAmount = calculateRemainingAmount(total, totalPaid);

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
      return "Bạn không có quyền sửa thông tin thiết bị trong phiếu sửa chữa";
    }

    if (outsourceServicesChanged && !canUpdateWorkOrderOutsourceService) {
      return "Bạn không có quyền tạo/sửa dịch vụ gia công ngoài";
    }

    return null;
  };

  const handleSaveOnly = async () => {
    const blockedMessageEarly = getBlockedDeepEditMessage(Number(order?.additionalPayment || 0));
    if (blockedMessageEarly) { showToast.error(blockedMessageEarly); return; }

    const existingPaid = (order?.depositAmount || 0) + (order?.additionalPayment || 0);
    const paymentStatus = derivePaymentStatus({ total, totalPaid: existingPaid });

    const payloads = buildRepairServicePayloads().filter((s: any) => s.service_name.trim().length > 0);

    try {
      const result = await saveWorkOrderAsync({
        existingOrder: order || null,
        formData: {
          customerName: formData.customerName || "",
          customerPhone: formData.customerPhone || "",
          vehicleModel: formData.vehicleModel,
          licensePlate: formData.licensePlate,
          vehicleId: formData.vehicleId,
          currentKm: formData.currentKm,
          issueDescription: formData.issueDescription,
          technicianName: resolvedTechnicianName,
          status: formData.status || "Tiếp nhận",
          paymentMethod: formData.paymentMethod,
        },
        laborCost: effectiveLaborCost,
        discount,
        total,
        depositAmount: depositAmount || 0,
        additionalPayment: 0,
        totalDeposit: (order?.depositAmount || 0),
        totalPaid: existingPaid,
        remainingAmount: total - existingPaid,
        paymentStatus,
        selectedParts,
        additionalServices,
        repairServicePayloads: payloads,
        devicePassword,
        devicePhotos: formData.devicePhotos,
        currentBranchId,
        storePrefix: storeSettings?.work_order_prefix,
        options: { atomic: false },
      });

      if (invalidateWorkOrders) invalidateWorkOrders();
      onSave(result.order);
      showToast.success(order?.id ? "Đã cập nhật phiếu" : "Đã lưu phiếu thành công");
      onClose();
    } catch (error: any) {
      console.error("handleSaveOnly error:", error);
    }
  };

  const handleSave = async (forceFullPayment = false) => {
    if (submittingRef.current || isSubmitting) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    const maxAdditionalPayment = Math.max(0, total - totalDeposit);
    const additionalPaymentPreview =
      formData.status === "Trả máy"
        ? forceFullPayment ? maxAdditionalPayment : showPartialPayment ? partialPayment : 0
        : 0;

    const blockedMessageEarly = getBlockedDeepEditMessage(additionalPaymentPreview);
    if (blockedMessageEarly) {
      showToast.error(blockedMessageEarly);
      setIsSubmitting(false);
      submittingRef.current = false;
      return;
    }

    const additionalPaymentToApply = getAdditionalPaymentToApply({
      status: formData.status,
      forceFullPayment,
      showPartialPayment,
      partialPayment,
      total,
      totalDeposit,
      clampToRemaining: true, // đường lưu clamp theo số còn lại (giữ hành vi cũ)
    });
    const totalPaidToApply = totalDeposit + additionalPaymentToApply;
    const remainingAmountToApply = calculateRemainingAmount(total, totalPaidToApply);
    const paymentStatus = derivePaymentStatus({ total, totalPaid: totalPaidToApply });

    const payloads = buildRepairServicePayloads().filter((s: any) => s.service_name.trim().length > 0);

    try {
      const result = await saveWorkOrderAsync({
        existingOrder: order || null,
        formData: {
          customerName: formData.customerName || "",
          customerPhone: formData.customerPhone || "",
          vehicleModel: formData.vehicleModel,
          licensePlate: formData.licensePlate,
          vehicleId: formData.vehicleId,
          currentKm: formData.currentKm,
          issueDescription: formData.issueDescription,
          technicianName: resolvedTechnicianName,
          status: formData.status || "Tiếp nhận",
          paymentMethod: formData.paymentMethod,
        },
        laborCost: effectiveLaborCost,
        discount,
        total,
        depositAmount: totalDeposit,
        additionalPayment: additionalPaymentToApply,
        totalDeposit,
        totalPaid: totalPaidToApply,
        remainingAmount: remainingAmountToApply,
        paymentStatus,
        selectedParts,
        additionalServices,
        repairServicePayloads: payloads,
        devicePassword,
        devicePhotos: formData.devicePhotos,
        currentBranchId,
        storePrefix: storeSettings?.work_order_prefix,
        options: { atomic: true },
      });

      if (invalidateWorkOrders) invalidateWorkOrders();

      if (result.usedFallback) {
        showToast.warning(
          "Đã lưu phiếu nhưng KHO CHƯA ĐƯỢC TRỪ tự động (thiếu RPC trên database). Vui lòng liên hệ quản trị để chạy migration."
        );
      }

      onSave(result.order);
      showToast.success(order?.id ? "Đã cập nhật phiếu" : "Đã tạo phiếu mới");
      onClose();
    } catch (error: any) {
      console.error("handleSave error:", error);
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
