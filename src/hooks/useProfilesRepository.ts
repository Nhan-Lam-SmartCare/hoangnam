import { useQuery } from "@tanstack/react-query";
import { fetchProfilesForTechnicians } from "../lib/repository/profilesRepository";

export function useProfilesForTechnicians() {
  return useQuery({
    queryKey: ["profilesForTechnicians"],
    queryFn: async () => {
      const res = await fetchProfilesForTechnicians();
      if (!res.ok) throw res.error;
      return res.data;
    },
  });
}
