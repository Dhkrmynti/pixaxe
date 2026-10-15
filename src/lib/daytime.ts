/**
 * Day and night on the island follow the clock in Jakarta (WIB). `light` runs from 0 (deep night)
 * to 1 (full day): dawn from about 04:00 to 08:00, dusk from 16:00 to 20:00. `?time=21` (or 21.5)
 * pins the hour, to see the island at any time of day.
 */
import { useEffect, useState } from "react";

export type Phase = "night" | "dawn" | "day" | "dusk";

export interface Daytime {
  /** Hour in WIB, with fractions: 21.5 is 21:30. */
  hour: number;
  light: number;
  phase: Phase;
  /** 21:30, for the page to show. */
  clock: string;
}

function pinned() {
  const t = new URLSearchParams(window.location.search).get("time");
  const h = t === null ? NaN : parseFloat(t);
  return isFinite(h) ? ((h % 24) + 24) % 24 : null;
}

function wibHour() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 12);
  const m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return h + m / 60;
}

export function daytimeAt(hour: number): Daytime {
  // a smooth day curve, peaking at noon, flattened so the middle of the day and night are steady
  const raw = 0.5 - 0.5 * Math.cos((2 * Math.PI * hour) / 24);
  const light = Math.max(0, Math.min(1, (raw - 0.25) / 0.5));
  const phase: Phase = light >= 0.95 ? "day" : light <= 0.05 ? "night" : hour < 12 ? "dawn" : "dusk";
  const hh = Math.floor(hour);
  const mm = Math.floor((hour - hh) * 60);
  return { hour, light, phase, clock: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
}

export function useDaytime(): Daytime {
  const [d, setD] = useState(() => daytimeAt(pinned() ?? wibHour()));
  useEffect(() => {
    if (pinned() !== null) return;
    const id = setInterval(() => setD(daytimeAt(wibHour())), 60_000);
    return () => clearInterval(id);
  }, []);
  return d;
}
