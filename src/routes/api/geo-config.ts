import { createFileRoute } from "@tanstack/react-router";
import type { GeoConfig } from "@/lib/eye/types";

export const Route = createFileRoute("/api/geo-config")({
  server: {
    handlers: {
      GET: async () => {
        const ionToken = process.env.CESIUM_ION_TOKEN?.trim() || "";
        const googleKey = process.env.GOOGLE_MAP_TILES_API_KEY?.trim() || "";
        const mapillaryToken = process.env.MAPILLARY_TOKEN?.trim() || "";
        const body: GeoConfig = {
          ion: Boolean(ionToken),
          ionToken: ionToken || undefined,
          google3d: Boolean(googleKey),
          googleKey: googleKey || undefined,
          mapillary: Boolean(mapillaryToken),
          mapillaryToken: mapillaryToken || undefined,
          fallback: {
            imagery: "Esri World Imagery",
            terrain: "Esri World Elevation 3D",
            buildings: ionToken ? "Cesium OSM Buildings" : "Esri OSM 3D Buildings (I3S)",
            labels: "Esri World Boundaries and Places",
            search: "OSM Nominatim",
          },
        };
        return Response.json(body, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
