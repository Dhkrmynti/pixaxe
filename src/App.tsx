import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { demoPond, demoRounds, demoStatus, usePoll, type Pond, type RoundRow, type Status } from "./lib/api";
import { useFeed } from "./lib/feed";
import { prefersReducedMotion } from "./lib/motion";
import { restoreWallet } from "./lib/wallet";
import { Hud, TopBar } from "./game/Hud";
import { Title } from "./game/Title";
import { Scoreboard } from "./game/Scoreboard";
import { FurnaceUI } from "./game/FurnaceUI";
import { Advancements } from "./game/Advancements";
import { Inventory } from "./game/Inventory";
import { ChestUI } from "./game/ChestUI";
import { GameOver } from "./game/GameOver";
import { Graveyard } from "./game/Graveyard";

gsap.registerPlugin(ScrollTrigger);

export function App() {
  const { data: status, error } = usePoll<Status>("/api/status", 4000, demoStatus);
  const live = !!status?.tokenAddress;
  // the island is live: a new buyer is on it within a few seconds
  const { data: pond } = usePoll<Pond>(live ? "/api/pond?limit=50" : null, 3000, demoPond);
  const { data: rounds } = usePoll<RoundRow[]>(live ? "/api/rounds" : null, 20000, demoRounds);
  const feed = useFeed(pond, rounds, live);

  // A wallet that already trusts this site shows as connected without a popup.
  useEffect(restoreWallet, []);

  // Scroll-started reveals measure where they begin once; when fonts, X pictures or the live board
  // change the height above them, measure again so nothing starts in the wrong place.
  useEffect(() => {
    ScrollTrigger.config({ ignoreMobileResize: true });
    let t = 0;
    const again = () => {
      clearTimeout(t);
      t = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    };
    document.fonts?.ready.then(again);
    window.addEventListener("load", again);
    const watched = ["board", "furnace", "rules", "inventory", "chest", "grave"].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const heights = new Map<Element, number>();
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const h = Math.round(e.contentRect.height);
        if (heights.get(e.target) !== h) {
          heights.set(e.target, h);
          again();
        }
      }
    });
    watched.forEach((el) => ro.observe(el));
    return () => {
      clearTimeout(t);
      window.removeEventListener("load", again);
      ro.disconnect();
    };
  }, []);

  // Smooth scroll that ScrollTrigger reads from; off for reduced motion.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    const anchors = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!a || a.getAttribute("href") === "#") return;
      const el = document.querySelector(a.getAttribute("href")!);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: a.getAttribute("href") === "#top" ? 0 : -56 });
    };
    document.addEventListener("click", anchors);
    return () => {
      document.removeEventListener("click", anchors);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="game">
      <TopBar status={status} />
      <Title status={status} pond={pond} offline={!!error && !status} />
      <main>
        <Scoreboard status={status} pond={pond} />
        <FurnaceUI status={status} />
        <Advancements status={status} />
        <Inventory live={live} pond={pond} status={status} />
        <ChestUI status={status} rounds={rounds} />
        <Graveyard status={status} />
      </main>
      <GameOver status={status} />
      <Hud status={status} feed={feed} />
    </div>
  );
}
