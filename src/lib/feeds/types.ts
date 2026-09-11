export type FirePoint = {
  lat: number;
  lon: number;
  frp: number;
  brightness: number;
  date: string;
};

export type AircraftPoint = {
  icao: string;
  callsign: string;
  country: string;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  velocity: number;
};

export type SatelliteTle = {
  id: number;
  name: string;
  kind: "station" | "science" | "earth" | "weather";
  line1: string;
  line2: string;
};

export type SatelliteSnapshot = {
  id: number;
  name: string;
  lat: number;
  lon: number;
  alt: number;
};

export type FeedMeta = {
  source: string;
  at: number;
  count: number;
  status: "ok" | "degraded" | "offline";
  message?: string;
};

export type FiresPayload = { meta: FeedMeta; points: FirePoint[] };
export type AircraftPayload = { meta: FeedMeta; points: AircraftPoint[] };
export type SatellitesPayload = {
  meta: FeedMeta;
  tles: SatelliteTle[];
  overhead: SatelliteSnapshot[];
};
