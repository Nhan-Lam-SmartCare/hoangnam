import { IS_OFFLINE } from "../supabaseClient";
import { useParts as usePartsQuery } from "./useSupabase";
import { useAppContext } from "../contexts/AppContext";
import type { Part } from "../types";

export const usePartsData = () => {
  const { parts: partsFromContext } = useAppContext();
  const query = usePartsQuery();

  if (IS_OFFLINE) {
    return {
      data: partsFromContext as Part[],
      isLoading: false,
      isError: false,
      refetch: async () => {},
    } as const;
  }

  return query;
};
