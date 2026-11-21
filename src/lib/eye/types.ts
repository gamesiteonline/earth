export type EyeMode = "satellite" | "hybrid" | "terrain" | "standard";
export type EyeQuality = "auto" | "high" | "saver";

export type OverlayKind =
  | "camera"
  | "device"
  | "vehicle"
  | "drone"
  | "incident"
  | "geofence"
  | "history"
  | "fire"
  | "aircraft"
  | "satellite"
  | "place";

export type TrackPoint = { lon: number; lat: number; alt: number; t?: string };

export type IntelFeature = {
  id: string;
  kind: OverlayKind;
  name: string;
  lat: number;
  lon: number;
  alt?: number;
  heading?: number;
  detail: string;
  region: string;
  when?: string;
  ring?: Array<[number, number]>;
  track?: TrackPoint[];
};

export type GeoHit = {
  name: string;
  lat: number;
  lon: number;
  kind: string;
};

export type GeoConfig = {
  ion: boolean;
  ionToken?: string;
  google3d: boolean;
  googleKey?: string;
  mapillary: boolean;
  mapillaryToken?: string;
  fallback: {
    imagery: string;
    terrain: string;
    buildings: string;
    labels: string;
    search: string;
  };
};
