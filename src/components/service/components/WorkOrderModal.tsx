import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import type { WorkOrder, Part, WorkOrderPart, Vehicle } from "../../../types";
import { formatCurrency, formatWorkOrderId, normalizeSearchText } from "../../../utils/format";
import { NumberInput } from "../../common/NumberInput";
import { getCategoryColor } from "../../../utils/categoryColors";
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
  paymentSources,
  currentBranchId,
  storeSettings,
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
        technicianName: order?.technicianName || "",
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

    const [searchPart, setSearchPart] = useState("");
    const [devicePassword, setDevicePassword] = useState("");
    const [selectedParts, setSelectedParts] = useState<WorkOrderPart[]>([]);
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
    const [expandedSections, setExpandedSections] = useState({
      customer: true,
      vehicle: true,
      issue: true,
      parts: true,
      services: true,
      payment: true,
    });

    // Manual parts entry state
    const [showAddManualPart, setShowAddManualPart] = useState(false);
    const [newManualPartName, setNewManualPartName] = useState("");
    const [newManualPartCost, setNewManualPartCost] = useState(0);
    const [newManualPartPrice, setNewManualPartPrice] = useState(0);
    const [newManualPartQuantity, setNewManualPartQuantity] = useState(1);
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
      console.log('[WorkOrderModal] Syncing additionalServices from order:', order?.additionalServices);
      if (order?.additionalServices && Array.isArray(order.additionalServices) && order.additionalServices.length > 0) {
        setAdditionalServices(order.additionalServices);
      } else {
        console.log('[WorkOrderModal] Setting additionalServices to empty array');
        setAdditionalServices([]);
      }

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
          setDevicePassword(match[1]);
        } else {
          setDevicePassword("");
        }
      } else {
        setDevicePassword("");
      }
    }, [order]);

    // Handler for Load More button
    const handleLoadMoreCustomers = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
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
      showToast.success("Đã thêm xe mới");
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

    // Calculate totals
    const partsTotal = selectedParts.reduce(
      (sum, p) => sum + (p.price || 0) * (p.quantity || 0),
      0
    );
    const servicesTotal = additionalServices.reduce(
      (sum, s) => sum + (s.price || 0) * (s.quantity || 0),
      0
    );
    const subtotal = (formData.laborCost || 0) + partsTotal + servicesTotal;
    const discount = formData.discount || 0;
    const total = Math.max(0, subtotal - discount);

    // Debug log
    console.log("Tinh toan:", {
      laborCost: formData.laborCost,
      partsTotal,
      servicesTotal,
      subtotal,
      discount,
      total,
    });

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

      console.log("[createCustomerDebtIfNeeded] CALLED with:", {
        workOrderId: workOrder.id,
        totalAmount,
        paidAmount,
        remainingAmount,
        customerName: workOrder.customerName,
        timestamp: new Date().toISOString(),
      });

      try {
        const safeCustomerId =
          workOrder.customerPhone || workOrder.id || `CUST-ANON-${Date.now()}`;
        const safeCustomerName =
          workOrder.customerName?.trim() ||
          workOrder.customerPhone ||
          "Khách vãng lai";

        // Tạo nội dung chi tiết từ phiếu sửa chữa
        const workOrderNumber =
          formatWorkOrderId(workOrder.id, storeSettings?.work_order_prefix)
            .split("-")
            .pop() || "";

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

        console.log("[ServiceManager] createCustomerDebt payload:", payload);
        const result = await createCustomerDebt.mutateAsync(payload as any);
        console.log("[ServiceManager] createCustomerDebt result:", result);
        showToast.success(
          `Đã tạo/cập nhật công nợ ${remainingAmount.toLocaleString()}đ (Mã: ${result?.id || "N/A"
          })`
        );
      } catch (error) {
        console.error("Error creating/updating customer debt:", error);
        showToast.error("Không thể tạo/cập nhật công nợ tự động");
      }
    };

    // 🔹 Function to handle deposit (Đặt cọc để đặt hàng)
    const handleDeposit = async () => {
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
          `${storeSettings?.work_order_prefix || "SC"}-${Date.now()}`;

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
          technicianName: formData.technicianName || "",
          status: formData.status || "Tiếp nhận",
          laborCost: formData.laborCost || 0,
          discount: discount,
          partsUsed: selectedParts,
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
          await supabase
            .from("work_orders")
            .update({
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
            })
            .eq("id", formData.id);
        } else {
          // Insert new work order
          await supabase.from("work_orders").insert({
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
          description: `Đặt cọc sửa chữa #${orderId.split("-").pop()} - ${formData.customerName
            }`,
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
          description: `Đặt hàng phụ tùng cho #${orderId.split("-").pop()} - ${formData.customerName
            }`,
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

      // Note: Không validate total > 0 vì có thể chỉ tiếp nhận thông tin, chưa báo giá

      // Add/update customer
      if (formData.customerName && formData.customerPhone) {
        const existingCustomer = customers.find(
          (c) => c.phone === formData.customerPhone
        );

        if (!existingCustomer) {
          // Chỉ tạo khách hàng mới nếu SĐT chưa tồn tại
          console.log(
            `[WorkOrderModal] Creating new customer: ${formData.customerName} (${formData.customerPhone})`
          );

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
          console.log(
            `[WorkOrderModal] Customer exists: ${existingCustomer.name} (${existingCustomer.phone})`
          );
          if (
            formData.vehicleModel &&
            existingCustomer.vehicleModel !== formData.vehicleModel
          ) {
            await upsertCustomer({
              ...existingCustomer,
              vehicleModel: formData.vehicleModel,
              licensePlate: formData.licensePlate,
            });
            console.log(
              `[WorkOrderModal] Updated vehicle info for existing customer`
            );
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
          `${storeSettings?.work_order_prefix || "SC"}-${Date.now()}`;

        const workOrderData = {
          id: orderId,
          customername: formData.customerName || "",
          customerphone: formData.customerPhone || "",
          vehicleid: formData.vehicleId,
          vehiclemodel: formData.vehicleModel || "",
          licenseplate: formData.licensePlate || "",
          currentkm: formData.currentKm,
          issuedescription: formData.issueDescription || "",
          technicianname: formData.technicianName || "",
          status: formData.status || "Tiếp nhận",
          laborcost: formData.laborCost || 0,
          discount: discount,
          partsused: selectedParts,
          additionalservices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchid: currentBranchId,
          paymentstatus: paymentStatus,
          paymentmethod: formData.paymentMethod || null,
          depositamount: order?.depositAmount || null,
          totalpaid: existingPaid > 0 ? existingPaid : null,
          remainingamount: total - existingPaid,
          creationdate: order?.creationDate || new Date().toISOString(),
        };

        // Save to Supabase database
        if (order?.id) {
          // Update existing
          const { data, error } = await supabase
            .from("work_orders")
            .update(workOrderData)
            .eq("id", order.id)
            .select();

          if (error) {
            console.error("[UPDATE ERROR]", error);
            throw error;
          }
          console.log("[UPDATE SUCCESS]", data);

          // Update vehicle currentKm if km was provided
          if (
            formData.currentKm &&
            formData.vehicleId &&
            formData.customerPhone
          ) {
            console.log(
              `[WorkOrderModal UPDATE] Attempting to update km ${formData.currentKm} for vehicle ${formData.vehicleId}`
            );
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
                  console.log(
                    `[WorkOrderModal UPDATE] ✅ Updated km ${formData.currentKm} to DB for vehicle ${formData.vehicleId}`
                  );
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
          } else {
            console.log(
              `[WorkOrderModal UPDATE] ⚠️ Skipping km update - currentKm: ${formData.currentKm}, vehicleId: ${formData.vehicleId}, phone: ${formData.customerPhone}`
            );
          }
        } else {
          // Insert new
          console.log("[INSERT] Attempting to insert:", workOrderData);
          const { data, error } = await supabase
            .from("work_orders")
            .insert(workOrderData)
            .select();

          if (error) {
            console.error("[INSERT ERROR]", error);
            console.error(
              "[INSERT ERROR DETAILS]",
              JSON.stringify(error, null, 2)
            );
            throw error;
          }
          console.log("[INSERT SUCCESS]", data);

          // Update vehicle currentKm if km was provided
          if (
            formData.currentKm &&
            formData.vehicleId &&
            formData.customerPhone
          ) {
            console.log(
              `[WorkOrderModal CREATE] Attempting to update km ${formData.currentKm} for vehicle ${formData.vehicleId}`
            );
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
                console.log(
                  `[WorkOrderModal CREATE] ✅ ${vehicleExists ? "Updated" : "Added"
                  } km ${formData.currentKm} to DB for vehicle ${formData.vehicleId
                  }`
                );
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
          } else {
            console.log(
              `[WorkOrderModal CREATE] ⚠️ Skipping km update - currentKm: ${formData.currentKm}, vehicleId: ${formData.vehicleId}, phone: ${formData.customerPhone}`
            );
          }
        }

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
    const handleSave = async () => {
      // 🔹 DEBUG - Log order info
      console.log(
        "[handleSave] Starting - order:",
        order?.id,
        "formData.status:",
        formData.status
      );

      // 🔹 PREVENT DUPLICATE SUBMISSIONS (synchronous check with ref)
      if (submittingRef.current || isSubmitting) {
        console.log("[handleSave] Already submitting, skipping...");
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
            console.log(
              `[WorkOrderModal] Creating new customer: ${formData.customerName} (${formData.customerPhone})`
            );

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
            console.log(
              `[WorkOrderModal] Customer exists: ${existingCustomer.name} (${existingCustomer.phone})`
            );
            if (
              formData.vehicleModel &&
              existingCustomer.vehicleModel !== formData.vehicleModel
            ) {
              await upsertCustomer({
                ...existingCustomer,
                vehicleModel: formData.vehicleModel,
                licensePlate: formData.licensePlate,
              });
              console.log(
                `[WorkOrderModal] Updated vehicle info for existing customer`
              );
            }
          }
        }

        // Determine payment status
        let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
        if (totalPaid >= total) {
          paymentStatus = "paid";
        } else if (totalPaid > 0) {
          paymentStatus = "partial";
        }

        // If this is a NEW work order, ALWAYS use atomic RPC
        if (!order?.id) {
          try {
            const orderId = `${storeSettings?.work_order_prefix || "SC"
              }-${Date.now()}`;

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
              technicianName: formData.technicianName || "",
              status: formData.status || "Tiếp nhận",
              laborCost: formData.laborCost || 0,
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
                totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
              totalPaid: totalPaid > 0 ? totalPaid : undefined,
              remainingAmount: remainingAmount,
              creationDate: new Date().toISOString(),
            } as any);

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
              technicianName: formData.technicianName || "",
              status: formData.status || "Tiếp nhận",
              laborCost: formData.laborCost || 0,
              discount: discount,
              partsUsed: selectedParts,
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
                totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
              totalPaid: totalPaid > 0 ? totalPaid : undefined,
              remainingAmount: remainingAmount,
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

            if (paymentTxId && totalAdditionalPayment > 0) {
              // INSERT payment transaction to database
              try {
                const { error: paymentDbError } = await supabase
                  .from("cash_transactions")
                  .insert({
                    id: paymentTxId,
                    type: "income",
                    category: "service_income",
                    amount: totalAdditionalPayment,
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
                  amount: totalAdditionalPayment,
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
                          totalAdditionalPayment,
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
                  console.log("[Outsourcing] Inserting expense transaction:", {
                    id: outsourcingTxId,
                    amount: -totalOutsourcingCost,
                    branchid: currentBranchId,
                  });

                  // Check if transaction already exists
                  const { data: existingTx } = await supabase
                    .from("cash_transactions")
                    .select("id")
                    .eq("reference", orderId)
                    .eq("category", "outsourcing")
                    .maybeSingle();

                  if (existingTx) {
                    console.log(
                      "[Outsourcing] Transaction already exists, skipping insert"
                    );
                  } else {
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
                      console.log("[Outsourcing] Insert SUCCESS");
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
                  console.log("[Negative Sales] Inserting expense transaction:", {
                    id: negativeSalesTxId,
                    amount: -negativeSalesPayment,
                    branchid: currentBranchId,
                  });

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

                  if (existingNegTx) {
                    console.log(
                      "[Negative Sales] Transaction already exists, skipping insert"
                    );
                  } else {
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
                      console.log("[Negative Sales] Insert SUCCESS");
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
                console.log(
                  "[handleSave] New order is fully paid AND atomic create didn't deduct inventory. Calling completeWorkOrderPayment..."
                );
                const result = await completeWorkOrderPayment(
                  orderId,
                  formData.paymentMethod || "cash",
                  0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
                );
                if (!result.ok) {
                  showToast.warning(
                    "Đã lưu phiếu nhưng có lỗi khi trừ kho: " +
                    (result.error.message || "Lỗi không xác định")
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
            if (formData.status === "Trả máy" && remainingAmount > 0) {
              console.log("[handleSave] Creating debt with finalOrder:", {
                id: finalOrder.id,
                customerName: finalOrder.customerName,
                customerPhone: finalOrder.customerPhone,
                licensePlate: finalOrder.licensePlate,
                vehicleModel: finalOrder.vehicleModel,
              });
              await createCustomerDebtIfNeeded(
                finalOrder,
                remainingAmount,
                total,
                totalPaid
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
          console.log(
            "[handleSave] UPDATE block - Order ID:",
            order.id,
            "Status:",
            formData.status
          );
          try {
            console.log("[handleSave] Calling updateWorkOrderAtomicAsync...");

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
              technicianName: formData.technicianName || "",
              status: formData.status || "Tiếp nhận",
              laborCost: formData.laborCost || 0,
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
                totalAdditionalPayment > 0 ? totalAdditionalPayment : undefined,
              totalPaid: totalPaid > 0 ? totalPaid : undefined,
              remainingAmount: remainingAmount,
            } as any);

            const workOrderRow = (responseData as any).workOrder;
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
                  order.technicianName ||
                  "",
                status: (workOrderRow as any).status || order.status,
                laborCost:
                  (workOrderRow as any).laborcost ||
                  (workOrderRow as any).laborCost ||
                  order.laborCost ||
                  0,
                discount: (workOrderRow as any).discount || order.discount || 0,
                partsUsed:
                  (workOrderRow as any).partsused ||
                  (workOrderRow as any).partsUsed ||
                  order.partsUsed ||
                  [],
                additionalServices:
                  additionalServices.length > 0 ? additionalServices : null,
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
                technicianName: formData.technicianName || order.technicianName,
                status: formData.status || order.status,
                laborCost: formData.laborCost || order.laborCost,
                discount: discount,
                partsUsed: selectedParts,
                additionalServices:
                  additionalServices.length > 0 ? additionalServices : null,
                total: total,
                depositAmount: depositAmount,
                depositTransactionId: depositTxId || order.depositTransactionId,
                paymentStatus: paymentStatus,
                paymentMethod: formData.paymentMethod || order.paymentMethod,
                additionalPayment: totalAdditionalPayment,
                totalPaid: totalPaid,
                remainingAmount: remainingAmount,
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

            console.log(
              "[handleSave] updateWorkOrderAtomicAsync SUCCESS - Response:",
              responseData
            );

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
                console.log(
                  "[handleSave] Order became fully paid, calling completeWorkOrderPayment to deduct inventory"
                );
                const result = await completeWorkOrderPayment(
                  order.id,
                  formData.paymentMethod || "cash",
                  0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
                );
                if (!result.ok) {
                  showToast.warning(
                    "Đã cập nhật phiếu nhưng có lỗi khi trừ kho: " +
                    (result.error.message || "Lỗi không xác định")
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
            if (formData.status === "Trả máy" && remainingAmount > 0) {
              await createCustomerDebtIfNeeded(
                finalOrder,
                remainingAmount,
                total,
                totalPaid
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
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
        <div className="bg-white dark:bg-slate-800 w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl rounded-t-3xl md:rounded-xl shadow-2xl md:shadow-lg flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 md:px-6 md:py-4 flex items-center justify-between rounded-t-3xl md:rounded-t-xl flex-shrink-0">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {formData.id
                ? `Chi tiết Phiếu sửa chữa - ${formatWorkOrderId(
                  formData.id,
                  storeSettings?.work_order_prefix
                )}`
                : "Tạo Phiếu sửa chữa mới"}
            </h2>
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
          <div className="px-4 py-5 md:px-6 md:py-6 space-y-6 overflow-y-auto flex-1 pb-24 md:pb-6">
            {/* Customer & Vehicle Info */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Thông tin Khách hàng & Sự cố
                </h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Khách hàng <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative customer-search-container">
                      <input
                        type="text"
                        placeholder="Tìm khách hàng..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(true);
                          setFormData({
                            ...formData,
                            customerName: e.target.value,
                          });
                        }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />

                      {/* Customer Dropdown */}
                      {showCustomerDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredCustomers.length > 0 ? (
                            <>
                              {filteredCustomers.map((customer) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() => {
                                    // Find primary vehicle or first vehicle
                                    const primaryVehicle =
                                      customer.vehicles?.find(
                                        (v: Vehicle) => v.isPrimary
                                      ) || customer.vehicles?.[0];

                                    setFormData({
                                      ...formData,
                                      customerName: customer.name,
                                      customerPhone: customer.phone,
                                      vehicleId: primaryVehicle?.id,
                                      vehicleModel:
                                        primaryVehicle?.model ||
                                        customer.vehicleModel ||
                                        "",
                                      licensePlate:
                                        primaryVehicle?.licensePlate ||
                                        customer.licensePlate ||
                                        "",
                                    });
                                    setCustomerSearch(customer.name);
                                    setShowCustomerDropdown(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 border-b border-slate-200 dark:border-slate-600 last:border-0"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                                        {customer.name}
                                      </div>
                                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                        🔹 {customer.phone}
                                      </div>
                                      {(customer.vehicleModel ||
                                        customer.licensePlate ||
                                        customer.vehicles?.length > 0) && (
                                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                                            <svg
                                              className="w-3 h-3"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <circle cx="6" cy="17" r="2" />
                                              <circle cx="18" cy="17" r="2" />
                                              <path d="M4 17h2l4-6h2l2 3h4" />
                                            </svg>
                                            {(() => {
                                              const primaryVehicle =
                                                customer.vehicles?.find(
                                                  (v: any) => v.isPrimary
                                                ) || customer.vehicles?.[0];
                                              const model =
                                                primaryVehicle?.model ||
                                                customer.vehicleModel;
                                              const plate =
                                                primaryVehicle?.licensePlate ||
                                                customer.licensePlate;
                                              return (
                                                <>
                                                  {model && <span>{model}</span>}
                                                  {plate && (
                                                    <span className="font-mono font-semibold text-yellow-600 dark:text-yellow-400">
                                                      {model && " - "}
                                                      {plate}
                                                    </span>
                                                  )}
                                                  {customer.vehicles?.length > 1 && (
                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">
                                                      (+{customer.vehicles.length - 1}
                                                      )
                                                    </span>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                </button>
                              ))}
                              {hasMoreCustomers && customerSearch.trim() && (
                                <button
                                  type="button"
                                  onClick={handleLoadMoreCustomers}
                                  className="w-full text-center px-3 py-3 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-slate-200 dark:border-slate-600"
                                >
                                  {isSearchingCustomer
                                    ? "Đang tải..."
                                    : "⬇️ Tải thêm khách hàng..."}
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                              {customers.length === 0
                                ? "Chưa có khách hàng nào. Nhấn '+' để thêm khách hàng mới."
                                : "Không tìm thấy khách hàng phù hợp"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCustomerModal(true);
                        // Pre-fill phone if search term looks like a phone number
                        if (customerSearch && /^[0-9]+$/.test(customerSearch)) {
                          setNewCustomer({
                            ...newCustomer,
                            phone: customerSearch,
                          });
                        }
                      }}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-xl"
                      title="Thêm khách hàng mới"
                    >
                      +
                    </button>
                  </div>

                  {/* Display customer info after selection */}
                  {formData.customerName && formData.customerPhone && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-start justify-between">
                        {/* View Mode */}
                        {!isEditingCustomer ? (
                          <>
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {formData.customerName}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    className="w-3.5 h-3.5"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M2.25 6.75c0 8.284 6.716 15 15 15 .828 0 1.5-.672 1.5-1.5v-2.25a1.5 1.5 0 00-1.5-1.5h-1.158a1.5 1.5 0 00-1.092.468l-.936.996a1.5 1.5 0 01-1.392.444 12.035 12.035 0 01-7.29-7.29 1.5 1.5 0 01.444-1.392l.996-.936a1.5 1.5 0 00.468-1.092V6.75A1.5 1.5 0 006.75 5.25H4.5c-.828 0-1.5.672-1.5 1.5z"
                                    />
                                  </svg>
                                  {formData.customerPhone}
                                </span>
                              </div>
                              {(formData.vehicleModel ||
                                formData.licensePlate) && (
                                  <div className="text-xs text-slate-600 dark:text-slate-400">
                                    <span className="inline-flex items-center gap-1">
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        className="w-3.5 h-3.5"
                                      >
                                        <circle cx="6" cy="17" r="2" />
                                        <circle cx="18" cy="17" r="2" />
                                        <path d="M4 17h2l4-6h2l2 3h4" />
                                      </svg>
                                      {formData.vehicleModel}{" "}
                                      {formData.licensePlate &&
                                        `- ${formData.licensePlate}`}
                                    </span>
                                  </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditCustomerName(
                                    formData.customerName || ""
                                  );
                                  setEditCustomerPhone(
                                    formData.customerPhone || ""
                                  );
                                  setIsEditingCustomer(true);
                                }}
                                className="text-slate-400 hover:text-blue-500 text-sm flex items-center"
                                title="Sửa thông tin khách hàng"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                                  />
                                </svg>
                              </button>
                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => {
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
                                className="text-slate-400 hover:text-red-500 text-sm flex items-center"
                                title="Xóa khách hàng"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          </>
                        ) : (
                          /* Edit Mode */
                          <div className="w-full space-y-2">
                            <div>
                              <label className="text-xs text-slate-500 dark:text-slate-400">
                                Tên khách hàng
                              </label>
                              <input
                                type="text"
                                value={editCustomerName}
                                onChange={(e) =>
                                  setEditCustomerName(e.target.value)
                                }
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                placeholder="Nhập tên khách hàng"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 dark:text-slate-400">
                                Số điện thoại
                              </label>
                              <input
                                type="tel"
                                value={editCustomerPhone}
                                onChange={(e) =>
                                  setEditCustomerPhone(e.target.value)
                                }
                                className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                placeholder="Nhập số điện thoại"
                              />
                            </div>
                            <div className="flex gap-2 justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => setIsEditingCustomer(false)}
                                className="px-3 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500"
                              >
                                Hủy
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveEditedCustomer}
                                className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600"
                              >
                                Lưu
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Vehicle Selection & Add Vehicle (for selected customer) */}
                  {currentCustomer && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                          {customerVehicles.length > 0
                            ? "Chọn xe"
                            : "Xe của khách hàng"}
                          {customerVehicles.length > 0 && (
                            <span className="text-xs text-slate-500 ml-1">
                              ({customerVehicles.length} xe)
                            </span>
                          )}
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowAddVehicleModal(true)}
                          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium"
                          title="Thêm xe mới"
                        >
                          + Thêm xe
                        </button>
                      </div>

                      {customerVehicles.length > 0 ? (
                        <div className="space-y-2">
                          {customerVehicles.map((vehicle: Vehicle) => {
                            const isSelected = formData.vehicleId === vehicle.id;
                            const isPrimary = vehicle.isPrimary;
                            const isEditing = editingVehicleId === vehicle.id;

                            return (
                              <div
                                key={vehicle.id}
                                className={`w-full rounded-lg border-2 transition-all ${isSelected
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                                  : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                                  }`}
                              >
                                {isEditing ? (
                                  // Edit mode
                                  <div className="p-3 space-y-2">
                                    <div>
                                      <label className="text-xs text-slate-500 dark:text-slate-400">
                                        Tên thiết bị
                                      </label>
                                      <input
                                        type="text"
                                        value={editVehicleModel}
                                        onChange={(e) =>
                                          setEditVehicleModel(e.target.value)
                                        }
                                        className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="Nhập tên thiết bị (VD: iPhone 13...)"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-slate-500 dark:text-slate-400">
                                        Serial/IMEI
                                      </label>
                                      <input
                                        type="text"
                                        value={editVehicleLicensePlate}
                                        onChange={(e) =>
                                          setEditVehicleLicensePlate(
                                            e.target.value
                                          )
                                        }
                                        className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                        placeholder="Nhập Serial/IMEI"
                                      />
                                    </div>
                                    <div className="flex gap-2 justify-end pt-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingVehicleId(null);
                                          setEditVehicleModel("");
                                          setEditVehicleLicensePlate("");
                                        }}
                                        className="px-3 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500"
                                      >
                                        Hủy
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleSaveEditedVehicle}
                                        className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600"
                                      >
                                        Lưu
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // Display mode
                                  <button
                                    type="button"
                                    onClick={() => handleSelectVehicle(vehicle)}
                                    className="w-full text-left px-3 py-2.5"
                                  >
                                    <div className="flex items-center gap-2">
                                      {isPrimary && (
                                        <span
                                          className="text-yellow-500"
                                          title="Xe chính"
                                        >
                                          ⭐
                                        </span>
                                      )}
                                      <div className="flex-1">
                                        <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                          {vehicle.model}
                                        </div>
                                        <div className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                                          {vehicle.licensePlate}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingVehicleId(vehicle.id);
                                            setEditVehicleModel(
                                              vehicle.model || ""
                                            );
                                            setEditVehicleLicensePlate(
                                              vehicle.licensePlate || ""
                                            );
                                          }}
                                          className="text-slate-400 hover:text-blue-500 p-1"
                                          title="Sửa thông tin xe"
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
                                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                          </svg>
                                        </button>
                                        {isSelected && (
                                          <svg
                                            className="w-5 h-5 text-blue-500"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path
                                              fillRule="evenodd"
                                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                              clipRule="evenodd"
                                            />
                                          </svg>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Chưa có xe nào. Nhấn "+ Thêm xe" để thêm.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Mật khẩu màn hình
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập mật khẩu / Pattern..."
                    value={devicePassword}
                    onChange={(e) => setDevicePassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono text-red-600 dark:text-red-400 font-bold"
                  />
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
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Chi tiết Dịch vụ
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Trạng thái
                    </label>
                    <select
                      value={formData.status || "Tiếp nhận"}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as any,
                        })
                      }
                      className={`w-full px-3 py-2 border rounded-lg font-medium ${formData.status === "Tiếp nhận"
                        ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                        : formData.status === "Đang sửa"
                          ? "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300"
                          : formData.status === "Đã sửa xong"
                            ? "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                            : "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                        }`}
                    >
                      <option
                        value="Tiếp nhận"
                        className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      >
                        Tiếp nhận
                      </option>
                      <option
                        value="Đang sửa"
                        className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      >
                        Đang sửa
                      </option>
                      <option
                        value="Đã sửa xong"
                        className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      >
                        Đã sửa xong
                      </option>
                      <option
                        value="Trả máy"
                        className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      >
                        Trả máy
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Kỹ thuật viên
                    </label>
                    <select
                      value={formData.technicianName || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          technicianName: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="">-- Chọn kỹ thuật viên --</option>
                      {employees
                        .filter(
                          (emp) =>
                            emp.status === "active" &&
                            (emp.department?.toLowerCase().includes("kỹ thuật") ||
                              emp.position?.toLowerCase().includes("kỹ thuật"))
                        )
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
                    Phí dịch vụ (Công thợ)
                    {!canEditPriceAndParts && (
                      <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                        (Không thể sửa)
                      </span>
                    )}
                  </label>
                  <NumberInput
                    placeholder="100.000"
                    value={formData.laborCost || ""}
                    onChange={(val) =>
                      setFormData({
                        ...formData,
                        laborCost: val,
                      })
                    }
                    disabled={!canEditPriceAndParts}
                    className={`w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${!canEditPriceAndParts ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                  />
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
              </div>
            </div>

            {/* Parts Used */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
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
                            <div className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                              {part.partName}
                            </div>
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
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
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
                        Giá nhập
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
                        <td className="px-4 py-2 text-right relative">
                          <NumberInput
                            value={service.costPrice ?? 0}
                            onChange={(val) =>
                              setAdditionalServices(
                                additionalServices.map((s) =>
                                  s.id === service.id
                                    ? { ...s, costPrice: val }
                                    : s
                                )
                              )
                            }
                            // Always allow editing cost price for internal tracking
                            disabled={false}
                            className="w-full px-2 py-1 border border-orange-200 dark:border-orange-800 rounded text-right bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-400 focus:border-orange-500 focus:bg-white dark:focus:bg-slate-700 transition-colors text-sm"
                            placeholder="0"
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
                                  console.log('[WorkOrderModal] Xóa hết additionalServices, update DB ngay');
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
                          placeholder="Giá nhập"
                          value={newService.costPrice ?? ""}
                          onChange={(val) =>
                            setNewService({
                              ...newService,
                              costPrice: Math.max(0, val), // Chỉ cho phép >= 0
                            })
                          }
                          className="w-full px-2 py-1 border border-orange-300 dark:border-orange-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
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
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: Payment Options */}
                <div className="space-y-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
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
                            onChange={(e) =>
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
                            onChange={(e) =>
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
                              if (!e.target.checked) setPartialPayment(0);
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
                            <div className="flex items-center gap-2">
                              <NumberInput
                                placeholder="0"
                                value={partialPayment || ""}
                                onChange={(val) => setPartialPayment(val)}
                                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                              />
                              <button
                                onClick={() => setPartialPayment(0)}
                                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                              >
                                0%
                              </button>
                              <button
                                onClick={() =>
                                  setPartialPayment(
                                    Math.round(remainingAmount * 0.5)
                                  )
                                }
                                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                              >
                                50%
                              </button>
                              <button
                                onClick={() => setPartialPayment(remainingAmount)}
                                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                              >
                                100%
                              </button>
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
                <div className="space-y-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Tổng kết
                  </h3>

                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Phí dịch vụ:
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(formData.laborCost || 0)}
                    </span>
                  </div>
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
            </div>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4 md:px-6 flex items-center justify-end gap-3 bg-white md:bg-slate-50 dark:bg-slate-800/70 md:dark:bg-slate-800/50 rounded-b-3xl md:rounded-b-xl flex-shrink-0">
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
                onClick={handleSave}
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
                onClick={handleSave}
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
                        console.log(
                          "[WorkOrderModal] Creating new customer from modal:",
                          newCustomer.phone
                        );

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
                        console.log(
                          "[WorkOrderModal] Customer already exists from modal:",
                          existingCustomer.id,
                          existingCustomer.phone
                        );

                        const hasVehicleChange =
                          (newCustomer.vehicleModel &&
                            newCustomer.vehicleModel !==
                            existingCustomer.vehicleModel) ||
                          (newCustomer.licensePlate &&
                            newCustomer.licensePlate !==
                            existingCustomer.licensePlate);

                        let vehicleIdToUse = existingCustomer.vehicles?.[0]?.id;

                        if (hasVehicleChange) {
                          console.log(
                            "[WorkOrderModal] Updating vehicle info for existing customer from modal"
                          );
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
                Thêm xe cho {currentCustomer.name}
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
