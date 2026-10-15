/**
 * The HUD, always on screen like in a game: a thin top bar with the name and the wallet, and at the
 * bottom one heart (one life), the XP bar (fees smelting toward the next step, the level is the
 * number of rounds run) and the hotbar, which is the page's navigation. Keys 1-8 jump to a slot.
 * The chat sits above the hotbar and lets each line fade, as game chat does.
 */
import { useEffect, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SpeakerHigh, SpeakerSlash, XLogo } from "@phosphor-icons/react";
import { play, useSound } from "../lib/sound";
import { DEFAULT_STEPS, DEMO, STEP, X_URL, ponsUrl, type Status } from "../lib/api";
import { NAME, TICKER } from "../lib/brand";
import { Icon, type IconName } from "../lib/icons";
import type { Line, RewardDrop } from "../lib/feed";
import { BuyButton, ConnectButton } from "../world/Bits";
import { Mark } from "../world/Miner";

export const SLOTS: [id: string, icon: IconName, label: string][] = [
  ["top", "world", "World"],
  ["board", "board", "Scoreboard"],
  ["furnace", "furnace", "Furnace"],
  ["rules", "star", "Rules"],
  ["inventory", "miner", "Your miner"],
  ["chest", "chest", "Chest"],
  ["grave", "grave", "Graveyard"],
];

const go = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const lenis = (window as unknown as { __lenis?: { scrollTo: (t: HTMLElement, o: { offset: number }) => void } }).__lenis;
  lenis ? lenis.scrollTo(el, { offset: id === "top" ? 0 : -56 }) : el.scrollIntoView();
};

export function TopBar({ status }: { status: Status | null }) {
  const [sound, setSound] = useSound();
  return (
    <header className="bar">
      <a className="bar__brand" href="#top" aria-label={`${NAME}, back to the top`}>
        <Mark size={30} />
        <span className="bar__word">{NAME}</span>
        <span className="bar__tick num">{TICKER}</span>
      </a>
      <div className="bar__acts">
        <button
          type="button"
          className={`bar__sound ${sound ? "is-on" : ""}`}
          onClick={() => setSound(!sound)}
          aria-pressed={sound}
          aria-label={sound ? "Sound on. Turn it off" : "Sound off. Turn it on"}
          title={sound ? "Sound on" : "Sound off"}
        >
          {sound ? <SpeakerHigh weight="bold" aria-hidden="true" /> : <SpeakerSlash weight="bold" aria-hidden="true" />}
        </button>
        {X_URL ? (
          <a className="bar__x" href={X_URL} target="_blank" rel="noreferrer noopener" aria-label={`${NAME} on X`}>
            <XLogo weight="bold" aria-hidden="true" />
          </a>
        ) : null}
        <ConnectButton />
        <BuyButton status={status} className="is-small" />
      </div>
    </header>
  );
}

export function Hud({ status, feed }: { status: Status | null; feed: Line[] }) {
  const [on, setOn] = useState("top");
  useEffect(() => {
    const st = SLOTS.map(([id]) => ScrollTrigger.create({ trigger: `#${id}`, start: "top 50%", end: "bottom 50%", onToggle: (s) => s.isActive && setOn(id) }));
    const keys = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= SLOTS.length) {
        play("click");
        go(SLOTS[n - 1][0]);
      }
      if (n === SLOTS.length + 1 && status?.tokenAddress && !DEMO) window.open(ponsUrl(status.tokenAddress), "_blank", "noopener");
    };
    window.addEventListener("keydown", keys);
    return () => {
      st.forEach((s) => s.kill());
      window.removeEventListener("keydown", keys);
    };
  }, [status?.tokenAddress]);

  // a Reward just paid out: LEVEL UP over the XP bar, and the bar flashes full for a moment
  const [up, setUp] = useState<RewardDrop | null>(null);
  useEffect(() => {
    let t = 0;
    const on = (e: Event) => {
      setUp((e as CustomEvent<RewardDrop>).detail);
      clearTimeout(t);
      t = window.setTimeout(() => setUp(null), 3200);
    };
    window.addEventListener("pixaxe:reward", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pixaxe:reward", on);
    };
  }, []);

  const live = !!status?.tokenAddress;
  const steps = status?.cycle.steps ?? DEFAULT_STEPS;
  const step = status ? steps[status.cycle.index] ?? steps[0] : steps[0];
  const escrow = live ? parseFloat(status?.escrowETH ?? "0") : 0;
  const target = parseFloat(step.thresholdETH);
  const pct = target > 0 ? Math.max(0, Math.min(1, escrow / target)) : 0;
  const ca = DEMO ? "" : status?.tokenAddress;

  // a line fades out on its own after a while; it is gone from the list once it has
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const shown = feed.filter((l) => now - l.at < 16000);

  return (
    <>
      <ol className="chat" aria-live="polite" aria-label="What just happened">
        {shown.map((l) => (
          <li key={l.id} className={`chat__line is-${l.tone}`}>
            {l.who ? <b>{l.who}</b> : null} {l.text}
          </li>
        ))}
      </ol>
    <div className="hud">
      <div className="hud__stats">
        <span className="hud__life" title="One life. Sell once and it is gone.">
          <Icon name="heart" size={22} />
          <span className="sr-only">One life</span>
        </span>
        {up ? (
          <p className="levelup" key={up.n} role="status">
            <b>LEVEL UP!</b>
            <span className="num">+{up.eth.toFixed(4)} ETH to the ten</span>
          </p>
        ) : null}
        <div
          className={`xp ${up ? "is-flash" : ""}`}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={escrow}
          aria-label={`${STEP[step.kind].name} smelting: ${escrow.toFixed(4)} of ${step.thresholdETH} ETH`}
        >
          <span className="xp__lv num">{(status?.rounds ?? 0) + (up ? 1 : 0)}</span>
          <span className="xp__bar">
            <i style={{ width: `${pct * 100}%` }} />
          </span>
          <span className="xp__say num">
            {live ? `${STEP[step.kind].name} ${escrow.toFixed(4)} / ${step.thresholdETH} ETH` : "Smelting starts at launch"}
          </span>
        </div>
      </div>
      <nav className="hotbar" aria-label="Sections">
        {SLOTS.map(([id, icon, label], i) => (
          <a
            key={id}
            href={`#${id}`}
            className={`hotbar__slot ${on === id ? "is-on" : ""}`}
            aria-current={on === id ? "location" : undefined}
            onClick={(e) => {
              e.preventDefault();
              play("click");
              go(id);
            }}
          >
            <Icon name={icon} size={30} />
            <span className="hotbar__key num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="hotbar__tip num">{label}</span>
          </a>
        ))}
        {ca ? (
          <a className="hotbar__slot is-buy" href={ponsUrl(ca)} target="_blank" rel="noreferrer">
            <Icon name="ingot" size={30} />
            <span className="hotbar__key num" aria-hidden="true">
              {SLOTS.length + 1}
            </span>
            <span className="hotbar__tip num">Buy {TICKER}</span>
          </a>
        ) : (
          <span className="hotbar__slot is-buy is-off" aria-label="Buy opens at launch">
            <Icon name="ingot" size={30} />
            <span className="hotbar__key num" aria-hidden="true">
              {SLOTS.length + 1}
            </span>
            <span className="hotbar__tip num">Buy at launch</span>
          </span>
        )}
      </nav>
    </div>
    </>
  );
}
