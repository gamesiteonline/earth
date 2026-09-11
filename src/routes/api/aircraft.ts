import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout } from "@/lib/feeds/http";
import type { AircraftPayload, AircraftPoint } from "@/lib/feeds/types";

const TTL_MS = 25_000;
const MAX_POINTS = 1600;

let cache: { at: number; payload: AircraftPayload } | null = null;

export const Route = createFileRoute("/api/aircraft")({
  server: {
    handlers: {
      GET: async () => {
        if (cache && Date.now() - cache.at < TTL_MS) {
          return Response.json(cache.payload);
        }
        try {
          const payload = await loadAircraft();
          cache = { at: Date.now(), payload };
          return Response.json(payload, {
            headers: { "Cache-Control": "public, max-age=15" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Aircraft feed unavailable";
          const fallback: AircraftPayload = cache?.payload ?? {
            meta: {
              source: "OpenSky Network",
              at: Date.now(),
              count: 0,
              status: "offline",
              message,
            },
            points: [],
          };
          fallback.meta = { ...fallback.meta, status: "offline", message };
          return Response.json(fallback, { status: 200 });
        }
      },
    },
  },
});

type StatesResponse = {
  time?: number;
  states?: Array<Array<string | number | boolean | null>>;
};

async function loadAircraft(): Promise<AircraftPayload> {
  const opensky = await tryOpenSky();
  if (opensky && opensky.length > 40) {
    const sampled = stride(opensky, MAX_POINTS);
    return {
      meta: {
        source: "OpenSky Network",
        at: Date.now(),
        count: sampled.length,
        status: "ok",
      },
      points: sampled,
    };
  }
  const adsb = await loadAdsb();
  const sampled = stride(adsb, MAX_POINTS);
  return {
    meta: {
      source: "ADS-B (OpenSky unreachable)",
      at: Date.now(),
      count: sampled.length,
      status: sampled.length ? "degraded" : "offline",
      message: opensky ? "OpenSky returned a thin sample" : "OpenSky timed out",
    },
    points: sampled,
  };
}

async function tryOpenSky(): Promise<AircraftPoint[] | null> {
  try {
    const res = await fetchWithTimeout("https://opensky-network.org/api/states/all", 7000);
    if (!res.ok) return null;
    const json = (await res.json()) as StatesResponse;
    return parseOpenSky(json.states ?? []);
  } catch {
    return null;
  }
}

function parseOpenSky(states: Array<Array<string | number | boolean | null>>): AircraftPoint[] {
  const points: AircraftPoint[] = [];
  for (const s of states) {
    const lat = Number(s[6]);
    const lon = Number(s[5]);
    const onGround = Boolean(s[8]);
    if (onGround || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const callsign = String(s[1] ?? "").trim();
    points.push({
      icao: String(s[0] ?? ""),
      callsign: callsign || String(s[0] ?? "aircraft"),
      country: String(s[2] ?? ""),
      lat,
      lon,
      alt: Number(s[13] ?? s[7] ?? 0) || 0,
      heading: Number(s[10] ?? 0) || 0,
      velocity: Number(s[9] ?? 0) || 0,
    });
  }
  return points;
}

const HUBS: Array<[number, number]> = [
  [40.64, -73.78],
  [33.94, -118.41],
  [51.47, -0.45],
  [50.03, 8.57],
  [25.25, 55.36],
  [1.36, 103.99],
  [35.55, 139.78],
  [-33.95, 151.18],
  [41.98, -87.9],
  [22.31, 113.91],
  [-23.43, -46.47],
  [52.31, 4.76],
];

type AdsbAc = {
  hex?: string;
  flight?: string;
  r?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | string;
  alt_geom?: number;
  gs?: number;
  track?: number;
};

async function loadAdsb(): Promise<AircraftPoint[]> {
  const urls = [
    "https://api.adsb.lol/v2/mil",
    ...HUBS.map(
      ([lat, lon]) => `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/250`,
    ),
  ];
  const batches = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetchWithTimeout(url, 9000);
        if (!res.ok) return [] as AdsbAc[];
        const json = (await res.json()) as { ac?: AdsbAc[] };
        return json.ac ?? [];
      } catch {
        return [] as AdsbAc[];
      }
    }),
  );
  const seen = new Set<string>();
  const points: AircraftPoint[] = [];
  for (const ac of batches.flat()) {
    const lat = Number(ac.lat);
    const lon = Number(ac.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const key = (ac.hex || `${lat},${lon}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (ac.alt_baro === "ground") continue;
    const alt =
      typeof ac.alt_baro === "number"
        ? ac.alt_baro * 0.3048
        : typeof ac.alt_geom === "number"
          ? ac.alt_geom * 0.3048
          : 10000;
    const callsign = (ac.flight || ac.r || ac.hex || "traffic").trim();
    points.push({
      icao: ac.hex || key,
      callsign,
      country: "",
      lat,
      lon,
      alt,
      heading: Number(ac.track) || 0,
      velocity: (Number(ac.gs) || 0) / 1.94384,
    });
  }
  return points;
}

function stride<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const out: T[] = [];
  const step = arr.length / max;
  for (let i = 0; i < max; i++) {
    const v = arr[Math.floor(i * step)];
    if (v) out.push(v);
  }
  return out;
}
