import { useMemo } from "react";
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Points } from "three";

export function Starfield({ count = 2800 }: { count?: number }) {
  const geom = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new Color();
    for (let i = 0; i < count; i++) {
      const r = 28 + Math.random() * 70;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      const t = Math.random();
      if (t > 0.86) c.set("#c9dcff");
      else if (t > 0.6) c.set("#f2f4f8");
      else c.set("#9aa3b5");
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(col, 3));
    return g;
  }, [count]);

  return (
    <points geometry={geom} frustumCulled={false}>
      <pointsMaterial
        vertexColors
        size={0.09}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

void Points;
