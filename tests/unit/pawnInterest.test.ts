import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonthsClamped,
  calcInterestDue,
  calcRedeemTotal,
  daysBetween,
  derivePawnStatus,
  interestPaidUntilForAmount,
  roundVnd,
  splitMonthsDays,
  startOfLocalDay,
} from "../../src/utils/pawnInterest";
import type { PawnRecord } from "../../src/types";

/** Ngày local, tránh lệch múi giờ khi parse chuỗi ISO. */
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

const baseRecord: PawnRecord = {
  id: "CD-20260727-109",
  customerName: "Nguyễn Văn A",
  assetType: "DT IP",
  loanAmount: 3_000_000,
  interestRate: 0.5,
  interestPeriod: "day",
  startDate: d(2026, 7, 27).toISOString(),
  interestPaidUntil: d(2026, 7, 27).toISOString(),
  minInterest: 0,
  status: "active",
};

describe("pawnInterest - tiện ích ngày", () => {
  it("daysBetween đếm theo lịch địa phương, không âm", () => {
    expect(daysBetween(d(2026, 7, 27), d(2026, 8, 8))).toBe(12);
    expect(daysBetween(d(2026, 8, 8), d(2026, 7, 27))).toBe(0);
    expect(daysBetween(d(2026, 7, 27), d(2026, 7, 27))).toBe(0);
  });

  it("daysBetween bỏ qua phần giờ (chuẩn hoá về nửa đêm)", () => {
    const morning = new Date(2026, 6, 27, 8, 30);
    const nextNight = new Date(2026, 6, 28, 23, 45);
    expect(daysBetween(morning, nextNight)).toBe(1);
  });

  it("addMonthsClamped kẹp ngày cuối tháng thay vì tràn sang tháng sau", () => {
    expect(addMonthsClamped(d(2026, 1, 31), 1)).toEqual(startOfLocalDay(d(2026, 2, 28)));
    // 2024 là năm nhuận
    expect(addMonthsClamped(d(2024, 1, 31), 1)).toEqual(startOfLocalDay(d(2024, 2, 29)));
    expect(addMonthsClamped(d(2026, 3, 31), 1)).toEqual(startOfLocalDay(d(2026, 4, 30)));
    expect(addMonthsClamped(d(2026, 7, 27), 1)).toEqual(startOfLocalDay(d(2026, 8, 27)));
  });

  it("splitMonthsDays tách tháng lịch tròn + ngày dư", () => {
    // 27/07 -> 07/09 = 1 tháng (tới 27/08) + 11 ngày
    expect(splitMonthsDays(d(2026, 7, 27), d(2026, 9, 7))).toEqual({ months: 1, days: 11 });
    // Đúng tròn 1 tháng
    expect(splitMonthsDays(d(2026, 7, 27), d(2026, 8, 27))).toEqual({ months: 1, days: 0 });
    // Chưa đủ 1 tháng
    expect(splitMonthsDays(d(2026, 7, 27), d(2026, 8, 8))).toEqual({ months: 0, days: 12 });
    // Ngược thời gian
    expect(splitMonthsDays(d(2026, 9, 7), d(2026, 7, 27))).toEqual({ months: 0, days: 0 });
  });

  it("roundVnd làm tròn tới bội số 1.000", () => {
    expect(roundVnd(180_400)).toBe(180_000);
    expect(roundVnd(180_600)).toBe(181_000);
    expect(roundVnd(0)).toBe(0);
  });
});

describe("calcInterestDue - lãi theo NGÀY", () => {
  it("tính đúng gốc × rate% × số ngày", () => {
    const r = calcInterestDue(baseRecord, d(2026, 8, 8));
    expect(r.totalDays).toBe(12);
    // 3.000.000 × 0,5% × 12 = 180.000
    expect(r.amount).toBe(180_000);
    expect(r.roundedAmount).toBe(180_000);
  });

  it("0 ngày phát sinh thì lãi bằng 0 (kể cả khi có lãi tối thiểu)", () => {
    const r = calcInterestDue({ ...baseRecord, minInterest: 50_000 }, d(2026, 7, 27));
    expect(r.totalDays).toBe(0);
    expect(r.amount).toBe(0);
  });

  it("áp sàn lãi tối thiểu khi lãi tính ra thấp hơn", () => {
    const r = calcInterestDue({ ...baseRecord, minInterest: 50_000 }, d(2026, 7, 29));
    // Thực tế: 3.000.000 × 0,5% × 2 = 30.000 -> nâng lên sàn 50.000
    expect(r.rawAmount).toBe(30_000);
    expect(r.amount).toBe(50_000);
  });

  it("tính trên GỐC CÒN LẠI sau khi khách trả bớt gốc", () => {
    const r = calcInterestDue(
      { ...baseRecord, principalOutstanding: 2_000_000 },
      d(2026, 8, 8)
    );
    // 2.000.000 × 0,5% × 12 = 120.000
    expect(r.principal).toBe(2_000_000);
    expect(r.amount).toBe(120_000);
  });

  it("mốc tính lãi là interestPaidUntil chứ không phải startDate", () => {
    const r = calcInterestDue(
      { ...baseRecord, interestPaidUntil: d(2026, 8, 1).toISOString() },
      d(2026, 8, 8)
    );
    expect(r.totalDays).toBe(7);
    expect(r.amount).toBe(105_000);
  });

  it("lãi suất 0% thì không phát sinh lãi", () => {
    const r = calcInterestDue({ ...baseRecord, interestRate: 0 }, d(2026, 8, 8));
    expect(r.amount).toBe(0);
  });
});

describe("calcInterestDue - lãi theo THÁNG (tháng tròn + lẻ chia /30)", () => {
  const monthly: PawnRecord = { ...baseRecord, interestPeriod: "month", interestRate: 3 };

  it("tháng lịch tròn tính trọn tháng, ngày dư chia /30", () => {
    const r = calcInterestDue(monthly, d(2026, 9, 7));
    expect(r.months).toBe(1);
    expect(r.remainderDays).toBe(11);
    // 3.000.000 × 3% × (1 + 11/30) = 90.000 + 33.000 = 123.000
    expect(r.amount).toBeCloseTo(123_000, 6);
    expect(r.roundedAmount).toBe(123_000);
  });

  it("đúng tròn 1 tháng lịch", () => {
    const r = calcInterestDue(monthly, d(2026, 8, 27));
    expect(r.months).toBe(1);
    expect(r.remainderDays).toBe(0);
    expect(r.amount).toBe(90_000);
  });

  it("chưa đủ tháng thì chỉ tính phần lẻ", () => {
    const r = calcInterestDue(monthly, d(2026, 8, 8));
    expect(r.months).toBe(0);
    expect(r.remainderDays).toBe(12);
    // 3.000.000 × 3% × 12/30 = 36.000
    expect(r.amount).toBe(36_000);
  });

  it("kẹp cuối tháng: 31/01 -> 28/02 là tròn 1 tháng, không dư ngày", () => {
    const r = calcInterestDue(
      { ...monthly, interestPaidUntil: d(2026, 1, 31).toISOString() },
      d(2026, 2, 28)
    );
    expect(r.months).toBe(1);
    expect(r.remainderDays).toBe(0);
    expect(r.amount).toBe(90_000);
  });
});

describe("interestPaidUntilForAmount - suy ngày từ số tiền khách đưa", () => {
  it("theo ngày: khớp chính xác thì ra đúng ngày", () => {
    const result = interestPaidUntilForAmount(baseRecord, 180_000);
    expect(result).toEqual(startOfLocalDay(d(2026, 8, 8)));
  });

  it("theo ngày: trả thiếu thì làm tròn XUỐNG", () => {
    // 100.000 / 15.000 mỗi ngày = 6,67 ngày -> 6 ngày
    const result = interestPaidUntilForAmount(baseRecord, 100_000);
    expect(result).toEqual(startOfLocalDay(d(2026, 8, 2)));
  });

  it("theo ngày: round-trip với calcInterestDue", () => {
    const until = interestPaidUntilForAmount(baseRecord, 180_000);
    const back = calcInterestDue(baseRecord, until);
    expect(back.amount).toBe(180_000);
  });

  it("theo tháng: quy đổi tháng tròn + ngày lẻ", () => {
    const monthly: PawnRecord = { ...baseRecord, interestPeriod: "month", interestRate: 3 };
    // 123.000 / 90.000 = 1,3667 tháng -> 1 tháng (27/08) + floor(0,3667×30)=11 ngày
    const result = interestPaidUntilForAmount(monthly, 123_000);
    expect(result).toEqual(startOfLocalDay(d(2026, 9, 7)));
  });

  it("trả 0 đồng thì giữ nguyên mốc cũ", () => {
    expect(interestPaidUntilForAmount(baseRecord, 0)).toEqual(startOfLocalDay(d(2026, 7, 27)));
  });

  it("lãi suất 0% hoặc hết gốc thì giữ nguyên mốc (không chia cho 0)", () => {
    expect(interestPaidUntilForAmount({ ...baseRecord, interestRate: 0 }, 500_000)).toEqual(
      startOfLocalDay(d(2026, 7, 27))
    );
    expect(
      interestPaidUntilForAmount({ ...baseRecord, principalOutstanding: 0 }, 500_000)
    ).toEqual(startOfLocalDay(d(2026, 7, 27)));
  });

  it("cho phép chỉ định mốc bắt đầu khác", () => {
    const result = interestPaidUntilForAmount(baseRecord, 150_000, d(2026, 8, 1));
    // 150.000 / 15.000 = 10 ngày
    expect(result).toEqual(startOfLocalDay(d(2026, 8, 11)));
  });
});

describe("calcRedeemTotal", () => {
  it("tổng chuộc = gốc còn lại + lãi phát sinh", () => {
    const r = calcRedeemTotal({ ...baseRecord, principalOutstanding: 2_000_000 }, d(2026, 8, 8));
    expect(r.principal).toBe(2_000_000);
    expect(r.interest).toBe(120_000);
    expect(r.total).toBe(2_120_000);
  });
});

describe("derivePawnStatus", () => {
  const withDates: PawnRecord = {
    ...baseRecord,
    endDate: d(2026, 8, 27).toISOString(),
  };

  it("phát hiện quá hạn và đếm số ngày trễ", () => {
    const s = derivePawnStatus(withDates, d(2026, 9, 3));
    expect(s.isOverdue).toBe(true);
    expect(s.overdueDays).toBe(7);
  });

  it("phát hiện sắp tới hạn trong 7 ngày", () => {
    const s = derivePawnStatus(withDates, d(2026, 8, 22));
    expect(s.isOverdue).toBe(false);
    expect(s.isDueSoon).toBe(true);
  });

  it("phát hiện nợ lãi khi đã qua ngày đóng lãi tới", () => {
    const s = derivePawnStatus(withDates, d(2026, 8, 8));
    expect(s.hasUnpaidInterest).toBe(true);
    expect(s.unpaidInterestDays).toBe(12);
    expect(s.isOverdue).toBe(false);
  });

  it("hợp đồng đã chuộc/thanh lý thì không tính quá hạn hay nợ lãi", () => {
    const s = derivePawnStatus({ ...withDates, status: "redeemed" }, d(2026, 12, 31));
    expect(s.isOverdue).toBe(false);
    expect(s.hasUnpaidInterest).toBe(false);
  });
});
