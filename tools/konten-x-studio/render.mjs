/**
 * Renders six hook posts for Pixaxe into konten-x/: the world and a few words, no numbers.
 * Reads the site from the project's build, so run `npm run build` in the project root first.
 *
 *   node render.mjs                        all six
 *   node render.mjs launch --ca 0x…        the launch video with the contract address on its end card
 *   node render.mjs rain lava              only those
 */
import fs from "node:fs";
import path from "node:path";
import { OUT, browser, cleanFrames, cues, freeze, gif, mp4, open, ready, shoot, sizeMB, wait } from "./film.mjs";

const args = process.argv.slice(2);
const caAt = args.indexOf("--ca");
const CA = caAt >= 0 ? args[caAt + 1] : "";
const only = args.filter((a, i) => !a.startsWith("--") && !(caAt >= 0 && i === caAt + 1));
const want = (k) => !only.length || only.includes(k);

const LOGO = `<p class="logo">${"PIXAXE".split("").map((c) => `<i>${c}</i>`).join("")}</p>`;
const BRAND = `<span class="brand">$PIXAXE</span>`;
const reward = () => (page) => page.evaluate(() => window.dispatchEvent(new CustomEvent("pixaxe:reward", { detail: { eth: 0.02, n: 900 } })));
const sell = (rank) => (page) => page.evaluate((r) => window.__pixaxeFilm.sell(r), rank);
const boost = (rank, amount) => (page) => page.evaluate(([r, a]) => window.__pixaxeFilm.boost(r, a), [rank, amount]);
const folder = (name) => {
  const d = path.join(OUT, name);
  fs.mkdirSync(d, { recursive: true });
  return d;
};

/** Films a square clip and writes it as MP4 and GIF into konten-x/<dir>/<file>. */
async function clip(b, { key, dir, file, time, seconds, words, events, extra = BRAND, gifWidth = 600 }) {
  console.log(key);
  const { ctx, page } = await open(b, { width: 1080, height: 1080, query: `time=${time}` });
  await ready(page);
  await wait(page, 1500);
  await cues(page, words, extra);
  const frames = await shoot(page, key, { seconds, events });
  const d = folder(dir);
  const out = path.join(d, `${file}.mp4`);
  mp4(frames, out);
  gif(out, path.join(d, `${file}.gif`), { width: gifWidth, fps: 15 });
  console.log(`  ${file}.mp4 ${sizeMB(out)} MB · .gif ${sizeMB(path.join(d, `${file}.gif`))} MB`);
  await ctx.close();
}

const b = await browser();
try {
  /* 01 · the launch video: the island at night, the holders get paid, one sells into the lava, the end card with the CA */
  if (want("launch"))
    await clip(b, {
      key: "launch",
      dir: "01-launch",
      file: CA ? "pixaxe-launch" : "pixaxe-launch-soon",
      time: 16.5,
      seconds: 15,
      gifWidth: 540,
      events: [
        { at: 4.6, run: reward() },
        { at: 7.4, run: sell(4) },
      ],
      words: [
        { from: 0.3, to: 3.2, html: `${LOGO}<p class="s">a hardcore island</p>` },
        { from: 3.4, to: 6.6, html: `<p class="h" style="--h:80px">The biggest holders stand here.</p><p class="s">and get paid in ETH</p>` },
        { from: 6.8, to: 8.4, html: `<p class="h">Sell once?</p>` },
        { from: 8.4, to: 10.6, html: `<p class="h is-red">Lava.</p><p class="s is-red">no respawn</p>` },
        {
          from: 10.8,
          to: 99,
          cls: "card",
          html: `${LOGO}<p class="line">One life. Don't sell.</p><p class="meta">$PIXAXE · Robinhood Chain · Pons</p><p class="ca ${CA ? "" : "is-soon"}">${CA ? `CA ${CA}` : "CA soon"}</p>`,
        },
      ],
    });

  /* 02 · hold, and it rains */
  if (want("rain"))
    await clip(b, {
      key: "rain",
      dir: "02-it-rains-eth",
      file: "pixaxe-it-rains-eth",
      time: 11,
      seconds: 6,
      events: [{ at: 1.2, run: reward() }],
      words: [
        { from: 0.2, to: 2.2, html: `<p class="h" style="--h:120px">Hold.</p>` },
        { from: 2.2, to: 99, html: `<p class="h is-gold" style="--h:100px">It rains ETH.</p>` },
      ],
    });

  /* 03 · sell once */
  if (want("lava"))
    await clip(b, {
      key: "lava",
      dir: "03-no-respawn",
      file: "pixaxe-no-respawn",
      time: 17.2,
      seconds: 6.5,
      events: [{ at: 1.0, run: sell(7) }],
      words: [
        { from: 0.2, to: 2.2, html: `<p class="h" style="--h:110px">Sell once.</p>` },
        { from: 2.2, to: 4.2, html: `<p class="h is-red" style="--h:130px">Lava.</p>` },
        { from: 4.2, to: 99, html: `<p class="h" style="--h:110px">No respawn.</p>` },
      ],
    });

  /* 04 · the beacon: one of the lower ten buys in and climbs all the way up to it */
  if (want("beacon"))
    await clip(b, {
      key: "beacon",
      dir: "04-the-beacon",
      file: "pixaxe-the-beacon",
      time: 17.0,
      seconds: 8,
      events: [{ at: 3.0, run: boost(10, 2e7) }],
      words: [
        { from: 0.2, to: 3.0, html: `<p class="h" style="--h:82px">Only one holds the beacon.</p>` },
        { from: 3.2, to: 5.6, html: `<p class="h is-gold" style="--h:90px">Anyone can take it.</p>` },
        { from: 5.8, to: 99, html: `<p class="h" style="--h:82px">Hold the most.</p><p class="s">light the beacon</p>` },
      ],
    });

  /* 05 · the poster: the island at golden hour, the name and the line */
  if (want("poster")) {
    console.log("poster");
    const { ctx, page } = await open(b, { width: 1600, height: 900, query: "time=16.9" });
    // the island takes the right of the frame, the words the left
    await page.addStyleTag({ content: `.title__world { margin-left: 36% !important; } #film .fx-left { left: 6%; top: 50%; width: 40%; display: grid; gap: 22px; justify-items: start; text-align: left; } #film .fx-left .logo { justify-content: flex-start; font-size: 112px; }` });
    await ready(page);
    await wait(page, 2500);
    await cues(
      page,
      [{ from: 0, to: 99, cls: "fx-left", html: `${LOGO}<p class="h" style="--h:66px">One life.<br>Don't sell.</p><p class="s">a hardcore island</p>` }],
      BRAND,
    );
    await page.evaluate(() => {
      const el = document.querySelector("#film .fx-left");
      window.__filmStep(5);
      el.style.transform = "translateY(-50%)";
    });
    await page.screenshot({ path: path.join(folder("05-poster"), "pixaxe-poster.png") });
    await ctx.close();
  }

  /* the profile picture and the wordmark */
  if (want("logo")) {
    console.log("logo");
    const d = folder("00-brand");
    // the avatar: a miner in a hard hat with a pickaxe and diamond shoulders, on the sky. Centred for X's round crop.
    fs.writeFileSync(path.join(d, "pixaxe-avatar.svg"), avatarSvg());
    const ctx = await b.newContext({ viewport: { width: 1000, height: 1000 } });
    const page = await ctx.newPage();
    await page.setContent(`<body style="margin:0">${avatarSvg(1000)}</body>`);
    await page.screenshot({ path: path.join(d, "pixaxe-avatar.png") });
    await ctx.close();
    // the wordmark: the site's own block letters, on nothing
    const { ctx: c2, page: p2 } = await open(b, { width: 1400, height: 400, query: "time=12" });
    await p2.addStyleTag({ content: `html, body { background: transparent !important; } .game { display: none !important; } #film .wordmark { position: absolute; inset: 0; display: grid; place-items: center; } #film .wordmark .logo { font-size: 200px; }` });
    await p2.evaluate((logo) => (document.getElementById("film").innerHTML = `<div class="wordmark">${logo}</div>`), LOGO);
    await p2.locator("#film .logo").screenshot({ path: path.join(d, "pixaxe-wordmark.png"), omitBackground: true });
    await c2.close();
  }

  /* the X header, 1500 by 500: the island on the right, the words in the middle, clear of the avatar at the bottom left */
  if (want("banner")) {
    console.log("banner");
    const { ctx, page } = await open(b, { width: 1500, height: 500, query: "time=16.9" });
    await page.addStyleTag({ content: `.title__world { margin-left: 54% !important; } #film .fx-band { left: 21%; top: 50%; width: 36%; display: grid; gap: 14px; justify-items: start; text-align: left; } #film .fx-band .logo { justify-content: flex-start; font-size: 96px; }` });
    await ready(page);
    await wait(page, 2500);
    await cues(page, [{ from: 0, to: 99, cls: "fx-band", html: `${LOGO}<p class="h" style="--h:50px">One life. Don't sell.</p>` }]);
    await page.evaluate(() => {
      window.__filmStep(5);
      document.querySelector("#film .fx-band").style.transform = "translateY(-50%)";
    });
    await page.screenshot({ path: path.join(folder("00-brand"), "pixaxe-banner.png") });
    await ctx.close();
  }

  /* 06 · the graveyard: stones and epitaphs, nothing counted */
  if (want("grave")) {
    console.log("graveyard");
    const { ctx, page } = await open(b, { width: 1600, height: 900, still: true });
    await freeze(page);
    await page.evaluate(() => window.scrollTo(0, document.getElementById("grave").getBoundingClientRect().top + window.scrollY));
    await wait(page, 2500);
    await page.evaluate(() => window.__filmAnims(9000));
    await cues(page, [], BRAND);
    await page.screenshot({ path: path.join(folder("06-graveyard"), "pixaxe-graveyard.png") });
    await ctx.close();
  }
} finally {
  await b.close();
  cleanFrames();
}

/**
 * The avatar as an SVG: 16 by 16 pixels, drawn from the same parts as the miner on the site
 * (hard hat with its lamp, sand skin, a pickaxe over the shoulder, diamond armor on the shoulders).
 */
function avatarSvg(size = 512) {
  const pal = { a: "#9ccfee", b: "#ffffff", y: "#f2c230", Y: "#c4931a", l: "#fff7c2", h: "#2b1d12", s: "#d9a066", S: "#bf8650", w: "#ffffff", k: "#16161a", m: "#6b2f22", i: "#c9c9d2", I: "#7d7d88", p: "#7a5230", v: "#4fe0d4", V: "#2fb8ad" };
  const fill = Array.from({ length: 16 }, () => "a".repeat(16).split(""));
  const put = (rows, x, y) => rows.forEach((r, dy) => r.split("").forEach((c, dx) => c !== "." && fill[y + dy]?.[x + dx] !== undefined && (fill[y + dy][x + dx] = c)));
  put(["..bbbb......", ".bbbbbbb...."], 1, 1);
  put(["..yyyy..", ".yyyyyy.", "yyyllyyy", "YYYYYYYY", "hssssssh", "ssssssss", "swksskws", "sssSSsss", "ssmmmmss", "ssssssss"], 4, 3);
  put(["..vvvvvvvvvvvv..", "vvVvvvvvvvvvvVvv", "vvvvvvvvvvvvvvvv"], 0, 13);
  put(["iiii", "I.pI", "..p.", "..p.", "..p.", "..p."], 12, 4);
  let rects = "";
  fill.forEach((row, y) => {
    let x = 0;
    while (x < 16) {
      let w = 1;
      while (x + w < 16 && row[x + w] === row[x]) w++;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${pal[row[x]]}"/>`;
      x += w;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges">${rects}</svg>`;
}
