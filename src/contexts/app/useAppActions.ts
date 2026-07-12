import { useCallback } from "react";
import { upsertPayrollRecord as upsertPayrollRecordRepo } from "../../lib/repository/payrollRepository";
import { showToast } from "../../utils/toast";
import type {
  Employee,
  Loan,
  LoanPayment,
  Part,
  PayrollRecord,
  Supplier,
  WorkOrder,
} from "../../types";
import type { AppActions, AppState } from "./types";
import { useCustomerActions } from "./useCustomerActions";
import { useFinanceActions } from "./useFinanceActions";

// eslint-disable-next-line max-lines-per-function
export function useAppActions(state: AppState): AppActions {
  const {
    currentBranchId,
    parts,
    setParts,
    setSuppliers,
    setWorkOrders,
    setEmployees,
    setPayrollRecords,
    setLoans,
    setLoanPayments,
    customers,
    setCustomers,
    sales,
    setSales,
    setCashTransactions,
    setPaymentSources,
    setCustomerDebts,
    setSupplierDebts,
    setCartItems,
    setInventoryTransactions,
  } = state;

  const upsertPart = useCallback(
    (part: Partial<Part> & { id?: string }) => {
      setParts((prev) => {
        if (part.id) {
          return prev.map((p) =>
            p.id === part.id ? ({ ...p, ...part } as Part) : p
          );
        }
        const id = `PART-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const newPart: Part = {
          id,
          name: part.name || "Tên phụ tùng",
          sku: part.sku || id,
          stock: part.stock || { [currentBranchId]: 0 },
          retailPrice: part.retailPrice || { [currentBranchId]: 0 },
          wholesalePrice: part.wholesalePrice || { [currentBranchId]: 0 },
          category: part.category,
          description: part.description,
          warrantyPeriod: part.warrantyPeriod,
          created_at: new Date().toISOString(),
        };
        return [newPart, ...prev];
      });
    },
    [currentBranchId, setParts]
  );

  const deletePart = useCallback(
    (partId: string) => {
      setParts((prev) => prev.filter((p) => p.id !== partId));
    },
    [setParts]
  );

  const upsertSupplier = useCallback(
    (supplier: Partial<Supplier> & { id?: string }) => {
      setSuppliers((prev) => {
        if (supplier.id) {
          return prev.map((s) =>
            s.id === supplier.id ? ({ ...s, ...supplier } as Supplier) : s
          );
        }
        const id = `SUP-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const newSupplier: Supplier = {
          id,
          name: supplier.name || "Nhà cung cấp",
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          created_at: new Date().toISOString(),
        };
        return [newSupplier, ...prev];
      });
    },
    [setSuppliers]
  );

  const upsertWorkOrder = useCallback(
    (order: WorkOrder) => {
      setWorkOrders((prev) => {
        const existing = prev.find((w) => w.id === order.id);
        if (existing) {
          return prev.map((w) => (w.id === order.id ? order : w));
        }
        return [order, ...prev];
      });
    },
    [setWorkOrders]
  );

  const upsertEmployee = useCallback(
    (employee: Partial<Employee> & { id?: string }) => {
      setEmployees((prev) => {
        if (employee.id) {
          return prev.map((e) =>
            e.id === employee.id ? ({ ...e, ...employee } as Employee) : e
          );
        }
        const id = `EMP-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const newEmployee: Employee = {
          id,
          name: employee.name || "Nhân viên",
          phone: employee.phone,
          position: employee.position || "",
          baseSalary: employee.baseSalary || 0,
          startDate: employee.startDate || new Date().toISOString(),
          status: employee.status || "active",
          created_at: new Date().toISOString(),
        };
        return [newEmployee, ...prev];
      });
    },
    [setEmployees]
  );

  const upsertPayrollRecord = useCallback(
    async (record: PayrollRecord) => {
      const res = await upsertPayrollRecordRepo(record);

      if (!res.ok) {
        console.error("Error upserting payroll record:", res.error.cause);
        showToast.error("Lỗi lưu bảng lương");
        return;
      }

      setPayrollRecords((prev) => {
        const existing = prev.find((p) => p.id === record.id);
        if (existing) {
          return prev.map((p) => (p.id === record.id ? record : p));
        }
        return [record, ...prev];
      });
    },
    [setPayrollRecords]
  );

  const upsertLoan = useCallback(
    (loan: Partial<Loan> & { id?: string }) => {
      setLoans((prev) => {
        if (loan.id) {
          return prev.map((l) =>
            l.id === loan.id ? ({ ...l, ...loan } as Loan) : l
          );
        }
        const id = `LOAN-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const newLoan: Loan = {
          id,
          lenderName: loan.lenderName || "",
          loanType: loan.loanType || "bank",
          principal: loan.principal || 0,
          interestRate: loan.interestRate || 0,
          term: loan.term || 0,
          startDate: loan.startDate || new Date().toISOString(),
          endDate: loan.endDate || new Date().toISOString(),
          monthlyPayment: loan.monthlyPayment || 0,
          remainingAmount: loan.remainingAmount || loan.principal || 0,
          status: loan.status || "active",
          purpose: loan.purpose,
          collateral: loan.collateral,
          branchId: currentBranchId,
          created_at: new Date().toISOString(),
        };
        return [newLoan, ...prev];
      });
    },
    [currentBranchId, setLoans]
  );

  const upsertLoanPayment = useCallback(
    (payment: LoanPayment) => {
      setLoanPayments((prev) => {
        const existing = prev.find((p) => p.id === payment.id);
        if (existing) {
          return prev.map((p) => (p.id === payment.id ? payment : p));
        }
        return [payment, ...prev];
      });
    },
    [setLoanPayments]
  );

  const customerActions = useCustomerActions({ customers, setCustomers });
  const financeActions = useFinanceActions({
    currentBranchId,
    parts,
    sales,
    cashTransactions: state.cashTransactions,
    customerDebts: state.customerDebts,
    setSales,
    setParts,
    setCashTransactions,
    setPaymentSources,
    setCustomerDebts,
    setSupplierDebts,
    setCartItems,
    setInventoryTransactions,
  });

  return {
    upsertPart,
    deletePart,
    upsertCustomer: customerActions.upsertCustomer,
    upsertSupplier,
    upsertWorkOrder,
    clearCart: financeActions.clearCart,
    deleteSale: financeActions.deleteSale,
    finalizeSale: financeActions.finalizeSale,
    recordInventoryTransaction: financeActions.recordInventoryTransaction,
    upsertEmployee,
    upsertPayrollRecord,
    upsertLoan,
    upsertLoanPayment,
    payCustomerDebts: financeActions.payCustomerDebts,
    paySupplierDebts: financeActions.paySupplierDebts,
  };
}
