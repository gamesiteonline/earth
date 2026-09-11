import { create } from "zustand";
import type { FeaturedLocation } from "@/lib/locations";

export type LayerId = "places" | "fires" | "aircraft" | "satellites";

export type Selection =
  | { type: "place"; id: string; name: string; lat: number; lon: number; detail: string; region: string }
  | { type: "fire"; id: string; name: string; lat: number; lon: number; detail: string }
  | { type: "aircraft"; id: string; name: string; lat: number; lon: number; detail: string }
  | { type: "satellite"; id: string; name: string; lat: number; lon: number; detail: string };

type GlobeState = {
  layers: Record<LayerId, boolean>;
  autoRotate: boolean;
  interacting: boolean;
  focusing: boolean;
  listOpen: boolean;
  search: string;
  selection: Selection | null;
  focus: { lat: number; lon: number; nonce: number } | null;
  look: { lat: number; lon: number };
  toggleLayer: (id: LayerId) => void;
  setAutoRotate: (v: boolean) => void;
  setInteracting: (v: boolean) => void;
  setFocusing: (v: boolean) => void;
  setListOpen: (v: boolean) => void;
  setSearch: (v: string) => void;
  setLook: (lat: number, lon: number) => void;
  selectPlace: (loc: FeaturedLocation) => void;
  selectMarker: (sel: Selection, fly?: boolean) => void;
  clearSelection: () => void;
};

let lookRaf = 0;

export const useGlobeStore = create<GlobeState>((set) => ({
  layers: { places: true, fires: true, aircraft: true, satellites: true },
  autoRotate: true,
  interacting: false,
  focusing: false,
  listOpen: false,
  search: "",
  selection: null,
  focus: null,
  look: { lat: 18, lon: 12 },
  toggleLayer: (id) =>
    set((s) => ({ layers: { ...s.layers, [id]: !s.layers[id] } })),
  setAutoRotate: (v) => set({ autoRotate: v }),
  setInteracting: (v) => set({ interacting: v }),
  setFocusing: (v) => set({ focusing: v }),
  setListOpen: (v) => set({ listOpen: v }),
  setSearch: (v) => set({ search: v }),
  setLook: (lat, lon) => {
    if (lookRaf) return;
    lookRaf = requestAnimationFrame(() => {
      lookRaf = 0;
      set({ look: { lat, lon } });
    });
  },
  selectPlace: (loc) =>
    set((s) => ({
      selection: {
        type: "place",
        id: loc.id,
        name: loc.name,
        lat: loc.lat,
        lon: loc.lon,
        region: loc.region,
        detail: loc.blurb,
      },
      focus: { lat: loc.lat, lon: loc.lon, nonce: (s.focus?.nonce ?? 0) + 1 },
      listOpen: typeof window !== "undefined" && window.innerWidth >= 900,
    })),
  selectMarker: (sel, fly = true) =>
    set((s) => ({
      selection: sel,
      focus: fly
        ? { lat: sel.lat, lon: sel.lon, nonce: (s.focus?.nonce ?? 0) + 1 }
        : s.focus,
    })),
  clearSelection: () => set({ selection: null }),
}));
