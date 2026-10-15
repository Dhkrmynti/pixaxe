/**
 * Everything on the page is drawn in pixels: a picture is a grid of colours, one string per row,
 * one character per pixel, looked up in a palette. Runs of the same colour on a row become one
 * rect, so a 12 by 20 miner is a few dozen elements, not hundreds.
 */

export type Palette = Record<string, string>;

/** Turns rows of palette keys into merged rects. "." and " " are transparent. */
export function runs(rows: string[], pal: Palette) {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const k = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === k) w++;
      if (k !== "." && k !== " " && pal[k]) out.push({ x, y, w, fill: pal[k] });
      x += w;
    }
  });
  return out;
}

/** Writes `patch` over `base` at (x, y); "." in the patch leaves what is underneath. */
export function stamp(base: string[], patch: string[], x: number, y: number) {
  const rows = base.map((r) => r.split(""));
  patch.forEach((r, dy) =>
    r.split("").forEach((c, dx) => {
      if (c === "." || !rows[y + dy] || rows[y + dy][x + dx] === undefined) return;
      rows[y + dy][x + dx] = c;
    }),
  );
  return rows.map((r) => r.join(""));
}

/* ───────── block textures, 16 by 16, generated once and kept as CSS variables ───────── */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Tex = (x: number, y: number, r: () => number) => string;

/** Noise of a few shades, plus whatever a block draws on top. */
const speckle = (shades: string[]) => (_x: number, _y: number, r: () => number) => shades[Math.floor(r() * r() * shades.length * 1.6) % shades.length];

function ore(base: string[], ore: string[]): Tex {
  // Fixed clusters so every ore block reads as ore at a glance, not as noise.
  const spots = new Set(["3,3", "4,3", "3,4", "10,2", "11,2", "11,3", "6,8", "7,8", "7,9", "12,10", "13,10", "12,11", "2,12", "3,12", "3,13", "9,13", "10,13"]);
  const s = speckle(base);
  return (x, y, r) => (spots.has(`${x},${y}`) ? ore[(x + y) % ore.length] : s(x, y, r));
}

const TEX: Record<string, Tex> = {
  grass: (_x, y, r) => (y < 3 || (y < 5 && r() < 0.5 - (y - 3) * 0.2) ? ["#5fa041", "#6db34c", "#4f8c36"][Math.floor(r() * 3)] : ["#86593a", "#77502f", "#93643f", "#6b4529"][Math.floor(r() * 4)]),
  grasstop: speckle(["#5fa041", "#6db34c", "#4f8c36", "#5a9a3d"]),
  dirt: speckle(["#86593a", "#77502f", "#93643f", "#6b4529"]),
  stone: speckle(["#7d7d84", "#727279", "#88888f", "#696970"]),
  deep: speckle(["#3a3a44", "#33333c", "#41414b", "#2d2d35"]),
  bedrock: speckle(["#141417", "#2a2a30", "#0c0c0e", "#3a3a40"]),
  diamond: ore(["#7d7d84", "#727279", "#88888f", "#696970"], ["#4fe0d4", "#2fb8ad", "#a9f5ee"]),
  gold: ore(["#7d7d84", "#727279", "#88888f", "#696970"], ["#f2c230", "#d49a1a", "#fff09a"]),
  lava: (x, y, r) => ((x * 3 + y * 5) % 11 < 3 ? "#ffd23a" : ["#ff6a1a", "#f2501a", "#ff8a2a"][Math.floor(r() * 3)]),
  plank: (x, y, r) => (y % 4 === 3 ? "#6b4a2a" : x === (y < 4 ? 5 : y < 8 ? 12 : y < 12 ? 2 : 9) ? "#6b4a2a" : ["#a87c4a", "#9c7142", "#b08452"][Math.floor(r() * 3)]),
  beacon: (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? "#2fb8ad" : x > 3 && x < 12 && y > 3 && y < 12 ? (x > 5 && x < 10 && y > 5 && y < 10 ? "#ffffff" : "#a9f5ee") : "#4fe0d4"),
};

/** The 16 by 16 colours of one block, the same every time for the same block. */
function texels(name: string) {
  const r = rng(1000 + BLOCKS.indexOf(name) * 97);
  const draw = TEX[name];
  const out: string[][] = [];
  for (let y = 0; y < 16; y++) {
    const row: string[] = [];
    for (let x = 0; x < 16; x++) row.push(draw(x, y, r));
    out.push(row);
  }
  return out;
}

function texture(name: string) {
  const px = texels(name);
  const pal: Palette = {};
  const keys = "abcdefghijklmnopqrstuvwxyz0123456789";
  const rows = px.map((line) =>
    line
      .map((c) => {
        let k = Object.keys(pal).find((key) => pal[key] === c);
        if (!k) {
          k = keys[Object.keys(pal).length];
          pal[k] = c;
        }
        return k;
      })
      .join(""),
  );
  const rects = runs(rows, pal)
    .map((p) => `<rect x='${p.x}' y='${p.y}' width='${p.w}' height='1' fill='${p.fill}'/>`)
    .join("");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const BLOCKS = Object.keys(TEX);
export type Block = keyof typeof TEX;

/** Puts every texture on :root as --tex-<name>. Called once, before the first paint. */
export function installTextures() {
  const root = document.documentElement;
  BLOCKS.forEach((b) => root.style.setProperty(`--tex-${b}`, texture(b)));
}

/** A block's texture on a 16 by 16 canvas, for the 3D world. */
export function blockCanvas(name: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d")!;
  texels(name).forEach((line, y) =>
    line.forEach((col, x) => {
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}

/** Any palette grid on a canvas, one pixel per character; "." stays transparent. */
export function gridCanvas(rows: string[], pal: Palette) {
  const c = document.createElement("canvas");
  c.width = Math.max(...rows.map((r) => r.length));
  c.height = rows.length;
  const g = c.getContext("2d")!;
  runs(rows, pal).forEach((p) => {
    g.fillStyle = p.fill;
    g.fillRect(p.x, p.y, p.w, 1);
  });
  return c;
}
