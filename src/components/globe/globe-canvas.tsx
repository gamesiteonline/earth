import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ACESFilmicToneMapping, Color } from "three";
import { Earth } from "@/components/globe/earth";
import { Starfield } from "@/components/globe/stars";
import { CameraRig } from "@/components/globe/camera-rig";
import {
  AircraftLayer,
  FireLayer,
  PlaceMarkers,
  SatelliteLayer,
} from "@/components/globe/markers";
import { useGlobeStore } from "@/lib/globe-store";
import { useAircraft, useFires, useSatellites } from "@/lib/use-live-feeds";

function Lights() {
  return (
    <>
      <ambientLight intensity={0.18} color="#9aa6bb" />
      <hemisphereLight args={["#8aa4c4", "#07080c", 0.38]} />
      <directionalLight position={[6, 2.2, 3]} intensity={1.35} color="#fff4e8" />
      <directionalLight position={[-4, -1.4, -3]} intensity={0.18} color="#6e88aa" />
    </>
  );
}

function LiveLayers() {
  const fires = useFires();
  const aircraft = useAircraft();
  const sats = useSatellites();
  return (
    <>
      <FireLayer points={fires.data?.points ?? []} />
      <AircraftLayer points={aircraft.data?.points ?? []} />
      <SatelliteLayer tles={sats.data?.tles ?? []} />
    </>
  );
}

export function GlobeCanvas() {
  const clearSelection = useGlobeStore((s) => s.clearSelection);

  return (
    <Canvas
      className="h-full w-full touch-none"
      camera={{ position: [0.35, 0.55, 2.55], fov: 42, near: 0.1, far: 160 }}
      dpr={[1, 1.6]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.08,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(new Color("#05060a"));
      }}
      onPointerMissed={() => clearSelection()}
    >
      <Suspense fallback={null}>
        <Lights />
        <Earth />
        <PlaceMarkers />
        <LiveLayers />
        <Starfield />
        <CameraRig />
      </Suspense>
    </Canvas>
  );
}
