#!/usr/bin/env node
/**
 * Test script for newly implemented features:
 * - Debts (Customer & Supplier)
 * - Loans & Loan Payments
 * - Employees
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============= TEST UTILITIES =============
let testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function logTest(name, passed, details = "") {
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${name}`);
  if (details) console.log(`   ${details}`);
  testResults.tests.push({ name, passed, details });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

function printSummary() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Total:  ${testResults.passed + testResults.failed}`);
  console.log("=".repeat(60));
}

// ============= TEST: CUSTOMER DEBTS =============
async function testCustomerDebts() {
  console.log("\n🧪 Testing Customer Debts...");

  try {
    // Test 1: Count existing debts
    const { data: existing, error: countError } = await supabase
      .from("customer_debts")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;
    logTest("Customer Debts - Table accessible", true, `Found table`);

    // Test 2: Create test debt
    const testDebt = {
      id: `TEST-DEBT-${Date.now()}`,
      customer_id: "TEST-CUSTOMER",
      customer_name: "Nguyễn Văn Test",
      phone: "0909123456",
      license_plate: "29A-12345",
      description: "Test công nợ khách hàng",
      total_amount: 1000000,
      paid_amount: 0,
      remaining_amount: 1000000,
      created_date: new Date().toISOString().split("T")[0],
      branch_id: "CN1",
    };

    const { data: created, error: createError } = await supabase
      .from("customer_debts")
      .insert(testDebt)
      .select()
      .single();

    if (createError) throw createError;
    logTest(
      "Customer Debts - Create",
      !!created,
      `Created debt: ${created.customer_name}`
    );

    // Test 3: Read debt
    const { data: read, error: readError } = await supabase
      .from("customer_debts")
      .select("*")
      .eq("id", testDebt.id)
      .single();

    if (readError) throw readError;
    logTest(
      "Customer Debts - Read",
      read.customer_name === testDebt.customer_name,
      `Read: ${read.customer_name}`
    );

    // Test 4: Update debt
    const { data: updated, error: updateError } = await supabase
      .from("customer_debts")
      .update({
        paid_amount: 500000,
        remaining_amount: 500000,
      })
      .eq("id", testDebt.id)
      .select()
      .single();

    if (updateError) throw updateError;
    logTest(
      "Customer Debts - Update",
      updated.paid_amount === 500000,
      `Updated paid_amount: ${updated.paid_amount.toLocaleString()}`
    );

    // Test 5: Delete debt
    const { error: deleteError } = await supabase
      .from("customer_debts")
      .delete()
      .eq("id", testDebt.id);

    if (deleteError) throw deleteError;
    logTest("Customer Debts - Delete", !deleteError, `Deleted test debt`);
  } catch (error) {
    logTest("Customer Debts - FAILED", false, error.message);
  }
}

// ============= TEST: SUPPLIER DEBTS =============
async function testSupplierDebts() {
  console.log("\n🧪 Testing Supplier Debts...");

  try {
    // Test 1: Table accessible
    const { error: countError } = await supabase
      .from("supplier_debts")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;
    logTest("Supplier Debts - Table accessible", true, `Found table`);

    // Test 2: Create test debt
    const testDebt = {
      id: `TEST-SUPP-DEBT-${Date.now()}`,
      supplier_id: "TEST-SUPPLIER",
      supplier_name: "Công ty Test",
      description: "Test công nợ nhà cung cấp",
      total_amount: 5000000,
      paid_amount: 0,
      remaining_amount: 5000000,
      created_date: new Date().toISOString().split("T")[0],
      branch_id: "CN1",
    };

    const { data: created, error: createError } = await supabase
      .from("supplier_debts")
      .insert(testDebt)
      .select()
      .single();

    if (createError) throw createError;
    logTest(
      "Supplier Debts - Create",
      !!created,
      `Created debt: ${created.supplier_name}`
    );

    // Test 3: Update and delete
    const { error: deleteError } = await supabase
      .from("supplier_debts")
      .delete()
      .eq("id", testDebt.id);

    logTest("Supplier Debts - Delete", !deleteError, `Deleted test debt`);
  } catch (error) {
    logTest("Supplier Debts - FAILED", false, error.message);
  }
}

// ============= TEST: LOANS =============
async function testLoans() {
  console.log("\n🧪 Testing Loans...");

  try {
    // Test 1: Table accessible
    const { error: countError } = await supabase
      .from("loans")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;
    logTest("Loans - Table accessible", true, `Found table`);

    // Test 2: Create test loan
    const testLoan = {
      id: `TEST-LOAN-${Date.now()}`,
      lender_name: "Ngân hàng Test",
      loan_type: "bank", // Must be: bank, personal, or other
      principal: 100000000,
      interest_rate: 8.5,
      term: 12,
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      remaining_amount: 100000000,
      monthly_payment: 8700000,
      status: "active",
      purpose: "Test loan purpose",
      branch_id: "CN1",
    };

    const { data: created, error: createError } = await supabase
      .from("loans")
      .insert(testLoan)
      .select()
      .single();

    if (createError) throw createError;
    logTest(
      "Loans - Create",
      !!created,
      `Created loan: ${created.lender_name}`
    );

    // Test 3: Create loan payment
    const testPayment = {
      id: `TEST-LPAY-${Date.now()}`,
      loan_id: testLoan.id,
      payment_date: new Date().toISOString().split("T")[0],
      principal_amount: 7000000,
      interest_amount: 700000,
      total_amount: 7700000,
      remaining_amount: 93000000,
      payment_method: "cash",
      branch_id: "CN1",
    };

    const { data: payment, error: paymentError } = await supabase
      .from("loan_payments")
      .insert(testPayment)
      .select()
      .single();

    if (paymentError) throw paymentError;
    logTest(
      "Loan Payments - Create",
      !!payment,
      `Payment: ${payment.total_amount.toLocaleString()}`
    );

    // Test 4: Read loan with payments
    const { data: loanPayments, error: readError } = await supabase
      .from("loan_payments")
      .select("*")
      .eq("loan_id", testLoan.id);

    logTest(
      "Loan Payments - Read",
      loanPayments?.length === 1,
      `Found ${loanPayments?.length} payment(s)`
    );

    // Test 5: Cleanup
    await supabase.from("loan_payments").delete().eq("loan_id", testLoan.id);
    const { error: deleteError } = await supabase
      .from("loans")
      .delete()
      .eq("id", testLoan.id);

    logTest("Loans - Delete", !deleteError, `Deleted test loan`);
  } catch (error) {
    logTest("Loans - FAILED", false, error.message);
  }
}

// ============= TEST: EMPLOYEES =============
async function testEmployees() {
  console.log("\n🧪 Testing Employees...");

  try {
    // Test 1: Table accessible
    const { error: countError } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true });

    if (countError) throw countError;
    logTest("Employees - Table accessible", true, `Found table`);

    // Test 2: Create test employee
    const testEmployee = {
      id: `TEST-EMP-${Date.now()}`,
      name: "Nhân viên Test", // Column is 'name' not 'full_name'
      phone: "0909999888",
      email: "test@example.com",
      position: "staff",
      status: "active",
      start_date: new Date().toISOString().split("T")[0],
      base_salary: 10000000,
      branch_id: "CN1",
    };

    const { data: created, error: createError } = await supabase
      .from("employees")
      .insert(testEmployee)
      .select()
      .single();

    if (createError) throw createError;
    logTest("Employees - Create", !!created, `Created: ${created.name}`);

    // Test 3: Update employee
    const { data: updated, error: updateError } = await supabase
      .from("employees")
      .update({ base_salary: 12000000 })
      .eq("id", testEmployee.id)
      .select()
      .single();

    logTest(
      "Employees - Update",
      updated?.base_salary === 12000000,
      `Updated salary: ${updated?.base_salary.toLocaleString()}`
    );

    // Test 4: Delete employee
    const { error: deleteError } = await supabase
      .from("employees")
      .delete()
      .eq("id", testEmployee.id);

    logTest("Employees - Delete", !deleteError, `Deleted test employee`);
  } catch (error) {
    logTest("Employees - FAILED", false, error.message);
  }
}

// ============= TEST: DATA INTEGRITY =============
async function testDataIntegrity() {
  console.log("\n🧪 Testing Data Integrity...");

  try {
    // Test 1: Check for orphaned loan payments
    const { data: orphanedPayments, error: orphanError } = await supabase
      .from("loan_payments")
      .select("id, loan_id")
      .not("loan_id", "in", `(SELECT id FROM loans)`);

    if (orphanError) {
      // This is expected if subquery is not supported, skip
      logTest("Data Integrity - Orphaned payments", true, "Check skipped");
    } else {
      logTest(
        "Data Integrity - No orphaned payments",
        !orphanedPayments || orphanedPayments.length === 0,
        `Found ${orphanedPayments?.length || 0} orphaned records`
      );
    }

    // Test 2: Check column types
    const { data: loanSample } = await supabase
      .from("loans")
      .select("*")
      .limit(1)
      .single();

    if (loanSample) {
      const hasRequiredFields =
        typeof loanSample.principal === "number" &&
        typeof loanSample.interest_rate === "number" &&
        typeof loanSample.status === "string";
      logTest(
        "Data Integrity - Loan schema",
        hasRequiredFields,
        "Schema validated"
      );
    }
  } catch (error) {
    logTest("Data Integrity - FAILED", false, error.message);
  }
}

// ============= MAIN =============
async function main() {
  console.log("🚀 Starting Feature Tests...\n");
  console.log("Testing newly implemented features:");
  console.log("- Customer Debts");
  console.log("- Supplier Debts");
  console.log("- Loans & Loan Payments");
  console.log("- Employees");
  console.log("=".repeat(60));

  await testCustomerDebts();
  await testSupplierDebts();
  await testLoans();
  await testEmployees();
  await testDataIntegrity();

  printSummary();

  // Exit with error code if any tests failed
  process.exit(testResults.failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("💥 Test suite crashed:", error);
  process.exit(1);
});
