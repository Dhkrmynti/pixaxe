/**
 * The share card: one 1200 by 630 picture of a wallet's miner, the size X shows best. Drawn on a
 * canvas in the browser from the same pixel grids as the page, so nothing is uploaded anywhere.
 */
import { blockCanvas, runs } from "./pixels";
import { ARMOR } from "./armor";
import { minerPalette, minerRows, type Traits } from "../world/Miner";
import { NAME, TICKER } from "./brand";

export interface CardData {
  traits: Traits;
  armor: number;
  name: string;
  rank: number | null;
  /** "Beacon", "On a ledge", "Spectator"… */
  word: string;
  held: string;
  holds: string;
  paid: string;
  gone: boolean;
  host: string;
}

const BACKDROP: [string, string][] = [
  ["#9ccfee", "#5fa041"],
  ["#9ccfee", "#c4e4f7"],
  ["#2b2b33", "#55555c"],
  ["#3a1a12", "#ff6a1a"],
  ["#1b2340", "#2b3560"],
  ["#f3e6b4", "#d9c58a"],
];

function bevel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, light: string, dark: string) {
  g.fillStyle = "#000";
  g.fillRect(x - 6, y - 6, w + 12, h + 12);
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
  g.fillStyle = light;
  g.fillRect(x, y, w, 6);
  g.fillRect(x, y, 6, h);
  g.fillStyle = dark;
  g.fillRect(x, y + h - 6, w, 6);
  g.fillRect(x + w - 6, y, 6, h);
}

export async function drawCard(d: CardData): Promise<Blob> {
  await Promise.all([document.fonts.load('700 64px "Pixelify Sans"'), document.fonts.load('400 40px "VT323"'), document.fonts.load('500 30px "Pixelify Sans"')]).catch(() => {});
  const W = 1200;
  const H = 630;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;

  // ground: dirt tiles under a dark wash, a strip of grass on top
  const dirt = blockCanvas("dirt");
  for (let x = 0; x < W; x += 96) for (let y = 0; y < H; y += 96) g.drawImage(dirt, x, y, 96, 96);
  g.fillStyle = "rgba(12, 9, 7, 0.72)";
  g.fillRect(0, 0, W, H);
  const grass = blockCanvas("grasstop");
  for (let x = 0; x < W; x += 24) g.drawImage(grass, x, 0, 24, 24);
  g.fillStyle = "#000";
  g.fillRect(0, 24, W, 6);

  // the doll: the miner on its backdrop
  const [sky, floor] = BACKDROP[d.traits[3]] ?? BACKDROP[0];
  const dx = 70;
  const dy = 80;
  const dw = 360;
  const dh = 480;
  bevel(g, dx, dy, dw, dh, sky, "rgba(255,255,255,0.25)", "rgba(0,0,0,0.3)");
  g.fillStyle = floor;
  g.fillRect(dx + 6, dy + dh - 96, dw - 12, 90);
  const px = 20;
  const rows = minerRows(d.traits, d.gone, d.gone ? 0 : d.armor);
  const mx = dx + (dw - 15 * px) / 2 + 30;
  const my = dy + dh - 96 - 21 * px + 20;
  if (d.gone) g.filter = "grayscale(1) brightness(0.75)";
  runs(rows, minerPalette(d.traits, d.gone ? 0 : d.armor)).forEach((p) => {
    g.fillStyle = p.fill;
    g.fillRect(mx + p.x * px, my + p.y * px, p.w * px, px);
  });
  g.filter = "none";

  // the window on the right
  const wx = 490;
  const wy = 80;
  const ww = 640;
  const wh = 480;
  bevel(g, wx, wy, ww, wh, "#c6c6c6", "#ffffff", "#555555");
  g.textBaseline = "top";
  g.fillStyle = "#3f3f3f";
  g.font = '400 34px "VT323", monospace';
  g.fillText(`${NAME} · ${TICKER}`, wx + 34, wy + 30);
  if (d.rank) {
    const r = `No. ${d.rank}`;
    g.font = '400 44px "VT323", monospace';
    g.fillText(r, wx + ww - 34 - g.measureText(r).width, wy + 24);
  }

  g.fillStyle = "#1f1f1f";
  g.font = '700 58px "Pixelify Sans", sans-serif';
  let name = d.name;
  while (g.measureText(name).width > ww - 68 && name.length > 4) name = name.slice(0, -2) + "…";
  g.fillText(name, wx + 34, wy + 78);
  if (d.gone) {
    g.fillRect(wx + 34, wy + 108, g.measureText(name).width, 6);
  }

  // the status, as an effect badge
  g.font = '400 36px "VT323", monospace';
  const bw = g.measureText(d.word).width + 64;
  g.fillStyle = "#000";
  g.fillRect(wx + 34, wy + 160, bw, 50);
  g.fillStyle = "#2a2a30";
  g.fillRect(wx + 38, wy + 164, bw - 8, 42);
  g.fillStyle = d.gone ? "#ff3b2e" : d.rank && d.rank <= 10 ? "#7fe14b" : "#f2c230";
  g.fillRect(wx + 50, wy + 176, 18, 18);
  g.fillStyle = "#fff";
  g.fillText(d.word, wx + 80, wy + 168);

  // four slots
  const stats: [string, string][] = [
    ["Held for", d.held],
    ["Armor", d.gone ? "lost" : ARMOR[d.armor].name],
    ["Holds", d.holds],
    ["Paid so far", d.paid],
  ];
  stats.forEach(([k, v], i) => {
    const sx = wx + 34 + (i % 2) * 292;
    const sy = wy + 236 + Math.floor(i / 2) * 102;
    g.fillStyle = "#8b8b8b";
    g.fillRect(sx, sy, 276, 88);
    g.fillStyle = "#373737";
    g.fillRect(sx, sy, 276, 5);
    g.fillRect(sx, sy, 5, 88);
    g.fillStyle = "#ffffff";
    g.fillRect(sx, sy + 83, 276, 5);
    g.fillRect(sx + 271, sy, 5, 88);
    g.fillStyle = "#ececec";
    g.font = '400 28px "VT323", monospace';
    g.fillText(k, sx + 18, sy + 12);
    g.font = '400 36px "VT323", monospace';
    g.fillStyle = "#3f3f3f";
    g.fillText(v, sx + 21, sy + 43);
    g.fillStyle = "#ffffff";
    g.fillText(v, sx + 18, sy + 40);
  });

  // the line and the address of the site, under the window
  g.textBaseline = "alphabetic";
  g.font = '700 34px "Pixelify Sans", sans-serif';
  g.fillStyle = "#fff";
  g.fillText("One life. Don't sell.", 70, H - 22);
  g.font = '400 34px "VT323", monospace';
  g.fillStyle = "#f2c230";
  const host = d.host;
  g.fillText(host, W - 70 - g.measureText(host).width, H - 24);

  return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("The card couldn't be drawn."))), "image/png"));
}
