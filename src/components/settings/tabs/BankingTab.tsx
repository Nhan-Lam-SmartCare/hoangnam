import React from "react";
import { Info } from "lucide-react";
import { StoreSettings } from "../types";

interface BankingTabProps {
  settings: StoreSettings;
  updateField: (field: keyof StoreSettings, value: any) => void;
  isOwner: boolean;
}

export const BankingTab: React.FC<BankingTabProps> = ({
  settings,
  updateField,
  isOwner,
}) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
        Thông tin ngân hàng
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Tên ngân hàng *
          </label>
          <input
            type="text"
            value={settings.bank_name || ""}
            onChange={(e) => updateField("bank_name", e.target.value)}
            disabled={!isOwner}
            placeholder="VD: Vietcombank, Techcombank, MB Bank..."
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Số tài khoản *
          </label>
          <input
            type="text"
            value={settings.bank_account_number || ""}
            onChange={(e) => updateField("bank_account_number", e.target.value)}
            disabled={!isOwner}
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Chủ tài khoản *
          </label>
          <input
            type="text"
            value={settings.bank_account_holder || ""}
            onChange={(e) => updateField("bank_account_holder", e.target.value)}
            disabled={!isOwner}
            placeholder="VD: NGUYEN VAN A"
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Chi nhánh
          </label>
          <input
            type="text"
            value={settings.bank_branch || ""}
            onChange={(e) => updateField("bank_branch", e.target.value)}
            disabled={!isOwner}
            placeholder="VD: Chi nhánh Quận 1, TP.HCM"
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          />
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 md:p-4">
        <div className="flex gap-2 md:gap-3">
          <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs md:text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">Thông tin ngân hàng</p>
            <p>
              Thông tin này sẽ được hiển thị trên các hóa đơn, biên nhận
              và phiếu dịch vụ. Khách hàng có thể quét mã QR hoặc chuyển
              khoản theo thông tin này.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
