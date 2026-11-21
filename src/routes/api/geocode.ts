import { createFileRoute } from "@tanstack/react-router";
import { fetchWithTimeout } from "@/lib/feeds/http";
import type { GeoHit } from "@/lib/eye/types";

const cache = new Map<string, { at: number; results: GeoHit[] }>();

export const Route = createFileRoute("/api/geocode")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
        if (q.length < 2) return Response.json({ results: [] });
        const key = q.toLowerCase();
        const hit = cache.get(key);
        if (hit && Date.now() - hit.at < 10 * 60 * 1000) {
          return Response.json({ results: hit.results });
        }
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=6&q=${encodeURIComponent(q)}`;
        try {
          const res = await fetchWithTimeout(url, 12000, {
            headers: { "User-Agent": "FalizEye/1.0 (geographic search)" },
          });
          if (!res.ok) throw new Error(`nominatim ${res.status}`);
          const rows = (await res.json()) as Array<{
            display_name?: string;
            lat?: string;
            lon?: string;
            type?: string;
            addresstype?: string;
          }>;
          const results: GeoHit[] = rows
            .map((row) => ({
              name: row.display_name ?? q,
              lat: Number(row.lat),
              lon: Number(row.lon),
              kind: row.addresstype || row.type || "place",
            }))
            .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon));
          cache.set(key, { at: Date.now(), results });
          return Response.json({ results });
        } catch (err) {
          const message = err instanceof Error ? err.message : "search failed";
          return Response.json({ results: [], message }, { status: 200 });
        }
      },
    },
  },
});
