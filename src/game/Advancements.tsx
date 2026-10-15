/**
 * The rules as an advancement tree: three to earn, one after the other (spawn in, reach a ledge,
 * light the beacon), and one challenge in red that ends the run (sell once). Each node is unlocked
 * in turn as the tree comes into view.
 */
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { amount, type Status } from "../lib/api";
import { prefersReducedMotion } from "../lib/motion";
import { TICKER } from "../lib/brand";
import { Icon, type IconName } from "../lib/icons";
import { ARMOR } from "../lib/armor";
import { ArmorIcon } from "../world/Miner";

gsap.registerPlugin(ScrollTrigger, useGSAP);

function Node({ icon, title, line, cls = "" }: { icon: IconName; title: string; line: string; cls?: string }) {
  return (
    <li className={`adv ${cls}`}>
      <span className="adv__frame">
        <Icon name={icon} size={40} />
      </span>
      <span className="adv__text">
        <b>{title}</b>
        <span>{line}</span>
      </span>
    </li>
  );
}

export function Advancements({ status }: { status: Status | null }) {
  const root = useRef<HTMLElement>(null);
  const min = amount(status?.rules.minBalance ?? "100000");
  const out = status?.tokenAddress ? status.counts.hopped : 0;
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap
        .timeline({ scrollTrigger: { trigger: ".advtree", start: "top 78%" } })
        .from(".adv", { scale: 0, opacity: 0, duration: 0.35, ease: "back.out(2.2)", stagger: 0.18 })
        .from(".advtree__link", { scaleX: 0, transformOrigin: "0 50%", duration: 0.3, stagger: 0.18 }, 0.2);
    },
    { scope: root },
  );
  return (
    <section className="sec rules" id="rules" ref={root} aria-labelledby="rules-head">
      <div className="wrap">
        <div className="sec__head">
          <p className="eyebrow num">Advancements · the rules</p>
          <h2 className="h2" id="rules-head">
            Three to earn. One to lose.
          </h2>
        </div>
        <div className="advtree">
          <ol className="advtree__path">
            <Node icon="miner" title="Spawn in" line={`Hold ${min} ${TICKER} to exist in this world.`} />
            <li className="advtree__link" aria-hidden="true" />
            <Node icon="ingots" title="On a ledge" line="Be one of the ten biggest holders. Every reward is shared, in ETH." />
            <li className="advtree__link" aria-hidden="true" />
            <Node icon="beacon" title="Light the beacon" line="Hold the most. The biggest share of the next reward is yours." cls="is-goal" />
          </ol>
          <div className="armorrow">
            <p className="armorrow__k num">Armor comes with time, never with money</p>
            <ol>
              {ARMOR.slice(1).map((a, i) => (
                <li key={a.name}>
                  <ArmorIcon tier={i + 1} size={34} />
                  <span>
                    <b>{a.name}</b>
                    <span className="num">
                      {a.days} {a.days === 1 ? "day" : "days"} held
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <ol className="advtree__fail">
            <Node icon="lava" title="Hardcore" line="Sell once and you are a spectator. For good. Moving between your own wallets is not a sale." cls="is-fail" />
          </ol>
        </div>
        <p className="rules__out">
          <b className="num">{out}</b> spectators so far.
        </p>
      </div>
    </section>
  );
}
