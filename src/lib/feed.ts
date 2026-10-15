/**
 * The chat: what just happened in the world, said in one line each. Nothing here is stored or sent;
 * it is read off the changes between two boards (a new No. 1, a new name on a ledge, a sale) and the
 * rounds the engine reports. A new Reward also fires `pixaxe:reward`, which rains ingots on the island
 * and levels up the HUD.
 */
import { useEffect, useRef, useState } from "react";
import { nameFor } from "./alias";
import { DEMO, FILM, short, type Pond, type RoundRow } from "./api";
import { play } from "./sound";

export interface RewardDrop {
  /** ETH paid out in this round, split over the ten. */
  eth: number;
  n: number;
  demo?: boolean;
}
export const dropReward = (d: RewardDrop) => window.dispatchEvent(new CustomEvent<RewardDrop>("pixaxe:reward", { detail: d }));

export type Tone = "info" | "good" | "bad" | "gold";
export interface Line {
  id: number;
  at: number;
  tone: Tone;
  who?: string;
  text: string;
}

let next = 1;

export function useFeed(pond: Pond | null, rounds: RoundRow[] | null, live: boolean) {
  const [lines, setLines] = useState<Line[]>(() => [{ id: next++, at: Date.now(), tone: "info", text: "Hardcore mode is on. One life." }]);
  const push = (l: Omit<Line, "id" | "at">[]) => l.length && setLines((all) => [...all, ...l.map((x) => ({ ...x, id: next++, at: Date.now() }))].slice(-8));

  const top = useRef<string[] | null>(null);
  const names = useRef(new Map<string, string>());
  const sold = useRef<Set<string> | null>(null);
  const lastRound = useRef<number | null>(null);

  useEffect(() => {
    if (!live || !pond) return;
    const rows = pond.rows.slice(0, 10);
    rows.forEach((r) => names.current.set(r.addr.toLowerCase(), nameFor(r.addr, r.nickname, r.x).name));
    const ids = rows.map((r) => r.addr.toLowerCase());
    const out: Omit<Line, "id" | "at">[] = [];
    if (top.current) {
      if (ids[0] && ids[0] !== top.current[0]) out.push({ tone: "gold", who: names.current.get(ids[0]), text: "lit the beacon" });
      ids.forEach((id, i) => {
        if (i === 0 || top.current!.includes(id)) return;
        out.push({ tone: "good", who: names.current.get(id), text: `reached the ${i < 5 ? "diamond" : "gold"} ledge` });
      });
    }
    top.current = ids;
    const gone = [...(pond.sold ?? []), ...(pond.out ?? []).map((o) => o.addr)].map((a) => a.toLowerCase());
    if (sold.current) {
      for (const a of gone)
        if (!sold.current.has(a)) {
          sold.current.add(a);
          out.push({ tone: "bad", who: names.current.get(a) ?? short(a), text: "fell in the lava" });
        }
    } else sold.current = new Set(gone);
    push(out);
    // the loudest thing that happened gets the sound: a sale, then a new No. 1, then a new name on a ledge
    if (out.some((l) => l.tone === "bad")) play("lava");
    else if (out.some((l) => l.tone === "gold")) play("beacon");
    else if (out.length) play("ledge");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pond, live]);

  useEffect(() => {
    if (!rounds?.length) return;
    const done = rounds.filter((r) => r.stage === "done").sort((a, b) => a.n - b.n);
    const say = (r: RoundRow): Omit<Line, "id" | "at"> =>
      r.kind === "feeding"
        ? { tone: "gold", text: `Reward smelted: ${parseFloat(r.fedETH).toFixed(4)} ETH to ${r.recipients || 10} miners` }
        : { tone: "info", text: `${parseFloat(r.spentETH).toFixed(4)} ETH went into the treasury` };
    if (lastRound.current === null) push(done.slice(-2).map(say));
    else {
      const fresh = done.filter((r) => r.n > lastRound.current!);
      push(fresh.map(say));
      fresh.filter((r) => r.kind === "feeding").forEach((r) => dropReward({ eth: parseFloat(r.fedETH), n: r.n }));
    }
    lastRound.current = done.at(-1)?.n ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds]);

  // The illustration edition has no live rounds: it shows what a reward looks like now and then.
  useEffect(() => {
    // a recording stages its own rewards
    if (!DEMO || FILM) return;
    let n = 100;
    const drop = () => {
      if (document.hidden) return;
      const eth = 0.0201;
      push([{ tone: "gold", text: `Reward smelted: ${eth.toFixed(4)} ETH to 10 miners (demo)` }]);
      dropReward({ eth, n: ++n, demo: true });
    };
    const first = window.setTimeout(drop, 7000);
    const again = window.setInterval(drop, 45000);
    return () => {
      clearTimeout(first);
      clearInterval(again);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return lines;
}
