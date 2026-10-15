/**
 * The miner. One pixel figure used everywhere: the ten on the ledges, the portrait on a player
 * card, the mark. Every wallet gets one generated from its address; holders can pick their own skin.
 * Part counts must match MUGSHOT_PARTS in bot/byline.ts (the slot keys are kept for the engine).
 */
import { type CSSProperties } from "react";
import { runs, stamp, type Palette } from "../lib/pixels";
import { ARMOR } from "../lib/armor";

export const PARTS = { fur: 5, hat: 5, acc: 6, bg: 6 } as const;
export type Traits = [fur: number, hat: number, acc: number, bg: number];

/** fur = skin tone, hat = headgear, acc = goggles, mask and pickaxe, bg = the backdrop on the card. */
export const PART_NAMES = {
  fur: ["Pale", "Sand", "Tan", "Umber", "Deep"],
  hat: ["Bare head", "Hard hat", "Bandana", "Leaf crown", "Bucket"],
  acc: ["Nothing", "Goggles", "Dust mask", "Pickaxe", "Goggles + pickaxe", "Mask + pickaxe"],
  bg: ["Grass", "Sky", "Cave", "Lava", "Night", "Sand"],
};

const SKIN = ["#f1c9a5", "#d9a066", "#b5784a", "#8a5634", "#5e3a23"];
const SKIN_DARK = ["#d9a77f", "#bf8650", "#9a6238", "#704426", "#4a2c1a"];
const HAIR = ["#5b3a1e", "#2b1d12", "#1b1410", "#3a2414", "#121010"];

const BASE: Palette = {
  k: "#16161a",
  w: "#ffffff",
  m: "#6b2f22",
  o: "#3b5b8c",
  O: "#2a4268",
  t: "#b8532c",
  T: "#8f3d1e",
  b: "#3a2a1c",
  y: "#f2c230",
  Y: "#c4931a",
  l: "#fff7c2",
  r: "#c8342b",
  R: "#8f2019",
  g: "#5fa041",
  G: "#3d7a2a",
  c: "#a7a7b0",
  C: "#6d6d76",
  q: "#4fe0d4",
  Q: "#24242b",
  f: "#ddd6c4",
  F: "#b3ab96",
  p: "#7a5230",
  i: "#c9c9d2",
  I: "#7d7d88",
};

/** The colours for one miner; `armor` (0-4) sets v and V, the armor's main and dark shade. */
export const minerPalette = (t: Traits, armor = 0): Palette => ({
  ...BASE,
  s: SKIN[t[0]] ?? SKIN[0],
  S: SKIN_DARK[t[0]] ?? SKIN_DARK[0],
  h: HAIR[t[0]] ?? HAIR[0],
  v: ARMOR[armor]?.main || BASE.o,
  V: ARMOR[armor]?.dark || BASE.O,
});

const hasGoggles = (acc: number) => acc === 1 || acc === 4;
const hasMask = (acc: number) => acc === 2 || acc === 5;
export const hasPick = (acc: number) => acc >= 3;

/** The head, 8 wide and 10 tall: two rows above it for whatever is worn on top. */
export function headRows(t: Traits, startled = false) {
  const [, hat, acc] = t;
  let g = [
    "........",
    "........",
    "hhhhhhhh",
    "hhhhhhhh",
    "hssssssh",
    startled ? "swwsswws" : "ssssssss",
    startled ? "swksskws" : "swksskws",
    "sssSSsss",
    startled ? "sssmmsss" : "ssmmmmss",
    startled ? "sssmmsss" : "ssssssss",
  ];
  if (hasGoggles(acc)) g = stamp(g, ["QqqQQqqQ"], 0, 6);
  if (hasMask(acc)) g = stamp(g, ["ffffffff", "fFffffFf", "ffffffff"], 0, 7);
  if (hat === 1) g = stamp(g, ["..yyyy..", ".yyyyyy.", "yyyllyyy", "YYYYYYYY"], 0, 0);
  else if (hat === 2) g = stamp(g, ["........", "........", "rrrrrrrr", "rRrrrrRr", ".......r"], 0, 0);
  else if (hat === 3) g = stamp(g, ["........", "g.G..g.G", "gGgGgGgG"], 0, 0);
  else if (hat === 4) g = stamp(g, [".cccccc.", "cccccccc", "cCcccccc", "CCCCCCCC"], 0, 0);
  return g;
}

const BODY = [
  "tttottttottt...",
  "tttottttottt...",
  "tttoooooottt...",
  "tttoooooottt...",
  "ssOooooooOss...",
  "..OooooooO.....",
  "..ooo..ooo.....",
  "..ooo..ooo.....",
  "..ooo..ooo.....",
  "..bbb..bbb.....",
  "..bbb..bbb.....",
];

const PICK = ["iiiiii", "I..p.I", "...p..", "...p..", "...p..", "...p..", "...p.."];

/**
 * Armor goes on piece by piece as a wallet holds longer: a chestplate first (leather), then boots
 * (iron), then leggings (gold); diamond adds a glint. Drawn over the overalls in colours v and V.
 */
function armorOn(g: string[], armor: number) {
  if (armor >= 1) g = stamp(g, ["vvvvvvvvvvvv", armor >= 4 ? "VvwvVvvVvwvV" : "VvvvVvvVvvvV", "...vvvvvv...", "...VvvvvV..."], 0, 10);
  if (armor >= 3) g = stamp(g, ["..VvvvvvvV..", "..vvv..vvv..", "..vvv..vvv..", "..VVV..VVV.."], 0, 15);
  if (armor >= 2) g = stamp(g, ["..vvv..vvv..", "..VVV..VVV.."], 0, 19);
  return g;
}

/** The whole miner standing: 15 wide (room for a pickaxe) by 21 tall. */
export function minerRows(t: Traits, startled = false, armor = 0) {
  let g = Array.from({ length: 21 }, () => "...............");
  g = stamp(g, headRows(t, startled), 2, 0);
  g = stamp(g, BODY, 0, 10);
  g = armorOn(g, armor);
  if (hasPick(t[2])) g = stamp(stamp(g, PICK, 8, 7), ["ss"], 10, 14);
  return g;
}

function Pixels({ rows, palette }: { rows: string[]; palette: Palette }) {
  return (
    <>
      {runs(rows, palette).map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w} height={1} fill={p.fill} />
      ))}
    </>
  );
}

function fnv(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The skin a wallet gets until its owner picks one. */
export function traitsFor(addr: string): Traits {
  const h = fnv(addr.toLowerCase() + ":mugshot");
  return [h % PARTS.fur, Math.floor(h / 7) % PARTS.hat, Math.floor(h / 53) % PARTS.acc, Math.floor(h / 419) % PARTS.bg];
}

export function validTraits(t: unknown): t is Traits {
  const max = [PARTS.fur, PARTS.hat, PARTS.acc, PARTS.bg];
  return Array.isArray(t) && t.length === 4 && t.every((v, i) => Number.isInteger(v) && v >= 0 && v < max[i]);
}

/** A wallet's miner: the skin it picked, else the one its address generates. */
export function minerOf(addr: string, pp?: number[] | null): Traits {
  return validTraits(pp) ? pp : traitsFor(addr);
}

/** A miner standing on a block, in the armor it has earned. `startled` is the face of a wallet that just sold. */
export function Miner({ traits, startled = false, armor = 0, className = "" }: { traits: Traits; startled?: boolean; armor?: number; className?: string }) {
  return (
    <svg className={`miner ${className}`} viewBox="0 0 15 21" shapeRendering="crispEdges" aria-hidden="true">
      <Pixels rows={minerRows(traits, startled, armor)} palette={minerPalette(traits, armor)} />
    </svg>
  );
}

/** What is behind a portrait, 16 by 16. */
function backdrop(b: number): { rows: string[]; palette: Palette } {
  const fill = (k: string) => Array.from({ length: 16 }, () => k.repeat(16));
  if (b === 0) return { rows: stamp(fill("a"), ["b...b.....b...b.", "....b..b........"], 0, 13), palette: { a: "#7ec850", b: "#5fa041" } };
  if (b === 1) return { rows: stamp(fill("a"), ["..bbbb......", ".bbbbbbb...."], 1, 2), palette: { a: "#9ccfee", b: "#ffffff" } };
  if (b === 2) return { rows: stamp(stamp(fill("a"), ["b.", "bb"], 1, 3), ["bb", ".b"], 13, 9), palette: { a: "#3a3a44", b: "#4fe0d4" } };
  if (b === 3) return { rows: stamp(fill("a"), ["b......b.....b..", "..b.......b....."], 0, 1), palette: { a: "#c8401a", b: "#ffd23a" } };
  if (b === 4) return { rows: stamp(stamp(fill("a"), ["b.......b.....b."], 0, 2), ["..b.........b..."], 0, 6), palette: { a: "#1b2340", b: "#fff7c2" } };
  return { rows: stamp(fill("a"), ["b.....b......b..", "....b.....b....."], 0, 4), palette: { a: "#e3d39a", b: "#cbb877" } };
}

/** The plate on a card: head and shoulders, whatever backdrop the holder chose. */
export function Portrait({
  traits,
  size = 40,
  armor = 0,
  className = "",
  title,
  style,
}: {
  traits: Traits;
  size?: number;
  armor?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}) {
  const bd = backdrop(traits[3]);
  let fig = Array.from({ length: 16 }, () => "................");
  fig = stamp(fig, headRows(traits), 4, 3);
  fig = stamp(fig, armor ? ["..vvvvvvvvvvvv..", "vvVvvvvvvvvvvVvv", "vvvvvvvvvvvvvvvv"] : ["..tttoooootttt..", "tttttoooooottttt", "tttttoooooottttt"], 0, 13);
  if (hasPick(traits[2])) fig = stamp(fig, ["iiii", "I.pI", "..p.", "..p.", "..p.", "..p."], 12, 4);
  return (
    <svg
      className={`portrait ${className}`}
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={style}
    >
      <Pixels rows={bd.rows} palette={bd.palette} />
      <Pixels rows={fig} palette={minerPalette(traits, armor)} />
    </svg>
  );
}

/** The golem: the dev wallet. Guards the mine, never digs, never paid. 12 by 15. */
export function Golem({ className = "" }: { className?: string }) {
  const rows = [
    "..gggGggg...",
    "..aaaaaaaa..",
    "..aeeaaeea..",
    "..aaaAAaaa..",
    "..aAaaaaAa..",
    "..aaaaaaaa..",
    "aaaaaaaaaaaa",
    "aAaaaaaaaaAa",
    "aagaaaaaAaaa",
    "aaggaaaaaaaa",
    "Aaaaaaaaaaaa",
    "aa.aaaaaa.aa",
    "...aaa.aaa..",
    "...aaa.aaa..",
    "...AAA.AAA..",
  ];
  return (
    <svg className={`golem ${className}`} viewBox="0 0 12 15" shapeRendering="crispEdges" aria-hidden="true">
      <Pixels rows={rows} palette={{ a: "#8a8a92", A: "#5f5f68", g: "#5fa041", G: "#3d7a2a", e: "#ffb020" }} />
    </svg>
  );
}

/** The mark: a miner in a hard hat, framed in gold. */
export function Mark({ size = 34, className = "" }: { size?: number; className?: string }) {
  let g = Array.from({ length: 16 }, (_, y) => (y === 0 || y === 15 ? "YYYYYYYYYYYYYYYY" : "Y" + "k".repeat(14) + "Y"));
  g = stamp(g, headRows([1, 1, 0, 0]), 4, 3);
  g = stamp(g, ["ttoooott"], 4, 13);
  return (
    <svg className={`mark ${className}`} viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true">
      <Pixels rows={g} palette={{ ...minerPalette([1, 1, 0, 0]), k: "#24242b" }} />
    </svg>
  );
}

/** A small pickaxe, for the depth gauge. 9 by 9. */
export function Pick({ className = "" }: { className?: string }) {
  const rows = ["..iiiii..", ".i.....i.", "i...p...i", "....p....", "....p....", "....p....", "....p....", "....p....", "....p...."];
  return (
    <svg className={className} viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true">
      <Pixels rows={rows} palette={BASE} />
    </svg>
  );
}

/** A chestplate in the colours of an armor tier, for lists and cards. 10 by 9. */
export function ArmorIcon({ tier, size = 18, className = "" }: { tier: number; size?: number; className?: string }) {
  if (!tier) return null;
  const rows = ["vvv....vvv", "vVvvvvvvVv", "vvvvvvvvvv", ".vvvvvvvv.", tier >= 4 ? ".vvwvvvvv." : ".vvvvvvvv.", ".vvvvvvvv.", ".VvvvvvvV.", ".vvvvvvvv.", ".VVVVVVVV."];
  return (
    <svg className={`armor ${className}`} viewBox="-1 -1 12 11" width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={`${ARMOR[tier].name} armor`}>
      <title>{`${ARMOR[tier].name} armor`}</title>
      <Pixels rows={rows} palette={{ v: ARMOR[tier].main, V: ARMOR[tier].dark, w: "#ffffff" }} />
    </svg>
  );
}
