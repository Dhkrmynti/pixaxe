/**
 * The title screen: the floating island with the live top ten on it, and the name in block letters.
 * If the browser can't draw 3D, the ten are shown as portraits on two ledges instead.
 */
import { lazy, Suspense, useMemo, useRef, useState, type CSSProperties } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowDown } from "@phosphor-icons/react";
import { DEMO, type Pond, type Status } from "../lib/api";
import { nameFor } from "../lib/alias";
import { prefersReducedMotion } from "../lib/motion";
import { NAME, TICKER } from "../lib/brand";
import { BuyButton } from "../world/Bits";
import { Portrait, minerOf } from "../world/Miner";
import { openTag } from "./Inventory";
import { useDaytime } from "../lib/daytime";
import type { Stand } from "../world3d/Island";

// three.js is the heaviest part of the page: it loads after everything else is on screen
const Island = lazy(() => import("../world3d/Island").then((m) => ({ default: m.Island })));

gsap.registerPlugin(useGSAP);

function Flat({ rows }: { rows: Stand[] }) {
  return (
    <div className="flat">
      {[rows.slice(0, 5), rows.slice(5, 10)].map((ledge, k) => (
        <ol key={k} className={`flat__ledge ${k ? "is-gold" : "is-diamond"}`} start={k * 5 + 1}>
          {ledge.map((s, i) => (
            <li key={s.id}>
              <button type="button" onClick={() => openTag(s.addr)}>
                <Portrait traits={s.traits} size={56} />
                <span className="num">
                  #{k * 5 + i + 1} {s.name}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ))}
    </div>
  );
}

export function Title({ status, pond, offline }: { status: Status | null; pond: Pond | null; offline: boolean }) {
  const root = useRef<HTMLElement>(null);
  const live = !!status?.tokenAddress;
  const rows: Stand[] = useMemo(
    () => (live ? (pond?.rows ?? []).slice(0, 10) : []).map((r) => ({ id: r.addr.toLowerCase(), addr: r.addr, name: nameFor(r.addr, r.nickname, r.x).name, traits: minerOf(r.addr, r.pp), firstIn: r.firstIn, bal: parseFloat(r.balance) })),
    [pond, live],
  );
  const house = live && pond?.house ? pond.house : null;
  const golem = useMemo(() => (house ? { addr: house.addr, name: nameFor(house.addr, house.nickname, house.x).name } : null), [house?.addr, house?.nickname, house?.x?.username]);
  const empty = rows.length === 0 && !(live && !pond);

  // everyone the engine ever reported as sold stays in the set, so a late board still drops the right miner
  const sold = useRef(new Set<string>());
  for (const a of pond?.sold ?? []) sold.current.add(a.toLowerCase());
  for (const o of pond?.out ?? []) sold.current.add(o.addr.toLowerCase());

  const [flat, setFlat] = useState(false);
  const day = useDaytime();
  // the sun (by day) or the moon (by night) on an arc across the sky: up at 06:00 and 18:00, highest at 12:00 and 00:00
  const arc = ((day.hour + 18) % 12) / 12;
  const body = { left: `${46 + arc * 48}%`, top: `${16 + Math.pow(arc * 2 - 1, 2) * 26}%` };

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap
        .timeline({ delay: 0.15 })
        .from(".logo i", { yPercent: -120, opacity: 0, duration: 0.5, ease: "bounce.out", stagger: 0.05 })
        .from(".title__copy > :not(.logo)", { y: 20, opacity: 0, duration: 0.45, ease: "power2.out", stagger: 0.07 }, "-=0.2");
    },
    { scope: root },
  );

  return (
    <section
      className={`title is-${day.phase}`}
      id="top"
      ref={root}
      aria-label="The world"
      style={{ "--light": day.light, "--dusk": Math.max(0, 1 - Math.abs(day.light - 0.5) * 2.4) } as CSSProperties}
    >
      <div className="sky" aria-hidden="true">
        <i className="sky__night" />
        <i className="sky__dusk" />
        <i className="sky__stars" />
        <i className={`sky__body ${day.light < 0.5 ? "is-moon" : "is-sun"}`} style={body} />
      </div>
      <div className="title__world">
        {flat ? (
          <Flat rows={rows} />
        ) : (
          <Suspense fallback={null}>
            <Island rows={rows} golem={golem} sold={sold.current} onPick={openTag} onFail={() => setFlat(true)} light={day.light} />
          </Suspense>
        )}
      </div>
      <div className="title__copy">
        <p className="logo" aria-label={NAME}>
          {NAME.toUpperCase()
            .split("")
            .map((c, i) => (
              <i key={i} aria-hidden="true">
                {c}
              </i>
            ))}
        </p>
        <h1 className="title__h">{empty ? "The world is empty." : "One life. Don't sell."}</h1>
        <p className="title__sub">
          {offline
            ? "The world is offline for a moment."
            : empty
              ? `${live ? "" : "Opens at launch. "}The first holder of 100,000 ${TICKER} lights the beacon.`
              : `The ten biggest holders of ${TICKER} stand on the island and are paid in ETH from trading fees. Sell once and you fall in the lava. Hardcore: no respawn.`}
          {DEMO ? <em className="demo"> Demo data.</em> : null}
        </p>
        <div className="title__acts">
          <BuyButton status={status} />
          <a className="btn is-line" href="#board">
            <span className="btn__long">Scoreboard</span>
            <span className="btn__short">Board</span> <ArrowDown weight="bold" aria-hidden="true" />
          </a>
        </div>
        <p className="title__clock num">
          {day.clock} WIB · {day.phase === "night" ? "night on the island, the torches are lit" : day.phase === "dawn" ? "dawn on the island" : day.phase === "dusk" ? "dusk on the island" : "day on the island"}
        </p>
        {!flat && rows.length ? <p className="title__hint num">
            <span className="is-mouse">Drag to turn the island. Click a miner to see its card.</span>
            <span className="is-touch">Tap a miner to see its card.</span>
          </p> : null}
      </div>
    </section>
  );
}
