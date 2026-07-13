import React, { createContext, useContext } from "react";
import type { AppContextType } from "./app/types";
import { useAppState } from "./app/useAppState";
import { useAppActions } from "./app/useAppActions";

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const state = useAppState();
  const actions = useAppActions(state);

  const value: AppContextType = {
    parts: state.parts,
    customers: state.customers,
    suppliers: state.suppliers,
    sales: state.sales,
    workOrders: state.workOrders,
    cartItems: state.cartItems,
    paymentSources: state.paymentSources,
    cashTransactions: state.cashTransactions,
    inventoryTransactions: state.inventoryTransactions,
    employees: state.employees,
    payrollRecords: state.payrollRecords,
    loans: state.loans,
    loanPayments: state.loanPayments,
    customerDebts: state.customerDebts,
    supplierDebts: state.supplierDebts,
    currentBranchId: state.currentBranchId,
    setCurrentBranchId: state.setCurrentBranchId,
    setParts: state.setParts,
    upsertPart: actions.upsertPart,
    deletePart: actions.deletePart,
    setCustomers: state.setCustomers,
    upsertCustomer: actions.upsertCustomer,
    setSuppliers: state.setSuppliers,
    upsertSupplier: actions.upsertSupplier,
    setWorkOrders: state.setWorkOrders,
    upsertWorkOrder: actions.upsertWorkOrder,
    setCartItems: state.setCartItems,
    clearCart: actions.clearCart,
    setSales: state.setSales,
    deleteSale: actions.deleteSale,
    returnSaleItems: actions.returnSaleItems,
    finalizeSale: actions.finalizeSale,
    setPaymentSources: state.setPaymentSources,
    setCashTransactions: state.setCashTransactions,
    recordInventoryTransaction: actions.recordInventoryTransaction,
    setEmployees: state.setEmployees,
    upsertEmployee: actions.upsertEmployee,
    setPayrollRecords: state.setPayrollRecords,
    upsertPayrollRecord: actions.upsertPayrollRecord,
    setLoans: state.setLoans,
    upsertLoan: actions.upsertLoan,
    setLoanPayments: state.setLoanPayments,
    upsertLoanPayment: actions.upsertLoanPayment,
    setCustomerDebts: state.setCustomerDebts,
    setSupplierDebts: state.setSupplierDebts,
    payCustomerDebts: actions.payCustomerDebts,
    paySupplierDebts: actions.paySupplierDebts,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext phải dùng bên trong AppProvider");
  return ctx;
};
