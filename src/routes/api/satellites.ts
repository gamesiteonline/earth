import { createFileRoute } from "@tanstack/react-router";
import { N2YO_API_KEY } from "@/lib/feeds/keys.server";
import { fetchWithTimeout } from "@/lib/feeds/http";
import type { SatelliteSnapshot, SatelliteTle, SatellitesPayload } from "@/lib/feeds/types";

const TLE_TTL = 3 * 60 * 60 * 1000;
const SNAP_TTL = 70_000;

const CATALOG: Array<{ id: number; name: string; kind: SatelliteTle["kind"] }> = [
  { id: 25544, name: "ISS", kind: "station" },
  { id: 48274, name: "Tiangong", kind: "station" },
  { id: 20580, name: "Hubble", kind: "science" },
  { id: 25994, name: "Terra", kind: "earth" },
  { id: 27424, name: "Aqua", kind: "earth" },
  { id: 43013, name: "NOAA-20", kind: "weather" },
  { id: 42063, name: "Sentinel-2B", kind: "earth" },
  { id: 49260, name: "Landsat 9", kind: "earth" },
  { id: 39084, name: "Landsat 8", kind: "earth" },
  { id: 40697, name: "Sentinel-2A", kind: "earth" },
];

let tleCache: { at: number; tles: SatelliteTle[] } | null = null;
let snapCache: { at: number; overhead: SatelliteSnapshot[] } | null = null;

export const Route = createFileRoute("/api/satellites")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [tles, overhead] = await Promise.all([loadTles(), loadOverhead()]);
          const payload: SatellitesPayload = {
            meta: {
              source: "N2YO / Celestrak",
              at: Date.now(),
              count: Math.max(tles.length, overhead.length),
              status: tles.length ? "ok" : overhead.length ? "degraded" : "offline",
            },
            tles,
            overhead,
          };
          return Response.json(payload, {
            headers: { "Cache-Control": "public, max-age=30" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Satellite feed unavailable";
          const payload: SatellitesPayload = {
            meta: {
              source: "N2YO",
              at: Date.now(),
              count: tleCache?.tles.length ?? 0,
              status: "offline",
              message,
            },
            tles: tleCache?.tles ?? [],
            overhead: snapCache?.overhead ?? [],
          };
          return Response.json(payload, { status: 200 });
        }
      },
    },
  },
});

async function loadTles(): Promise<SatelliteTle[]> {
  if (tleCache && Date.now() - tleCache.at < TLE_TTL) return tleCache.tles;
  const tles: SatelliteTle[] = [];
  for (const sat of CATALOG) {
    const tle = await fetchOneTle(sat);
    if (tle) tles.push(tle);
  }
  if (tles.length) tleCache = { at: Date.now(), tles };
  return tles;
}

async function fetchOneTle(sat: (typeof CATALOG)[number]): Promise<SatelliteTle | null> {
  const n2yo = `https://api.n2yo.com/rest/v1/satellite/tle/${sat.id}?apiKey=${N2YO_API_KEY}`;
  try {
    const res = await fetchWithTimeout(n2yo, 8000);
    if (res.ok) {
      const json = (await res.json()) as { tle?: string; info?: { satname?: string } };
      const parsed = splitTle(json.tle ?? "");
      if (parsed) {
        return {
          id: sat.id,
          name: json.info?.satname || sat.name,
          kind: sat.kind,
          ...parsed,
        };
      }
    }
  } catch {
    /* fall through to Celestrak */
  }
  try {
    const res = await fetchWithTimeout(
      `https://celestrak.org/NORAD/elements/gp.php?CATNR=${sat.id}&FORMAT=tle`,
      8000,
    );
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    const l1 = lines.find((l) => l.startsWith("1 "));
    const l2 = lines.find((l) => l.startsWith("2 "));
    if (!l1 || !l2) return null;
    return { id: sat.id, name: sat.name, kind: sat.kind, line1: l1.trim(), line2: l2.trim() };
  } catch {
    return null;
  }
}

function splitTle(raw: string): { line1: string; line2: string } | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const line1 = lines.find((l) => l.startsWith("1 "));
  const line2 = lines.find((l) => l.startsWith("2 "));
  if (!line1 || !line2) return null;
  return { line1, line2 };
}

async function loadOverhead(): Promise<SatelliteSnapshot[]> {
  if (snapCache && Date.now() - snapCache.at < SNAP_TTL) return snapCache.overhead;
  const url = `https://api.n2yo.com/rest/v1/satellite/above/0/0/0/90/15/?apiKey=${N2YO_API_KEY}`;
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) return snapCache?.overhead ?? [];
    const json = (await res.json()) as {
      above?: Array<{ satid: number; satname: string; satlat: number; satlng: number; satalt: number }>;
    };
    const overhead: SatelliteSnapshot[] = (json.above ?? []).map((s) => ({
      id: s.satid,
      name: s.satname,
      lat: s.satlat,
      lon: s.satlng,
      alt: s.satalt,
    }));
    snapCache = { at: Date.now(), overhead };
    return overhead;
  } catch {
    return snapCache?.overhead ?? [];
  }
}
