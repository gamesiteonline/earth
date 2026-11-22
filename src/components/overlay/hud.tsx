import { useMemo, useState } from "react";
import { FEATURED_LOCATIONS } from "@/lib/locations";
import { formatCoord } from "@/lib/geo";
import { useGlobeStore, type LayerId, type Selection } from "@/lib/globe-store";
import { useAircraft, useFires, useSatellites } from "@/lib/use-live-feeds";

const TYPE_LABEL: Record<Selection["type"], string> = {
  place: "Location",
  fire: "FIRMS",
  aircraft: "Flight",
  satellite: "Satellite",
};

const LAYERS: { id: LayerId; label: string; swatch: string }[] = [
  { id: "places", label: "Places", swatch: "bg-accent" },
  { id: "fires", label: "Fires", swatch: "bg-fire" },
  { id: "aircraft", label: "Flights", swatch: "bg-air" },
  { id: "satellites", label: "Sats", swatch: "bg-sat" },
];

export function Hud() {
  const layers = useGlobeStore((s) => s.layers);
  const toggleLayer = useGlobeStore((s) => s.toggleLayer);
  const autoRotate = useGlobeStore((s) => s.autoRotate);
  const interacting = useGlobeStore((s) => s.interacting);
  const setAutoRotate = useGlobeStore((s) => s.setAutoRotate);
  const listOpen = useGlobeStore((s) => s.listOpen);
  const setListOpen = useGlobeStore((s) => s.setListOpen);
  const search = useGlobeStore((s) => s.search);
  const setSearch = useGlobeStore((s) => s.setSearch);
  const selection = useGlobeStore((s) => s.selection);
  const selectPlace = useGlobeStore((s) => s.selectPlace);
  const clearSelection = useGlobeStore((s) => s.clearSelection);
  const look = useGlobeStore((s) => s.look);

  const fires = useFires();
  const aircraft = useAircraft();
  const sats = useSatellites();

  const places = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FEATURED_LOCATIONS;
    return FEATURED_LOCATIONS.filter(
      (loc) =>
        loc.name.toLowerCase().includes(q) ||
        loc.region.toLowerCase().includes(q) ||
        loc.kind.includes(q),
    );
  }, [search]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
      <header className="flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="text-[15px] font-medium tracking-[0.18em] text-fg uppercase">
              Orbital
            </h1>
            <span className="font-mono text-[10px] tracking-wide text-faint uppercase">
              {interacting ? "Hold" : autoRotate ? "Spin" : "Still"}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[11px] text-muted tabular-nums">
            {formatCoord(look.lat, look.lon)}
          </p>
        </div>
        <div className="pointer-events-auto flex max-w-[70%] flex-wrap justify-end gap-1.5">
          <FeedPill
            label="Fires"
            count={fires.data?.points.length}
            status={fires.isError ? "offline" : (fires.data?.meta.status ?? "degraded")}
          />
          <FeedPill
            label="Flights"
            count={aircraft.data?.points.length}
            status={aircraft.isError ? "offline" : (aircraft.data?.meta.status ?? "degraded")}
          />
          <FeedPill
            label="Sats"
            count={sats.data?.tles.length}
            status={sats.isError ? "offline" : (sats.data?.meta.status ?? "degraded")}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 items-end justify-between gap-3 p-3 sm:items-stretch sm:p-4">
        <section className="pointer-events-auto flex w-[min(100%,280px)] flex-col gap-2 self-end sm:self-auto sm:justify-end">
          <div className="flex flex-wrap gap-1.5">
            {LAYERS.map((layer) => {
              const on = layers[layer.id];
              return (
                <button
                  key={layer.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLayer(layer.id)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] transition-colors ${
                    on
                      ? "bg-surface text-fg shadow-[var(--shadow-border)]"
                      : "bg-surface/60 text-faint"
                  }`}
                >
                  <span className={`size-1.5 rounded-full ${on ? layer.swatch : "bg-faint"}`} />
                  {layer.label}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={autoRotate}
              onClick={() => setAutoRotate(!autoRotate)}
              className="inline-flex h-8 items-center rounded-full bg-surface/80 px-2.5 text-[12px] text-muted shadow-[var(--shadow-border)]"
            >
              {autoRotate ? "Auto" : "Paused"}
            </button>
          </div>

          {selection ? (
            <article className="rounded-lg bg-surface/92 p-3 shadow-[var(--shadow-border)] backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-accent uppercase">
                    {TYPE_LABEL[selection.type]}
                  </p>
                  <h2 className="truncate text-[15px] font-medium">{selection.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="shrink-0 text-[12px] text-muted"
                  aria-label="Close details"
                >
                  Close
                </button>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted tabular-nums">
                {formatCoord(selection.lat, selection.lon)}
                {"region" in selection && selection.region ? ` · ${selection.region}` : ""}
              </p>
              <p className="mt-2 text-[13px] leading-snug text-fg/90">{selection.detail}</p>
            </article>
          ) : null}

          <LocationsPanel
            open={listOpen}
            onToggle={() => setListOpen(!listOpen)}
            search={search}
            onSearch={setSearch}
            places={places}
            activeId={selection?.type === "place" ? selection.id : null}
            onPick={selectPlace}
          />
        </section>
      </div>
    </div>
  );
}

function FeedPill({
  label,
  count,
  status,
}: {
  label: string;
  count?: number;
  status: "ok" | "degraded" | "offline";
}) {
  const dot =
    status === "ok" ? "bg-air" : status === "degraded" ? "bg-fire" : "bg-faint";
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface/85 px-2 font-mono text-[10px] tracking-wide text-muted shadow-[var(--shadow-border)] backdrop-blur-md">
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
      <span className="text-fg tabular-nums">{count ?? "–"}</span>
    </span>
  );
}

function LocationsPanel({
  open,
  onToggle,
  search,
  onSearch,
  places,
  activeId,
  onPick,
}: {
  open: boolean;
  onToggle: () => void;
  search: string;
  onSearch: (v: string) => void;
  places: typeof FEATURED_LOCATIONS;
  activeId: string | null;
  onPick: (loc: (typeof FEATURED_LOCATIONS)[number]) => void;
}) {
  const [localFocus, setLocalFocus] = useState(false);
  return (
    <div className="overflow-hidden rounded-lg bg-surface/92 shadow-[var(--shadow-border)] backdrop-blur-md">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between px-3 text-left text-[13px]"
      >
        <span>Locations</span>
        <span className="font-mono text-[10px] text-faint">{places.length}</span>
      </button>
      {open ? (
        <div className="border-t border-border px-2 pb-2">
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setLocalFocus(true)}
            onBlur={() => setLocalFocus(false)}
            placeholder={localFocus ? "" : "Search cities"}
            aria-label="Search locations"
            className="mt-2 h-9 w-full rounded-md bg-bg/70 px-2.5 text-[13px] text-fg outline-none placeholder:text-faint"
          />
          <ul className="mt-1 max-h-[38dvh] overflow-y-auto">
            {places.map((loc) => {
              const active = loc.id === activeId;
              return (
                <li key={loc.id}>
                  <button
                    type="button"
                    onClick={() => onPick(loc)}
                    className={`flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                      active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
                    }`}
                  >
                    <span className="truncate">{loc.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-faint">{loc.region}</span>
                  </button>
                </li>
              );
            })}
            {places.length === 0 ? (
              <li className="px-2 py-3 text-[12px] text-faint">No matches.</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
