// Core session/user placeholder
export interface UserSession {
  id: string;
  email: string;
  name?: string;
}

// Domain Types (subset adapted from original repo for standalone needs)

// Thông tin bảo dưỡng gần nhất của xe
export interface MaintenanceRecord {
  km: number; // Số km tại thời điểm bảo dưỡng
  date: string; // Ngày bảo dưỡng (ISO string)
}

export interface VehicleMaintenances {
  oilChange?: MaintenanceRecord; // Thay nhớt máy (chu kỳ 1,000-1,500 km)
  gearboxOil?: MaintenanceRecord; // Thay nhớt hộp số (chu kỳ 5,000 km)
  throttleClean?: MaintenanceRecord; // Vệ sinh kim phun, họng ga, nồi (chu kỳ 20,000 km)
}

export interface Vehicle {
  id: string;
  model: string; // Dòng xe: Exciter, Wave, SH...
  licensePlate: string; // Biển số
  isPrimary?: boolean; // Xe chính (mặc định)
  currentKm?: number; // Số km hiện tại (cập nhật mỗi lần vào xưởng)
  firstRecordedKm?: number; // Số km lần đầu ghi nhận (khi khách mới đến)
  firstRecordedDate?: string; // Ngày lần đầu ghi nhận km (ISO string)
  lastMaintenances?: VehicleMaintenances; // Lịch sử bảo dưỡng gần nhất
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  vehicleModel?: string; // Xe (Dòng xe) - DEPRECATED: Giữ để tương thích
  licensePlate?: string; // Biển số - DEPRECATED: Giữ để tương thích
  vehicles?: Vehicle[]; // Danh sách xe của khách hàng
  created_at?: string;
  status?: "active" | "inactive";
  segment?: "VIP" | "Loyal" | "Potential" | "At Risk" | "Lost" | "New";
  loyaltyPoints?: number; // Điểm tích lũy
  totalSpent?: number; // Tổng chi tiêu
  visitCount?: number; // Số lần ghé thăm
  lastVisit?: string; // Lần ghé thăm cuối
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at?: string;
}

export interface Part {
  id: string;
  name: string;
  sku: string;
  imageUrl?: string;
  barcode?: string; // Mã vạch của hãng (Honda: 06455-KYJ-841, Yamaha: 5S9-F2101-00)
  // Stock & pricing are branch-mapped for multi-branch future extension
  stock: { [branchId: string]: number };
  reservedStock?: { [branchId: string]: number }; // Số lượng đặt trước cho phiếu sửa chữa chưa thanh toán
  retailPrice: { [branchId: string]: number };
  wholesalePrice?: { [branchId: string]: number };
  category?: string;
  description?: string;
  warrantyPeriod?: string;
  // Tax & costing extensions (for future real data integration)
  costPrice?: { [branchId: string]: number };
  vatRate?: number; // e.g. 0.1 for 10%
  created_at?: string;
}

/** Thông tin cảnh báo tồn kho khi tạo/cập nhật phiếu sửa chữa */
export interface StockWarning {
  partId: string;
  partName: string;
  requested: number;
  available: number;
  shortage: number;
}

// Product Category entity (normalized instead of deriving from parts)
export interface Category {
  id: string;
  name: string;
  icon?: string; // UI icon key
  color?: string; // Hex color
  created_at?: string;
  updated_at?: string;
}

export interface CartItem {
  partId: string;
  partName: string;
  sku: string;
  category?: string;
  quantity: number;
  sellingPrice: number; // Final unit price after selecting retail/wholesale
  stockSnapshot: number; // Stock at time added for validation
  discount?: number; // Per-line discount (absolute)
  isService?: boolean; // Mark as service item to skip stock validation
}

export interface Sale {
  id: string;
  sale_code?: string; // Mã phiếu bán hàng (VD: BH-20241117-001)
  date: string; // ISO
  items: CartItem[];
  subtotal: number; // Sum of (sellingPrice * quantity) before discounts
  discount: number; // Order-level discount (absolute)
  total: number; // subtotal - discount - sum(per-line discounts) if applied
  customer: { id?: string; name: string; phone?: string };
  paymentMethod: "cash" | "bank";
  userId: string; // snapshot user
  userName: string;
  branchId: string;
  cashTransactionId?: string; // link to recorded cash transaction

  // Delivery & COD fields
  delivery_method?: "pickup" | "delivery"; // Tự lấy hoặc giao hàng
  delivery_status?: "pending" | "preparing" | "shipping" | "delivered" | "cancelled"; // Trạng thái giao hàng
  delivery_address?: string; // Địa chỉ giao hàng
  delivery_phone?: string; // SĐT nhận hàng
  delivery_note?: string; // Ghi chú giao hàng
  shipper_id?: string; // ID nhân viên giao hàng
  shipper_name?: string; // Tên nhân viên (joined)
  cod_amount?: number; // Số tiền thu hộ COD
  shipping_fee?: number; // Phí vận chuyển
  estimated_delivery_date?: string; // Ngày giao dự kiến (ISO)
  actual_delivery_date?: string; // Ngày giao thực tế (ISO)
  tracking_number?: string; // Mã vận đơn (GHN, GHTK, etc.)
}

export interface WorkOrderPart {
  partId: string;
  partName: string;
  sku: string;
  category?: string;
  quantity: number;
  price: number; // Selling price snapshot
  costPrice?: number; // Cost price for profit calculation
}

export interface WorkOrder {
  id: string;
  creationDate: string; // ISO
  customerName: string;
  customerPhone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  vehicleId?: string; // NEW: Link to specific vehicle from customer.vehicles[]
  currentKm?: number; // Số km hiện tại tại thời điểm tạo phiếu
  issueDescription?: string;
  technicianName?: string;
  status: "Tiếp nhận" | "Đang sửa" | "Đã sửa xong" | "Trả máy" | "\u0110\u00E3 h\u1EE7y";
  laborCost: number;
  discount?: number; // Order level discount
  partsUsed?: WorkOrderPart[];
  additionalServices?: Array<{
    id: string;
    description: string;
    quantity: number;
    price: number;
    costPrice?: number; // Giá nhập
  }>; // Báo giá (Gia công, Đặt hàng)
  notes?: string;
  total: number; // labor + parts - discount
  branchId: string;

  // Deposit (Đặt cọc)
  depositAmount?: number; // Số tiền đặt cọc
  depositDate?: string; // Ngày đặt cọc
  depositTransactionId?: string; // Link to deposit transaction

  // Payment (Thanh toán)
  paymentStatus?: "unpaid" | "paid" | "partial";
  paymentMethod?: "cash" | "bank";
  additionalPayment?: number; // Số tiền thanh toán thêm khi trả xe
  totalPaid?: number; // Tổng đã trả = depositAmount + additionalPayment
  remainingAmount?: number; // Còn nợ = total - totalPaid
  paymentDate?: string;
  cashTransactionId?: string; // Link to final payment transaction

  // Refund (Hoàn tiền)
  refunded?: boolean; // True if refunded/cancelled
  refunded_at?: string; // Timestamp when refunded (snake_case to match DB)
  refund_transaction_id?: string; // Link to refund transaction (snake_case to match DB)
  refund_reason?: string; // Reason for refund (snake_case to match DB)
}

export interface InventoryTransaction {
  id: string;
  type: "Nhập kho" | "Xuất kho";
  partId: string;
  partName: string;
  quantity: number;
  date: string;
  unitPrice?: number; // for nhập kho (cost)
  totalPrice: number;
  branchId: string;
  notes?: string;
  saleId?: string;
  workOrderId?: string;
}

export interface PaymentSource {
  id: string; // e.g. 'cash', 'bank'
  name: string;
  balance: { [branchId: string]: number };
  isDefault?: boolean;
}

export type CashTransactionCategory =
  | "sale_income"
  | "service_income"
  | "other_income"
  | "inventory_purchase"
  | "salary"
  | "loan_payment"
  | "debt_collection"
  | "debt_payment"
  | "sale_refund"
  | "other_expense";

export interface CashTransaction {
  id: string;
  type: "income" | "expense";
  date: string;
  amount: number;
  recipient?: string; // Đối tượng thu/chi
  notes: string;
  paymentSourceId: string;
  branchId: string;
  category?: CashTransactionCategory;
  saleId?: string;
  workOrderId?: string;
}

// Employee & Payroll Types
export interface Employee {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  position: string; // Chức vụ
  department?: string; // Phòng ban
  baseSalary: number; // Lương cơ bản
  allowances?: number; // Phụ cấp
  startDate: string; // Ngày vào làm
  status: "active" | "inactive" | "terminated";
  branchId?: string; // Chi nhánh
  bankAccount?: string; // Số tài khoản
  bankName?: string; // Tên ngân hàng
  taxCode?: string; // Mã số thuế
  created_at?: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string; // Format: YYYY-MM
  baseSalary: number; // Lương cơ bản
  allowances: number; // Phụ cấp
  bonus: number; // Thưởng
  deduction: number; // Phạt/Khấu trừ
  workDays: number; // Số ngày làm việc
  standardWorkDays: number; // Số ngày chuẩn (26)
  socialInsurance: number; // BHXH (8%)
  healthInsurance: number; // BHYT (1.5%)
  unemploymentInsurance: number; // BHTN (1%)
  personalIncomeTax: number; // Thuế TNCN
  netSalary: number; // Lương thực nhận
  paymentStatus: "pending" | "paid";
  paymentDate?: string;
  paymentMethod?: "cash" | "bank";
  notes?: string;
  branchId: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  checkIn?: string; // HH:MM:SS
  checkOut?: string; // HH:MM:SS
  status: "present" | "absent" | "late" | "leave" | "holiday";
  workHours?: number;
  overtime?: number;
  notes?: string;
  branchId: string;
}

// Loan & Capital Types
export interface Loan {
  id: string;
  lenderName: string; // Tên ngân hàng/người cho vay
  loanType: "bank" | "personal" | "other"; // Loại vay
  principal: number; // Số tiền vay gốc
  interestRate: number; // Lãi suất %/năm
  term: number; // Kỳ hạn (tháng)
  startDate: string; // Ngày vay
  endDate: string; // Ngày đến hạn
  remainingAmount: number; // Số tiền còn nợ
  monthlyPayment: number; // Số tiền trả hàng tháng
  status: "active" | "paid" | "overdue";
  purpose?: string; // Mục đích vay
  collateral?: string; // Tài sản thế chấp
  notes?: string;
  branchId: string;
  created_at: string;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  paymentDate: string;
  principalAmount: number; // Tiền gốc
  interestAmount: number; // Tiền lãi
  totalAmount: number; // Tổng tiền trả
  remainingAmount: number; // Số tiền còn lại sau khi trả
  paymentMethod: "cash" | "bank";
  notes?: string;
  branchId: string;
  cashTransactionId?: string;
}

export interface Capital {
  id: string;
  type: "owner" | "investor" | "loan"; // Vốn chủ/Nhà đầu tư/Vay
  sourceName: string; // Tên nguồn vốn
  amount: number; // Số tiền
  date: string; // Ngày nhận
  notes?: string;

  // Thông tin lãi suất (áp dụng cho investor và loan)
  interestRate?: number; // Lãi suất %/năm
  interestType?: "simple" | "compound"; // Lãi đơn/Lãi kép
  paymentFrequency?: "monthly" | "quarterly" | "yearly"; // Kỳ trả lãi
  maturityDate?: string; // Ngày đến hạn

  branchId: string;
  created_at: string;
}

export interface FixedAsset {
  id: string;
  name: string; // Tên tài sản
  assetType: "equipment" | "vehicle" | "building" | "furniture" | "other"; // Loại tài sản
  purchaseDate: string; // Ngày mua
  purchasePrice: number; // Giá mua
  currentValue: number; // Giá trị hiện tại
  depreciationRate: number; // Tỷ lệ khấu hao %/năm
  depreciationMethod: "straight-line" | "declining-balance"; // Phương pháp khấu hao
  usefulLife: number; // Thời gian sử dụng (năm)
  status: "active" | "disposed" | "maintenance"; // Trạng thái
  location?: string; // Vị trí
  serialNumber?: string; // Số serial
  supplier?: string; // Nhà cung cấp
  warranty?: string; // Bảo hành đến
  notes?: string; // Ghi chú
  branchId: string;
  created_at: string;
  updated_at?: string;
}

export interface FixedAssetDepreciation {
  id: string;
  assetId: string;
  year: number;
  month: number;
  depreciationAmount: number; // Số tiền khấu hao
  accumulatedDepreciation: number; // Khấu hao lũy kế
  bookValue: number; // Giá trị còn lại
  created_at: string;
}

export interface CustomerDebt {
  id: string;
  customerId: string;
  customerName: string;
  phone?: string;
  licensePlate?: string;
  description: string; // Nội dung
  totalAmount: number; // Số tiền
  paidAmount: number; // Đã trả
  remainingAmount: number; // Còn nợ
  createdDate: string;
  branchId: string;
}

export interface SupplierDebt {
  id: string;
  supplierId: string;
  supplierName: string;
  description: string; // Nội dung
  totalAmount: number; // Số tiền
  paidAmount: number; // Đã trả
  remainingAmount: number; // Còn nợ
  createdDate: string;
  branchId: string;
}

// Employee Advance (Ứng lương)
export interface EmployeeAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  advanceAmount: number; // Số tiền ứng
  advanceDate: string; // Ngày ứng
  reason?: string; // Lý do
  paymentMethod: "cash" | "transfer"; // Nguồn tiền: Tiền mặt hoặc Chuyển khoản
  status: "pending" | "approved" | "rejected" | "paid"; // Trạng thái
  approvedBy?: string; // Người duyệt
  approvedDate?: string; // Ngày duyệt

  // Trả góp
  isInstallment: boolean; // Có trả góp không
  installmentMonths?: number; // Số tháng trả góp
  monthlyDeduction?: number; // Số tiền trừ hàng tháng
  remainingAmount: number; // Còn nợ
  paidAmount: number; // Đã trả

  branchId: string;
  created_at: string;
  updated_at?: string;
}

export interface EmployeeAdvancePayment {
  id: string;
  advanceId: string;
  employeeId: string;
  amount: number; // Số tiền trả
  paymentDate: string; // Ngày trả
  paymentMonth: string; // Tháng lương (YYYY-MM)
  payrollRecordId?: string; // Link to payroll record
  notes?: string;
  branchId: string;
  created_at: string;
}

// =====================================================
// Purchase Orders (Đơn đặt hàng)
// =====================================================
export type PurchaseOrderStatus =
  | "draft"
  | "ordered"
  | "received"
  | "cancelled";

export interface PurchaseOrder {
  id: string;
  po_number: string; // PO-25-001
  supplier_id: string;
  branch_id: string;
  status: PurchaseOrderStatus;
  order_date: string; // ISO timestamp
  expected_date?: string; // ISO timestamp
  received_date?: string; // ISO timestamp
  total_amount: number;
  discount_amount: number;
  shipping_fee: number;
  final_amount: number;
  notes?: string;
  cancellation_reason?: string;
  receipt_id?: string; // Link to inventory_transactions
  created_by: string;
  created_at: string;
  updated_at: string;

  // Joined data (not in DB)
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
  creator?: { email: string; name?: string };
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  part_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  created_at: string;
  updated_at: string;

  // Joined data (not in DB)
  part?: Part;
}

export interface CreatePurchaseOrderInput {
  supplier_id: string;
  branch_id: string;
  expected_date?: string;
  notes?: string;
  items: Array<{
    part_id: string;
    quantity_ordered: number;
    unit_price: number;
    notes?: string;
  }>;
}

export interface UpdatePurchaseOrderInput {
  id: string;
  status?: PurchaseOrderStatus;
  expected_date?: string;
  received_date?: string;
  discount_amount?: number;
  shipping_fee?: number;
  notes?: string;
  cancellation_reason?: string;
}

export interface ExternalPart {
  id: string;
  name: string;
  sku?: string;
  price: number;
  category?: string;
  image_url?: string;
  source_url?: string;
  created_at: string;
}

// High-level app state snapshot (not strictly used by context but handy)
export interface AppState {
  user: UserSession | null;
  customers: Customer[];
  parts: Part[];
  sales: Sale[];
  workOrders: WorkOrder[];
  cartItems: CartItem[];
  paymentSources: PaymentSource[];
  cashTransactions: CashTransaction[];
  employees: Employee[];
  payrollRecords: PayrollRecord[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  purchaseOrders: PurchaseOrder[];
  externalParts: ExternalPart[];
}
