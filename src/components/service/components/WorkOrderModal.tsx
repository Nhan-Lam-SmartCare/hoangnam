import React from "react";
import type { WorkOrder, Part } from "../../../types";
import { useWorkOrderFormState, StoreSettings } from "../hooks/useWorkOrderFormState";
import { WorkOrderCustomerSection } from "./WorkOrderCustomerSection";
import { WorkOrderVehicleSection } from "./WorkOrderVehicleSection";
import CustomerModal from "../../customer/CustomerModal";
import { POPULAR_DEVICES } from "../../../constants/devices";
import { DevicePhotoGallery } from "../../common/DevicePhotoGallery";
import { AndroidPatternLock } from "../../common/AndroidPatternLock";
import { Lock, Grid3x3, CheckCircle } from "lucide-react";
import { WorkOrderPartsSection } from "./WorkOrderPartsSection";
import { WorkOrderLaborSection } from "./WorkOrderLaborSection";
import { WorkOrderPaymentSection } from "./WorkOrderPaymentSection";
import { WorkOrderOutsourceSection } from "./WorkOrderOutsourceSection";

export type { StoreSettings };

const WorkOrderModal: React.FC<{
  order: WorkOrder;
  onClose: () => void;
  onSave: (order: WorkOrder) => void;
  parts: Part[];
  partsLoading: boolean;
  customers: any[];
  employees: any[];
  upsertCustomer: (customer: any) => void;
  setCashTransactions: (fn: (prev: any[]) => any[]) => void;
  setPaymentSources: (fn: (prev: any[]) => any[]) => void;
  paymentSources: any[];
  currentBranchId: string;
  storeSettings?: StoreSettings | null;
  canUpdateWorkOrderStatus?: boolean;
  canUpdateWorkOrderPayment?: boolean;
  canUpdateWorkOrderParts?: boolean;
  canUpdateWorkOrderLabor?: boolean;
  canUpdateWorkOrderDiscount?: boolean;
  canUpdateWorkOrderCustomer?: boolean;
  canUpdateWorkOrderVehicle?: boolean;
  canUpdateWorkOrderOutsourceService?: boolean;
  invalidateWorkOrders?: () => void;
}> = (props) => {
  const state = useWorkOrderFormState(props);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-1.5 sm:p-2.5 md:p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-h-[95vh] max-w-[99vw] lg:max-w-[96vw] xl:max-w-6xl rounded-xl shadow-2xl flex flex-col overflow-hidden text-[12px] sm:text-[13px]">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 md:px-5 md:py-2.5 flex items-center justify-between gap-2.5 rounded-t-xl flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/80 dark:bg-slate-900/30">
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  {
                    value: "Tiếp nhận",
                    label: "Tiếp nhận",
                    activeClass: "bg-sky-600 text-white border-sky-500 shadow-sm shadow-sky-500/30",
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8 12h8M8 17h5M5 4h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" />
                      </svg>
                    ),
                  },
                  {
                    value: "Đang sửa",
                    label: "Đang sửa",
                    activeClass: "bg-amber-500 text-white border-amber-400 shadow-sm shadow-amber-500/30",
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 01-5.4 5.4l-5 5a1.5 1.5 0 102.1 2.1l5-5a4 4 0 005.4-5.4l-2.1 2.1-1.4-1.4 2.1-2.1z" />
                      </svg>
                    ),
                  },
                  {
                    value: "Đã sửa xong",
                    label: "Đã xong",
                    activeClass: "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-500/30",
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7L9 18l-5-5" />
                      </svg>
                    ),
                  },
                  {
                    value: "Trả máy",
                    label: "Trả máy",
                    activeClass: "bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-500/30",
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5h14v10H5zM9 19h6M12 15v4" />
                      </svg>
                    ),
                  },
                ].map((step) => {
                  const isActive = (state.formData.status || "Tiếp nhận") === step.value;
                  return (
                    <button
                      key={step.value}
                      type="button"
                      onClick={() =>
                        state.setFormData((prev) => ({
                          ...prev,
                          status: step.value as any,
                        }))
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold border transition-all ${
                        isActive
                          ? step.activeClass
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {step.icon}
                        {step.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <button
            onClick={props.onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Đóng"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Warning Banner for Paid Orders */}
        {state.isOrderPaid && (
          <div className="mx-4 mt-4 md:mx-6 md:mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex-shrink-0">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                  ⚠️ Phiếu đã thanh toán
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Phiếu đã thanh toán: Không thể thay đổi danh sách dịch vụ và giá bán (Revenue).
                  <br className="mb-1" />
                  Tuy nhiên, bạn vẫn có thể cập nhật <b>Giá vốn (Cost)</b> của các dịch vụ để tính lợi nhuận chính xác, cũng như thông tin khách hàng và ghi chú.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="px-3 py-3 md:px-5 md:py-5 grid gap-3.5 md:gap-5 grid-cols-[minmax(0,1fr)_minmax(200px,30%)] items-start overflow-auto flex-1 pb-4 [&_th]:px-2.5 [&_th]:py-1.5 [&_td]:px-2.5 [&_td]:py-1.5">
          {/* Main Form Fields (Left Column) */}
          <div className="grid gap-6 grid-cols-2 col-start-1">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">1</span>
                Khách hàng & Thiết bị
              </h3>

              <div>
                <WorkOrderCustomerSection
                  customerSearch={state.customerSearch}
                  showCustomerDropdown={state.showCustomerDropdown}
                  filteredCustomers={state.filteredCustomers}
                  hasMoreCustomers={state.hasMoreCustomers}
                  isSearchingCustomer={state.isSearchingCustomer}
                  customersLength={props.customers.length}
                  formData={state.formData}
                  isEditingCustomer={state.isEditingCustomer}
                  editCustomerName={state.editCustomerName}
                  editCustomerPhone={state.editCustomerPhone}
                  onCustomerSearchChange={(value) => {
                    state.setCustomerSearch(value);
                    state.setShowCustomerDropdown(true);
                    state.setFormData((prev) => ({
                      ...prev,
                      customerName: value,
                    }));
                  }}
                  onCustomerFocus={() => state.setShowCustomerDropdown(true)}
                  onSelectCustomer={(customer) => {
                    const primaryVehicle =
                      customer.vehicles?.find((v: any) => v.isPrimary) ||
                      customer.vehicles?.[0];

                    state.setFormData((prev) => ({
                      ...prev,
                      customerName: customer.name,
                      customerPhone: customer.phone,
                      vehicleId: primaryVehicle?.id,
                      vehicleModel: primaryVehicle?.model || customer.vehicleModel || "",
                      licensePlate: primaryVehicle?.licensePlate || customer.licensePlate || "",
                    }));
                    state.setCustomerSearch(customer.name);
                    state.setShowCustomerDropdown(false);
                  }}
                  onLoadMoreCustomers={state.handleLoadMoreCustomers}
                  onOpenAddCustomer={() => {
                    state.setShowAddCustomerModal(true);
                    if (state.customerSearch && /^[0-9]+$/.test(state.customerSearch)) {
                      state.setNewCustomer((prev) => ({
                        ...prev,
                        phone: state.customerSearch,
                      }));
                    }
                  }}
                  onStartEditCustomer={() => {
                    state.setEditCustomerName(state.formData.customerName || "");
                    state.setEditCustomerPhone(state.formData.customerPhone || "");
                    state.setIsEditingCustomer(true);
                  }}
                  onClearCustomer={() => {
                    state.setCustomerSearch("");
                    state.setFormData((prev) => ({
                      ...prev,
                      customerName: "",
                      customerPhone: "",
                      vehicleId: undefined,
                      vehicleModel: "",
                      licensePlate: "",
                    }));
                  }}
                  onEditCustomerNameChange={state.setEditCustomerName}
                  onEditCustomerPhoneChange={state.setEditCustomerPhone}
                  onCancelEditCustomer={() => state.setIsEditingCustomer(false)}
                  onSaveEditedCustomer={state.handleSaveEditedCustomer}
                />

                {/* Vehicle Selection & Add Vehicle (for selected customer) */}
                {state.currentCustomer && (
                  <WorkOrderVehicleSection
                    customerVehicles={state.customerVehicles}
                    selectedVehicleId={state.formData.vehicleId}
                    editingVehicleId={state.editingVehicleId}
                    editVehicleModel={state.editVehicleModel}
                    editVehicleLicensePlate={state.editVehicleLicensePlate}
                    onOpenAddVehicleModal={() => state.setShowAddVehicleModal(true)}
                    onSelectVehicle={state.handleSelectVehicle}
                    onStartEditVehicle={(vehicle) => {
                      state.setEditingVehicleId(vehicle.id);
                      state.setEditVehicleModel(vehicle.model || "");
                      state.setEditVehicleLicensePlate(vehicle.licensePlate || "");
                    }}
                    onCancelEditVehicle={() => {
                      state.setEditingVehicleId(null);
                      state.setEditVehicleModel("");
                      state.setEditVehicleLicensePlate("");
                    }}
                    onSaveEditedVehicle={state.handleSaveEditedVehicle}
                    onEditVehicleModelChange={state.setEditVehicleModel}
                    onEditVehicleLicensePlateChange={state.setEditVehicleLicensePlate}
                  />
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-0">
                    Mật khẩu màn hình
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (state.devicePassword.startsWith("Pattern:")) {
                        state.setDevicePassword("");
                      }
                      state.setIsPatternMode(!state.isPatternMode);
                    }}
                    className="text-sm font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1 active:scale-95 transition-transform"
                  >
                    {state.isPatternMode ? (
                      <>
                        <Lock className="w-4 h-4" /> Nhập số/chữ
                      </>
                    ) : (
                      <>
                        <Grid3x3 className="w-4 h-4" /> Vẽ hình (Android)
                      </>
                    )}
                  </button>
                </div>

                {state.isPatternMode ? (
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center">
                    <div className="mb-2 text-sm font-medium text-slate-500">Vẽ mật khẩu mở khóa</div>
                    <div className="bg-white dark:bg-slate-900 p-2 rounded-xl shadow-sm">
                      <AndroidPatternLock
                        initialValue={state.devicePassword.startsWith("Pattern:") ? state.devicePassword.replace("Pattern:", "").trim() : ""}
                        onPatternComplete={(pattern) => {
                          if (pattern) {
                            state.setDevicePassword(`Pattern: ${pattern}`);
                          }
                        }}
                      />
                    </div>
                    {state.devicePassword.startsWith("Pattern:") ? (
                      <div className="mt-3 text-sm font-mono text-emerald-500 font-bold flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle className="w-4 h-4" /> Đã lưu hình vẽ
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-slate-400 italic">
                        Vẽ hình để lưu mật khẩu
                      </div>
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Nhập mật khẩu (VD: 123456...)"
                    value={state.devicePassword}
                    onChange={(e) => state.setDevicePassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono text-red-600 dark:text-red-400 font-bold focus:border-blue-500 focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả sự cố
                </label>
                <textarea
                  rows={4}
                  placeholder="Bảo dưỡng định kỳ, thay nhớt..."
                  value={state.formData.issueDescription || ""}
                  onChange={(e) =>
                    state.setFormData((prev) => ({
                      ...prev,
                      issueDescription: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>

              <div>
                <DevicePhotoGallery
                  photos={state.formData.devicePhotos || []}
                  onAddPhoto={state.handleAddDevicePhoto}
                  onRemovePhoto={state.handleRemoveDevicePhoto}
                  isUploading={state.isUploadingPhoto}
                />
              </div>
            </div>

            {/* Labor Section */}
            <WorkOrderLaborSection
              formData={state.formData}
              setFormData={state.setFormData}
              resolvedTechnicianName={state.resolvedTechnicianName}
              isTechnicianLockedForStaff={state.isTechnicianLockedForStaff}
              employees={props.employees}
              repairLaborTotal={state.repairLaborTotal}
              newRepairServiceDraft={state.newRepairServiceDraft}
              setNewRepairServiceDraft={state.setNewRepairServiceDraft}
              serviceConfigs={state.serviceConfigs}
              employeeOptions={state.employeeOptions}
              selectedParts={state.selectedParts}
              repairServices={state.repairServices}
              setRepairServices={state.setRepairServices}
              getRepairServiceLaborAmount={state.getRepairServiceLaborAmount}
              getRepairServiceWorkers={state.getRepairServiceWorkers}
              getSelectedPartCost={state.getSelectedPartCost}
              canEditPriceAndParts={state.canEditPriceAndParts}
              order={props.order}
              currentBranchId={props.currentBranchId}
            />
          </div>

          {/* Parts Used Section */}
          <WorkOrderPartsSection
            canEditPriceAndParts={state.canEditPriceAndParts}
            showPartSearch={state.showPartSearch}
            setShowPartSearch={state.setShowPartSearch}
            searchPart={state.searchPart}
            setSearchPart={state.setSearchPart}
            partsLoading={props.partsLoading}
            filteredParts={state.filteredParts}
            currentBranchId={props.currentBranchId}
            selectedParts={state.selectedParts}
            setSelectedParts={state.setSelectedParts}
            getPartLaborBase={state.getPartLaborBase}
            getIntegratedLaborByQuantity={state.getIntegratedLaborByQuantity}
            getPartWarranty={state.getPartWarranty}
            handleAddPart={state.handleAddPart}
          />

          {/* Outsource Section */}
          <WorkOrderOutsourceSection
            additionalServices={state.additionalServices}
            setAdditionalServices={state.setAdditionalServices}
            newService={state.newService}
            setNewService={state.setNewService}
            canEditPriceAndParts={state.canEditPriceAndParts}
            order={props.order}
          />

          {/* Payment Details Column (Right Column) */}
          <WorkOrderPaymentSection
            formData={state.formData}
            setFormData={state.setFormData}
            showDepositInput={state.showDepositInput}
            setShowDepositInput={state.setShowDepositInput}
            depositAmount={state.depositAmount}
            setDepositAmount={state.setDepositAmount}
            order={props.order}
            showPartialPayment={state.showPartialPayment}
            setShowPartialPayment={state.setShowPartialPayment}
            partialPayment={state.partialPayment}
            setPartialPayment={state.setPartialPayment}
            remainingAmount={state.remainingAmount}
            partsTotal={state.partsTotal}
            servicesTotal={state.servicesTotal}
            effectiveLaborCost={state.effectiveLaborCost}
            includeIntegratedLabor={state.includeIntegratedLabor}
            setIncludeIntegratedLabor={state.setIncludeIntegratedLabor}
            discountType={state.discountType}
            setDiscountType={state.setDiscountType}
            discountPercent={state.discountPercent}
            setDiscountPercent={state.setDiscountPercent}
            subtotal={state.subtotal}
            total={state.total}
            totalDeposit={state.totalDeposit}
            totalAdditionalPayment={state.totalAdditionalPayment}
            handleSaveOnly={state.handleSaveOnly}
            handleSave={state.handleSave}
            handlePayFull={state.handlePayFull}
            onClose={props.onClose}
          />
        </div>
      </div>

      {/* Add Customer Modal */}
      {state.showAddCustomerModal && (
        <CustomerModal
          customer={{} as any}
          existingCustomers={props.customers}
          onSave={(savedCustomer) => {
            const customerId = savedCustomer.id || `CUST-${Date.now()}`;
            const primaryVehicle = savedCustomer.vehicles?.find((v: any) => v.isPrimary) || savedCustomer.vehicles?.[0];
            const existingCustomer = props.customers.find((c) => c.phone === savedCustomer.phone);

            if (!existingCustomer) {
              props.upsertCustomer({
                id: customerId,
                name: savedCustomer.name || "",
                phone: savedCustomer.phone || "",
                vehicles: savedCustomer.vehicles,
                vehicleModel: primaryVehicle?.model || savedCustomer.vehicleModel || "",
                licensePlate: primaryVehicle?.licensePlate || savedCustomer.licensePlate || "",
                created_at: new Date().toISOString(),
              });
            } else {
              const updatedVehicles = savedCustomer.vehicles && savedCustomer.vehicles.length > 0
                ? savedCustomer.vehicles
                : existingCustomer.vehicles;
              props.upsertCustomer({
                ...existingCustomer,
                vehicles: updatedVehicles,
                vehicleModel: primaryVehicle?.model || existingCustomer.vehicleModel,
                licensePlate: primaryVehicle?.licensePlate || existingCustomer.licensePlate,
              });
            }

            state.setFormData((prev) => ({
              ...prev,
              customerName: savedCustomer.name || "",
              customerPhone: savedCustomer.phone || "",
              vehicleId: primaryVehicle?.id,
              vehicleModel: primaryVehicle?.model || savedCustomer.vehicleModel || "",
              licensePlate: primaryVehicle?.licensePlate || savedCustomer.licensePlate || "",
            }));
            state.setCustomerSearch(savedCustomer.name || "");
            state.setShowAddCustomerModal(false);
          }}
          onClose={() => state.setShowAddCustomerModal(false)}
        />
      )}

      {/* Add Vehicle Modal */}
      {state.showAddVehicleModal && state.currentCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Thêm thiết bị cho {state.currentCustomer.name}
            </h3>

            <div className="space-y-4 mb-6">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tên thiết bị (Model) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: iPhone 15 Pro, Dell XPS..."
                  value={state.newVehicle.model}
                  onChange={(e) => {
                    state.setNewVehicle((prev) => ({ ...prev, model: e.target.value }));
                    state.setShowAddVehicleModelDropdown(true);
                  }}
                  onFocus={() => state.setShowAddVehicleModelDropdown(true)}
                  onBlur={() => setTimeout(() => state.setShowAddVehicleModelDropdown(false), 200)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  autoFocus
                />
                {state.showAddVehicleModelDropdown && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {POPULAR_DEVICES.filter((model) =>
                      model.toLowerCase().includes(state.newVehicle.model.toLowerCase())
                    )
                      .slice(0, 20)
                      .map((model, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            state.setNewVehicle((prev) => ({ ...prev, model }));
                            state.setShowAddVehicleModelDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-600 text-sm border-b border-slate-200 dark:border-slate-600 last:border-0 text-slate-900 dark:text-slate-100"
                        >
                          {model}
                        </button>
                      ))}
                    {POPULAR_DEVICES.filter((model) =>
                      model.toLowerCase().includes(state.newVehicle.model.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                        Không tìm thấy - nhập tên thiết bị mới
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Serial Number / IMEI <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: 356988..."
                  value={state.newVehicle.licensePlate}
                  onChange={(e) =>
                    state.setNewVehicle((prev) => ({
                      ...prev,
                      licensePlate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                🔹 Thiết bị mới sẽ tự động được chọn sau khi thêm
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  state.setShowAddVehicleModal(false);
                  state.setNewVehicle({ model: "", licensePlate: "" });
                  state.setShowAddVehicleModelDropdown(false);
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Hủy
              </button>
              <button
                onClick={state.handleAddVehicle}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                disabled={!state.newVehicle.model.trim() || !state.newVehicle.licensePlate.trim()}
              >
                Thêm thiết bị
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkOrderModal;
