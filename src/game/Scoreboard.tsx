/**
 * The scoreboard: the player list you get when you hold Tab on a server. The ten on the island
 * first, split by ledge (the two reward tiers), each with how long it has held (live) and a signal bar
 * for how much it holds next to No. 1. Then the golem, who is spawning, who is a spectator, and No. 11-50 below a fold.
 * When ranks move, rows slide to their new place.
 */
import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { DEFAULT_TIERS, compact, demoDiamond, splitInheritance, usd, usePoll, type Diamond, type Pond, type PondRow, type Status } from "../lib/api";
import { nameFor } from "../lib/alias";
import { prefersReducedMotion } from "../lib/motion";
import { NAME, TICKER } from "../lib/brand";
import { Icon } from "../lib/icons";
import { Countdown, Held } from "../lib/clock";
import { armorOf } from "../lib/armor";
import { ArmorIcon } from "../world/Miner";
import { Face, XCheck, XLink } from "../world/Bits";
import { openTag } from "./Inventory";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function Who({ addr, nickname, pp, x, size = 28 }: { addr: string; nickname?: string; pp?: number[] | null; x?: PondRow["x"]; size?: number }) {
  const who = nameFor(addr, nickname, x ?? null);
  return (
    <span className="who">
      {size > 0 ? <Face addr={addr} pp={pp ?? null} x={x ?? null} size={size} className="who__face" /> : null}
      {x ? <XLink x={x} className="who__x" /> : null}
      <button type="button" className="who__name" onClick={() => openTag(addr)} aria-label={`Open the card of ${who.name}`}>
        {who.name}
      </button>
      {x ? <XCheck x={x} /> : null}
    </span>
  );
}

/** Five bars, filled by how much a wallet holds next to No. 1 (on a log scale, so small holders still show). */
function Signal({ of, max }: { of: number; max: number }) {
  const n = max > 0 ? Math.max(1, Math.min(5, Math.round(5 + Math.log10(Math.max(of, 1) / max) * 2.2))) : 0;
  return (
    <span className="signal" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((k) => (
        <i key={k} className={k <= n ? "is-on" : ""} style={{ height: `${k * 20}%` }} />
      ))}
    </span>
  );
}

/**
 * Diamond hands: the same holders ranked by how long they have held instead of how much. Armor and
 * a live timer for each, and where each one stands by holdings.
 */
function DiamondHands({ live }: { live: boolean }) {
  const { data } = usePoll<Diamond>(live ? "/api/diamond?limit=30" : null, 15000, demoDiamond);
  const rows = data?.rows ?? [];
  if (!rows.length)
    return <p className="dh__empty">{live ? "Nobody has held long enough to count yet." : "Opens at launch. The first buyer starts the clock."}</p>;
  return (
    <>
      <div className="dh__cols num" aria-hidden="true">
        <span>#</span>
        <span>Miner</span>
        <span>Held for</span>
        <span>Holds</span>
        <span>By holdings</span>
      </div>
      <ol className="dh">
        {rows.map((r) => (
          <li key={r.addr} className={`dh__row ${r.rank <= 3 ? `is-top is-${r.rank}` : ""}`}>
            <span className="dh__n num">{r.rank}</span>
            <span className="prow__who">
              <Who addr={r.addr} nickname={r.nickname} pp={r.pp} x={r.x} size={30} />
            </span>
            <span className="dh__held">
              <ArmorIcon tier={armorOf(r.firstIn)} />
              <Held since={r.firstIn} />
            </span>
            <span className="dh__bal num">{compact(r.balance)}</span>
            <span className={`dh__by num ${r.balanceRank && r.balanceRank <= 10 ? "is-ledge" : ""}`}>{r.balanceRank ? `No. ${r.balanceRank}` : "-"}</span>
          </li>
        ))}
      </ol>
      <p className="dh__foot num">{(data?.total ?? 0).toLocaleString("en-US")} holders on the clock. It only counts from the first buy; a sale ends it for good.</p>
    </>
  );
}

export function Scoreboard({ status, pond }: { status: Status | null; pond: Pond | null }) {
  const [view, setView] = useState<"hold" | "diamond">("hold");
  const root = useRef<HTMLElement>(null);
  const live = !!status?.tokenAddress;
  const rows = live ? (pond?.rows ?? []).slice(0, 50) : [];
  const tiers = status?.rules.tiers ?? DEFAULT_TIERS;
  const reward = parseFloat(status?.cycle.steps.find((s) => s.kind === "feeding")?.thresholdETH ?? "0.02");
  const share = splitInheritance(reward, rows.filter((r) => r.inTop).map((r) => parseFloat(r.balance)), tiers);
  const px = status?.price?.tokenUSD ?? 0;
  const worth = (b: string) => (px > 0 ? usd(parseFloat(b) * px) : "");
  const max = rows.length ? parseFloat(rows[0].balance) : 0;
  const bar = rows.length >= 10 ? parseFloat(rows[9].balance) : 0;
  const ten = Array.from({ length: 10 }, (_, i) => rows[i]);
  const far = rows.slice(10);

  // rows slide to their new place when ranks move (FLIP by wallet, measured by offset, never on screen)
  const last = useRef(new Map<string, { y: number; w: number }>());
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const w = el.offsetWidth;
    const now = new Map<string, { y: number; w: number }>();
    el.querySelectorAll<HTMLElement>(".prow[data-key]").forEach((n) => {
      const b = { y: n.offsetTop, w };
      now.set(n.dataset.key!, b);
      const a = last.current.get(n.dataset.key!);
      if (prefersReducedMotion() || !a || a.w !== w || Math.abs(a.y - b.y) < 2) return;
      gsap.fromTo(n, { y: a.y - b.y, zIndex: 3 }, { y: 0, duration: 1, ease: "power2.inOut", clearProps: "transform,zIndex" });
    });
    last.current = now;
  });

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".tablist", { scaleY: 0.2, opacity: 0, duration: 0.45, ease: "power3.out", scrollTrigger: { trigger: ".tablist", start: "top 85%" } });
      gsap.from(".prow", { x: -16, opacity: 0, duration: 0.3, ease: "power2.out", stagger: 0.04, delay: 0.2, scrollTrigger: { trigger: ".tablist", start: "top 85%" } });
    },
    { scope: root, dependencies: [rows.length > 0] },
  );

  const row = (r: PondRow | undefined, rank: number) =>
    r ? (
      <li key={r.addr} data-key={r.addr} className={`prow ${rank === 1 ? "is-one" : ""}`}>
        <span className="prow__n num">{rank}</span>
        <span className="prow__who">
          <Who addr={r.addr} nickname={r.nickname} pp={r.pp} x={r.x} size={30} />
          {rank === 1 ? <Icon name="beacon" size={22} className="prow__beacon" title="Holds the beacon" /> : null}
        </span>
        <span className="prow__bal num">
          {compact(r.balance)}
          {worth(r.balance) ? <small> {worth(r.balance)}</small> : null}
        </span>
        <span className="prow__held">
          <ArmorIcon tier={armorOf(r.firstIn)} />
          <Held since={r.firstIn} />
        </span>
        <Signal of={parseFloat(r.balance)} max={max} />
        <span className="prow__next num">+{(share[rank - 1] ?? 0).toFixed(4)}</span>
      </li>
    ) : (
      <li key={`open-${rank}`} className="prow is-open">
        <span className="prow__n num">{rank}</span>
        <span className="prow__open">{bar > 0 ? "Empty spot. Hold more than No. 10." : `Empty spot. Hold 100,000 ${TICKER}.`}</span>
      </li>
    );

  return (
    <section className="sec board" id="board" ref={root} aria-labelledby="board-head">
      <div className="wrap">
        <div className="sec__head">
          <p className="eyebrow num">Hold Tab · the scoreboard</p>
          <h2 className="h2" id="board-head">
            Who is still digging
          </h2>
        </div>

        <div className="tablist">
          <p className="tablist__top num">
            <span>
              {NAME} · hardcore · {live ? `${(pond?.total ?? 0).toLocaleString("en-US")} players online` : "opens at launch"}
            </span>
            {px > 0 ? <span>1 {TICKER} ≈ ${px < 0.01 ? px.toPrecision(3) : px.toFixed(4)}</span> : null}
          </p>
          <div className="tabs" role="tablist" aria-label="Rank by">
            <button type="button" role="tab" aria-selected={view === "hold"} className="tabs__tab num" onClick={() => setView("hold")}>
              <Icon name="ingot" size={20} /> Holdings
            </button>
            <button type="button" role="tab" aria-selected={view === "diamond"} className="tabs__tab num" onClick={() => setView("diamond")}>
              <Icon name="beacon" size={20} /> Diamond hands
            </button>
          </div>
          {view === "diamond" ? (
            <DiamondHands live={live} />
          ) : (
          <>
          <div className="tablist__cols num" aria-hidden="true">
            <span>#</span>
            <span>Miner</span>
            <span>Holds</span>
            <span>Held for</span>
            <span>Signal</span>
            <span>Next reward, ETH</span>
          </div>
          <div className="tablist__group is-diamond">
            <p className="tablist__label num">
              Diamond ledge · No. 1-5 share {tiers[0]?.eth ?? "0.014"} ETH of every {reward} ETH reward
            </p>
            <ol>{ten.slice(0, 5).map((r, i) => row(r, i + 1))}</ol>
          </div>
          <div className="tablist__group is-gold">
            <p className="tablist__label num">Gold ledge · No. 6-10 share {tiers[1]?.eth ?? "0.006"} ETH</p>
            <ol>{ten.slice(5).map((r, i) => row(r, i + 6))}</ol>
          </div>
          {live && (pond?.house || pond?.waiting?.length || pond?.out?.length) ? (
            <div className="tablist__notes">
              {pond?.house ? (
                <p>
                  <b className="num">Golem</b>
                  <Who addr={pond.house.addr} nickname={pond.house.nickname} pp={pond.house.pp} x={pond.house.x} size={22} />
                  <span>
                    <span className="num">{compact(pond.house.balance)}</span>. The dev wallet: guards the island, never digs, never paid.
                  </span>
                </p>
              ) : null}
              {pond?.waiting?.length ? (
                <p>
                  <b className="num">Spawning</b>
                  {pond.waiting.map((w) => (
                    <span key={w.addr} className="spawning">
                      <Who addr={w.addr} nickname={w.nickname} pp={w.pp} x={w.x} size={20} />
                      <span className="spawning__in">
                        spawns in <Countdown to={w.eligibleAt} />
                      </span>
                    </span>
                  ))}
                </p>
              ) : null}
              {pond?.out?.length ? (
                <p>
                  <b className="num">Spectators</b>
                  {pond.out.map((w) => (
                    <span key={w.addr} className="tablist__gone">
                      {nameFor(w.addr, w.nickname, w.x).name}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          ) : null}
          </>
          )}
        </div>

        {view === "hold" && far.length ? (
          <details className="deeper">
            <summary className="btn is-line">Still in the stone · No. 11-{far.length + 10}</summary>
            <ol className="deeper__list" start={11}>
              {far.map((r) => {
                const gap = bar - parseFloat(r.balance);
                return (
                  <li key={r.addr}>
                    <span className="deeper__n num">{r.rank}</span>
                    <Who addr={r.addr} nickname={r.nickname} pp={r.pp} x={r.x} size={20} />
                    <span className="deeper__sub num">
                      {compact(r.balance)} · {gap > 0 ? `+${compact(gap + 1)} to a ledge` : "next up"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </details>
        ) : null}
      </div>
    </section>
  );
}

