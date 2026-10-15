/**
 * Live timers. One shared one-second tick for the whole page: every timer re-renders only itself,
 * never the board around it. Times from the engine are unix seconds (block time of the first buy).
 */
import { useEffect, useState } from "react";

const subs = new Set<(t: number) => void>();
let timer = 0;

function subscribe(fn: (t: number) => void) {
  subs.add(fn);
  if (!timer) timer = window.setInterval(() => !document.hidden && subs.forEach((f) => f(Date.now() / 1000)), 1000);
  return () => {
    subs.delete(fn);
    if (!subs.size) {
      clearInterval(timer);
      timer = 0;
    }
  };
}

/** Now, in unix seconds, updated every second. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => subscribe(setNow), []);
  return now;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 3d 04:12:55, or 04:12:55 under a day. */
export function span(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d ? `${d}d ${hms}` : hms;
}

/** How long a wallet has held, counting up. Nothing to show for a wallet with no first buy. */
export function Held({ since, className = "" }: { since: number; className?: string }) {
  const now = useNow();
  if (!since) return <span className={`num ${className}`}>-</span>;
  return (
    <span className={`num ${className}`} title={`Holding since ${new Date(since * 1000).toLocaleString()}`}>
      {span(now - since)}
    </span>
  );
}

/** Counting down to a moment; says `done` once it has passed. */
export function Countdown({ to, done = "any moment", className = "" }: { to: number; done?: string; className?: string }) {
  const now = useNow();
  return <span className={`num ${className}`}>{to > now ? span(to - now) : done}</span>;
}
