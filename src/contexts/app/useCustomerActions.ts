import { useCallback } from "react";
import { showToast } from "../../utils/toast";
import type { Customer } from "../../types";
import type { AppActions, AppState } from "./types";
import {
  findCustomerById,
  findDuplicateCustomerByPhone,
  updateCustomerWithFallback,
  insertCustomerWithFallback,
} from "../../lib/repository/customersRepository";

type CustomerDeps = Pick<AppState, "customers" | "setCustomers">;

type CustomerInput = Partial<Customer> & { id?: string };

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

  const dupRes = await findDuplicateCustomerByPhone(customer.phone);
  const duplicate = dupRes.ok ? dupRes.data : null;

  if (!duplicate) return null;

  const existingId = duplicate.id;
  const existingVehicles = duplicate.vehicles || [];
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

  const updateRes = await updateCustomerWithFallback(existingId, [
    {
      name: customer.name || duplicate.name || "Khách hàng",
      vehiclemodel: customer.vehicleModel || duplicate.vehiclemodel || null,
      licenseplate: customer.licensePlate || duplicate.licenseplate || null,
      vehicles: updatedVehicles,
      lastvisit: new Date().toISOString(),
    },
    {
      name: customer.name || duplicate.name || "Khách hàng",
      vehiclemodel: customer.vehicleModel || duplicate.vehiclemodel || null,
      licenseplate: customer.licensePlate || duplicate.licenseplate || null,
      vehicles: updatedVehicles,
    },
    {
      name: customer.name || duplicate.name || "Khách hàng",
      vehicles: updatedVehicles,
    },
  ]);

  if (!updateRes.ok) {
    console.error("Lỗi cập nhật khách hàng:", updateRes.error.cause);
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
        const dbRes = await findCustomerById(customer.id);
        if (dbRes.ok && dbRes.data) {
          existingCustomer = dbRes.data;
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

          const updateRes = await updateCustomerWithFallback(targetCustomerId, [
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

          if (!updateRes.ok) {
            console.error("Error updating customer in Supabase:", updateRes.error.cause);
            showToast.error("Lỗi cập nhật khách hàng");
          }
        } else {
          const matchedDuplicateId = await handleDuplicatePhoneCustomer(customer);
          if (matchedDuplicateId) {
            showToast.success("Đã cập nhật khách hàng theo số điện thoại trùng");
            applyLocalCustomerUpsert(setCustomers, { ...customer, id: matchedDuplicateId }, matchedDuplicateId);
            return;
          }

          const insertRes = await insertCustomerWithFallback([
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

          if (!insertRes.ok) {
            console.error("Lỗi thêm khách hàng vào Supabase:", insertRes.error.cause);
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
