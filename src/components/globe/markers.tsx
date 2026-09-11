import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedMesh,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
  type SatRec,
} from "satellite.js";
import { FEATURED_LOCATIONS, type FeaturedLocation } from "@/lib/locations";
import { altitudeToRadius, latLonToVec3 } from "@/lib/geo";
import { useGlobeStore } from "@/lib/globe-store";
import type { AircraftPoint, FirePoint, SatelliteTle } from "@/lib/feeds/types";

const _v = new Vector3();
const _o = new Object3D();
const _up = new Vector3(0, 1, 0);
const _q = new Quaternion();
const fireBase = new Color("#d9895f");
const fireHot = new Color("#f0c4a0");
const fireTmp = new Color();
const airColor = new Color("#7eb8a4");
const satColor = new Color("#d5dce8");

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (!g) return new CanvasTexture(c);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.22, "rgba(255,255,255,0.45)");
  grd.addColorStop(0.55, "rgba(255,255,255,0.08)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function PlaceMarker({ loc, glow }: { loc: FeaturedLocation; glow: CanvasTexture }) {
  const active = useGlobeStore((s) => s.selection?.id === loc.id);
  const selectPlace = useGlobeStore((s) => s.selectPlace);
  const pos = useMemo(() => {
    const p = latLonToVec3(loc.lat, loc.lon, 1.014);
    return [p.x, p.y, p.z] as [number, number, number];
  }, [loc.lat, loc.lon]);
  const look = useMemo(() => {
    const p = latLonToVec3(loc.lat, loc.lon, 1.4);
    return [p.x, p.y, p.z] as [number, number, number];
  }, [loc.lat, loc.lon]);

  return (
    <group>
      <mesh
        position={pos}
        onClick={(e) => {
          e.stopPropagation();
          selectPlace(loc);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[active ? 0.013 : 0.009, 16, 16]} />
        <meshBasicMaterial color={active ? "#f4f6fa" : "#8eb4c9"} toneMapped={false} />
      </mesh>
      <sprite position={pos} scale={active ? 0.09 : 0.055}>
        <spriteMaterial
          map={glow}
          color={active ? "#f4f6fa" : "#8eb4c9"}
          blending={AdditiveBlending}
          depthWrite={false}
          transparent
          opacity={active ? 0.95 : 0.7}
          toneMapped={false}
        />
      </sprite>
      {active ? (
        <mesh position={pos} lookAt={look}>
          <ringGeometry args={[0.018, 0.023, 32]} />
          <meshBasicMaterial
            color="#e8eaef"
            side={DoubleSide}
            transparent
            opacity={0.85}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

export function PlaceMarkers() {
  const visible = useGlobeStore((s) => s.layers.places);
  const glow = useMemo(() => glowTexture(), []);
  if (!visible) return null;
  return (
    <group>
      {FEATURED_LOCATIONS.map((loc) => (
        <PlaceMarker key={loc.id} loc={loc} glow={glow} />
      ))}
    </group>
  );
}

export function FireLayer({ points }: { points: FirePoint[] }) {
  const visible = useGlobeStore((s) => s.layers.fires);
  const mesh = useRef<InstancedMesh>(null);
  const selectMarker = useGlobeStore((s) => s.selectMarker);
  const count = points.length;

  useEffect(() => {
    const m = mesh.current;
    if (!m || !count) return;
    for (let i = 0; i < count; i++) {
      const p = points[i];
      if (!p) continue;
      const s = 0.007 + Math.min(p.frp, 140) / 3500;
      latLonToVec3(p.lat, p.lon, 1.006, _v);
      _o.position.copy(_v);
      _q.setFromUnitVectors(_up, _v.normalize());
      _o.quaternion.copy(_q);
      _o.scale.setScalar(s);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
      const t = Math.min(p.frp / 60, 1);
      fireTmp.lerpColors(fireBase, fireHot, t);
      m.setColorAt(i, fireTmp);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [points, count]);

  if (!visible || count === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, count]}
      onClick={(e) => {
        e.stopPropagation();
        const i = e.instanceId ?? -1;
        const p = points[i];
        if (!p) return;
        selectMarker({
          type: "fire",
          id: `fire-${i}`,
          name: "Thermal anomaly",
          lat: p.lat,
          lon: p.lon,
          detail: `VIIRS hotspot · FRP ${p.frp.toFixed(1)} MW${p.date ? ` · ${p.date}` : ""}`,
        });
      }}
    >
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#d9895f" toneMapped={false} transparent opacity={0.92} />
    </instancedMesh>
  );
}

export function AircraftLayer({ points }: { points: AircraftPoint[] }) {
  const visible = useGlobeStore((s) => s.layers.aircraft);
  const mesh = useRef<InstancedMesh>(null);
  const selectMarker = useGlobeStore((s) => s.selectMarker);
  const count = points.length;

  useEffect(() => {
    const m = mesh.current;
    if (!m || !count) return;
    for (let i = 0; i < count; i++) {
      const p = points[i];
      if (!p) continue;
      const r = altitudeToRadius((p.alt || 10000) / 1000);
      latLonToVec3(p.lat, p.lon, r, _v);
      _o.position.copy(_v);
      _q.setFromUnitVectors(_up, _v.normalize());
      _o.quaternion.copy(_q);
      _o.scale.set(0.006, 0.014, 0.006);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [points, count]);

  if (!visible || count === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, count]}
      onClick={(e) => {
        e.stopPropagation();
        const i = e.instanceId ?? -1;
        const p = points[i];
        if (!p) return;
        const alt = p.alt ? `${Math.round(p.alt)} m` : "alt unknown";
        const spd = p.velocity ? `${Math.round(p.velocity * 1.94384)} kt` : "";
        selectMarker({
          type: "aircraft",
          id: p.icao || `ac-${i}`,
          name: p.callsign || p.icao || "Aircraft",
          lat: p.lat,
          lon: p.lon,
          detail: [p.country, alt, spd].filter(Boolean).join(" · "),
        });
      }}
    >
      <coneGeometry args={[1, 1, 5]} />
      <meshBasicMaterial color={airColor} toneMapped={false} />
    </instancedMesh>
  );
}

type TrackedSat = {
  id: number;
  name: string;
  kind: SatelliteTle["kind"];
  rec: SatRec;
};

export function SatelliteLayer({ tles }: { tles: SatelliteTle[] }) {
  const visible = useGlobeStore((s) => s.layers.satellites);
  const mesh = useRef<InstancedMesh>(null);
  const selectMarker = useGlobeStore((s) => s.selectMarker);
  const tracked = useMemo<TrackedSat[]>(() => {
    const out: TrackedSat[] = [];
    for (const t of tles) {
      try {
        out.push({
          id: t.id,
          name: t.name,
          kind: t.kind,
          rec: twoline2satrec(t.line1, t.line2),
        });
      } catch {
        /* skip */
      }
    }
    return out;
  }, [tles]);

  const positions = useRef<Array<{ lat: number; lon: number; alt: number }>>([]);

  useFrame(() => {
    if (!visible || !mesh.current || tracked.length === 0) return;
    const now = new Date();
    const gmst = gstime(now);
    for (let i = 0; i < tracked.length; i++) {
      const sat = tracked[i];
      if (!sat) continue;
      const pv = propagate(sat.rec, now);
      const position = pv?.position;
      if (!position || typeof position === "boolean") continue;
      const gd = eciToGeodetic(position, gmst);
      const lat = degreesLat(gd.latitude);
      const lon = degreesLong(gd.longitude);
      const alt = gd.height;
      positions.current[i] = { lat, lon, alt };
      const r = altitudeToRadius(alt);
      latLonToVec3(lat, lon, r, _v);
      _o.position.copy(_v);
      _o.scale.setScalar(0.016);
      _o.quaternion.identity();
      _o.updateMatrix();
      mesh.current.setMatrixAt(i, _o.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  if (!visible || tracked.length === 0) return null;

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, tracked.length]}
      onClick={(e) => {
        e.stopPropagation();
        const i = e.instanceId ?? -1;
        const sat = tracked[i];
        const p = positions.current[i];
        if (!sat || !p) return;
        selectMarker({
          type: "satellite",
          id: String(sat.id),
          name: sat.name,
          lat: p.lat,
          lon: p.lon,
          detail: `${sat.kind} · NORAD ${sat.id} · ${Math.round(p.alt)} km`,
        });
      }}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshBasicMaterial color={satColor} toneMapped={false} />
    </instancedMesh>
  );
}
