import { createFileRoute } from "@tanstack/react-router";
import { INTEL_REGISTRY } from "@/lib/eye/registry";

export const Route = createFileRoute("/api/intelligence")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(
          {
            source: "GOD'S EYE enrolled registry",
            at: Date.now(),
            features: INTEL_REGISTRY,
          },
          { headers: { "Cache-Control": "public, max-age=30" } },
        ),
    },
  },
});
