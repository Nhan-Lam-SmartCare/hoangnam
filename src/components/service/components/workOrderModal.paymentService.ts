export type WorkOrderPaymentStatus = "unpaid" | "paid" | "partial";

interface AdditionalPaymentParams {
  status?: string;
  forceFullPayment: boolean;
  showPartialPayment: boolean;
  partialPayment: number;
  total: number;
  totalDeposit: number;
}

interface PaymentSummaryParams {
  total: number;
  totalDeposit: number;
  additionalPayment: number;
}

export const getAdditionalPaymentToApply = ({
  status,
  forceFullPayment,
  showPartialPayment,
  partialPayment,
  total,
  totalDeposit,
}: AdditionalPaymentParams): number => {
  if (status !== "Trả máy") return 0;
  if (forceFullPayment) return Math.max(0, total - totalDeposit);
  return showPartialPayment ? partialPayment : 0;
};

export const buildPaymentSummary = ({
  total,
  totalDeposit,
  additionalPayment,
}: PaymentSummaryParams): {
  paymentStatus: WorkOrderPaymentStatus;
  totalPaid: number;
  remainingAmount: number;
} => {
  const totalPaid = Math.max(0, totalDeposit + additionalPayment);
  const remainingAmount = Math.max(0, total - totalPaid);

  let paymentStatus: WorkOrderPaymentStatus = "unpaid";
  if (totalPaid >= total) {
    paymentStatus = "paid";
  } else if (totalPaid > 0) {
    paymentStatus = "partial";
  }

  return {
    paymentStatus,
    totalPaid,
    remainingAmount,
  };
};

export const buildIssueDescriptionWithPassword = (
  issueDescription: string | undefined,
  devicePassword: string | undefined
): string => {
  let finalIssueDescription = issueDescription || "";
  finalIssueDescription = finalIssueDescription
    .replace(/\[MK: .+?\]\s*/g, "")
    .trim();

  if (devicePassword && devicePassword.trim()) {
    finalIssueDescription = `[MK: ${devicePassword.trim()}] ${finalIssueDescription}`;
  }

  return finalIssueDescription;
};
