import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  completeWorkOrderPayment,
  recordWorkOrderPaymentTransactions,
} from "../../src/lib/repository/workOrdersRepository";

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock("../../src/supabaseClient", () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  },
}));

// Kết quả trả về cho từng bảng (mặc định rỗng). Test ghi đè khi cần.
let tableResults: Record<string, { data: any; error: any }> = {};
const defaultResult = { data: [], error: null };

// Chuỗi truy vấn supabase giả lập: mọi method trả về chính nó (chainable),
// và bản thân nó "thenable" -> await sẽ resolve về kết quả của bảng tương ứng.
function makeThenable(result: { data: any; error: any }) {
  const proxy: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: any) => any) => resolve(result);
        }
        return () => proxy;
      },
    }
  );
  return proxy;
}

// Theo dõi các payload đã insert vào cash_transactions để assert.
let cashInserts: any[] = [];

function installFromMock() {
  mockFrom.mockImplementation((table: string) => {
    const result = tableResults[table] || defaultResult;
    if (table === "cash_transactions") {
      const proxy: any = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "then") {
              return (resolve: (v: any) => any) => resolve(result);
            }
            if (prop === "insert") {
              return (payload: any) => {
                cashInserts.push(payload);
                return makeThenable({ data: null, error: null });
              };
            }
            return () => proxy;
          },
        }
      );
      return proxy;
    }
    return makeThenable(result);
  });
}

describe("workOrdersRepository payment logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableResults = {};
    cashInserts = [];
    mockGetUser.mockResolvedValue({
      data: { user: { id: "U-1", email: "tester@example.com", user_metadata: { name: "Tester" } } },
    });
    installFromMock();
  });

  describe("completeWorkOrderPayment", () => {
    it("ánh xạ kết quả RPC thành công (paid) và đánh dấu không dùng fallback", async () => {
      mockRpc.mockResolvedValue({
        data: {
          workOrder: {
            id: "SC-1",
            total: 100000,
            totalPaid: 100000,
            status: "Đang sửa",
            paymentStatus: "paid",
            branchId: "CN1",
            partsUsed: [],
          },
          paymentTransactionId: null,
          newPaymentStatus: "paid",
          inventoryDeducted: true,
        },
        error: null,
      });

      const res = await completeWorkOrderPayment("SC-1", "cash", 100000);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.newPaymentStatus).toBe("paid");
        expect(res.data.inventoryDeducted).toBe(true);
        expect(res.data.usedFallback).toBe(false);
      }
      expect(mockRpc).toHaveBeenCalledWith(
        "work_order_complete_payment",
        expect.objectContaining({ p_order_id: "SC-1", p_payment_amount: 100000 })
      );
    });

    it("ánh xạ lỗi INSUFFICIENT_STOCK thành failure validation kèm tên phụ tùng", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: {
          message: "stock error",
          details:
            'INSUFFICIENT_STOCK:[{"partId":"P-1","partName":"Bugi","available":1,"requested":3}]',
        },
      });

      const res = await completeWorkOrderPayment("SC-1", "cash", 50000);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("validation");
        expect(res.error.message).toContain("Bugi");
      }
    });

    it("ánh xạ lỗi ORDER_NOT_FOUND thành failure validation", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "ORDER_NOT_FOUND", details: "ORDER_NOT_FOUND" },
      });

      const res = await completeWorkOrderPayment("SC-404", "cash", 0);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe("validation");
        expect(res.error.message).toContain("Không tìm thấy phiếu");
      }
    });

    it("dùng fallback cập nhật trực tiếp khi RPC chưa tồn tại (PGRST202) và set usedFallback", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { code: "PGRST202", message: "Could not find function work_order_complete_payment" },
      });

      tableResults["work_orders"] = {
        data: {
          id: "SC-1",
          total: 100000,
          totalpaid: 0,
          depositamount: 0,
          status: "Trả máy",
          paymentstatus: "partial",
          branchid: "CN1",
          partsused: [],
        },
        error: null,
      };

      const res = await completeWorkOrderPayment("SC-1", "cash", 100000);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.usedFallback).toBe(true);
        expect(res.data.inventoryDeducted).toBe(true);
        expect(res.data.newPaymentStatus).toBe("paid");
      }
    });
  });

  describe("recordWorkOrderPaymentTransactions (idempotent)", () => {
    it("ghi 2 giao dịch (đặt cọc + thu sửa chữa) khi chưa có giao dịch nào", async () => {
      tableResults["cash_transactions"] = { data: [], error: null };

      const created = await recordWorkOrderPaymentTransactions({
        orderId: "SC-10",
        customerName: "Nguyễn Văn A",
        branchId: "CN1",
        paymentMethod: "cash",
        depositAmount: 50000,
        servicePayment: 150000,
      });

      expect(created).toHaveLength(2);
      const deposit = created.find((t) => t.category === "service_deposit");
      const income = created.find((t) => t.category === "service_income");
      expect(deposit?.amount).toBe(50000);
      expect(income?.amount).toBe(150000);
      // 2 lần insert thực sự vào cash_transactions
      expect(cashInserts).toHaveLength(2);
    });

    it("chỉ ghi phần chênh lệch khi đã có giao dịch trước đó", async () => {
      // Đã ghi đủ đặt cọc 50k, mới thu thêm 100k trong tổng 150k -> chỉ ghi 50k income.
      tableResults["cash_transactions"] = {
        data: [
          { id: "old-dep", type: "income", category: "service_deposit", amount: 50000 },
          { id: "old-inc", type: "income", category: "service_income", amount: 100000 },
        ],
        error: null,
      };

      const created = await recordWorkOrderPaymentTransactions({
        orderId: "SC-11",
        customerName: "Trần B",
        branchId: "CN1",
        paymentMethod: "cash",
        depositAmount: 50000,
        servicePayment: 150000,
      });

      expect(created).toHaveLength(1);
      expect(created[0].category).toBe("service_income");
      expect(created[0].amount).toBe(50000);
    });

    it("không ghi gì khi số tiền mục tiêu đã được ghi đủ (chống ghi trùng)", async () => {
      tableResults["cash_transactions"] = {
        data: [
          { id: "d", type: "income", category: "service_deposit", amount: 50000 },
          { id: "i", type: "income", category: "service_income", amount: 150000 },
        ],
        error: null,
      };

      const created = await recordWorkOrderPaymentTransactions({
        orderId: "SC-12",
        customerName: "Lê C",
        branchId: "CN1",
        paymentMethod: "cash",
        depositAmount: 50000,
        servicePayment: 150000,
      });

      expect(created).toHaveLength(0);
      expect(cashInserts).toHaveLength(0);
    });

    it("bỏ qua khi không có tiền đặt cọc lẫn thanh toán", async () => {
      const created = await recordWorkOrderPaymentTransactions({
        orderId: "SC-13",
        customerName: "Phạm D",
        branchId: "CN1",
        depositAmount: 0,
        servicePayment: 0,
      });
      expect(created).toHaveLength(0);
    });
  });
});
