/**
 * The chest: a double chest, 54 slots, one item per step the engine ran. Gold ingots are a Reward to
 * the ten, a chest is a load to the treasury. Point at a slot (or tap it) to read what it was, with
 * the transaction that proves it. Newest first.
 */
import { useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { STEP, dateWib, eth, txUrl, type RoundRow, type Status } from "../lib/api";
import { prefersReducedMotion } from "../lib/motion";
import { Icon } from "../lib/icons";
import { play } from "../lib/sound";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function ChestUI({ status, rounds }: { status: Status | null; rounds: RoundRow[] | null }) {
  const root = useRef<HTMLElement>(null);
  const all = (rounds ?? []).filter((r) => r.stage !== "failed" && STEP[r.kind]).slice(0, 54);
  const [pick, setPick] = useState<number | null>(null);
  const sel = all.find((r) => r.n === pick) ?? all[0];
  const t = status?.totals;
  const fed = all.filter((r) => r.kind === "feeding").length;

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".chestui .slot", { scale: 0, duration: 0.2, ease: "back.out(2)", stagger: { each: 0.008, from: "start" }, scrollTrigger: { trigger: ".chestui", start: "top 80%" } });
    },
    { scope: root, dependencies: [all.length] },
  );

  const what = (r: RoundRow) => (r.kind === "feeding" ? `paid to ${r.recipients || 10} holders` : "to the treasury wallet");
  const value = (r: RoundRow) => (r.kind === "feeding" && r.stage === "done" ? r.fedETH : r.spentETH);
  const tx = (r: RoundRow) => (r.kind === "feeding" ? r.claimTx : r.treasuryTx);

  return (
    <section className="sec chest" id="chest" ref={root} aria-labelledby="chest-head">
      <div className="wrap chest__grid">
        <div className="sec__head">
          <p className="eyebrow num">The chest · every step, on chain</p>
          <h2 className="h2" id="chest-head">
            Nothing leaves without a receipt.
          </h2>
          <p className="totals">
            <span>
              <Icon name="ingots" size={24} /> <b className="num">{eth(t?.fedETH ?? "0")}</b> paid to the ten
            </span>
            <span>
              <Icon name="chest" size={24} /> <b className="num">{eth(t?.keeperETH ?? "0")}</b> to the treasury
            </span>
          </p>
        </div>

        <div className="gui chestui">
          <p className="gui__title">
            Large chest · <span className="num">{fed}</span> rewards, <span className="num">{all.length - fed}</span> treasury loads
          </p>
          <ol className="chestui__slots">
            {Array.from({ length: 54 }, (_, i) => {
              const r = all[i];
              if (!r) return <li key={`empty-${i}`} className="slot" aria-hidden="true" />;
              const on = sel?.n === r.n;
              return (
                <li key={`round-${r.n}`}>
                  <button
                    type="button"
                    className={`slot is-${r.kind} ${on ? "is-on" : ""} ${r.stage === "done" ? "" : "is-open"}`}
                    onMouseEnter={() => setPick(r.n)}
                    onFocus={() => setPick(r.n)}
                    onClick={() => (setPick(r.n), play("click"))}
                    aria-pressed={on}
                    aria-label={`Round ${r.n}: ${STEP[r.kind].name}, ${parseFloat(value(r)).toFixed(4)} ETH ${what(r)}`}
                  >
                    <Icon name={r.kind === "feeding" ? "ingots" : "chest"} size={30} />
                    <span className="slot__n num">{r.n}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {sel ? (
            <div className={`tooltip is-${sel.kind}`} aria-live="polite">
              <p className="tooltip__name">
                {STEP[sel.kind].name} <span className="num">#{sel.n}</span>
              </p>
              <p className="tooltip__line">
                <span className="num">{parseFloat(value(sel)).toFixed(4)} ETH</span> {what(sel)}
              </p>
              <p className="tooltip__meta num">
                {dateWib(sel.at)} ·{" "}
                {sel.stage === "done" && tx(sel) ? (
                  <a href={txUrl(tx(sel))} target="_blank" rel="noreferrer">
                    {tx(sel).slice(0, 10)}… <ArrowUpRight weight="bold" aria-hidden="true" />
                  </a>
                ) : (
                  "pending"
                )}
              </p>
            </div>
          ) : (
            <p className="tooltip is-empty">The chest is empty. The first reward drops when the creator fees reach {status?.cycle.steps[0].thresholdETH ?? "0.02"} ETH.</p>
          )}
        </div>
      </div>
    </section>
  );
}
