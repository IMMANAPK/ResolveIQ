import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ApiComplaintStats } from "@/types/api";

export function useComplaintStats(days: number = 30) {
  return useQuery({
    queryKey: ["complaint-stats", days],
    queryFn: async () => {
      const { data } = await api.get<ApiComplaintStats>(`/complaints/stats?days=${days}`);
      return data;
    },
  });
}
