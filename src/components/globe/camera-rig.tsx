import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { latLonToVec3, vec3ToLatLon } from "@/lib/geo";
import { useGlobeStore } from "@/lib/globe-store";

const FOCUS_RADIUS = 2.12;
const _from = new Vector3();
const _to = new Vector3();
const _cur = new Vector3();

export function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const focus = useGlobeStore((s) => s.focus);
  const autoRotate = useGlobeStore((s) => s.autoRotate);
  const interacting = useGlobeStore((s) => s.interacting);
  const selection = useGlobeStore((s) => s.selection);
  const setInteracting = useGlobeStore((s) => s.setInteracting);
  const setFocusing = useGlobeStore((s) => s.setFocusing);
  const setLook = useGlobeStore((s) => s.setLook);

  const anim = useRef({ active: false, t: 0, duration: 1.15 });
  const idle = useRef(0);
  const idleLook = useRef(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (!focus) return;
    _from.copy(camera.position);
    latLonToVec3(focus.lat, focus.lon, FOCUS_RADIUS, _to);
    anim.current = { active: true, t: 0, duration: 1.15 };
    setFocusing(true);
    if (controls.current) controls.current.enabled = false;
  }, [focus, camera, setFocusing]);

  useFrame((_, dt) => {
    const d = Math.min(dt, 0.08);
    const c = controls.current;

    if (anim.current.active) {
      anim.current.t += d;
      const u = Math.min(1, anim.current.t / anim.current.duration);
      const e = 1 - Math.pow(1 - u, 3);
      _cur.lerpVectors(_from, _to, e);
      camera.position.copy(_cur);
      camera.lookAt(0, 0, 0);
      if (c) {
        c.target.set(0, 0, 0);
        c.update();
      }
      if (u >= 1) {
        anim.current.active = false;
        setFocusing(false);
        if (c) c.enabled = true;
      }
    }

    if (interacting) idle.current = 0;
    else idle.current += d;

    if (c) {
      c.autoRotate =
        autoRotate &&
        !interacting &&
        !selection &&
        !anim.current.active &&
        !reduced.current &&
        idle.current > 2.4;
    }

    const pos = camera.position;
    idleLook.current += d;
    if (idleLook.current > 0.16) {
      idleLook.current = 0;
      const ll = vec3ToLatLon(pos.x, pos.y, pos.z);
      setLook(ll.lat, ll.lon);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      minDistance={1.38}
      maxDistance={4.6}
      autoRotate={false}
      autoRotateSpeed={0.28}
      onStart={() => setInteracting(true)}
      onEnd={() => setInteracting(false)}
    />
  );
}
