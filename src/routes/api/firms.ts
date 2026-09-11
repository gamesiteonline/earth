import { createFileRoute } from "@tanstack/react-router";
import { FIRMS_MAP_KEY } from "@/lib/feeds/keys.server";
import { fetchWithTimeout, num, parseCsv } from "@/lib/feeds/http";
import type { FirePoint, FiresPayload } from "@/lib/feeds/types";

const TTL_MS = 8 * 60 * 1000;
const MAX_POINTS = 2200;
const SOURCE = "VIIRS_NOAA20_NRT";

let cache: { at: number; payload: FiresPayload } | null = null;

export const Route = createFileRoute("/api/firms")({
  server: {
    handlers: {
      GET: async () => {
        if (cache && Date.now() - cache.at < TTL_MS) {
          return Response.json(cache.payload);
        }
        try {
          const payload = await loadFires();
          cache = { at: Date.now(), payload };
          return Response.json(payload, {
            headers: { "Cache-Control": "public, max-age=120" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "FIRMS unavailable";
          const fallback: FiresPayload = cache?.payload ?? {
            meta: {
              source: "NASA FIRMS VIIRS",
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

async function latestDate(): Promise<string> {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/${FIRMS_MAP_KEY}/${SOURCE}`;
  const res = await fetchWithTimeout(url, 10000);
  const text = await res.text();
  const rows = parseCsv(text);
  const max = rows[0]?.max_date?.trim();
  if (max && /^\d{4}-\d{2}-\d{2}$/.test(max)) return max;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function loadFires(): Promise<FiresPayload> {
  const date = await latestDate();
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${SOURCE}/world/1/${date}`;
  const res = await fetchWithTimeout(url, 28000);
  const text = await res.text();
  if (!res.ok || !/latitude/i.test(text.split(/\r?\n/, 1)[0] ?? "")) {
    throw new Error(text.slice(0, 180) || `FIRMS ${res.status}`);
  }
  const rows = parseCsv(text);
  const points: FirePoint[] = [];
  for (const row of rows) {
    const lat = num(row.latitude);
    const lon = num(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    points.push({
      lat,
      lon,
      frp: num(row.frp),
      brightness: num(row.bright_ti4 || row.brightness),
      date: row.acq_date ?? date,
    });
  }
  points.sort((a, b) => b.frp - a.frp);
  const sampled = sample(points, MAX_POINTS);
  return {
    meta: {
      source: `NASA FIRMS · VIIRS NOAA-20 · ${date}`,
      at: Date.now(),
      count: sampled.length,
      status: sampled.length ? "ok" : "degraded",
    },
    points: sampled,
  };
}

function sample(points: FirePoint[], max: number) {
  if (points.length <= max) return points;
  const out: FirePoint[] = [];
  const step = points.length / max;
  for (let i = 0; i < max; i++) {
    const p = points[Math.floor(i * step)];
    if (p) out.push(p);
  }
  return out;
}
