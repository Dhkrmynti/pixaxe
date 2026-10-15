/**
 * The world: a floating island of blocks, drawn with three.js. The upper terrace (diamond ore in its
 * cliff) holds No. 1-5, No. 1 on the beacon; the lower terrace (gold ore) holds No. 6-10; at the front
 * is the lava. Every miner is built from the same pixel skin as its 2D portrait. A wallet that sells
 * walks off the edge into the lava. Drag to turn the island; click a miner to open its card.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import gsap from "gsap";
import { blockCanvas, gridCanvas, type Palette } from "../lib/pixels";
import { span } from "../lib/clock";
import { armorOf } from "../lib/armor";
import { splitInheritance } from "../lib/api";
import type { RewardDrop } from "../lib/feed";
import { prefersReducedMotion } from "../lib/motion";
import { hasPick, headRows, minerPalette, type Traits } from "../world/Miner";

export type Stand = { id: string; addr: string; name: string; traits: Traits; firstIn: number; bal: number };

/* ───────── the island, in block coordinates: x 0..11, z 0..12 ───────── */

const NX = 12;
const NZ = 13;
const CX = (NX - 1) / 2;
const CZ = (NZ - 1) / 2;

/** Height of the top block of each column. */
function top(x: number, z: number) {
  if (z <= 4) return 5;
  if (z <= 9) return 3;
  return x === 0 || x === NX - 1 || z === NZ - 1 ? 2 : 1;
}
/** The underside tapers to a point, a little ragged. */
function bottom(x: number, z: number) {
  const d = Math.max(Math.abs(x - CX) / (NX / 2), Math.abs(z - CZ) / (NZ / 2));
  return -1 - Math.floor(6 * (1 - d) ** 1.2) + ((x * 7 + z * 3) % 4 === 0 ? 1 : 0);
}
function kind(x: number, y: number, z: number) {
  const h = top(x, z);
  if (z >= 10) return y === h && h === 1 ? "lava" : "stone";
  if (y === h) return "grass";
  const edge = z === 4 ? "diamond" : z === 9 ? "gold" : "";
  if (edge && y >= h - 2) return edge;
  if (y >= h - 2) return "dirt";
  return (x + y * 3 + z * 5) % 7 === 0 ? "dirt" : "stone";
}

/** Where each rank stands, in block coordinates: [x, z, the height its feet are at]. */
const SPOTS: [number, number, number][] = [
  [2, 2, 7],
  [4, 2, 6],
  [6, 2, 6],
  [8, 2, 6],
  [10, 2, 6],
  [2, 7, 4],
  [4, 7, 4],
  [6, 7, 4],
  [8, 7, 4],
  [10, 7, 4],
];
const BEACON: [number, number, number] = [2, 6, 2];
const GOLEM: [number, number, number] = [11, 0, 6];
const at = (x: number, y: number, z: number) => new THREE.Vector3(x - CX, y, z - CZ);

/* ───────── textures and models ───────── */

function pixelTexture(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const lambert = (map: THREE.Texture) => new THREE.MeshLambertMaterial({ map });
const flat = (color: string) => new THREE.MeshLambertMaterial({ color });

/** Box face order in three.js: +x, -x, +y, -y, +z (front), -z (back). */
function headMaterials(t: Traits, pal: Palette, startled = false) {
  const rows = headRows(t, startled);
  const hat = rows[2][0] === "h" ? "h" : rows[2][0];
  const side = [hat.repeat(8), hat.repeat(8), "hhhhhsss", "hhhhssss", "hhhhssss", "hhhsssss", "hhssssss", "hsssssss"];
  const mirror = side.map((r) => r.split("").reverse().join(""));
  const tex = (g: string[]) => lambert(pixelTexture(gridCanvas(g, pal)));
  return [
    tex(mirror),
    tex(side),
    tex(Array(8).fill(hat.repeat(8))),
    tex(Array(8).fill("ssssssss")),
    tex(rows.slice(2)),
    tex([hat.repeat(8), hat.repeat(8), ...Array(6).fill("hhhhhhhh")]),
  ];
}

type Geo = Record<"head" | "body" | "limb" | "brim" | "crown" | "bucket" | "leaf" | "handle" | "pick", THREE.BoxGeometry>;
const makeGeo = (): Geo => ({
  head: new THREE.BoxGeometry(0.5, 0.5, 0.5),
  body: new THREE.BoxGeometry(0.5, 0.75, 0.25),
  limb: new THREE.BoxGeometry(0.25, 0.75, 0.25),
  brim: new THREE.BoxGeometry(0.62, 0.08, 0.62),
  crown: new THREE.BoxGeometry(0.48, 0.16, 0.48),
  bucket: new THREE.BoxGeometry(0.56, 0.32, 0.56),
  leaf: new THREE.BoxGeometry(0.14, 0.12, 0.14),
  handle: new THREE.BoxGeometry(0.07, 0.8, 0.07),
  pick: new THREE.BoxGeometry(0.5, 0.09, 0.09),
});

function buildMiner(t: Traits, geo: Geo, armor = 0) {
  const pal = minerPalette(t, armor);
  const root = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(0.82);
  root.add(rig);
  const part = (g: THREE.BoxGeometry, m: THREE.Material | THREE.Material[], x: number, y: number, z = 0) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    rig.add(mesh);
    return mesh;
  };
  const tex = (g: string[]) => lambert(pixelTexture(gridCanvas(g, pal)));
  // armor, earned by holding: chestplate (leather), boots (iron), leggings (gold), a glint (diamond)
  const leg = tex([...Array(9).fill(armor >= 3 ? "vvvv" : "oooo"), ...Array(3).fill(armor >= 2 ? "vvvv" : "bbbb")]);
  const arm = tex([...Array(armor >= 1 ? 4 : 0).fill("vvvv"), ...Array(armor >= 1 ? 5 : 9).fill("tttt"), ...Array(3).fill("ssss")]);
  const torso = tex(
    armor >= 1
      ? ["vvvvvvvv", armor >= 4 ? "VvwvvwvV" : "VvvVVvvV", "vvvvvvvv", "vvvvvvvv", "VvvvvvvV", "vvvvvvvv", "OOOOOOOO", "oooooooo"]
      : ["ttottott", "ttottott", "toooooot", "toooooot", "toooooot", "toooooot", "OOOOOOOO", "oooooooo"],
  );
  part(geo.limb, leg, -0.125, 0.375);
  part(geo.limb, leg, 0.125, 0.375);
  part(geo.body, [arm, arm, arm, leg, torso, torso], 0, 1.125);
  part(geo.limb, arm, -0.375, 1.125);
  const right = part(geo.limb, arm, 0.375, 1.125);
  const head = part(geo.head, headMaterials(t, pal), 0, 1.75);
  head.name = "head";
  const hat = t[1];
  if (hat === 1) {
    part(geo.brim, flat(pal.Y), 0, 2.02);
    part(geo.crown, flat(pal.y), 0, 2.12);
  } else if (hat === 3) {
    [-0.18, 0.18].forEach((x) => [-0.18, 0.18].forEach((z) => part(geo.leaf, flat(pal.g), x, 2.05, z)));
  } else if (hat === 4) {
    part(geo.bucket, flat(pal.c), 0, 2.12);
  }
  if (hasPick(t[2])) {
    const pick = new THREE.Group();
    pick.add(new THREE.Mesh(geo.handle, flat(pal.p)));
    const blade = new THREE.Mesh(geo.pick, flat(pal.i));
    blade.position.y = 0.38;
    pick.add(blade);
    pick.position.set(0.375, 0.8, 0.2);
    pick.rotation.x = -0.9;
    rig.add(pick);
    right.rotation.x = -0.5;
  }
  root.userData.rig = rig;
  return root;
}

function buildGolem() {
  const root = new THREE.Group();
  const stone = lambert(pixelTexture(blockCanvas("stone")));
  const moss = lambert(pixelTexture(blockCanvas("grasstop")));
  const pal = { a: "#8a8a92", A: "#5f5f68", e: "#ffb020" };
  const face = lambert(pixelTexture(gridCanvas(["aaaaaaaa", "aaaaaaaa", "aeeaaeea", "aeeaaeea", "aaaAAaaa", "aaaAAaaa", "aAaaaaAa", "aaaaaaaa"], pal)));
  const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, 0);
    root.add(mesh);
  };
  box(0.3, 0.5, 0.3, stone, -0.2, 0.25);
  box(0.3, 0.5, 0.3, stone, 0.2, 0.25);
  box(0.9, 0.75, 0.5, [stone, stone, moss, stone, stone, stone], 0, 0.88);
  box(0.25, 0.95, 0.3, stone, -0.58, 0.72);
  box(0.25, 0.95, 0.3, stone, 0.58, 0.72);
  box(0.5, 0.45, 0.45, [stone, stone, moss, stone, face, stone], 0, 1.48);
  return root;
}

function dispose(o: THREE.Object3D, keep: Set<THREE.BufferGeometry>) {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    if (!keep.has(m.geometry)) m.geometry.dispose();
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
      (mat as THREE.MeshLambertMaterial).map?.dispose();
      mat.dispose();
    });
  });
}

function nametag(onPick: (addr: string) => void) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "ntag";
  el.innerHTML = "<b></b><span></span><i class=\"ntag__held\"></i>";
  const obj = new CSS2DObject(el);
  obj.position.set(0, 2.25, 0);
  el.addEventListener("click", () => el.dataset.addr && onPick(el.dataset.addr));
  return obj;
}
function label(obj: CSS2DObject, rank: number, s: Stand) {
  const el = obj.element as HTMLButtonElement;
  el.dataset.addr = s.addr;
  el.className = `ntag ${rank <= 5 ? "is-diamond" : "is-gold"} ${rank === 1 ? "is-one" : ""}`;
  el.querySelector("b")!.textContent = `#${rank}`;
  el.querySelector("span")!.textContent = s.name;
  el.dataset.since = String(s.firstIn || "");
  writeHeld(el, Date.now() / 1000);
  el.setAttribute("aria-label", `No. ${rank}, ${s.name}. Open the card`);
}

/** Writes how long the wallet behind a tag has held. The time only shows while the tag is hovered. */
function writeHeld(el: HTMLElement, now: number) {
  const since = Number(el.dataset.since);
  const out = el.querySelector<HTMLElement>(".ntag__held");
  if (out) out.textContent = since ? `held ${span(now - since)}` : "";
}

/* ───────── the component ───────── */

type Live = { obj: THREE.Group; tag: CSS2DObject; key: string; rank: number; bal: number };

export function Island({
  rows,
  golem,
  sold,
  onPick,
  onFail,
  light = 1,
}: {
  light?: number;
  rows: Stand[];
  golem: { addr: string; name: string } | null;
  sold: Set<string>;
  onPick: (addr: string) => void;
  onFail: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ sync: (rows: Stand[], golem: { addr: string; name: string } | null) => void; setLight: (l: number) => void } | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const soldRef = useRef(sold);
  soldRef.current = sold;

  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
    } catch {
      onFail();
      return;
    }
    const still = prefersReducedMotion();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.className = "island__labels";
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xffffff, 0x5a6070, 2.2);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(6, 14, 9);
    scene.add(sun);

    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minPolarAngle = 0.75;
    controls.maxPolarAngle = 1.15;
    controls.target.set(0, 2.2, 0);
    // a finger on a phone scrolls the page; turning the island is for a mouse
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    controls.enabled = !coarse;
    const R = 40;
    let azimuth = Math.PI / 4;
    const polar = 0.98;
    const place = () => {
      camera.position.set(R * Math.sin(polar) * Math.sin(azimuth), 2.2 + R * Math.cos(polar), R * Math.sin(polar) * Math.cos(azimuth));
      camera.lookAt(controls.target);
    };
    place();
    controls.update();

    /* the ground */
    const blockMat: Record<string, THREE.Material | THREE.Material[]> = {};
    const lavaTex = pixelTexture(blockCanvas("lava"), true);
    for (const k of ["dirt", "stone", "diamond", "gold", "beacon"]) blockMat[k] = lambert(pixelTexture(blockCanvas(k)));
    const side = lambert(pixelTexture(blockCanvas("grass")));
    blockMat.grass = [side, side, lambert(pixelTexture(blockCanvas("grasstop"))), blockMat.dirt as THREE.Material, side, side];
    blockMat.lava = new THREE.MeshBasicMaterial({ map: lavaTex });
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const cells: Record<string, THREE.Vector3[]> = {};
    for (let x = 0; x < NX; x++)
      for (let z = 0; z < NZ; z++)
        for (let y = bottom(x, z); y <= top(x, z); y++) (cells[kind(x, y, z)] ??= []).push(at(x, y + 0.5, z));
    const ground = new THREE.Group();
    const m4 = new THREE.Matrix4();
    for (const [k, list] of Object.entries(cells)) {
      const inst = new THREE.InstancedMesh(cube, blockMat[k], list.length);
      list.forEach((p, i) => inst.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
      ground.add(inst);
    }
    scene.add(ground);

    const beacon = new THREE.Mesh(cube, blockMat.beacon);
    beacon.position.copy(at(BEACON[0], BEACON[1] + 0.5, BEACON[2]));
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 60, 0.36),
      new THREE.MeshBasicMaterial({ color: 0xa9f5ee, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    beam.position.copy(at(BEACON[0], BEACON[1] + 31, BEACON[2]));
    scene.add(beacon, beam);

    // torches at the corners of the terraces: hardly seen by day, the warm points of the night
    const stick = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const flame = new THREE.MeshBasicMaterial({ color: 0xffd23a });
    const torches = new THREE.Group();
    (
      [
        [0, 4, 6],
        [11, 4, 6],
        [0, 9, 4],
        [11, 9, 4],
      ] as [number, number, number][]
    ).forEach(([x, z, y]) => {
      const t = new THREE.Group();
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), stick);
      s.position.y = 0.3;
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), flame);
      f.position.y = 0.7;
      t.add(s, f);
      t.position.copy(at(x, y, z));
      torches.add(t);
    });
    scene.add(torches);

    const clouds = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    [
      [-15, 9, -12, 4, 2],
      [4, 11, -18, 5, 2.5],
      [18, 8, -4, 3.5, 2],
      [-20, 10, 6, 4.5, 2],
    ].forEach(([x, y, z, w, d]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, d), cloudMat);
      c.position.set(x, y, z);
      clouds.add(c);
    });
    scene.add(clouds);

    /* the miners */
    const geo = makeGeo();
    const shared = new Set<THREE.BufferGeometry>(Object.values(geo));
    const crew = new THREE.Group();
    scene.add(crew);
    const live = new Map<string, Live>();
    let golemObj: { obj: THREE.Group; tag: CSS2DObject; addr: string } | null = null;

    const remove = (l: Live) => {
      crew.remove(l.obj);
      l.tag.element.remove();
      dispose(l.obj, shared);
    };

    const sync = (rows: Stand[], g: { addr: string; name: string } | null) => {
      const seen = new Set<string>();
      rows.slice(0, 10).forEach((s, i) => {
        seen.add(s.id);
        const [x, z, y] = SPOTS[i];
        const to = at(x, y, z);
        const armor = armorOf(s.firstIn);
        const key = `${s.traits.join("-")}:${armor}`;
        let l = live.get(s.id);
        if (l && l.key !== key) {
          // a new skin: rebuild in place
          const pos = l.obj.position.clone();
          remove(l);
          live.delete(s.id);
          l = undefined;
          const obj = buildMiner(s.traits, geo, armor);
          obj.position.copy(pos);
          const tag = nametag((a) => pick.current(a));
          obj.add(tag);
          obj.userData.addr = s.addr;
          crew.add(obj);
          l = { obj, tag, key, rank: i + 1, bal: s.bal };
          live.set(s.id, l);
        }
        if (!l) {
          const obj = buildMiner(s.traits, geo, armor);
          const tag = nametag((a) => pick.current(a));
          obj.add(tag);
          obj.userData.addr = s.addr;
          obj.position.copy(to);
          crew.add(obj);
          l = { obj, tag, key, rank: i + 1, bal: s.bal };
          live.set(s.id, l);
          if (!still) gsap.from(obj.position, { y: to.y + 7, duration: 0.9, ease: "bounce.out", delay: 0.15 + i * 0.06 });
        } else if (!l.obj.position.equals(to)) {
          if (still) l.obj.position.copy(to);
          else {
            // walk to the new spot: up and over if it is on the other terrace
            const tl = gsap.timeline();
            const hop = Math.abs(l.obj.position.y - to.y) > 0.5 ? Math.max(l.obj.position.y, to.y) + 1.2 : l.obj.position.y;
            tl.to(l.obj.position, { y: hop, duration: 0.3, ease: "power2.out" })
              .to(l.obj.position, { x: to.x, z: to.z, duration: 1.1, ease: "power1.inOut" })
              .to(l.obj.position, { y: to.y, duration: 0.3, ease: "power2.in" });
          }
        }
        l.rank = i + 1;
        l.bal = s.bal;
        label(l.tag, i + 1, s);
      });
      for (const [id, l] of live) {
        if (seen.has(id)) continue;
        live.delete(id);
        if (still || !soldRef.current.has(id)) {
          remove(l);
          continue;
        }
        // sold: a startled face, a step off the edge, and the lava
        const head = l.obj.getObjectByName("head") as THREE.Mesh | undefined;
        if (head) {
          const old = head.material as THREE.Material[];
          const traits = l.key.split(":")[0].split("-").map(Number) as Traits;
          head.material = headMaterials(traits, minerPalette(traits), true);
          old.forEach((m) => ((m as THREE.MeshLambertMaterial).map?.dispose(), m.dispose()));
        }
        l.tag.element.classList.add("is-gone");
        const lava = at(Math.round(l.obj.position.x + CX), 1.4, 10);
        gsap
          .timeline({ onComplete: () => remove(l) })
          .to(l.obj.position, { y: l.obj.position.y + 1, duration: 0.25, ease: "power2.out" })
          .to(l.obj.position, { x: lava.x, z: lava.z, duration: 0.9, ease: "none" }, ">")
          .to(l.obj.position, { y: lava.y, duration: 0.9, ease: "power2.in" }, "<")
          .to(l.obj.rotation, { x: 1.4, duration: 0.9, ease: "power1.in" }, "<")
          .to(l.obj.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.5 });
      }
      beacon.visible = beam.visible = live.size > 0;
      if (g && (!golemObj || golemObj.addr !== g.addr)) {
        if (golemObj) {
          // a different dev wallet: the old golem goes, tag and all
          crew.remove(golemObj.obj);
          golemObj.tag.element.remove();
          dispose(golemObj.obj, shared);
        }
        const obj = buildGolem();
        obj.position.copy(at(GOLEM[0], GOLEM[2], GOLEM[1]));
        obj.userData.addr = g.addr;
        const tag = nametag((a) => pick.current(a));
        tag.position.y = 2.05;
        obj.add(tag);
        crew.add(obj);
        golemObj = { obj, tag, addr: g.addr };
      }
      if (golemObj) {
        if (!g) {
          crew.remove(golemObj.obj);
          golemObj.tag.element.remove();
          dispose(golemObj.obj, shared);
          golemObj = null;
        } else {
          const e = golemObj.tag.element as HTMLButtonElement;
          e.dataset.addr = g.addr;
          e.className = "ntag is-golem";
          e.querySelector("b")!.textContent = "Golem";
          e.querySelector("span")!.textContent = g.name;
          e.setAttribute("aria-label", `The golem, ${g.name}. Open the card`);
        }
      }
    };
    /* day and night: the light follows the clock in Jakarta */
    let beamBase = 0.42;
    const dayHemi = new THREE.Color(0xffffff);
    const nightHemi = new THREE.Color(0x6f7fc0);
    const daySun = new THREE.Color(0xffffff);
    const moon = new THREE.Color(0x9fb4ff);
    const dayCloud = new THREE.Color(0xffffff);
    const nightCloud = new THREE.Color(0x4a5274);
    const setLight = (l: number) => {
      hemi.intensity = 0.9 + 1.3 * l;
      hemi.color.copy(nightHemi).lerp(dayHemi, l);
      sun.intensity = 0.8 + 1.6 * l;
      sun.color.copy(moon).lerp(daySun, l);
      // the moon stands on the other side of the sky
      sun.position.set(l > 0.5 ? 6 : -8, 14, l > 0.5 ? 9 : -4);
      cloudMat.color.copy(nightCloud).lerp(dayCloud, l);
      beamBase = 0.42 + 0.4 * (1 - l);
      (flame as THREE.MeshBasicMaterial).color.setHex(l < 0.5 ? 0xffe066 : 0xffd23a);
    };
    api.current = { sync, setLight };

    /* size: the island fills the box, a little room above for the tags */
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      const aspect = w / h;
      const half = Math.max(8.2, 11.5 / aspect);
      camera.left = -half * aspect;
      camera.right = half * aspect;
      camera.top = half + 1.2;
      camera.bottom = -half + 1.2;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();

    /* clicking a miner: a press that did not turn the island */
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down: [number, number] | null = null;
    const hit = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      let o: THREE.Object3D | null = ray.intersectObject(crew, true)[0]?.object ?? null;
      while (o && !o.userData.addr) o = o.parent;
      return (o?.userData.addr as string) || "";
    };
    const onDown = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) {
        const a = hit(e);
        if (a) pick.current(a);
      }
      down = null;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons) return;
      renderer.domElement.style.cursor = hit(e) ? "pointer" : controls.enabled ? "grab" : "default";
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointermove", onMove);

    /* the island sways gently from side to side until someone turns it, and again a while after */
    let idle = true;
    let wake = 0;
    let phase = 0;
    let base = azimuth;
    controls.addEventListener("start", () => {
      idle = false;
      clearTimeout(wake);
    });
    controls.addEventListener("end", () => {
      clearTimeout(wake);
      wake = window.setTimeout(() => {
        azimuth = controls.getAzimuthalAngle();
        base = azimuth - 0.5 * Math.sin(phase);
        idle = true;
      }, 4000);
    });

    /* a Reward: ingots rain from the sky onto each of the ten, each with its share of the ETH */
    const ingotGeo = new THREE.BoxGeometry(0.42, 0.16, 0.26);
    const ingotMat = new THREE.MeshLambertMaterial({ color: 0xf2c230, emissive: 0x3a2a00 });
    const rain = (e: Event) => {
      const { eth } = (e as CustomEvent<RewardDrop>).detail;
      if (still || !live.size) return;
      const ranked = [...live.values()].sort((a, b) => a.rank - b.rank);
      const shares = splitInheritance(eth, ranked.map((l) => l.bal));
      const beamMat = beam.material as THREE.MeshBasicMaterial;
      gsap.fromTo(beam.scale, { x: 1, z: 1 }, { x: 3.2, z: 3.2, duration: 0.25, yoyo: true, repeat: 3, ease: "power1.inOut" });
      gsap.fromTo(beamMat, { opacity: 1 }, { opacity: 0.5, duration: 1.4 });
      ranked.forEach((l, i) => {
        const p = l.obj.position;
        for (let k = 0; k < 3; k++) {
          const ingot = new THREE.Mesh(ingotGeo, ingotMat);
          ingot.position.set(p.x + (Math.random() - 0.5) * 0.8, p.y + 11 + k * 1.4, p.z + (Math.random() - 0.5) * 0.8);
          ingot.rotation.y = Math.random() * Math.PI;
          scene.add(ingot);
          gsap
            .timeline({ delay: i * 0.09 + k * 0.18, onComplete: () => void scene.remove(ingot) })
            .to(ingot.position, { y: p.y + 2.25, duration: 0.85, ease: "bounce.out" })
            .to(ingot.rotation, { y: `+=${Math.PI}`, duration: 0.85, ease: "none" }, "<")
            .to(ingot.position, { y: p.y + 1.2, duration: 0.22, ease: "power2.in" })
            .to(ingot.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.22 }, "<");
        }
        const tip = document.createElement("span");
        tip.className = "gain";
        tip.textContent = `+${(shares[i] ?? 0).toFixed(4)} ETH`;
        const obj = new CSS2DObject(tip);
        obj.position.set(0, 2.6, 0);
        l.obj.add(obj);
        gsap
          .timeline({ delay: 0.9 + i * 0.09, onComplete: () => (l.obj.remove(obj), tip.remove()) })
          .fromTo(obj.position, { y: 2.4 }, { y: 3.8, duration: 2.2, ease: "power1.out" })
          .fromTo(tip, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
          .to(tip, { opacity: 0, duration: 0.5 }, 1.7);
      });
    };
    window.addEventListener("pixaxe:reward", rain);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);

    // the hold timers on the tags: one tick a second for all of them
    const clock1 = window.setInterval(() => {
      if (!visible || document.hidden) return;
      const now = Date.now() / 1000;
      el.querySelectorAll<HTMLElement>(".ntag[data-since]").forEach((t) => writeHeld(t, now));
    }, 1000);

    const clock = new THREE.Timer();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      clock.update();
      const dt = Math.min(clock.getDelta(), 0.1);
      if (!visible || document.hidden) return;
      const t = clock.getElapsed();
      if (!still) {
        if (idle) {
          phase += dt * 0.18;
          azimuth = base + 0.5 * Math.sin(phase);
          place();
        }
        lavaTex.offset.y = (lavaTex.offset.y + dt * 0.04) % 1;
        (beam.material as THREE.MeshBasicMaterial).opacity = beamBase + 0.14 * Math.sin(t * 3);
        torches.children.forEach((tc, i) => (tc.children[1].scale.y = 0.85 + 0.3 * Math.abs(Math.sin(t * 7 + i))));
        clouds.children.forEach((c, i) => {
          c.position.x += dt * (0.3 + i * 0.08);
          if (c.position.x > 24) c.position.x = -24;
        });
        live.forEach((l, id) => {
          const rig = l.obj.userData.rig as THREE.Group;
          rig.position.y = Math.abs(Math.sin(t * 2.2 + id.charCodeAt(4))) * 0.06;
        });
      }
      // everyone turns to face you
      const yaw = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
      crew.children.forEach((c) => (c.rotation.y = yaw));
      if (!idle || !controls.enabled) controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(wake);
      clearInterval(clock1);
      window.removeEventListener("pixaxe:reward", rain);
      ingotGeo.dispose();
      ingotMat.dispose();
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      live.forEach(remove);
      live.clear();
      scene.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat) => {
          (mat as THREE.MeshLambertMaterial).map?.dispose();
          mat.dispose();
        });
      });
      Object.values(geo).forEach((g) => g.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.current?.sync(rows, golem);
  }, [rows, golem]);

  useEffect(() => {
    api.current?.setLight(light);
  }, [light]);

  return <div className="island" ref={host} />;
}
