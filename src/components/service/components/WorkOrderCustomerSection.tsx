import React from "react";

interface CustomerSummaryData {
  customerName?: string;
  customerPhone?: string;
  vehicleModel?: string;
  licensePlate?: string;
}

interface WorkOrderCustomerSectionProps {
  customerSearch: string;
  showCustomerDropdown: boolean;
  filteredCustomers: any[];
  hasMoreCustomers: boolean;
  isSearchingCustomer: boolean;
  customersLength: number;
  formData: CustomerSummaryData;
  isEditingCustomer: boolean;
  editCustomerName: string;
  editCustomerPhone: string;
  onCustomerSearchChange: (value: string) => void;
  onCustomerFocus: () => void;
  onSelectCustomer: (customer: any) => void;
  onLoadMoreCustomers: () => void;
  onOpenAddCustomer: () => void;
  onStartEditCustomer: () => void;
  onClearCustomer: () => void;
  onEditCustomerNameChange: (value: string) => void;
  onEditCustomerPhoneChange: (value: string) => void;
  onCancelEditCustomer: () => void;
  onSaveEditedCustomer: () => void;
}

export const WorkOrderCustomerSection: React.FC<WorkOrderCustomerSectionProps> = ({
  customerSearch,
  showCustomerDropdown,
  filteredCustomers,
  hasMoreCustomers,
  isSearchingCustomer,
  customersLength,
  formData,
  isEditingCustomer,
  editCustomerName,
  editCustomerPhone,
  onCustomerSearchChange,
  onCustomerFocus,
  onSelectCustomer,
  onLoadMoreCustomers,
  onOpenAddCustomer,
  onStartEditCustomer,
  onClearCustomer,
  onEditCustomerNameChange,
  onEditCustomerPhoneChange,
  onCancelEditCustomer,
  onSaveEditedCustomer,
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        Khách hàng <span className="text-red-500">*</span>
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative customer-search-container">
          <input
            type="text"
            placeholder="Tìm khách hàng..."
            value={customerSearch}
            onChange={(e) => onCustomerSearchChange(e.target.value)}
            onFocus={onCustomerFocus}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          />

          {showCustomerDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredCustomers.length > 0 ? (
                <>
                  {filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => onSelectCustomer(customer)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 border-b border-slate-200 dark:border-slate-600 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                            {customer.name}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            🔹 {customer.phone}
                          </div>
                          {(customer.vehicleModel ||
                            customer.licensePlate ||
                            customer.vehicles?.length > 0) && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 flex items-center gap-1">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <circle cx="6" cy="17" r="2" />
                                <circle cx="18" cy="17" r="2" />
                                <path d="M4 17h2l4-6h2l2 3h4" />
                              </svg>
                              {(() => {
                                const primaryVehicle =
                                  customer.vehicles?.find((v: any) => v.isPrimary) ||
                                  customer.vehicles?.[0];
                                const model =
                                  primaryVehicle?.model || customer.vehicleModel;
                                const plate =
                                  primaryVehicle?.licensePlate || customer.licensePlate;
                                return (
                                  <>
                                    {model && <span>{model}</span>}
                                    {plate && (
                                      <span className="font-mono font-semibold text-yellow-600 dark:text-yellow-400">
                                        {model && " - "}
                                        {plate}
                                      </span>
                                    )}
                                    {customer.vehicles?.length > 1 && (
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1">
                                        (+{customer.vehicles.length - 1})
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  {hasMoreCustomers && customerSearch.trim() && (
                    <button
                      type="button"
                      onClick={onLoadMoreCustomers}
                      className="w-full text-center px-3 py-3 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-slate-200 dark:border-slate-600"
                    >
                      {isSearchingCustomer
                        ? "Đang tải..."
                        : "⬇️ Tải thêm khách hàng..."}
                    </button>
                  )}
                </>
              ) : (
                <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  {customersLength === 0
                    ? "Chưa có khách hàng nào. Nhấn '+' để thêm khách hàng mới."
                    : "Không tìm thấy khách hàng phù hợp"}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenAddCustomer}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-xl"
          title="Thêm khách hàng mới"
        >
          +
        </button>
      </div>

      {formData.customerName && formData.customerPhone && (
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start justify-between">
            {!isEditingCustomer ? (
              <>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {formData.customerName}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="w-3.5 h-3.5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 6.75c0 8.284 6.716 15 15 15 .828 0 1.5-.672 1.5-1.5v-2.25a1.5 1.5 0 00-1.5-1.5h-1.158a1.5 1.5 0 00-1.092.468l-.936.996a1.5 1.5 0 01-1.392.444 12.035 12.035 0 01-7.29-7.29 1.5 1.5 0 01.444-1.392l.996-.936a1.5 1.5 0 00.468-1.092V6.75A1.5 1.5 0 006.75 5.25H4.5c-.828 0-1.5.672-1.5 1.5z"
                        />
                      </svg>
                      {formData.customerPhone}
                    </span>
                  </div>
                  {(formData.vehicleModel || formData.licensePlate) && (
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-3.5 h-3.5"
                        >
                          <circle cx="6" cy="17" r="2" />
                          <circle cx="18" cy="17" r="2" />
                          <path d="M4 17h2l4-6h2l2 3h4" />
                        </svg>
                        {formData.vehicleModel}{" "}
                        {formData.licensePlate && `- ${formData.licensePlate}`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onStartEditCustomer}
                    className="text-slate-400 hover:text-blue-500 text-sm flex items-center"
                    title="Sửa thông tin khách hàng"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={onClearCustomer}
                    className="text-slate-400 hover:text-red-500 text-sm flex items-center"
                    title="Xóa khách hàng"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full space-y-2">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Tên khách hàng
                  </label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => onEditCustomerNameChange(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    placeholder="Nhập tên khách hàng"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={editCustomerPhone}
                    onChange={(e) => onEditCustomerPhoneChange(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    placeholder="Nhập số điện thoại"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={onCancelEditCustomer}
                    className="px-3 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={onSaveEditedCustomer}
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
