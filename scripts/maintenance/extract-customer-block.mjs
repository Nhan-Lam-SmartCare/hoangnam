import fs from "node:fs";

const filePath = "src/components/service/components/WorkOrderModal.tsx";
const source = fs.readFileSync(filePath, "utf8");

const labelAnchor =
  '                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">';
const customerLabelText =
  '                    Khách hàng <span className="text-red-500">*</span>';
const endAnchor =
  '                  {/* Vehicle Selection & Add Vehicle (for selected customer) */}';

const labelIndex = source.indexOf(labelAnchor);
const labelTextIndex = source.indexOf(customerLabelText, labelIndex);
const endIndex = source.indexOf(endAnchor);

const startIndex =
  labelIndex > 0 ? source.lastIndexOf("                <div>", labelIndex) : -1;

if (
  labelIndex === -1 ||
  labelTextIndex === -1 ||
  startIndex === -1 ||
  endIndex === -1 ||
  endIndex <= startIndex
) {
  throw new Error("Cannot find customer block anchors for extraction.");
}

const replacement = `                <WorkOrderCustomerSection
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

`;

const updated =
  source.slice(0, startIndex) + replacement + source.slice(endIndex);

fs.writeFileSync(filePath, updated, "utf8");
console.log("Customer block extracted successfully.");
