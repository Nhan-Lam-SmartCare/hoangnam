import React from "react";
import { StoreSettings } from "../types";

interface InvoiceTabProps {
  settings: StoreSettings;
  updateField: (field: keyof StoreSettings, value: any) => void;
  isOwner: boolean;
}

export const InvoiceTab: React.FC<InvoiceTabProps> = ({
  settings,
  updateField,
  isOwner,
}) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
        Cấu hình hóa đơn
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div>
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Mã hóa đơn bán
          </label>
          <input
            type="text"
            value={settings.invoice_prefix || "HD"}
            onChange={(e) => updateField("invoice_prefix", e.target.value)}
            disabled={!isOwner}
            placeholder="HD"
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          />
          <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
            VD: HD-001, HD-002
          </p>
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Mã phiếu nhập
          </label>
          <input
            type="text"
            value={settings.receipt_prefix || "PN"}
            onChange={(e) => updateField("receipt_prefix", e.target.value)}
            disabled={!isOwner}
            placeholder="PN"
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          />
          <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
            VD: PN-001, PN-002
          </p>
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Mã phiếu sửa chữa
          </label>
          <input
            type="text"
            value={settings.work_order_prefix || "SC"}
            onChange={(e) => updateField("work_order_prefix", e.target.value)}
            disabled={!isOwner}
            placeholder="SC"
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          />
          <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
            VD: SC-001, SC-002
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
          Ghi chú cuối hóa đơn
        </label>
        <textarea
          rows={3}
          value={settings.invoice_footer_note || ""}
          onChange={(e) => updateField("invoice_footer_note", e.target.value)}
          disabled={!isOwner}
          placeholder="Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ!"
          className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div>
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Định dạng ngày
          </label>
          <select
            value={settings.date_format || "DD/MM/YYYY"}
            onChange={(e) => updateField("date_format", e.target.value)}
            disabled={!isOwner}
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Đơn vị tiền tệ
          </label>
          <select
            value={settings.currency || "VND"}
            onChange={(e) => updateField("currency", e.target.value)}
            disabled={!isOwner}
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          >
            <option value="VND">VND - Việt Nam Đồng</option>
            <option value="USD">USD - Đô la Mỹ</option>
          </select>
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
            Múi giờ
          </label>
          <select
            value={settings.timezone || "Asia/Ho_Chi_Minh"}
            onChange={(e) => updateField("timezone", e.target.value)}
            disabled={!isOwner}
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          >
            <option value="Asia/Ho_Chi_Minh">Hồ Chí Minh (GMT+7)</option>
            <option value="Asia/Bangkok">Bangkok (GMT+7)</option>
            <option value="Asia/Singapore">Singapore (GMT+8)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
