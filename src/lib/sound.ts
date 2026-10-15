/**
 * Sound effects, synthesised with Web Audio: no files to load. Off until the visitor turns them on
 * (browsers only allow sound after a click anyway); the choice is remembered on this device.
 * A Reward plays itself here; everything else calls `play`.
 */
import { useEffect, useState } from "react";

export type Sfx = "click" | "ledge" | "beacon" | "levelup" | "lava";

const KEY = "pixaxe:sound";
let on = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();
let ctx: AudioContext | null = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// A choice remembered from an earlier visit can only start sounding after the first click here.
if (typeof window !== "undefined" && on) window.addEventListener("pointerdown", () => audio(), { once: true });

export function soundOn() {
  return on;
}

export function setSound(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
  } catch {
    /* private window: on for this visit only */
  }
  if (v) {
    audio();
    play("click");
  }
  window.dispatchEvent(new Event("pixaxe:soundpref"));
}

export function useSound(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(on);
  useEffect(() => {
    const sync = () => setV(on);
    window.addEventListener("pixaxe:soundpref", sync);
    return () => window.removeEventListener("pixaxe:soundpref", sync);
  }, []);
  return [v, setSound];
}

/** One note: a wave that may slide in pitch, with a short attack and an even fade. */
function note(a: AudioContext, at: number, freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** A burst of noise through a low-pass filter: fizz, sizzle, crumble. */
function hiss(a: AudioContext, at: number, dur: number, vol: number, cutoff: number) {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(cutoff, at);
  f.frequency.exponentialRampToValueAtTime(cutoff / 6, at + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, at);
  src.connect(f).connect(g).connect(a.destination);
  src.start(at);
}

export function play(name: Sfx) {
  if (!on || document.hidden) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  switch (name) {
    case "click":
      note(a, t, 900, 0.04, "square", 0.035);
      break;
    case "ledge":
      // a pop: someone stepped onto a ledge
      note(a, t, 520, 0.09, "triangle", 0.12, 820);
      break;
    case "beacon":
      // the beacon has a new owner: a bright chord that rings out
      [523, 659, 784, 1047].forEach((f, i) => note(a, t + i * 0.05, f, 0.9, "sine", 0.06));
      break;
    case "levelup":
      // a Reward: up the arpeggio, then a sparkle
      [523, 659, 784, 1047, 1319].forEach((f, i) => note(a, t + i * 0.08, f, 0.16, "square", 0.045));
      [2093, 2637].forEach((f, i) => note(a, t + 0.45 + i * 0.06, f, 0.35, "sine", 0.03));
      break;
    case "lava":
      // a sale: a falling cry into the sizzle
      note(a, t, 330, 0.5, "square", 0.05, 60);
      hiss(a, t + 0.3, 0.9, 0.18, 1400);
      break;
  }
}

// Every Reward, however it arrives, levels up out loud.
if (typeof window !== "undefined") window.addEventListener("pixaxe:reward", () => play("levelup"));
