import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  Color,
  FrontSide,
  ShaderMaterial,
  Vector3,
  SRGBColorSpace,
  RepeatWrapping,
} from "three";
import { sunDirection } from "@/lib/geo";
import { useGlobeStore } from "@/lib/globe-store";

const sun = new Vector3(1, 0, 0);

const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const EARTH_FRAG = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D bumpMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 l = normalize(sunDirection);
    float ndl = dot(n, l);
    float dayAmt = smoothstep(-0.05, 0.22, ndl);
    float twilight = 1.0 - smoothstep(0.0, 0.38, abs(ndl - 0.04));
    vec3 dayCol = texture2D(dayMap, vUv).rgb;
    vec3 nightCol = texture2D(nightMap, vUv).rgb;
    float h = texture2D(bumpMap, vUv).r;
    dayCol *= 0.86 + h * 0.22;
    vec3 nightGlow = nightCol * nightCol * 1.85 + nightCol * 0.25;
    vec3 color = mix(nightGlow, dayCol, dayAmt);
    color += vec3(0.42, 0.18, 0.07) * twilight * 0.28;
    float fres = pow(1.0 - max(dot(n, normalize(vViewW)), 0.0), 2.4);
    color += vec3(0.28, 0.48, 0.78) * fres * 0.22;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const ATM_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewW = cameraPosition - world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const ATM_FRAG = /* glsl */ `
  uniform vec3 glowColor;
  uniform float power;
  uniform float intensity;
  varying vec3 vNormalW;
  varying vec3 vViewW;
  void main() {
    float f = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewW))), power);
    gl_FragColor = vec4(glowColor * f * intensity, f * 0.85);
    #include <colorspace_fragment>
  }
`;

export function Earth() {
  const earthMat = useRef<ShaderMaterial>(null);
  const clearSelection = useGlobeStore((s) => s.clearSelection);
  const [dayMap, nightMap, bumpMap, cloudMap] = useTexture([
    "/textures/earth-day.jpg",
    "/textures/earth-night.jpg",
    "/textures/earth-bump.jpg",
    "/textures/earth-clouds.png",
  ]);

  dayMap.colorSpace = SRGBColorSpace;
  nightMap.colorSpace = SRGBColorSpace;
  cloudMap.colorSpace = SRGBColorSpace;
  cloudMap.wrapS = cloudMap.wrapT = RepeatWrapping;
  dayMap.anisotropy = 8;
  nightMap.anisotropy = 8;

  const uniforms = useMemo(
    () => ({
      dayMap: { value: dayMap },
      nightMap: { value: nightMap },
      bumpMap: { value: bumpMap },
      sunDirection: { value: sunDirection(new Date(), sun) },
    }),
    [dayMap, nightMap, bumpMap],
  );

  useFrame(({ clock }) => {
    const mat = earthMat.current;
    if (mat) mat.uniforms.sunDirection.value = sunDirection(new Date(), sun);
    const clouds = clock.elapsedTime * 0.004;
    if (cloudMap) cloudMap.offset.x = clouds;
  });

  return (
    <group>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          clearSelection();
        }}
      >
        <sphereGeometry args={[1, 96, 64]} />
        <shaderMaterial
          ref={earthMat}
          vertexShader={EARTH_VERT}
          fragmentShader={EARTH_FRAG}
          uniforms={uniforms}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.008, 64, 48]} />
        <meshBasicMaterial
          map={cloudMap}
          transparent
          opacity={0.38}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.045, 64, 48]} />
        <shaderMaterial
          vertexShader={ATM_VERT}
          fragmentShader={ATM_FRAG}
          uniforms={{
            glowColor: { value: new Color("#7ea8d4") },
            power: { value: 4.2 },
            intensity: { value: 1.05 },
          }}
          side={BackSide}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[1.018, 64, 48]} />
        <shaderMaterial
          vertexShader={ATM_VERT}
          fragmentShader={ATM_FRAG}
          uniforms={{
            glowColor: { value: new Color("#9ec4e6") },
            power: { value: 3.4 },
            intensity: { value: 0.42 },
          }}
          side={FrontSide}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
