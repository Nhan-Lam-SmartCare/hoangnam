import type { PawnRecord } from "../types";

/**
 * Tính lãi hợp đồng cầm đồ.
 *
 * Quy ước nghiệp vụ đã chốt:
 * - Lãi theo NGÀY : lãi = gốc còn lại × rate% × số ngày
 * - Lãi theo THÁNG: tháng lịch tròn tính trọn tháng, phần ngày dư chia /30
 * - Sàn `minInterest` áp cho mỗi lần thu (khi có phát sinh ngày)
 *
 * Mọi phép trừ ngày đều chuẩn hoá về 00:00 giờ địa phương trước, nếu không
 * múi giờ VN (UTC+7) sẽ gây lệch 1 ngày.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Chuẩn hoá về 00:00 giờ địa phương. */
export function startOfLocalDay(value: Date | string | undefined | null): Date {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value || Date.now());
  if (Number.isNaN(d.getTime())) return new Date(NaN);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Số ngày trọn vẹn giữa 2 mốc (theo lịch địa phương, không âm). */
export function daysBetween(from: Date | string, to: Date | string): number {
  const a = startOfLocalDay(from);
  const b = startOfLocalDay(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / MS_PER_DAY));
}

/**
 * Cộng tháng có kẹp ngày cuối tháng: 31/01 + 1 tháng = 28/02 (không tràn 03/03).
 */
export function addMonthsClamped(date: Date | string, months: number): Date {
  const src = startOfLocalDay(date);
  if (Number.isNaN(src.getTime())) return new Date(NaN);

  const day = src.getDate();
  const result = new Date(src.getTime());
  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}

/** Cộng ngày. */
export function addDays(date: Date | string, days: number): Date {
  const d = startOfLocalDay(date);
  if (Number.isNaN(d.getTime())) return new Date(NaN);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Tách khoảng thời gian thành "số tháng lịch tròn + số ngày dư".
 * VD 27/07 → 07/09 = 1 tháng (tới 27/08) + 11 ngày.
 */
export function splitMonthsDays(
  from: Date | string,
  to: Date | string
): { months: number; days: number } {
  const start = startOfLocalDay(from);
  const end = startOfLocalDay(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { months: 0, days: 0 };
  }
  if (end <= start) return { months: 0, days: 0 };

  let months = 0;
  // Tăng dần từng tháng khi mốc tháng kế tiếp vẫn chưa vượt quá `end`.
  while (addMonthsClamped(start, months + 1) <= end) {
    months += 1;
  }
  const anchor = addMonthsClamped(start, months);
  return { months, days: daysBetween(anchor, end) };
}

/** Làm tròn tiền tới bội số (mặc định 1.000đ). */
export function roundVnd(amount: number, step = 1000): number {
  if (!Number.isFinite(amount) || step <= 0) return 0;
  return Math.round(amount / step) * step;
}

/** Gốc còn lại của hợp đồng (fallback về số tiền vay ban đầu). */
export function getOutstandingPrincipal(record: Pick<PawnRecord, "principalOutstanding" | "loanAmount">): number {
  const outstanding = record.principalOutstanding;
  if (typeof outstanding === "number" && Number.isFinite(outstanding)) return outstanding;
  return Number(record.loanAmount || 0);
}

/** Mốc bắt đầu tính lãi kỳ hiện tại. */
export function getInterestAnchor(
  record: Pick<PawnRecord, "interestPaidUntil" | "startDate" | "created_at">
): Date {
  return startOfLocalDay(record.interestPaidUntil || record.startDate || record.created_at);
}

export interface InterestBreakdown {
  /** Gốc dùng để tính lãi. */
  principal: number;
  /** Mốc bắt đầu kỳ lãi. */
  from: Date;
  /** Mốc kết thúc kỳ lãi. */
  to: Date;
  /** Tổng số ngày phát sinh. */
  totalDays: number;
  /** Số tháng lịch tròn (chỉ dùng khi interestPeriod = "month"). */
  months: number;
  /** Số ngày dư sau các tháng tròn. */
  remainderDays: number;
  /** Lãi trước khi áp sàn minInterest và làm tròn. */
  rawAmount: number;
  /** Lãi sau khi áp sàn minInterest (chưa làm tròn). */
  amount: number;
  /** Lãi đã làm tròn tới 1.000đ — dùng để prefill ô nhập. */
  roundedAmount: number;
}

type InterestRecord = Pick<
  PawnRecord,
  | "loanAmount"
  | "principalOutstanding"
  | "interestRate"
  | "interestPeriod"
  | "minInterest"
  | "interestPaidUntil"
  | "startDate"
  | "created_at"
>;

/**
 * Lãi phát sinh từ `interestPaidUntil` (hoặc `startDate`) đến `toDate`.
 */
export function calcInterestDue(
  record: InterestRecord,
  toDate: Date | string = new Date()
): InterestBreakdown {
  const principal = getOutstandingPrincipal(record);
  const from = getInterestAnchor(record);
  const to = startOfLocalDay(toDate);
  const rate = Number(record.interestRate || 0) / 100;
  const minInterest = Number(record.minInterest || 0);

  const totalDays = daysBetween(from, to);

  let months = 0;
  let remainderDays = totalDays;
  let rawAmount = 0;

  if (record.interestPeriod === "month") {
    const split = splitMonthsDays(from, to);
    months = split.months;
    remainderDays = split.days;
    rawAmount = principal * rate * (months + remainderDays / 30);
  } else {
    rawAmount = principal * rate * totalDays;
  }

  const amount = totalDays > 0 ? Math.max(rawAmount, minInterest) : 0;

  return {
    principal,
    from,
    to,
    totalDays,
    months,
    remainderDays,
    rawAmount,
    amount,
    roundedAmount: roundVnd(amount),
  };
}

/**
 * Hàm ngược: khách chỉ trả được `amount` đồng thì lãi đóng tới ngày nào.
 * Luôn làm tròn XUỐNG (khách trả thiếu thì lùi ngày, không cho lố).
 */
export function interestPaidUntilForAmount(
  record: InterestRecord,
  amount: number,
  fromDate?: Date | string
): Date {
  const from = fromDate ? startOfLocalDay(fromDate) : getInterestAnchor(record);
  const principal = getOutstandingPrincipal(record);
  const rate = Number(record.interestRate || 0) / 100;
  const paid = Math.max(0, Number(amount) || 0);

  // Lãi 0% hoặc không còn gốc: không suy ra được ngày -> giữ nguyên mốc.
  if (rate <= 0 || principal <= 0) return from;

  if (record.interestPeriod === "month") {
    const perMonth = principal * rate;
    if (perMonth <= 0) return from;
    const units = paid / perMonth; // số "tháng" quy đổi
    const wholeMonths = Math.floor(units);
    const anchor = addMonthsClamped(from, wholeMonths);
    const extraDays = Math.floor((units - wholeMonths) * 30);
    return addDays(anchor, extraDays);
  }

  const perDay = principal * rate;
  if (perDay <= 0) return from;
  return addDays(from, Math.floor(paid / perDay));
}

/** Tổng tiền khách phải trả để chuộc tại `toDate`. */
export function calcRedeemTotal(
  record: InterestRecord,
  toDate: Date | string = new Date()
): { principal: number; interest: number; total: number } {
  const breakdown = calcInterestDue(record, toDate);
  const interest = breakdown.roundedAmount;
  return {
    principal: breakdown.principal,
    interest,
    total: breakdown.principal + interest,
  };
}

export interface PawnDerivedStatus {
  /** Trạng thái lưu trong DB. */
  status: PawnRecord["status"];
  /** Quá hạn chuộc. */
  isOverdue: boolean;
  /** Số ngày quá hạn (0 nếu chưa quá hạn). */
  overdueDays: number;
  /** Đang nợ lãi (đã qua ngày đóng lãi tới). */
  hasUnpaidInterest: boolean;
  /** Số ngày nợ lãi. */
  unpaidInterestDays: number;
  /** Sắp tới hạn trong `dueSoonDays` ngày. */
  isDueSoon: boolean;
}

/**
 * Trạng thái suy ra ở client — KHÔNG lưu DB (lưu thì phải có cron mới đúng).
 */
export function derivePawnStatus(
  record: Pick<PawnRecord, "status" | "endDate" | "interestPaidUntil" | "startDate" | "created_at">,
  now: Date | string = new Date(),
  dueSoonDays = 7
): PawnDerivedStatus {
  const today = startOfLocalDay(now);
  const base: PawnDerivedStatus = {
    status: record.status,
    isOverdue: false,
    overdueDays: 0,
    hasUnpaidInterest: false,
    unpaidInterestDays: 0,
    isDueSoon: false,
  };

  if (record.status !== "active") return base;

  if (record.endDate) {
    const end = startOfLocalDay(record.endDate);
    if (!Number.isNaN(end.getTime())) {
      if (today > end) {
        base.isOverdue = true;
        base.overdueDays = daysBetween(end, today);
      } else {
        base.isDueSoon = daysBetween(today, end) <= dueSoonDays;
      }
    }
  }

  const anchor = getInterestAnchor(record);
  if (!Number.isNaN(anchor.getTime()) && today > anchor) {
    base.hasUnpaidInterest = true;
    base.unpaidInterestDays = daysBetween(anchor, today);
  }

  return base;
}
