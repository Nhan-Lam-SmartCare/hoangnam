import { useQuery } from "@tanstack/react-query";
import { searchCustomers } from "../lib/repository/customersRepository";

export function useCustomerSearchRepo(searchTerm: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: ["customerSearchRepo", searchTerm, page, pageSize],
    queryFn: async () => {
      const res = await searchCustomers(searchTerm, page, pageSize);
      if (!res.ok) throw res.error;
      return res.data;
    },
    enabled: !!searchTerm.trim(),
  });
}
