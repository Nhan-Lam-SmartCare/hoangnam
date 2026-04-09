import fs from "node:fs";

const filePath = "src/components/service/components/WorkOrderModal.tsx";
let source = fs.readFileSync(filePath, "utf8");

const importLine =
  '} from "../../../lib/services/repairLaborService";';
const importLineIndex = source.indexOf(importLine);
if (importLineIndex === -1) {
  throw new Error("Cannot find import anchor.");
}

const importInsertIndex = importLineIndex + importLine.length;
source =
  source.slice(0, importInsertIndex) +
  "\nimport { WorkOrderCustomerSection } from \"./WorkOrderCustomerSection\";\nimport { WorkOrderVehicleSection } from \"./WorkOrderVehicleSection\";" +
  source.slice(importInsertIndex);

const customerLabel =
  '                    Khách hàng <span className="text-red-500">*</span>';
const customerEnd =
  '                  {/* Vehicle Selection & Add Vehicle (for selected customer) */}';

const customerLabelIndex = source.indexOf(customerLabel);
const customerStartIndex =
  customerLabelIndex > -1
    ? source.lastIndexOf("                <div>", customerLabelIndex)
    : -1;
const customerEndIndex = source.indexOf(customerEnd, customerLabelIndex);

if (customerStartIndex === -1 || customerEndIndex === -1 || customerEndIndex <= customerStartIndex) {
  throw new Error("Cannot find customer block range.");
}

const customerReplacement = `                <div>
                  <WorkOrderCustomerSection
                    customerSearch={customerSearch}
                    showCustomerDropdown={showCustomerDropdown}
                    filteredCustomers={filteredCustomers}
                    hasMoreCustomers={hasMoreCustomers}
                    isSearchingCustomer={isSearchingCustomer}
                    customersLength={customers.length}
                    formData={formData}
                    isEditingCustomer={isEditingCustomer}
                    editCustomerName={editCustomerName}
                    editCustomerPhone={editCustomerPhone}
                    onCustomerSearchChange={(value) => {
                      setCustomerSearch(value);
                      setShowCustomerDropdown(true);
                      setFormData({
                        ...formData,
                        customerName: value,
                      });
                    }}
                    onCustomerFocus={() => setShowCustomerDropdown(true)}
                    onSelectCustomer={(customer) => {
                      const primaryVehicle =
                        customer.vehicles?.find((v: Vehicle) => v.isPrimary) ||
                        customer.vehicles?.[0];

                      setFormData({
                        ...formData,
                        customerName: customer.name,
                        customerPhone: customer.phone,
                        vehicleId: primaryVehicle?.id,
                        vehicleModel:
                          primaryVehicle?.model || customer.vehicleModel || "",
                        licensePlate:
                          primaryVehicle?.licensePlate ||
                          customer.licensePlate ||
                          "",
                      });
                      setCustomerSearch(customer.name);
                      setShowCustomerDropdown(false);
                    }}
                    onLoadMoreCustomers={handleLoadMoreCustomers}
                    onOpenAddCustomer={() => {
                      setShowAddCustomerModal(true);
                      if (customerSearch && /^[0-9]+$/.test(customerSearch)) {
                        setNewCustomer({
                          ...newCustomer,
                          phone: customerSearch,
                        });
                      }
                    }}
                    onStartEditCustomer={() => {
                      setEditCustomerName(formData.customerName || "");
                      setEditCustomerPhone(formData.customerPhone || "");
                      setIsEditingCustomer(true);
                    }}
                    onClearCustomer={() => {
                      setCustomerSearch("");
                      setFormData({
                        ...formData,
                        customerName: "",
                        customerPhone: "",
                        vehicleId: undefined,
                        vehicleModel: "",
                        licensePlate: "",
                      });
                    }}
                    onEditCustomerNameChange={setEditCustomerName}
                    onEditCustomerPhoneChange={setEditCustomerPhone}
                    onCancelEditCustomer={() => setIsEditingCustomer(false)}
                    onSaveEditedCustomer={handleSaveEditedCustomer}
                  />
                </div>

`;

source =
  source.slice(0, customerStartIndex) +
  customerReplacement +
  source.slice(customerEndIndex);

const vehicleComment =
  '                  {/* Vehicle Selection & Add Vehicle (for selected customer) */}';
const vehicleCondition = '                  {currentCustomer && (';
const vehicleEndAnchor = '                <div className="space-y-2">';

const vehicleCommentIndex = source.indexOf(vehicleComment);
const vehicleConditionIndex = source.indexOf(
  vehicleCondition,
  vehicleCommentIndex
);
const vehicleStartIndex = vehicleCommentIndex;
const vehicleEndIndex = source.indexOf(vehicleEndAnchor, vehicleConditionIndex);

if (vehicleStartIndex === -1 || vehicleEndIndex === -1 || vehicleEndIndex <= vehicleStartIndex) {
  throw new Error("Cannot find vehicle block range.");
}

const vehicleReplacement = `                  {/* Vehicle Selection & Add Vehicle (for selected customer) */}
                  {currentCustomer && (
                    <WorkOrderVehicleSection
                      customerVehicles={customerVehicles}
                      selectedVehicleId={formData.vehicleId}
                      editingVehicleId={editingVehicleId}
                      editVehicleModel={editVehicleModel}
                      editVehicleLicensePlate={editVehicleLicensePlate}
                      onOpenAddVehicleModal={() => setShowAddVehicleModal(true)}
                      onSelectVehicle={(vehicle) => handleSelectVehicle(vehicle)}
                      onStartEditVehicle={(vehicle) => {
                        setEditingVehicleId(vehicle.id);
                        setEditVehicleModel(vehicle.model || "");
                        setEditVehicleLicensePlate(vehicle.licensePlate || "");
                      }}
                      onCancelEditVehicle={() => {
                        setEditingVehicleId(null);
                        setEditVehicleModel("");
                        setEditVehicleLicensePlate("");
                      }}
                      onSaveEditedVehicle={handleSaveEditedVehicle}
                      onEditVehicleModelChange={setEditVehicleModel}
                      onEditVehicleLicensePlateChange={setEditVehicleLicensePlate}
                    />
                  )}
`;

source =
  source.slice(0, vehicleStartIndex) +
  vehicleReplacement +
  source.slice(vehicleEndIndex);

fs.writeFileSync(filePath, source, "utf8");
console.log("Extracted customer + vehicle sections successfully.");
