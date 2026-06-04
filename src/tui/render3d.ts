/**
 * Shared software 3D renderer for the Ξ mark.
 * Used by both the startup intro animation and the persistent TUI header.
 *
 * Technique: donut.c-style rasterizer — vertex projection → triangle
 * rasterization → per-cell Z-buffer → Lambert + ambient lighting → ASCII
 * brightness ramp with depth-modulated amber true-color ANSI output.
 */

type Vec3 = [number, number, number];
type Tri = [Vec3, Vec3, Vec3];

// ASCII brightness ramp: dark → bright
export const RAMP = " .,-~:;=!*#$@";

// ---------------------------------------------------------------------------
// Mesh: the Ξ glyph as three extruded horizontal bars
// ---------------------------------------------------------------------------
export function buildMesh(): Tri[] {
  const bars: Array<[number, number, number, number]> = [
    [0,  1.15, 1.7, 0.28],  // top bar (wider)
    [0,  0.0,  1.2, 0.26],  // middle bar (shorter)
    [0, -1.15, 1.7, 0.28],  // bottom bar (wider)
  ];
  const depth = 0.42;
  const tris: Tri[] = [];
  for (const [cx, cy, hw, hh] of bars) {
    const x0 = cx - hw, x1 = cx + hw;
    const y0 = cy - hh, y1 = cy + hh;
    const z0 = -depth,  z1 = depth;
    const v: Vec3[] = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const quads: Array<[number,number,number,number]> = [
      [4,5,6,7], [1,0,3,2], [0,4,7,3], [5,1,2,6], [3,7,6,2], [0,1,5,4],
    ];
    for (const [a,b,c,d] of quads) {
      tris.push([v[a], v[b], v[c]]);
      tris.push([v[a], v[c], v[d]]);
    }
  }
  return tris;
}

const MESH = buildMesh();

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------
function sub(a: Vec3, b: Vec3): Vec3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function normalize(a: Vec3): Vec3 {
  const m = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0]/m, a[1]/m, a[2]/m];
}
export function rotY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c*v[0]+s*v[2], v[1], -s*v[0]+c*v[2]];
}
export function rotX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], c*v[1]-s*v[2], s*v[1]+c*v[2]];
}

const LIGHT = normalize([0.4, 0.7, 1]);

// ---------------------------------------------------------------------------
// Rasterizer
// ---------------------------------------------------------------------------
function edge(a: number[], b: number[], p: number[]): number {
  return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0]);
}

function rasterize(
  p: [number,number,number][],
  shade: number,
  lum: Float32Array,
  zbuf: Float32Array,
  gw: number, gh: number,
): void {
  const [a,b,c] = p;
  const minX = Math.max(0, Math.floor(Math.min(a[0],b[0],c[0])));
  const maxX = Math.min(gw-1, Math.ceil(Math.max(a[0],b[0],c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1],b[1],c[1])));
  const maxY = Math.min(gh-1, Math.ceil(Math.max(a[1],b[1],c[1])));
  const area = edge(a,b,c);
  if (Math.abs(area) < 1e-6) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = [x+0.5, y+0.5, 0];
      const w0 = edge(b,c,px)/area, w1 = edge(c,a,px)/area, w2 = edge(a,b,px)/area;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0*a[2] + w1*b[2] + w2*c[2];
      const i = y*gw+x;
      if (z > zbuf[i]) { zbuf[i] = z; lum[i] = shade; }
    }
  }
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render the Ξ mesh at rotation angles (ay, ax) into a gw×gh character grid.
 * Returns ANSI-colored strings, one per row.
 * `fade` ∈ [0,1] dims all colors (used for the dissolve in the intro).
 */
export function render3D(
  ay: number, ax: number,
  gw: number, gh: number,
  fade = 1,
): string[] {
  const ESC = "\x1b[";
  const R = `${ESC}0m`;
  const lum = new Float32Array(gw * gh).fill(-1);
  const zbuf = new Float32Array(gw * gh).fill(-Infinity);

  const scaleY = gh * 0.34;
  const scaleX = scaleY * 1.9;
  const cx = gw / 2, cy = gh / 2;
  const camZ = 6;

  for (const tri of MESH) {
    const p = tri.map((v) => rotX(rotY(v, ay), ax)) as Tri;
    const n = normalize(cross(sub(p[1], p[0]), sub(p[2], p[0])));
    if (n[2] <= 0) continue;
    const light = Math.max(0, n[0]*LIGHT[0] + n[1]*LIGHT[1] + n[2]*LIGHT[2]);
    const shade = 0.18 + 0.82 * light;
    const proj = p.map((v): [number,number,number] => {
      const persp = camZ / (camZ + v[2]);
      return [cx + v[0]*scaleX*persp, cy - v[1]*scaleY*persp, v[2]];
    });
    rasterize(proj, shade, lum, zbuf, gw, gh);
  }

  const lines: string[] = [];
  for (let y = 0; y < gh; y++) {
    let line = "";
    for (let x = 0; x < gw; x++) {
      const i = y*gw + x;
      const l = lum[i];
      if (l < 0) { line += " "; continue; }
      const ci = Math.min(RAMP.length-1, Math.max(0, Math.floor(l*(RAMP.length-1))));
      const ch = RAMP[ci];
      const z = zbuf[i];
      const t = Math.max(0, Math.min(1, (z+2)/4));
      const rC = Math.round((150+105*t) * fade);
      const gC = Math.round((90+90*t) * fade);
      const bC = Math.round(20*t * fade);
      line += `${ESC}38;2;${rC};${gC};${bC}m${ch}`;
    }
    lines.push(line + R);
  }
  return lines;
}
