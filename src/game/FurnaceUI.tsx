/**
 * The furnace: the engine's loop as a furnace screen. Creator fees go in the top slot, trades are
 * the fuel, the arrow is the escrow filling toward the current step, and what comes out is either a
 * Reward for the ten or a load for the treasury. Beside it, the recipe: the steps in order and the
 * split over one full loop. No buyback, no burn.
 */
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { DEFAULT_STEPS, DEFAULT_TIERS, STEP, addrUrl, short, stepShare, type RoundKind, type Status } from "../lib/api";
import { prefersReducedMotion } from "../lib/motion";
import { TICKER } from "../lib/brand";
import { Icon } from "../lib/icons";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const OUT: Record<RoundKind, "ingots" | "chest"> = { feeding: "ingots", keeper: "chest" };

export function FurnaceUI({ status }: { status: Status | null }) {
  const root = useRef<HTMLElement>(null);
  const steps = status?.cycle.steps ?? DEFAULT_STEPS;
  const tiers = status?.rules.tiers ?? DEFAULT_TIERS;
  const live = !!status?.tokenAddress;
  const idx = live ? status!.cycle.index : 0;
  const step = steps[idx] ?? steps[0];
  const escrow = live ? parseFloat(status?.escrowETH ?? "0") : 0;
  const target = parseFloat(step.thresholdETH);
  const pct = target > 0 ? Math.max(0, Math.min(1, escrow / target)) : 0;
  const treasury = live ? status?.treasuryAddress : "";
  const feed = stepShare(steps, "feeding");

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".furnaceui", { y: 40, rotate: -2, opacity: 0, duration: 0.6, ease: "back.out(1.6)", scrollTrigger: { trigger: ".furnaceui", start: "top 85%" } });
      gsap.from(".recipe li", { x: 30, opacity: 0, duration: 0.4, ease: "power2.out", stagger: 0.1, scrollTrigger: { trigger: ".recipe", start: "top 85%" } });
    },
    { scope: root },
  );

  const what = (kind: RoundKind) =>
    kind === "feeding"
      ? `ETH straight to the ten on the island. No. 1-5 split ${tiers[0]?.eth ?? "0.014"}, No. 6-10 split ${tiers[1]?.eth ?? "0.006"}, by balance on each ledge.`
      : "ETH into the treasury wallet. Every load is in the chest below.";

  return (
    <section className="sec furnace" id="furnace" ref={root} aria-labelledby="furnace-head">
      <div className="wrap furnace__grid">
        <div className="sec__head">
          <p className="eyebrow num">The furnace · where the fees go</p>
          <h2 className="h2" id="furnace-head">
            Every trade feeds the fire.
          </h2>
          <p className="deck">Each trade's creator fee lands in the Pons fee escrow. When it reaches the current step's level, the engine collects it and runs that step. Then the other one, then round again.</p>
        </div>

        <div className="gui furnaceui" role="img" aria-label={`${STEP[step.kind].name}: ${escrow.toFixed(4)} of ${step.thresholdETH} ETH collected`}>
          <p className="gui__title">Furnace</p>
          <div className="furnaceui__body">
            <span className="slot furnaceui__in" title="Creator fees in the escrow">
              <Icon name="eth" size={40} />
              <span className="slot__n num">{escrow.toFixed(4)}</span>
            </span>
            <span className={`furnaceui__fire ${live ? "is-lit" : ""}`} aria-hidden="true">
              <Icon name="fire" size={40} />
            </span>
            <span className="slot furnaceui__fuel" title="Trades are the fuel">
              <Icon name="board" size={40} />
            </span>
            <span className="furnaceui__arrow" aria-hidden="true">
              <i style={{ width: `${pct * 100}%` }} />
            </span>
            <span className="slot is-big furnaceui__out" title={`Next: ${STEP[step.kind].name}`}>
              <Icon name={OUT[step.kind]} size={56} />
              <span className="slot__n num">{step.thresholdETH}</span>
            </span>
          </div>
          <p className="furnaceui__read num">
            {live ? (
              <>
                Smelting <b>{STEP[step.kind].name}</b>: {escrow.toFixed(4)} / {step.thresholdETH} ETH
              </>
            ) : (
              "The fire is lit at launch."
            )}
          </p>
        </div>

        <div className="recipe">
          <p className="recipe__k num">The recipe, in order</p>
          <ol>
            {steps.map((s, i) => (
              <li key={i} className={`recipe__step is-${s.kind} ${live && i === idx ? "is-now" : ""}`}>
                <span className="slot">
                  <Icon name={OUT[s.kind]} size={34} />
                </span>
                <div>
                  <p className="recipe__name">
                    {STEP[s.kind].name} <span className="num">{s.thresholdETH} ETH</span>
                    {live && i === idx ? <em className="num">smelting now</em> : null}
                  </p>
                  <p className="recipe__what">{what(s.kind)}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="split" aria-label={`Over one full loop: ${feed}% to the ten, ${100 - feed}% to the treasury`}>
            <span className="split__bar" aria-hidden="true">
              <i className="is-feeding" style={{ flexGrow: feed }} />
              <i className="is-keeper" style={{ flexGrow: 100 - feed }} />
            </span>
            <span className="split__k num">
              <span>
                <b>{feed}%</b> to the ten
              </span>
              <span>
                <b>{100 - feed}%</b> to the treasury
              </span>
            </span>
          </div>
          <p className="plain">
            No buyback and no burn: the engine never buys, sells or destroys {TICKER}.
            {treasury ? (
              <>
                {" "}
                Treasury:{" "}
                <a href={addrUrl(treasury)} target="_blank" rel="noreferrer" className="num">
                  {short(treasury)} <ArrowUpRight weight="bold" aria-hidden="true" />
                </a>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </section>
  );
}
