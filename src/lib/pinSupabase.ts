// Supabase client cho Pin Factory Database
import { createClient } from "@supabase/supabase-js";

const PIN_SUPABASE_URL = "https://jvigqtcbtzaxmrdsbfru.supabase.co";
const PIN_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2aWdxdGNidHpheG1yZHNiZnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDk2NjksImV4cCI6MjA3NzkyNTY2OX0.6pKHKqzoayfmt4Dx_WwPc92Sx1YaFnFX_fFyHsPL2Zw";

export const pinSupabase = createClient(
  PIN_SUPABASE_URL,
  PIN_SUPABASE_ANON_KEY
);

// Types cho Pin cash transactions
export interface PinCashTransaction {
  id: string;
  type: "income" | "expense";
  category?: string;
  amount: number;
  date: string;
  description?: string;
  payment_method?: string;
  created_at?: string;
}

// Fetch cash transactions từ Pin DB
export async function fetchPinCashTransactions(): Promise<
  PinCashTransaction[]
> {
  const { data, error } = await pinSupabase
    .from("cashtransactions")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("[PinSupabase] Error fetching transactions:", error);
    return [];
  }

  return data || [];
}

// Fetch số dư ban đầu từ Pin payment_sources
export async function fetchPinInitialBalance(branchId: string = "CN1"): Promise<{
  cash: number;
  bank: number;
}> {
  const { data, error } = await pinSupabase
    .from("payment_sources")
    .select("id, balance")
    .in("id", ["cash", "bank"]);

  if (error) {
    console.error("[PinSupabase] Error fetching initial balance:", error);
    return { cash: 0, bank: 0 };
  }

  const cashSource = data?.find((ps) => ps.id === "cash");
  const bankSource = data?.find((ps) => ps.id === "bank");

  return {
    cash: cashSource?.balance?.[branchId] || 0,
    bank: bankSource?.balance?.[branchId] || 0,
  };
}

// Fetch tổng số dư từ Pin DB (chia theo tiền mặt và ngân hàng)
export async function fetchPinBalanceSummary(branchId: string = "CN1"): Promise<{
  totalIncome: number;
  totalExpense: number;
  balance: number;
  cash: number;
  bank: number;
}> {
  // Pin Factory dùng cột payment_source_id
  const { data, error } = await pinSupabase
    .from("cashtransactions")
    .select("type, amount, payment_source_id");

  if (error) {
    console.error("[PinSupabase] Error fetching balance:", error);
    return { totalIncome: 0, totalExpense: 0, balance: 0, cash: 0, bank: 0 };
  }

  // Helper để kiểm tra là tiền mặt
  const isCash = (t: any): boolean => {
    const source = t.payment_source_id;
    // Tiền mặt nếu payment_source_id là "cash", null, hoặc không có
    return !source || source === "cash";
  };

  // Helper để kiểm tra là ngân hàng
  const isBank = (t: any): boolean => {
    const source = t.payment_source_id;
    // Ngân hàng nếu payment_source_id là "bank"
    return source === "bank";
  };

  const totalIncome = (data || [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  const totalExpense = (data || [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  // Tính biến động tiền mặt từ transactions
  const cashIncome = (data || [])
    .filter((t) => t.type === "income" && isCash(t))
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const cashExpense = (data || [])
    .filter((t) => t.type === "expense" && isCash(t))
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  // Tính biến động ngân hàng từ transactions
  const bankIncome = (data || [])
    .filter((t) => t.type === "income" && isBank(t))
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const bankExpense = (data || [])
    .filter((t) => t.type === "expense" && isBank(t))
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  console.log("[PinSupabase] Cash delta: income=", cashIncome, "expense=", cashExpense, "net=", cashIncome - cashExpense);
  console.log("[PinSupabase] Bank delta: income=", bankIncome, "expense=", bankExpense, "net=", bankIncome - bankExpense);

  // Lấy số dư ban đầu
  const initialBalance = await fetchPinInitialBalance(branchId);
  console.log("[PinSupabase] Initial balance: cash=", initialBalance.cash, "bank=", initialBalance.bank);

  // Tính số dư thực tế = Số dư ban đầu + Biến động
  const cashBalance = initialBalance.cash + (cashIncome - cashExpense);
  const bankBalance = initialBalance.bank + (bankIncome - bankExpense);

  return {
    totalIncome,
    totalExpense,
    balance: cashBalance + bankBalance,
    cash: cashBalance,
    bank: bankBalance,
  };
}
