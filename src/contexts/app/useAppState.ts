import { useEffect, useState } from "react";
import type {
  CashTransaction,
  Customer,
  CustomerDebt,
  Employee,
  InventoryTransaction,
  Loan,
  LoanPayment,
  Part,
  PaymentSource,
  PayrollRecord,
  Sale,
  Supplier,
  SupplierDebt,
  WorkOrder,
  CartItem,
} from "../../types";
import { fetchPaymentSources as fetchPaymentSourcesRepo } from "../../lib/repository/paymentSourcesRepository";
import { fetchPayrollRecords } from "../../lib/repository/payrollRepository";
import type { AppState } from "./types";

const PAYROLL_TABLE_DISABLED_KEY = "motocare-schema-missing-payroll-records";

function getLocalFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setLocalFlag(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Ignore localStorage write errors
  }
}

function getInitialData() {
  try {
    const stored = localStorage.getItem("motocare-data");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading from localStorage:", error);
  }
  return {};
}

export function useAppState(): AppState {
  const [currentBranchId, setCurrentBranchId] = useState(() => {
    try {
      const storedBranchId = localStorage.getItem("motocare-current-branch");
      return storedBranchId || "CN1";
    } catch {
      return "CN1";
    }
  });

  const initialData = getInitialData();

  const [parts, setParts] = useState<Part[]>(() => initialData?.parts || []);
  const [customers, setCustomers] = useState<Customer[]>(
    () => initialData?.customers || []
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(
    () => initialData?.suppliers || []
  );
  const [sales, setSales] = useState<Sale[]>(() => initialData?.sales || []);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(
    () => initialData?.workOrders || []
  );
  const [cartItems, setCartItems] = useState<CartItem[]>(
    () => initialData?.cartItems || []
  );
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>(
    () =>
      initialData?.paymentSources || [
        { id: "cash", name: "Tiền mặt", balance: { CN1: 0 }, isDefault: true },
        { id: "bank", name: "Tài khoản ngân hàng", balance: { CN1: 0 } },
      ]
  );
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(
    () => initialData?.cashTransactions || []
  );
  const [inventoryTransactions, setInventoryTransactions] = useState<
    InventoryTransaction[]
  >(() => initialData?.inventoryTransactions || []);
  const [employees, setEmployees] = useState<Employee[]>(
    () => initialData?.employees || []
  );
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>(
    () => initialData?.payrollRecords || []
  );
  const [loans, setLoans] = useState<Loan[]>(() => initialData?.loans || []);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>(
    () => initialData?.loanPayments || []
  );
  const [customerDebts, setCustomerDebts] = useState<CustomerDebt[]>(
    () => initialData?.customerDebts || []
  );
  const [supplierDebts, setSupplierDebts] = useState<SupplierDebt[]>(
    () => initialData?.supplierDebts || []
  );

  useEffect(() => {
    const fetchPaymentSources = async () => {
      try {
        const paymentSourcesRes = await fetchPaymentSourcesRepo();
        if (paymentSourcesRes.ok) {
          setPaymentSources(paymentSourcesRes.data);
        }

        const payrollTableDisabled = getLocalFlag(PAYROLL_TABLE_DISABLED_KEY);
        if (payrollTableDisabled) {
          return;
        }

        const payrollRes = await fetchPayrollRecords();

        if (!payrollRes.ok) {
          if (payrollRes.error.code === "not_found") {
            setLocalFlag(PAYROLL_TABLE_DISABLED_KEY);
          }
          return;
        }

        setPayrollRecords(payrollRes.data);
      } catch (err) {
        console.error("Failed to fetch initial data from Supabase:", err);
      }
    };

    fetchPaymentSources();
  }, []);

  useEffect(() => {
    const data = {
      parts,
      customers,
      suppliers,
      sales,
      workOrders,
      cartItems,
      paymentSources,
      cashTransactions,
      inventoryTransactions,
      employees,
      payrollRecords,
      loans,
      loanPayments,
      customerDebts,
      supplierDebts,
    };
    localStorage.setItem("motocare-data", JSON.stringify(data));
  }, [
    parts,
    customers,
    suppliers,
    sales,
    workOrders,
    cartItems,
    paymentSources,
    cashTransactions,
    inventoryTransactions,
    employees,
    payrollRecords,
    loans,
    loanPayments,
    customerDebts,
    supplierDebts,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem("motocare-current-branch", currentBranchId || "CN1");
    } catch {
      // Ignore storage write errors
    }
  }, [currentBranchId]);

  return {
    parts,
    setParts,
    customers,
    setCustomers,
    suppliers,
    setSuppliers,
    sales,
    setSales,
    workOrders,
    setWorkOrders,
    cartItems,
    setCartItems,
    paymentSources,
    setPaymentSources,
    cashTransactions,
    setCashTransactions,
    inventoryTransactions,
    setInventoryTransactions,
    employees,
    setEmployees,
    payrollRecords,
    setPayrollRecords,
    loans,
    setLoans,
    loanPayments,
    setLoanPayments,
    customerDebts,
    setCustomerDebts,
    supplierDebts,
    setSupplierDebts,
    currentBranchId,
    setCurrentBranchId,
  };
}
