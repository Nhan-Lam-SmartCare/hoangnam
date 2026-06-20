import { useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { showToast } from "../../utils/toast";
import type { Customer } from "../../types";
import type { AppActions, AppState } from "./types";

type CustomerDeps = Pick<AppState, "customers" | "setCustomers">;

type CustomerInput = Partial<Customer> & { id?: string };

async function updateCustomerWithFallback(
  customerId: string,
  payloads: Array<Record<string, any>>
) {
  let lastError: any = null;
  for (const payload of payloads) {
    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", customerId);
    if (!error) return null;
    lastError = error;
  }
  return lastError;
}

async function insertCustomerWithFallback(payloads: Array<Record<string, any>>) {
  let lastError: any = null;
  for (const payload of payloads) {
    const { error } = await supabase.from("customers").insert([payload]);
    if (!error) return null;
    lastError = error;
  }
  return lastError;
}

async function findCustomerById(id: string) {
  try {
    const { data: dbCustomer } = await supabase
      .from("customers")
      .select("id")
      .eq("id", id)
      .single();
    return dbCustomer ? ({ id: dbCustomer.id } as Customer) : null;
  } catch {
    return null;
  }
}

function applyLocalCustomerUpsert(
  setCustomers: CustomerDeps["setCustomers"],
  customer: CustomerInput,
  customerId: string
) {
  setCustomers((prev) => {
    if (customer.id) {
      const existingIndex = prev.findIndex((c) => c.id === customer.id);
      if (existingIndex >= 0) {
        return prev.map((c) =>
          c.id === customer.id ? ({ ...c, ...customer } as Customer) : c
        );
      }
      const newCustomer: Customer = {
        id: customer.id,
        name: customer.name || "Khách hàng",
        phone: customer.phone,
        created_at: new Date().toISOString(),
        ...customer,
      } as Customer;
      return [newCustomer, ...prev];
    }

    const newCustomer: Customer = {
      id: customerId,
      name: customer.name || "Khách hàng",
      phone: customer.phone,
      created_at: new Date().toISOString(),
      ...customer,
    } as Customer;
    return [newCustomer, ...prev];
  });
}

// eslint-disable-next-line complexity
async function handleDuplicatePhoneCustomer(customer: CustomerInput): Promise<string | null> {
  if (!customer.phone) return null;

  const { data: duplicates } = await supabase
    .from("customers")
    .select("id, name, vehiclemodel, licenseplate, vehicles")
    .eq("phone", customer.phone)
    .limit(1);

  if (!duplicates || duplicates.length === 0) return null;

  const existingId = duplicates[0].id;
  const existingVehicles = duplicates[0].vehicles || [];
  let updatedVehicles = existingVehicles;

  if (customer.vehicles && customer.vehicles.length > 0) {
    const newVehicle = customer.vehicles[0];
    const vehicleExists = existingVehicles.some(
      (v: any) =>
        v.licensePlate === newVehicle.licensePlate || v.id === newVehicle.id
    );
    if (!vehicleExists && newVehicle.licensePlate) {
      updatedVehicles = [...existingVehicles, newVehicle];
    }
  }

  const updateError = await updateCustomerWithFallback(existingId, [
    {
      name: customer.name || duplicates[0].name || "Khách hàng",
      vehiclemodel: customer.vehicleModel || duplicates[0].vehiclemodel || null,
      licenseplate: customer.licensePlate || duplicates[0].licenseplate || null,
      vehicles: updatedVehicles,
      lastvisit: new Date().toISOString(),
    },
    {
      name: customer.name || duplicates[0].name || "Khách hàng",
      vehiclemodel: customer.vehicleModel || duplicates[0].vehiclemodel || null,
      licenseplate: customer.licensePlate || duplicates[0].licenseplate || null,
      vehicles: updatedVehicles,
    },
    {
      name: customer.name || duplicates[0].name || "Khách hàng",
      vehicles: updatedVehicles,
    },
  ]);

  if (updateError) {
    console.error("Lỗi cập nhật khách hàng:", updateError);
  }

  return existingId;
}

export function useCustomerActions(
  deps: CustomerDeps
): Pick<AppActions, "upsertCustomer"> {
  const { customers, setCustomers } = deps;

  const upsertCustomer = useCallback(
    // eslint-disable-next-line complexity
    async (customer: CustomerInput) => {
      const customerId =
        customer.id || `CUS-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      let existingCustomer: Customer | undefined = customers.find((c) => c.id === customer.id);
      if (!existingCustomer && customer.id) {
        const dbCustomer = await findCustomerById(customer.id);
        if (dbCustomer) {
          existingCustomer = dbCustomer;
        }
      }

      try {
        if (existingCustomer) {
          const targetCustomerId = customer.id || existingCustomer.id || customerId;
          const basePayload = {
            name: customer.name || existingCustomer.name,
            phone: customer.phone || existingCustomer.phone || null,
            vehiclemodel:
              customer.vehicleModel || existingCustomer.vehicleModel || null,
            licenseplate:
              customer.licensePlate || existingCustomer.licensePlate || null,
            vehicles: customer.vehicles || existingCustomer.vehicles || [],
            status: customer.status || existingCustomer.status || "active",
            segment: customer.segment || existingCustomer.segment || "New",
            loyaltypoints:
              customer.loyaltyPoints ?? existingCustomer.loyaltyPoints ?? 0,
            totalspent: customer.totalSpent ?? existingCustomer.totalSpent ?? 0,
            visitcount: customer.visitCount ?? existingCustomer.visitCount ?? 0,
          };

          const error = await updateCustomerWithFallback(targetCustomerId, [
            {
              ...basePayload,
              lastvisit: customer.lastVisit || existingCustomer.lastVisit || null,
            },
            {
              ...basePayload,
              latestvisit: customer.lastVisit || existingCustomer.lastVisit || null,
            },
            {
              ...basePayload,
            },
          ]);

          if (error) {
            console.error("Error updating customer in Supabase:", error);
            showToast.error("Lỗi cập nhật khách hàng");
          }
        } else {
          const matchedDuplicateId = await handleDuplicatePhoneCustomer(customer);
          if (matchedDuplicateId) {
            showToast.success("Đã cập nhật khách hàng theo số điện thoại trùng");
            applyLocalCustomerUpsert(setCustomers, { ...customer, id: matchedDuplicateId }, matchedDuplicateId);
            return;
          }

          const error = await insertCustomerWithFallback([
            {
              id: customerId,
              name: customer.name || "Khách hàng",
              phone: customer.phone || null,
              vehiclemodel: customer.vehicleModel || null,
              licenseplate: customer.licensePlate || null,
              vehicles: customer.vehicles || [],
              status: customer.status || "active",
              segment: customer.segment || "New",
              loyaltypoints: customer.loyaltyPoints ?? 0,
              totalspent: customer.totalSpent ?? 0,
              visitcount: customer.visitCount ?? 0,
              lastvisit: customer.lastVisit || null,
            },
            {
              id: customerId,
              name: customer.name || "Khách hàng",
              phone: customer.phone || null,
              vehiclemodel: customer.vehicleModel || null,
              licenseplate: customer.licensePlate || null,
              vehicles: customer.vehicles || [],
              totalspent: customer.totalSpent ?? 0,
            },
            {
              id: customerId,
              name: customer.name || "Khách hàng",
              phone: customer.phone || null,
              vehicles: customer.vehicles || [],
            },
          ]);

          if (error) {
            console.error("Lỗi thêm khách hàng vào Supabase:", error);
            showToast.error("Lỗi lưu khách hàng mới");
          } else {
            showToast.success("Đã lưu khách hàng mới");
          }
        }
      } catch (err) {
        console.error("Error saving customer to database:", err);
      }

      applyLocalCustomerUpsert(setCustomers, customer, customerId);
    },
    [customers, setCustomers]
  );

  return { upsertCustomer };
}
