/**
 * The graveyard: every wallet that sold, newest first, one stone each. Its ghost, how long it held,
 * the armor it died in, what it had been paid, and the transaction that ended the run. A few
 * records at the gate: how many, the shortest life, the longest one thrown away.
 */
import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { demoGraveyard, txUrl, usePoll, type Grave, type Graveyard as Yard, type Status } from "../lib/api";
import { nameFor } from "../lib/alias";
import { ARMOR, armorOf } from "../lib/armor";
import { prefersReducedMotion } from "../lib/motion";
import { useNow } from "../lib/clock";
import { Icon } from "../lib/icons";
import { ArmorIcon, Portrait, minerOf } from "../world/Miner";
import { TICKER } from "../lib/brand";
import { openTag } from "./Inventory";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** 2d 3h, 5h 12m, 4m 10s: a life, short. */
export function life(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}
const ago = (sec: number) => (sec < 3600 ? `${Math.max(1, Math.floor(sec / 60))}m ago` : sec < 86400 ? `${Math.floor(sec / 3600)}h ago` : `${Math.floor(sec / 86400)}d ago`);

/** The line on the stone, from how far the wallet got before it sold. */
function epitaph(g: Grave) {
  const lived = g.firstIn ? g.hoppedAt - g.firstIn : 0;
  const armor = g.firstIn ? armorOf(g.firstIn, g.hoppedAt) : 0;
  if (armor >= 4) return "Sold in diamond. Why.";
  if (armor === 3) return "Wore gold. Sold anyway.";
  if (armor === 2) return "Sold in iron.";
  if (armor === 1) return "Got the leather. Left.";
  if (lived < 600) return "Did not even unpack.";
  return "Gone before the first night.";
}

export function Graveyard({ status }: { status: Status | null }) {
  const root = useRef<HTMLElement>(null);
  const live = !!status?.tokenAddress;
  const { data } = usePoll<Yard>(live ? "/api/graveyard?limit=60" : null, 15000, demoGraveyard);
  const now = useNow();
  const [shown, setShown] = useState(12);
  const rows = data?.rows ?? [];
  const lives = rows.filter((g) => g.firstIn).map((g) => ({ g, lived: g.hoppedAt - g.firstIn }));
  const shortest = lives.reduce<(typeof lives)[number] | null>((a, b) => (!a || b.lived < a.lived ? b : a), null);
  const longest = lives.reduce<(typeof lives)[number] | null>((a, b) => (!a || b.lived > a.lived ? b : a), null);
  const name = (g: Grave) => nameFor(g.addr, g.nickname, g.x).name;

  useGSAP(
    () => {
      if (prefersReducedMotion() || !rows.length) return;
      // each stone rises out of the ground as the yard comes into view
      gsap.from(".grave", { yPercent: 60, opacity: 0, duration: 0.45, ease: "back.out(1.4)", stagger: 0.05, scrollTrigger: { trigger: ".graves", start: "top 85%" } });
    },
    { scope: root, dependencies: [rows.length > 0] },
  );

  return (
    <section className="sec yard" id="grave" ref={root} aria-labelledby="grave-head">
      <div className="wrap">
        <div className="sec__head">
          <p className="eyebrow num">The graveyard · spectators</p>
          <h2 className="h2" id="grave-head">
            Here lie the ones who sold.
          </h2>
          <p className="deck">One life each. Every stone is a wallet that sold its {TICKER}, with the transaction that ended the run.</p>
        </div>

        <div className="yard__gate">
          <p className="plaque">
            <Icon name="grave" size={30} />
            <span>
              <b className="num">{(data?.total ?? 0).toLocaleString("en-US")}</b> spectators
            </span>
          </p>
          {shortest ? (
            <p className="plaque">
              <Icon name="lava" size={30} />
              <span>
                Shortest life <b className="num">{life(shortest.lived)}</b> <em>{name(shortest.g)}</em>
              </span>
            </p>
          ) : null}
          {longest ? (
            <p className="plaque">
              <ArmorIcon tier={Math.max(1, armorOf(longest.g.firstIn, longest.g.hoppedAt))} size={30} />
              <span>
                Longest thrown away <b className="num">{life(longest.lived)}</b> <em>{name(longest.g)}</em>
              </span>
            </p>
          ) : null}
        </div>

        {rows.length ? (
          <ol className="graves">
            {rows.slice(0, shown).map((g) => {
              const lived = g.firstIn ? g.hoppedAt - g.firstIn : 0;
              const armor = g.firstIn ? armorOf(g.firstIn, g.hoppedAt) : 0;
              return (
                <li key={g.addr} className="grave">
                  <div className="grave__stone">
                    <span className="grave__rip num">R.I.P.</span>
                    <Portrait traits={minerOf(g.addr, g.pp)} size={44} className="grave__ghost" />
                    <button type="button" className="grave__name" onClick={() => openTag(g.addr)} aria-label={`Open the card of ${name(g)}`}>
                      {name(g)}
                    </button>
                    <span className="grave__lived num">held {g.firstIn ? life(lived) : "?"}</span>
                    <span className="grave__line">{epitaph(g)}</span>
                    {armor ? (
                      <span className="grave__armor num">
                        <ArmorIcon tier={armor} size={16} /> {ARMOR[armor].name}
                      </span>
                    ) : null}
                    {parseFloat(g.received) > 0 ? <span className="grave__paid num">was paid {parseFloat(g.received).toFixed(4)} ETH</span> : null}
                  </div>
                  <p className="grave__foot num">
                    fell {ago(now - g.hoppedAt)}
                    {g.hoppedTx ? (
                      <a href={txUrl(g.hoppedTx)} target="_blank" rel="noreferrer" aria-label={`The sale of ${name(g)}`}>
                        tx <ArrowUpRight weight="bold" aria-hidden="true" />
                      </a>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="yard__empty">{live ? "No graves yet. Nobody has sold." : "The graveyard opens at launch. May it stay empty."}</p>
        )}
        {rows.length > shown ? (
          <button type="button" className="btn is-line yard__more" onClick={() => setShown((n) => n + 12)}>
            Dig up {Math.min(12, rows.length - shown)} more
          </button>
        ) : null}
      </div>
    </section>
  );
}
