/**
 * The camera: opens the site from the project's build (dist/) inside the browser, freezes its clock
 * and steps it one frame at a time, so WebGL, GSAP and CSS animations all land on exact frames.
 * Then ffmpeg turns the frames into an MP4 and a GIF. No server runs and nothing talks to a chain.
 * The film hides every number on screen: name tags, payouts, the HUD. Only the world and the words.
 */
import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const SITE = "http://pixaxe.local";
export const OUT = path.resolve(import.meta.dirname, "../../konten-x");
const DIST = path.resolve(import.meta.dirname, "../../dist");
const FRAMES = path.resolve(import.meta.dirname, ".frames");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".json": "application/json" };

export const browser = () => chromium.launch({ channel: "chrome", args: ["--force-color-profile=srgb"] });

/** A tab whose requests for the site are answered from dist/; the engine API is simply absent. */
export async function context(b, opts) {
  if (!fs.existsSync(path.join(DIST, "index.html"))) throw new Error("No build found. Run `npm run build` in the project root first.");
  const ctx = await b.newContext(opts);
  await ctx.route(`${SITE}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, contentType: "application/json", body: '{"success":false,"error":"Not Found"}' });
    let file = path.join(DIST, decodeURIComponent(url.pathname));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  return ctx;
}

/** The words on screen: said lines in Pixelify, small lines in VT323, as on the site. */
const FILM_CSS = `
#film { position: fixed; inset: 0; z-index: 1000; pointer-events: none; }
#film .cue { position: absolute; opacity: 0; }
#film .fx-top { left: 0; right: 0; top: 9%; display: grid; justify-items: center; gap: 16px; text-align: center; padding: 0 6%; }
#film .fx-mid { left: 0; right: 0; top: 34%; display: grid; justify-items: center; gap: 18px; text-align: center; padding: 0 6%; }
#film .h { font: 700 var(--h, 96px)/1 "Pixelify Sans", sans-serif; color: #fff; text-shadow: 6px 6px 0 #000; }
#film .h.is-gold { color: #f2c230; }
#film .h.is-red { color: #ff6b5e; }
#film .s { font: 400 var(--s, 46px)/1.15 "VT323", monospace; color: #f2c230; background: rgba(0,0,0,.72); padding: 6px 20px; border: 4px solid #000; }
#film .s.is-red { color: #ff6b5e; }
#film .brand { position: absolute; left: 24px; bottom: 20px; font: 400 32px/1 "VT323", monospace; color: #f2c230; background: rgba(0,0,0,.6); padding: 4px 12px; }
#film .card { inset: 0; display: grid; place-content: center; justify-items: center; gap: 28px; background: rgba(6, 9, 24, .86); text-align: center; }
#film .logo { justify-content: center; }
#film .card .logo { font-size: 156px; }
#film .card .line { font: 700 62px/1 "Pixelify Sans", sans-serif; color: #fff; text-shadow: 5px 5px 0 #000; }
#film .card .meta { font: 400 42px/1 "VT323", monospace; color: #d8d8e0; }
#film .card .ca { font: 400 42px/1 "VT323", monospace; color: #f2c230; border: 4px solid #f2c230; background: #000; padding: 12px 24px; max-width: 92vw; overflow-wrap: anywhere; }
#film .card .ca.is-soon { color: #7fe14b; border-color: #7fe14b; }
`;

/** The island fills the frame; menus, bars, chat, HUD and every label with a number are gone. */
const STAGE_CSS = `
.bar, .chat, .hud, .title__copy, .title__clock, .title__hint, .island__labels { display: none !important; }
.title { grid-template-columns: 1fr !important; padding-top: 0 !important; min-height: 100vh !important; }
.title__world { grid-column: 1 !important; grid-row: 1 !important; height: 100vh !important; min-height: 0 !important; margin: 0 !important; }
main, footer.end { display: none !important; }
html, body { overflow: hidden !important; }
`;
/** For a still of a section: the bars go, and so does every number on the graveyard stones. */
const STILL_CSS = `
.bar, .chat, .hud { display: none !important; }
.sec { padding-top: 64px !important; }
.yard__gate, .grave__lived, .grave__paid, .grave__foot, .grave__name, .yard__more { display: none !important; }
`;

/** Opens the site's illustration edition in film mode with a frozen clock. */
export async function open(b, { width, height, query = "", still = false }) {
  const ctx = await context(b, { viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("  page error:", String(e)));
  await page.clock.install({ time: new Date("2026-10-15T12:00:00+07:00") });
  await page.goto(`${SITE}/?demo&film${query ? "&" + query : ""}`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: FILM_CSS + (still ? STILL_CSS : STAGE_CSS) });
  await page.evaluate(() => {
    const film = document.createElement("div");
    film.id = "film";
    document.body.appendChild(film);
    // every CSS animation is held and set to the film's time, so it moves frame by frame like the rest
    window.__filmAnims = (ms) => {
      for (const a of document.getAnimations()) {
        if (a.__t0 === undefined) a.__t0 = ms;
        a.pause();
        a.currentTime = Math.max(0, ms - a.__t0);
      }
    };
    // words fade in and out over a third of a second, rising a little as they come
    window.__filmStep = (t) => {
      for (const el of film.querySelectorAll(".cue")) {
        const k = Math.max(0, Math.min(1, (t - +el.dataset.from) / 0.35, (+el.dataset.to - t) / 0.35));
        el.style.opacity = String(k);
        el.style.transform = el.classList.contains("card") ? "" : `translateY(${(1 - k) * 18}px)`;
      }
    };
  });
  return { ctx, page };
}

/** Puts the words on the stage: [{ from, to, html, cls }] in seconds, plus anything that stays. */
export async function cues(page, list, extra = "") {
  await page.evaluate(
    ([list, extra]) => {
      const film = document.getElementById("film");
      film.innerHTML = extra;
      for (const c of list) {
        const el = document.createElement("div");
        el.className = `cue ${c.cls || "fx-top"}`;
        el.dataset.from = c.from;
        el.dataset.to = c.to;
        el.innerHTML = c.html;
        film.appendChild(el);
      }
    },
    [list, extra],
  );
}

/** Stops the page's clock a moment from now (a busy page can take a while to answer). */
export async function freeze(page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1500);
}

/** Waits for the island and its ten miners, then stops the clock. */
export async function ready(page) {
  await page.waitForSelector(".island canvas", { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll(".ntag").length >= 10, null, { timeout: 30000 });
  await freeze(page);
}

/** Moves the frozen clock on by `ms` without filming. */
export async function wait(page, ms) {
  for (let t = 0; t < ms; t += 50) await page.clock.runFor(50);
}

/** Films `seconds` at `fps`, running `events` ([{ at, run }], seconds) on their frames. */
export async function shoot(page, name, { seconds, fps = 30, events = [] }) {
  const dir = path.join(FRAMES, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const todo = [...events].sort((a, b) => a.at - b.at);
  const total = Math.round(seconds * fps);
  for (let i = 0; i < total; i++) {
    const t = i / fps;
    while (todo.length && todo[0].at <= t) await todo.shift().run(page);
    await page.clock.runFor(Math.round(((i + 1) * 1000) / fps) - Math.round((i * 1000) / fps));
    await page.evaluate((t) => (window.__filmStep(t), window.__filmAnims(t * 1000)), t);
    fs.writeFileSync(path.join(dir, `${String(i).padStart(5, "0")}.jpg`), await page.screenshot({ type: "jpeg", quality: 92 }));
  }
  return dir;
}

function run(args) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

/** Frames to an MP4 that X takes as is: H.264, yuv420p, fast start. */
export function mp4(dir, file, fps = 30) {
  run(["-framerate", String(fps), "-i", path.join(dir, "%05d.jpg"), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", file]);
}

/** An MP4 to a looping GIF with its own palette, kept under X's 15 MB. */
export function gif(src, file, { width = 600, fps = 15 } = {}) {
  const pal = file.replace(/\.gif$/, ".palette.png");
  run(["-i", src, "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen=stats_mode=diff`, pal]);
  run(["-i", src, "-i", pal, "-lavfi", `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4`, "-loop", "0", file]);
  fs.rmSync(pal);
}

export const sizeMB = (f) => (fs.statSync(f).size / 1048576).toFixed(2);
export const cleanFrames = () => fs.rmSync(FRAMES, { recursive: true, force: true });
