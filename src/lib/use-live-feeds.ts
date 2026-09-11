import { useQuery } from "@tanstack/react-query";
import type { AircraftPayload, FiresPayload, SatellitesPayload } from "@/lib/feeds/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return (await res.json()) as T;
}

export function useFires() {
  return useQuery({
    queryKey: ["firms"],
    queryFn: () => getJson<FiresPayload>("/api/firms"),
    refetchInterval: 8 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAircraft() {
  return useQuery({
    queryKey: ["aircraft"],
    queryFn: () => getJson<AircraftPayload>("/api/aircraft"),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

export function useSatellites() {
  return useQuery({
    queryKey: ["satellites"],
    queryFn: () => getJson<SatellitesPayload>("/api/satellites"),
    refetchInterval: 90_000,
    staleTime: 60_000,
  });
}
