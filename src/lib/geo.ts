import { Vector3 } from "three";

export const EARTH_RADIUS_KM = 6371;

const DEG = Math.PI / 180;

/** Convert geographic lat/lon (degrees) onto a Y-up unit sphere matching SphereGeometry UVs. */
export function latLonToVec3(lat: number, lon: number, radius = 1, target = new Vector3()) {
  const phi = (90 - lat) * DEG;
  const theta = (lon + 180) * DEG;
  const s = Math.sin(phi);
  return target.set(-radius * s * Math.cos(theta), radius * Math.cos(phi), radius * s * Math.sin(theta));
}

export function vec3ToLatLon(x: number, y: number, z: number) {
  const r = Math.hypot(x, y, z) || 1;
  const lat = Math.asin(Math.max(-1, Math.min(1, y / r))) * (180 / Math.PI);
  let lon = Math.atan2(z, -x) * (180 / Math.PI) - 180;
  lon = ((((lon + 180) % 360) + 360) % 360) - 180;
  return { lat, lon };
}

export function wrapLon(lon: number) {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Approximate solar subpoint → unit direction in globe space. */
export function sunDirection(date = new Date(), target = new Vector3()) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = (date.getTime() - start) / 86400000;
  const decl = -23.44 * Math.cos(((360 / 365) * (day + 10)) * DEG);
  const utcHours =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const lon = -15 * (utcHours - 12);
  return latLonToVec3(decl, lon, 1, target);
}

/** Compress orbital altitude so LEO sits just above the surface and GEO stays in frame. */
export function altitudeToRadius(altKm: number) {
  const real = Math.max(0, altKm) / EARTH_RADIUS_KM;
  return 1.012 + 0.48 * (1 - Math.exp(-real / 0.42));
}

export function formatCoord(lat: number, lon: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}  ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

export function formatKm(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k km`;
  return `${Math.round(n)} km`;
}
