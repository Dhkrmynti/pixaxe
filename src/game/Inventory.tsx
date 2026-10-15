/**
 * The inventory: look up any wallet and get its inventory screen, with where it stands and what it
 * has been paid. The holder of the wallet can then dress it: a name, a skin,
 * or an X account, set by signing one plain message. No transaction is ever requested.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CaretLeft, CaretRight, Check, DownloadSimple, Image as ImageIcon, LinkSimple, MagnifyingGlass, PenNib, SealCheck, ShareNetwork, Wallet, X as Close, XLogo } from "@phosphor-icons/react";
import { DEMO, addrUrl, amount, bylineNonce, claimByline, dateWib, demoSaveByline, demoWallet, eth, fetchWallet, ponsUrl, short, startXDemo, startXLink, takeXDemo, txUrl, unlinkX, type Pond, type PondRow, type Status, type WalletInfo } from "../lib/api";
import { nameFor } from "../lib/alias";
import { prefersReducedMotion } from "../lib/motion";
import { connectWallet, hasWallet, signText, useAccount } from "../lib/wallet";
import { NAME, TICKER } from "../lib/brand";
import { Face, XCheck, XLink } from "../world/Bits";
import { ArmorIcon, Mark, Miner, PARTS, PART_NAMES, minerOf, type Traits } from "../world/Miner";
import { Icon } from "../lib/icons";
import { Countdown, Held, span } from "../lib/clock";
import { drawCard } from "../lib/sharecard";
import { play } from "../lib/sound";
import { ARMOR, armorOf, nextArmor } from "../lib/armor";

gsap.registerPlugin(useGSAP);

const VALID = /^0x[0-9a-fA-F]{40}$/;

type Tone = "ok" | "wait" | "stop" | "dim";
const STAMP: Record<WalletInfo["status"], { word: string; tone: Tone; line: string }> = {
  sitting: { word: "In the mine", tone: "ok", line: "You are in the mine. Hold more and dig toward a ledge." },
  waiting: { word: "Spawning", tone: "wait", line: `Your first ${TICKER} are still loading in. A moment.` },
  "too-small": { word: "Outside", tone: "wait", line: `Under 100,000 ${TICKER}. Not enough to spawn. Hold more.` },
  hopped: { word: "Spectator", tone: "stop", line: "This wallet sold. One life, and it is gone. Spectator for good." },
  excluded: { word: "World block", tone: "dim", line: "Engine, curve, treasury or dead address. Never on a ledge, never paid." },
  "not-holding": { word: "Not here", tone: "dim", line: `This wallet holds no ${TICKER}.` },
};

/** What X sign-in came back with (?x=…), read once and then cleared from the address bar. */
const X_RESULT: Record<string, { ok: boolean; text: string }> = {
  linked: { ok: true, text: "X linked. The mine now shows your X handle, picture and badge." },
  demo: { ok: true, text: "X linked for real: that's your handle, picture and badge. Demo page, so nothing was saved." },
  cancelled: { ok: false, text: "X sign-in cancelled. Nothing changed." },
  expired: { ok: false, text: "The X sign-in took too long. Try again." },
  failed: { ok: false, text: "X didn't confirm the account. Try again in a minute." },
};
function takeXResult() {
  const url = new URL(window.location.href);
  const r = url.searchParams.get("x");
  if (!r) return null;
  url.searchParams.delete("x");
  window.history.replaceState(null, "", url);
  return X_RESULT[r] ?? X_RESULT.failed;
}

export const NO_WALLET = `No wallet in this browser. Open ${typeof window === "undefined" ? "this site" : window.location.host} inside your wallet app (MetaMask, Rabby, OKX) to connect. GMGN's built-in wallet can't sign here yet.`;

function readQuery() {
  const p = new URLSearchParams(window.location.search).get("w") || window.location.hash.match(/w=(0x[0-9a-fA-F]{40})/)?.[1] || "";
  return VALID.test(p) ? p : "";
}

/** Rows elsewhere on the page open a wallet's tag through this event. */
export function openTag(addr: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("w", addr);
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new CustomEvent("rbank:card", { detail: addr }));
}

const SLOTS = [
  ["fur", "Skin tone"],
  ["hat", "Headgear"],
  ["acc", "Gear"],
  ["bg", "Backdrop"],
] as const;

function ChangingRoom({ info, onSaved, flash }: { info: WalletInfo; onSaved: (patch: Partial<WalletInfo>) => void; flash: { ok: boolean; text: string } | null }) {
  // The header's Connect button and this room share one account.
  const shared = useAccount();
  // Back from a demo X sign-in, the room reopens already "connected".
  const [demoAccount, setDemoAccount] = useState(DEMO && flash ? info.addr : "");
  const account = demoAccount || shared;
  const [open, setOpen] = useState(!!flash || (!!shared && shared.toLowerCase() === info.addr.toLowerCase()));
  const [tab, setTab] = useState<"name" | "x">(info.x ? "x" : "name");
  // A freshly linked X account opens on its own tab.
  const hasX = !!info.x;
  useEffect(() => {
    if (hasX) setTab("x");
  }, [hasX]);
  const [name, setName] = useState(info.nickname || "");
  const [skin, setSkin] = useState<Traits>(minerOf(info.addr, info.pp));
  const turn = (slot: number, by: number) => {
    const max = [PARTS.fur, PARTS.hat, PARTS.acc, PARTS.bg][slot];
    const next = [...skin] as Traits;
    next[slot] = (next[slot] + by + max) % max;
    setSkin(next);
    play("click");
  };
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(flash);
  const mine = account && account.toLowerCase() === info.addr.toLowerCase();

  const connect = async () => {
    setNote(null);
    // The demo page opens the room without a wallet; nothing it saves leaves the page.
    if (DEMO) {
      setDemoAccount(info.addr);
      return setNote({ ok: true, text: "Demo page: try it all. Whatever you set stays on this page only." });
    }
    if (!hasWallet()) return setNote({ ok: false, text: NO_WALLET });
    try {
      setBusy(true);
      const a = await connectWallet();
      if (a.toLowerCase() !== info.addr.toLowerCase()) setNote({ ok: false, text: `This card belongs to ${short(info.addr)}, your wallet is ${short(a)}. Switch accounts in the wallet.` });
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || "The wallet didn't connect." });
    } finally {
      setBusy(false);
    }
  };

  const sign = async () => {
    setNote(null);
    const tidy = name.replace(/\s+/g, " ").trim();
    if (DEMO) {
      if (tidy.length < 3 || tidy.length > 18 || !/^[A-Za-z0-9 _'-]+$/.test(tidy)) return setNote({ ok: false, text: "Names are 3 to 18 letters, numbers, spaces, - ' or _." });
      demoSaveByline(info.addr, { nickname: tidy, pp: skin });
      onSaved({ nickname: tidy, pp: skin });
      return setNote({ ok: true, text: `Saved. You're "${tidy}" in the mine now. (Demo page: on this page only.)` });
    }
    try {
      setBusy(true);
      const clean = name.replace(/\s+/g, " ").trim();
      const { nonce, template } = await bylineNonce(info.addr);
      const signature = await signText(account, template.replace("{nickname}", clean).replace("{mugshot}", skin.join("-")));
      const saved = await claimByline(info.addr, clean, skin, nonce, signature);
      onSaved({ nickname: saved.nickname, pp: saved.pp });
      setNote({ ok: true, text: `Saved. You're "${saved.nickname}" in the mine now.` });
      window.dispatchEvent(new Event("rbank:refresh"));
    } catch (e: any) {
      setNote({ ok: false, text: e?.code === 4001 ? "You cancelled the signature. Nothing was saved." : e?.message || "Couldn't save the name." });
    } finally {
      setBusy(false);
    }
  };

  const failed = (e: any, what: string) => setNote({ ok: false, text: e?.code === 4001 ? "You cancelled the signature. Nothing changed." : e?.message || what });

  // Link X: the wallet signs, then the browser goes to X and comes back to this tag.
  const linkX = async () => {
    setNote(null);
    if (DEMO) {
      // A real X sign-in (shown once, never saved). Without X keys on the engine, say so plainly;
      // a pretend account is only used if the visitor asks for one.
      try {
        setBusy(true);
        const { url } = await startXDemo(info.addr);
        return window.location.assign(url);
      } catch (e: any) {
        setBusy(false);
        setPretend(true);
        return setNote({ ok: false, text: `Real X sign-in isn't switched on yet (${e?.message || "no X app keys on the server"}). You can preview with a pretend account instead.` });
      }
    }
    try {
      setBusy(true);
      const { nonce, linkX: text } = await bylineNonce(info.addr);
      const signature = await signText(account, text);
      const { url } = await startXLink(info.addr, nonce, signature);
      window.location.assign(url);
    } catch (e: any) {
      failed(e, "Couldn't start X sign-in.");
      setBusy(false);
    }
  };

  const [pretend, setPretend] = useState(false);
  const usePretend = () => {
    const x = { username: "your_x_handle", name: "Your X name", avatar: "/favicon.svg", verified: "blue" };
    demoSaveByline(info.addr, { x });
    onSaved({ x });
    setPretend(false);
    setNote({ ok: true, text: "Pretend X account linked. With X sign-in switched on, this is your real handle, picture and badge." });
  };

  const dropX = async () => {
    setNote(null);
    if (DEMO) {
      demoSaveByline(info.addr, { x: null });
      // take it off the shared test board too
      fetch("/api/x/demo/unlink", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addr: info.addr }) }).catch(() => {});
      onSaved({ x: null });
      setTab("name");
      return setNote({ ok: true, text: "X unlinked. The mine shows your name and skin again." });
    }
    try {
      setBusy(true);
      const { nonce, unlinkX: text } = await bylineNonce(info.addr);
      await unlinkX(info.addr, nonce, await signText(account, text));
      onSaved({ x: null });
      setTab("name");
      setNote({ ok: true, text: "X unlinked. The mine shows your name and skin again." });
      window.dispatchEvent(new Event("rbank:refresh"));
    } catch (e: any) {
      failed(e, "Couldn't unlink X.");
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <button type="button" className="btn is-line room__open" onClick={() => setOpen(true)}>
        <PenNib weight="bold" aria-hidden="true" /> {info.x ? "Manage X link" : info.nickname ? "Edit name, skin or connect X" : "Set your name, skin or connect X"}
      </button>
    );

  return (
    <div className="room">
      <p className="room__head num">Skin</p>
      {!mine ? (
        <>
          <button type="button" className="btn is-line" onClick={connect} disabled={busy}>
            <Wallet weight="bold" aria-hidden="true" /> {busy ? "Connecting" : account ? "Switch to this wallet" : "Connect this wallet"}
          </button>
          {account && !note ? <p className="help">Your wallet is {short(account)}. This card is {short(info.addr)}: switch accounts in the wallet to edit it.</p> : null}
        </>
      ) : (
        <>
          <div className="room__tabs" role="tablist" aria-label="How the mine shows you">
            <button type="button" role="tab" aria-selected={tab === "name"} className="room__tab" onClick={() => setTab("name")}>
              <PenNib weight="bold" aria-hidden="true" /> Name &amp; skin
            </button>
            <button type="button" role="tab" aria-selected={tab === "x"} className="room__tab" onClick={() => setTab("x")}>
              <XLogo weight="bold" aria-hidden="true" /> Connect X
            </button>
          </div>
          {tab === "x" ? (
            <div className="xdesk" role="tabpanel">
              {info.x ? (
                <>
                  <div className="xdesk__who">
                    <Face addr={info.addr} pp={info.pp} x={info.x} size={64} className="xdesk__face" />
                    <div>
                      <p className="xdesk__name">
                        {info.x.name} <XCheck x={info.x} />
                      </p>
                      <a className="xdesk__handle" href={`https://x.com/${info.x.username}`} target="_blank" rel="noreferrer noopener">
                        @{info.x.username}
                      </a>
                    </div>
                  </div>
                  <p className="help">Handle, picture and badge come from X and can't be edited here. Changed them on X? Link again to refresh.</p>
                  <div className="xdesk__actions">
                    <button type="button" className="btn is-line" onClick={linkX} disabled={busy}>
                      <XLogo weight="bold" aria-hidden="true" /> Link again
                    </button>
                    <button type="button" className="btn is-quiet" onClick={dropX} disabled={busy}>
                      Unlink X
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="xdesk__pitch">Show your X account instead: your handle, your picture, and your badge if X gave you one. A logo next to your name opens your profile.</p>
                  <button type="button" className="btn is-line" onClick={linkX} disabled={busy || !info.xLogin}>
                    <XLogo weight="bold" aria-hidden="true" /> {busy ? "Opening X" : "Sign & connect X"}
                  </button>
                  {DEMO && pretend ? (
                    <button type="button" className="btn is-quiet" onClick={usePretend}>
                      Use a pretend account
                    </button>
                  ) : null}
                  <p className="help">{info.xLogin ? "Read-only: we never post or see your DMs. Your picture and handle then can't be edited here." : "X sign-in opens at launch."}</p>
                </>
              )}
            </div>
          ) : info.x ? (
            <p className="help" role="tabpanel">
              Your X account is showing right now. Unlink X on the other tab to set a name and skin instead.
            </p>
          ) : (
            <form
              className="room__form"
              onSubmit={(e) => {
                e.preventDefault();
                sign();
              }}
            >
              <div className="dress">
                <div
                  className={`doll is-bg-${skin[3]}`}
                  role="img"
                  aria-label={`Your miner: ${PART_NAMES.fur[skin[0]]} skin, ${PART_NAMES.hat[skin[1]]}, ${PART_NAMES.acc[skin[2]]}, ${PART_NAMES.bg[skin[3]]}`}
                >
                  <Miner traits={skin} />
                </div>
                <div className="dress__dials">
                  {SLOTS.map(([key, label], i) => (
                    <div className="dress__dial" key={key}>
                      <span className="dress__label">{label}</span>
                      <button type="button" className="dress__turn" onClick={() => turn(i, -1)} aria-label={`Previous ${label.toLowerCase()}`}>
                        <CaretLeft weight="bold" />
                      </button>
                      <span className="dress__value">{PART_NAMES[key][skin[i]]}</span>
                      <button type="button" className="dress__turn" onClick={() => turn(i, 1)} aria-label={`Next ${label.toLowerCase()}`}>
                        <CaretRight weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <label htmlFor="byline-name">Name</label>
              <div className="field">
                <input id="byline-name" value={name} maxLength={18} placeholder="Your name" onChange={(e) => setName(e.target.value)} autoComplete="off" spellCheck={false} />
                <button type="submit" className="btn" disabled={busy}>
                  {busy ? "Signing" : "Sign & save"}
                </button>
              </div>
              <p className="help">3 to 18 letters or numbers. Free to sign, moves no funds, once a day.</p>
            </form>
          )}
        </>
      )}
      {note ? (
        <p className={note.ok ? "okline" : "errline"} role={note.ok ? "status" : "alert"}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}

/** What the wallet wears, and how long until the next piece. */
function ArmorLine({ firstIn }: { firstIn: number }) {
  const tier = armorOf(firstIn);
  const next = nextArmor(firstIn);
  return (
    <p className="armorline num">
      <ArmorIcon tier={tier} size={20} />
      <span>{tier ? `${ARMOR[tier].name} armor` : "No armor yet"}</span>
      {next ? (
        <span className="armorline__next">
          · {ARMOR[next.tier].name} in <Countdown to={next.at} />
        </span>
      ) : (
        <span className="armorline__next">· the best there is</span>
      )}
    </p>
  );
}

/**
 * The next goal: how much more it takes to pass the wallet just above (or to reach a ledge, or to
 * spawn at all), and how close the one just below is. Read off the live board, so it moves as people trade.
 */
function Goal({ info, pond, status }: { info: WalletInfo; pond: Pond | null; status: Status | null }) {
  if (!pond || info.house || !["sitting", "too-small"].includes(info.status)) return null;
  const rows = pond.rows;
  const idx = rows.findIndex((r) => r.addr.toLowerCase() === info.addr.toLowerCase());
  const bal = idx >= 0 ? parseFloat(rows[idx].balance) : parseFloat(info.balance);
  const who = (r: PondRow) => nameFor(r.addr, r.nickname, r.x).name;
  const min = parseFloat(status?.rules.minBalance ?? "100000");
  let goal: { need: number; text: string } | null = null;
  if (info.status === "too-small") goal = { need: min - bal, text: "to spawn in the mine" };
  else if (idx > 0 && idx < 10) {
    const above = rows[idx - 1];
    goal = {
      need: parseFloat(above.balance) - bal + 1,
      text: `to pass No. ${idx} (${who(above)})${idx === 1 ? " and take the beacon" : idx === 5 ? " and step up to the diamond ledge" : ""}`,
    };
  } else if (idx !== 0 && rows[9]) goal = { need: parseFloat(rows[9].balance) - bal + 1, text: `to reach a ledge (pass No. 10, ${who(rows[9])})` };
  const below = idx >= 0 && idx < 10 ? rows[idx + 1] : undefined;
  const ca = DEMO ? "" : status?.tokenAddress;
  if (!goal && !below) return null;
  return (
    <div className="goal">
      <Icon name="star" size={28} />
      <div className="goal__body">
        <p className="goal__k num">{idx === 0 ? "You hold the beacon" : "Next goal"}</p>
        {goal && goal.need > 0 ? (
          <p className="goal__line">
            <b className="num">
              +{amount(Math.ceil(goal.need))} {TICKER}
            </b>{" "}
            {goal.text}.
          </p>
        ) : null}
        {below ? (
          <p className="goal__chase">
            No. {idx + 2} ({who(below)}) is <span className="num">{amount(Math.max(0, bal - parseFloat(below.balance)))}</span> behind you.
          </p>
        ) : null}
      </div>
      {ca && goal && goal.need > 0 ? (
        <a className="btn is-small" href={ponsUrl(ca)} target="_blank" rel="noreferrer">
          Buy
        </a>
      ) : null}
    </div>
  );
}

/** A picture of this miner to post on X: made here on a canvas, shown, then saved or shared. */
function ShareCard({ info, word }: { info: WalletInfo; word: string }) {
  const [card, setCard] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const close = () => {
    if (card) URL.revokeObjectURL(card.url);
    setCard(null);
  };
  useEffect(() => {
    if (!card) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  const gone = info.status === "hopped";
  const held = gone ? `${info.padDays}d, sold` : info.firstIn ? span(Date.now() / 1000 - info.firstIn) : "-";
  const who = nameFor(info.addr, info.nickname, info.x).name;
  const link = `${window.location.origin}/?w=${info.addr}`;
  const text = gone
    ? `Fell in the lava after ${info.padDays} days on the ${NAME} island. One life. ${TICKER}`
    : info.rank && info.rank <= 10
      ? `No. ${info.rank} on the ${NAME} island, ${ARMOR[armorOf(info.firstIn)].name.toLowerCase()} armor, held ${held}. One life, don't sell. ${TICKER}`
      : `Digging on the ${NAME} island, held ${held}. One life, don't sell. ${TICKER}`;

  const make = async () => {
    setErr("");
    setBusy(true);
    try {
      const blob = await drawCard({
        traits: minerOf(info.addr, info.pp),
        armor: armorOf(info.firstIn),
        name: who,
        rank: info.rank,
        word,
        held,
        holds: amount(info.balance),
        paid: eth(info.received),
        gone,
        host: window.location.host,
      });
      setCard({ url: URL.createObjectURL(blob), blob });
    } catch (e: any) {
      setErr(e?.message || "The card couldn't be drawn.");
    } finally {
      setBusy(false);
    }
  };

  const file = () => new File([card!.blob], `pixaxe-${info.addr.slice(2, 8)}.png`, { type: "image/png" });
  const canShare = !!card && typeof navigator.canShare === "function" && navigator.canShare({ files: [file()] });

  return (
    <>
      <button type="button" className="inv__share num" onClick={make} disabled={busy}>
        <ImageIcon weight="bold" aria-hidden="true" /> {busy ? "Drawing the card" : "Share card"}
      </button>
      {err ? <p className="errline">{err}</p> : null}
      {card ? (
        <div className="sharebox" role="dialog" aria-modal="true" aria-label="Your share card" onClick={(e) => e.target === e.currentTarget && close()}>
          <div className="gui sharebox__win">
            <div className="sharebox__top">
              <p className="gui__title">Share card</p>
              <button type="button" className="sharebox__x" onClick={close} aria-label="Close">
                <Close weight="bold" />
              </button>
            </div>
            <img src={card.url} width={1200} height={630} alt={`Share card of ${who}`} className="sharebox__img" />
            <div className="sharebox__acts">
              <a className="btn" href={card.url} download={`pixaxe-${info.addr.slice(2, 8)}.png`}>
                <DownloadSimple weight="bold" aria-hidden="true" /> Save PNG
              </a>
              {canShare ? (
                <button type="button" className="btn is-line" onClick={() => navigator.share({ files: [file()], text: `${text} ${link}` }).catch(() => {})}>
                  <ShareNetwork weight="bold" aria-hidden="true" /> Share
                </button>
              ) : null}
              <a className="btn is-line" href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer noopener">
                <XLogo weight="bold" aria-hidden="true" /> Post on X
              </a>
            </div>
            <p className="help sharebox__help">Save the picture first, then attach it to the post. Nothing is uploaded from this page.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function Inventory({ live, pond, status }: { live: boolean; pond: Pond | null; status: Status | null }) {
  const root = useRef<HTMLElement>(null);
  const [input, setInput] = useState(readQuery);
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const [xFlash] = useState(takeXResult);

  const lookup = async (addr: string) => {
    if (!VALID.test(addr)) {
      setError("That isn't a wallet address. It starts with 0x and has 42 characters.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const w = await fetchWallet(addr);
      setInfo(w);
      const url = new URL(window.location.href);
      url.searchParams.set("w", addr);
      window.history.replaceState(null, "", url);
    } catch (e: any) {
      setError(e?.message === "Not Found" || !live ? "The mine isn't open yet: nothing to check." : "Couldn't reach the engine. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const q = readQuery();
    const code = new URLSearchParams(window.location.search).get("xdemo");
    if (DEMO && code && q) {
      const url = new URL(window.location.href);
      url.searchParams.delete("xdemo");
      window.history.replaceState(null, "", url);
      takeXDemo(code)
        .then((x) => demoSaveByline(q, { x }))
        .catch(() => {})
        .finally(() => lookup(q));
    } else if (q) lookup(q);
    const open = (e: Event) => {
      const addr = (e as CustomEvent<string>).detail;
      setInput(addr);
      lookup(addr);
      const el = document.getElementById("inventory");
      const lenis = (window as unknown as { __lenis?: { scrollTo: (t: HTMLElement, o: { offset: number }) => void } }).__lenis;
      if (el) lenis ? lenis.scrollTo(el, { offset: -64 }) : el.scrollIntoView();
    };
    // The header's Connect button found no wallet: say so here, where the tag lives.
    const noWallet = () => {
      setError(NO_WALLET);
      document.getElementById("inventory")?.scrollIntoView();
    };
    window.addEventListener("rbank:card", open);
    window.addEventListener("rbank:nowallet", noWallet);
    return () => {
      window.removeEventListener("rbank:card", open);
      window.removeEventListener("rbank:nowallet", noWallet);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A fresh card opens like an inventory screen: the window, then its slots one by one.
  useGSAP(
    () => {
      if (!info || prefersReducedMotion()) return;
      gsap.fromTo(".inv", { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: "back.out(1.8)" });
      gsap.fromTo(".inv .slot", { scale: 0 }, { scale: 1, duration: 0.25, ease: "back.out(2)", stagger: 0.06, delay: 0.2 });
      gsap.fromTo(".effect", { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3, delay: 0.3 });
    },
    { scope: root, dependencies: [info] },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    lookup(input.trim());
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinked(true);
      setTimeout(() => setLinked(false), 1600);
    } catch {}
  };

  const base = info ? (info.house ? { word: "Golem", tone: "ok" as Tone, line: "The dev wallet. Guards the mine, never digs, never paid." } : STAMP[info.status]) : null;
  // Holders outside the top N get no share yet: say how far there is to climb.
  const stamp =
    info && base && info.status === "sitting" && !info.inTop
      ? { ...base, word: "Digging", tone: "wait" as const, line: `No. ${info.rank}, in the stone. Only the top ${info.topN} stand on a ledge: dig past ${info.rank! - info.topN} more.` }
      : info && base && info.status === "sitting"
        ? { ...base, word: info.rank === 1 ? "Beacon" : "On a ledge", line: info.rank === 1 ? "You hold the most. The beacon and the biggest share of the next reward are yours." : `Ledge spot No. ${info.rank}. You share the next reward.` }
        : base;

  const who = info ? nameFor(info.addr, info.nickname, info.x) : null;
  const last =
    info?.status === "sitting" && info.inTop
      ? { k: "Next reward", v: eth(info.estNext), icon: "ingots" as const }
      : info?.status === "hopped"
        ? { k: "Sold", v: dateWib(info.hoppedAt), icon: "lava" as const }
        : { k: "Rank", v: info?.rank ? `#${info.rank}` : "-", icon: "star" as const };

  return (
    <section className="sec inventory" id="inventory" ref={root} aria-labelledby="inv-head">
      <div className="wrap inventory__grid">
        <div className="inventory__ask">
          <p className="eyebrow num">Inventory · your miner</p>
          <h2 className="h2" id="inv-head">
            Find your miner
          </h2>
          <form className="lookup" onSubmit={submit} noValidate>
            <label htmlFor="wallet">Any wallet address</label>
            <div className="field">
              <input id="wallet" inputMode="text" autoComplete="off" spellCheck={false} placeholder="0x…" value={input} onChange={(e) => setInput(e.target.value)} aria-invalid={!!error} aria-describedby="wallet-help" />
              <button type="submit" className="btn is-line" disabled={busy}>
                <MagnifyingGlass weight="bold" aria-hidden="true" /> {busy ? "Checking" : "Check"}
              </button>
            </div>
            <p id="wallet-help" className={error ? "errline" : "help"} role={error ? "alert" : undefined}>
              {error || (xFlash && !info && !readQuery() ? xFlash.text : "Read only. Connect only to set a name and skin; it signs a message, never a payment.")}
            </p>
          </form>
        </div>

        <div className="inventory__slot" aria-live="polite">
          {info && stamp && who ? (
            <article className={`gui inv is-${stamp.tone}`}>
              <header className="inv__top">
                <span className="gui__title">
                  <Mark size={20} /> {NAME}
                </span>
                {info.rank ? <span className="inv__rank num">No. {info.rank}</span> : null}
              </header>
              <div className="inv__main">
                <div className={`doll is-bg-${minerOf(info.addr, info.pp)[3]} ${info.status === "hopped" ? "is-gone" : ""}`} aria-hidden="true">
                  {info.x ? <Face addr={info.addr} pp={info.pp} x={info.x} size={120} className="doll__x" /> : <Miner traits={minerOf(info.addr, info.pp)} startled={info.status === "hopped"} armor={info.status === "hopped" ? 0 : armorOf(info.firstIn)} />}
                </div>
                <div className="inv__id">
                  <p className={`inv__who ${info.status === "hopped" ? "is-struck" : ""}`}>
                    {info.x ? <XLink x={info.x} className="inv__xlead" /> : null}
                    {who.name}
                    {info.x ? <XCheck x={info.x} /> : who.claimed ? <SealCheck className="inv__claimed" weight="fill" aria-label="claimed name" /> : null}
                  </p>
                  <p className="inv__addr num">
                    <a href={addrUrl(info.addr)} target="_blank" rel="noreferrer">
                      {short(info.addr)}
                    </a>
                    {info.x ? <span> · @{info.x.username}</span> : who.claimed ? null : <span> · no name set</span>}
                  </p>
                  <p className="effect num">
                    <i aria-hidden="true" />
                    {stamp.word}
                  </p>
                  <p className="inv__line">{stamp.line}</p>
                  {info.status !== "hopped" && info.status !== "not-holding" && info.status !== "excluded" && info.firstIn ? <ArmorLine firstIn={info.firstIn} /> : null}
                </div>
              </div>
              <Goal info={info} pond={pond} status={status} />
              <dl className="inv__stats">
                {info.status === "waiting" && info.eligibleAt ? (
                  <div className="slot is-wide">
                    <Icon name="miner" size={26} />
                    <dt>Spawns in</dt>
                    <dd>
                      <Countdown to={info.eligibleAt} />
                    </dd>
                  </div>
                ) : (
                  <div className="slot is-wide">
                    <Icon name="world" size={26} />
                    <dt>Held for</dt>
                    <dd>{info.status === "hopped" ? <span className="num">{info.padDays}d, then sold</span> : <Held since={info.firstIn} />}</dd>
                  </div>
                )}
                <div className="slot">
                  <Icon name="ingot" size={26} />
                  <dt>Holds</dt>
                  <dd className="num">{amount(info.balance)}</dd>
                </div>
                <div className="slot">
                  <Icon name="eth" size={26} />
                  <dt>Paid so far</dt>
                  <dd className="num">{eth(info.received)}</dd>
                </div>
                <div className="slot">
                  <Icon name={last.icon} size={26} />
                  <dt>{last.k}</dt>
                  <dd className="num">
                    {info.status === "hopped" && info.hoppedTx ? (
                      <a href={txUrl(info.hoppedTx)} target="_blank" rel="noreferrer">
                        {last.v}
                      </a>
                    ) : (
                      last.v
                    )}
                  </dd>
                </div>
              </dl>
              <div className="inv__acts">
                <ShareCard info={info} word={stamp.word} />
                <button type="button" className="inv__share num" onClick={share}>
                  {linked ? <Check weight="bold" aria-hidden="true" /> : <LinkSimple weight="bold" aria-hidden="true" />}
                  {linked ? "Link copied" : "Copy link"}
                </button>
              </div>
            </article>
          ) : (
            <div className="gui inv is-blank">
              <p className="gui__title">Inventory</p>
              <div className="inv__empty">
                {Array.from({ length: 18 }, (_, k) => (
                  <span key={k} className="slot" />
                ))}
              </div>
              <p className="inv__hint num">Check a wallet, or click a miner on the island.</p>
            </div>
          )}
          {info && info.status !== "not-holding" && (info.status !== "excluded" || info.house) ? (
            <ChangingRoom key={info.addr} info={info} flash={xFlash} onSaved={(patch) => setInfo(DEMO ? demoWallet(info.addr) : { ...info, ...patch })} />
          ) : info && info.status === "not-holding" ? (
            // Say why the room is shut instead of leaving a connected holder guessing.
            <p className="help">
              {live
                ? `Names, skins and X links are for wallets holding ${TICKER}. Buy in, then come back.`
                : `Opens at launch: once ${TICKER} trades, any holder can set a name, pick a skin or link X here.`}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
