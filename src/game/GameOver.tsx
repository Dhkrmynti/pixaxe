/** The end of the page, as the screen you get in hardcore: no respawn, only the way back in. */
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowUpRight, XLogo } from "@phosphor-icons/react";
import { DEMO, X_URL, dexUrl, type Status } from "../lib/api";
import { prefersReducedMotion } from "../lib/motion";
import { CHAIN, NAME, TICKER } from "../lib/brand";
import { BuyButton, CaCopy, useMedia } from "../world/Bits";
import { Mark } from "../world/Miner";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function GameOver({ status }: { status: Status | null }) {
  const root = useRef<HTMLElement>(null);
  const narrow = useMedia("(max-width: 760px)");
  const ca = DEMO ? "" : status?.tokenAddress;
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(".end__h", { scale: 1.6, opacity: 0, duration: 0.6, ease: "power4.out", scrollTrigger: { trigger: ".end__h", start: "top 85%" } });
      gsap.from(".end__acts > *", { y: 20, opacity: 0, duration: 0.4, stagger: 0.08, delay: 0.3, scrollTrigger: { trigger: ".end__h", start: "top 85%" } });
    },
    { scope: root },
  );
  return (
    <footer className="end" ref={root} aria-label="Closing">
      <div className="wrap end__wrap">
        <p className="end__h">No respawn.</p>
        <p className="end__sub">Hardcore world. One life. Keep digging.</p>
        <div className="end__acts">
          <BuyButton status={status} />
          <span className="btn is-dead" aria-disabled="true" title="Not in hardcore">
            Respawn
          </span>
          <CaCopy status={status} compact={narrow} />
        </div>
        <nav className="end__links num" aria-label="Elsewhere">
          {X_URL ? (
            <a href={X_URL} target="_blank" rel="noreferrer">
              <XLogo weight="bold" aria-hidden="true" /> {NAME} on X <ArrowUpRight weight="bold" aria-hidden="true" />
            </a>
          ) : null}
          {ca ? (
            <a href={dexUrl(ca)} target="_blank" rel="noreferrer">
              Chart <ArrowUpRight weight="bold" aria-hidden="true" />
            </a>
          ) : null}
          <a href="/terms.html">Terms</a>
          <a href="/privacy.html">Privacy</a>
        </nav>
        <p className="end__sig num">
          <Mark size={20} /> {NAME} · {TICKER} · {CHAIN}
        </p>
        <p className="end__fine">An original world. Not affiliated with Mojang, Microsoft or any game.</p>
      </div>
    </footer>
  );
}
