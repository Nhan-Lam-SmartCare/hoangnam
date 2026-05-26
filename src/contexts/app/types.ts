import type React from "react";
import type {
  Part,
  Customer,
  Supplier,
  Sale,
  CartItem,
  WorkOrder,
  PaymentSource,
  CashTransaction,
  InventoryTransaction,
  Employee,
  PayrollRecord,
  Loan,
  LoanPayment,
  CustomerDebt,
  SupplierDebt,
} from "../../types";

export interface AppContextType {
  parts: Part[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  workOrders: WorkOrder[];
  cartItems: CartItem[];
  paymentSources: PaymentSource[];
  cashTransactions: CashTransaction[];
  inventoryTransactions: InventoryTransaction[];
  employees: Employee[];
  payrollRecords: PayrollRecord[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  customerDebts: CustomerDebt[];
  supplierDebts: SupplierDebt[];
  currentBranchId: string;
  setCurrentBranchId: React.Dispatch<React.SetStateAction<string>>;
  setParts: React.Dispatch<React.SetStateAction<Part[]>>;
  upsertPart: (part: Partial<Part> & { id?: string }) => void;
  deletePart: (partId: string) => void;
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  upsertCustomer: (customer: Partial<Customer> & { id?: string }) => void;
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  upsertSupplier: (supplier: Partial<Supplier> & { id?: string }) => void;
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  upsertWorkOrder: (order: WorkOrder) => void;
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  clearCart: () => void;
  deleteSale: (saleId: string) => void;
  finalizeSale: (data: {
    items: CartItem[];
    discount: number;
    paymentMethod: "cash" | "bank";
    customer: { id?: string; name: string; phone?: string };
    note?: string;
    paidAmount?: number;
  }) => void;
  setPaymentSources: React.Dispatch<React.SetStateAction<PaymentSource[]>>;
  setCashTransactions: React.Dispatch<React.SetStateAction<CashTransaction[]>>;
  recordInventoryTransaction: (tx: Omit<InventoryTransaction, "id">) => void;
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  upsertEmployee: (employee: Partial<Employee> & { id?: string }) => void;
  setPayrollRecords: React.Dispatch<React.SetStateAction<PayrollRecord[]>>;
  upsertPayrollRecord: (record: PayrollRecord) => void;
  setLoans: React.Dispatch<React.SetStateAction<Loan[]>>;
  upsertLoan: (loan: Partial<Loan> & { id?: string }) => void;
  setLoanPayments: React.Dispatch<React.SetStateAction<LoanPayment[]>>;
  upsertLoanPayment: (payment: LoanPayment) => void;
  setCustomerDebts: React.Dispatch<React.SetStateAction<CustomerDebt[]>>;
  setSupplierDebts: React.Dispatch<React.SetStateAction<SupplierDebt[]>>;
  payCustomerDebts: (
    customerIds: string[],
    paymentMethod: "cash" | "bank",
    timestamp: string
  ) => void;
  paySupplierDebts: (
    supplierIds: string[],
    paymentMethod: "cash" | "bank",
    timestamp: string
  ) => void;
}

export interface AppState {
  parts: Part[];
  setParts: React.Dispatch<React.SetStateAction<Part[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  sales: Sale[];
  setSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  workOrders: WorkOrder[];
  setWorkOrders: React.Dispatch<React.SetStateAction<WorkOrder[]>>;
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  paymentSources: PaymentSource[];
  setPaymentSources: React.Dispatch<React.SetStateAction<PaymentSource[]>>;
  cashTransactions: CashTransaction[];
  setCashTransactions: React.Dispatch<React.SetStateAction<CashTransaction[]>>;
  inventoryTransactions: InventoryTransaction[];
  setInventoryTransactions: React.Dispatch<React.SetStateAction<InventoryTransaction[]>>;
  employees: Employee[];
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  payrollRecords: PayrollRecord[];
  setPayrollRecords: React.Dispatch<React.SetStateAction<PayrollRecord[]>>;
  loans: Loan[];
  setLoans: React.Dispatch<React.SetStateAction<Loan[]>>;
  loanPayments: LoanPayment[];
  setLoanPayments: React.Dispatch<React.SetStateAction<LoanPayment[]>>;
  customerDebts: CustomerDebt[];
  setCustomerDebts: React.Dispatch<React.SetStateAction<CustomerDebt[]>>;
  supplierDebts: SupplierDebt[];
  setSupplierDebts: React.Dispatch<React.SetStateAction<SupplierDebt[]>>;
  currentBranchId: string;
  setCurrentBranchId: React.Dispatch<React.SetStateAction<string>>;
}

export interface AppActions {
  upsertPart: AppContextType["upsertPart"];
  deletePart: AppContextType["deletePart"];
  upsertCustomer: AppContextType["upsertCustomer"];
  upsertSupplier: AppContextType["upsertSupplier"];
  upsertWorkOrder: AppContextType["upsertWorkOrder"];
  clearCart: AppContextType["clearCart"];
  deleteSale: AppContextType["deleteSale"];
  finalizeSale: AppContextType["finalizeSale"];
  recordInventoryTransaction: AppContextType["recordInventoryTransaction"];
  upsertEmployee: AppContextType["upsertEmployee"];
  upsertPayrollRecord: AppContextType["upsertPayrollRecord"];
  upsertLoan: AppContextType["upsertLoan"];
  upsertLoanPayment: AppContextType["upsertLoanPayment"];
  payCustomerDebts: AppContextType["payCustomerDebts"];
  paySupplierDebts: AppContextType["paySupplierDebts"];
}
