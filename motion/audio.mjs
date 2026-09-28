// Synthesises the soundtrack (120 BPM, A major) straight from the film's timeline.
//   node audio.mjs  → out/soundtrack.wav (48 kHz, 24-bit stereo)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { T, TERMS_LIST, DURATION } from './scenes.js';
import { rng } from './engine.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const DUR = DURATION;
const N = SR * DUR;
const TAU = Math.PI * 2;

// Buses: music (gated for the freeze), fx (never gated), reverb send.
const bus = () => [new Float32Array(N), new Float32Array(N)];
const MUSIC = bus();
const FX = bus();
const SEND = bus();

const rand = rng(1234);
const white = () => rand() * 2 - 1;

const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function hz(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  const midi = NOTE[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

function write(b, i, l, r, send) {
  if (i < 0 || i >= N) return;
  b[0][i] += l;
  b[1][i] += r;
  if (send) {
    SEND[0][i] += l * send;
    SEND[1][i] += r * send;
  }
}
const panLR = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];

class Biquad {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; this.c = [1, 0, 0, 0, 0]; }
  set(type, f, q) {
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const cw = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    let b0; let b1; let b2;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    const a0 = 1 + a;
    this.c = [b0 / a0, b1 / a0, b2 / a0, (-2 * cw) / a0, (1 - a) / a0];
  }
  run(x) {
    const [b0, b1, b2, a1, a2] = this.c;
    const y = b0 * x + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// ─── Instruments ─────────────────────────────────────────────────────────
function kick(t0, amp = 1, b = MUSIC) {
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let n = 0; n < SR * 0.5; n++) {
    const u = n / SR;
    const f = 46 + 150 * Math.exp(-u * 30);
    ph += (TAU * f) / SR;
    let s = Math.sin(ph) * Math.exp(-u * 6.5);
    if (u < 0.004) s += white() * 0.5 * (1 - u / 0.004);
    s = Math.tanh(s * 1.6) * amp * 0.5 * Math.min(1, (0.5 - u) / 0.02);
    write(b, i0 + n, s, s, 0.02);
  }
}

function noise(o) {
  const { t0, dur, amp, type = 'bp', f0, f1 = f0, q = 1, env, pan0 = 0, pan1 = pan0, send = 0, b = MUSIC } = o;
  const i0 = Math.round(t0 * SR);
  const len = Math.round(dur * SR);
  const fl = new Biquad();
  const fr = new Biquad();
  for (let n = 0; n < len; n++) {
    const x = n / len;
    if (n % 32 === 0) {
      const f = f0 * (f1 / f0) ** x;
      fl.set(type, f, q);
      fr.set(type, f, q);
    }
    const g = env(x, n / SR) * amp;
    const [pl, pr] = panLR(pan0 + (pan1 - pan0) * x);
    write(b, i0 + n, fl.run(white()) * g * pl, fr.run(white()) * g * pr, send);
  }
}

const hat = (t0, amp, open = false) => noise({
  t0, dur: open ? 0.25 : 0.06, amp, type: 'hp', f0: 7500, q: 0.8,
  env: (x, u) => Math.exp(-u * (open ? 14 : 55)), pan0: 0.25, send: 0.05,
});

function clap(t0, amp) {
  for (const d of [0, 0.011, 0.023]) {
    noise({ t0: t0 + d, dur: 0.03, amp: amp * 0.8, f0: 1500, q: 1.3, env: (x, u) => Math.exp(-u * 140), send: 0.2 });
  }
  noise({ t0: t0 + 0.023, dur: 0.25, amp, f0: 1200, q: 0.9, env: (x, u) => Math.exp(-u * 16), send: 0.35 });
}

function tick(t0, amp, pan = 0, b = MUSIC) {
  noise({ t0, dur: 0.012, amp, type: 'hp', f0: 3500, q: 0.7, env: (x) => 1 - x, pan0: pan, send: 0.05, b });
}

function whoosh(t0, dur, amp, f0, f1, pan0 = 0, pan1 = pan0, b = MUSIC) {
  noise({
    t0, dur, amp, f0, f1, q: 1.6, pan0, pan1, send: 0.25, b,
    env: (x) => (x ** 1.6 * (1 - x) ** 0.6) * 2.6,
  });
}

function reverseCymbal(t0, dur, amp, b = MUSIC) {
  noise({ t0, dur, amp, type: 'hp', f0: 2500, f1: 6000, q: 0.7, env: (x) => x ** 3.5, send: 0.3, b });
}

function riser(t0, dur, amp) {
  noise({ t0, dur, amp: amp * 0.7, type: 'bp', f0: 500, f1: 7000, q: 2.2, env: (x) => x ** 2, send: 0.3 });
  const i0 = Math.round(t0 * SR);
  const len = Math.round(dur * SR);
  let ph = 0;
  for (let n = 0; n < len; n++) {
    const x = n / len;
    const f = 180 * 4 ** x;
    ph += (TAU * f) / SR;
    let s = 0;
    for (let k = 1; k <= 6; k++) s += Math.sin(ph * k) / k;
    const trem = 0.75 + 0.25 * Math.sin(TAU * (4 + 20 * x) * x * dur);
    s *= x ** 2.4 * amp * 0.12 * trem;
    write(MUSIC, i0 + n, s, s, 0.4);
  }
}

function impact(t0, amp, b = MUSIC) {
  kick(t0, amp, b);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let n = 0; n < SR * 2; n++) {
    const u = n / SR;
    const f = 32 + 40 * Math.exp(-u * 2.5);
    ph += (TAU * f) / SR;
    const s = Math.sin(ph) * Math.exp(-u * 1.7) * amp * 0.55 * Math.min(1, (2 - u) / 0.05);
    write(b, i0 + n, s, s, 0);
  }
  noise({ t0, dur: 2.2, amp: amp * 0.35, type: 'lp', f0: 9000, f1: 1200, q: 0.6, env: (x, u) => Math.exp(-u * 2.6), send: 0.6, b });
  noise({ t0, dur: 0.5, amp: amp * 0.5, type: 'lp', f0: 260, q: 0.8, env: (x, u) => Math.exp(-u * 7), send: 0.3, b });
}

/** Mallet/bell: sine body with an FM strike on top. */
function mallet(t0, f, amp, pan = 0, send = 0.35, decay = 0.9, b = MUSIC) {
  const i0 = Math.round(t0 * SR);
  const [pl, pr] = panLR(pan);
  let pc = 0;
  let pm = 0;
  for (let n = 0; n < SR * decay * 2.2; n++) {
    const u = n / SR;
    pm += (TAU * f * 3.5) / SR;
    pc += (TAU * f) / SR;
    const idx = 2.6 * Math.exp(-u * 22);
    const env = Math.min(1, u / 0.0015) * Math.exp(-u / (decay * 0.42));
    const s = (Math.sin(pc + idx * Math.sin(pm)) * 0.8 + Math.sin(pc * 2) * 0.12 * Math.exp(-u * 6)) * env * amp;
    write(b, i0 + n, s * pl, s * pr, send);
  }
}

/** Karplus–Strong pluck. */
function pluck(t0, f, amp, pan = 0) {
  const i0 = Math.round(t0 * SR);
  const len = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(len);
  for (let k = 0; k < len; k++) buf[k] = white();
  const [pl, pr] = panLR(pan);
  let p = 0;
  let last = 0;
  for (let n = 0; n < SR * 0.6; n++) {
    const a = buf[p];
    const nb = buf[(p + 1) % len];
    const v = 0.996 * 0.5 * (a + nb);
    buf[p] = v;
    p = (p + 1) % len;
    last = last * 0.4 + a * 0.6;
    const s = last * amp * Math.exp(-(n / SR) * 4) * Math.min(1, (0.6 - n / SR) / 0.03);
    write(MUSIC, i0 + n, s * pl, s * pr, 0.25);
  }
}

function blip(t0, f, amp, pan = 0, b = MUSIC) {
  const i0 = Math.round(t0 * SR);
  const [pl, pr] = panLR(pan);
  let ph = 0;
  for (let n = 0; n < SR * 0.09; n++) {
    const u = n / SR;
    ph += (TAU * f * (1 + 0.5 * Math.exp(-u * 80))) / SR;
    const s = Math.sin(ph) * Math.exp(-u * 45) * amp * Math.min(1, u / 0.001);
    write(b, i0 + n, s * pl, s * pr, 0.2);
  }
}

function glitch(t0, dur, amp) {
  const i0 = Math.round(t0 * SR);
  const len = Math.round(dur * SR);
  let hold = 0;
  let v = 0;
  const pan = white() * 0.6;
  const [pl, pr] = panLR(pan);
  for (let n = 0; n < len; n++) {
    if (hold-- <= 0) { v = white() > 0 ? 1 : -1; hold = 8 + Math.floor(rand() * 90); }
    const s = v * amp * (1 - n / len) * 0.5;
    write(MUSIC, i0 + n, s * pl, s * pr, 0.1);
  }
}

/** Band-limited (polyBLEP) detuned saws through a 2-pole low-pass with moving cutoff. */
function pad(t0, t1, notes, amp, cutoff, attack = 0.25, release = 0.35, send = 0.45) {
  const i0 = Math.round(t0 * SR);
  const len = Math.round((t1 - t0 + release) * SR);
  const voices = [];
  notes.forEach((nm, j) => {
    const f = typeof nm === 'number' ? nm : hz(nm);
    for (const [d, p] of [[-0.12, -0.7], [0, 0], [0.12, 0.7]]) {
      voices.push({ f: f * 2 ** (d / 12 * 0.6), ph: rand(), pan: p * (j % 2 ? 1 : -1) });
    }
  });
  const polyblep = (t, dt) => {
    if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
    if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
    return 0;
  };
  let l1 = 0; let l2 = 0; let r1 = 0; let r2 = 0;
  const hold = (t1 - t0) * SR;
  const gain = amp / Math.sqrt(voices.length);
  for (let n = 0; n < len; n++) {
    const tt = t0 + n / SR;
    const env = Math.min(1, n / (attack * SR)) * (n > hold ? Math.max(0, 1 - (n - hold) / (release * SR)) : 1);
    let L = 0;
    let R = 0;
    for (const v of voices) {
      const dt = v.f / SR;
      v.ph += dt;
      if (v.ph >= 1) v.ph -= 1;
      const s = 2 * v.ph - 1 - polyblep(v.ph, dt);
      const [pl, pr] = panLR(v.pan);
      L += s * pl;
      R += s * pr;
    }
    const fc = typeof cutoff === 'function' ? cutoff(tt) : cutoff;
    const a = 1 - Math.exp((-TAU * fc) / SR);
    l1 += a * (L - l1); l2 += a * (l1 - l2);
    r1 += a * (R - r1); r2 += a * (r1 - r2);
    write(MUSIC, i0 + n, l2 * env * gain, r2 * env * gain, send);
  }
}

const stab = (t0, notes, amp) => pad(t0, t0 + 0.06, notes, amp, (t) => 600 + 3200 * Math.exp(-(t - t0) * 9), 0.004, 0.3, 0.4);

function bassNote(t0, dur, f, amp) {
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  for (let n = 0; n < dur * SR; n++) {
    const u = n / SR;
    ph += (TAU * f) / SR;
    const env = Math.min(1, u / 0.004) * Math.exp(-u * 7) * Math.min(1, (dur - u) / 0.012);
    const s = Math.tanh((Math.sin(ph) + 0.35 * Math.sin(2 * ph)) * 1.4) * env * amp * 0.65;
    write(MUSIC, i0 + n, s, s, 0);
  }
}

// ─── Score ───────────────────────────────────────────────────────────────
const motif = ['A4', 'C#5', 'E5'].map(hz);
const beats = (a, b, step) => {
  const out = [];
  for (let t = a; t < b - 1e-6; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
};

// 1 · Ouverture
pad(0, 2.0, ['A1', 'E2', 'A2', 'E3'], 0.16, (t) => 180 + 1100 * (t / 2) ** 2, 0.8, 0.25);
noise({ t0: 0.03, dur: 0.45, amp: 0.1, type: 'hp', f0: 1500, f1: 9000, q: 0.7, env: (x) => (1 - x) ** 2 * Math.min(1, x * 20), send: 0.3 });
for (let k = 0; k < 11; k++) tick(0.12 + k * 0.016, 0.05, 0.3);
T.drops.forEach((ti, i) => {
  whoosh(ti - 0.3, 0.3, 0.09, 3000, 700, (i - 1) * 0.3);
  mallet(ti, motif[i], 0.34, (i - 1) * 0.35);
  kick(ti, 0.42);
});
{
  // Orbit whoosh that pans with the spin.
  const t0 = 1.08;
  const dur = 0.72;
  const i0 = Math.round(t0 * SR);
  const f = new Biquad();
  for (let n = 0; n < dur * SR; n++) {
    const u = n / SR;
    const x = u / dur;
    if (n % 32 === 0) f.set('bp', 300 * 12 ** x, 1.4);
    const spin = 2 * Math.PI * 1.4 * (u / 0.7) ** 2;
    const [pl, pr] = panLR(Math.sin(spin) * 0.8);
    const s = f.run(white()) * x ** 1.2 * 0.5 * Math.min(1, (1 - x) / 0.18);
    write(MUSIC, i0 + n, s * pl, s * pr, 0.3);
  }
}
riser(1.3, 0.7, 0.9);
reverseCymbal(1.4, 0.6, 0.22);

// 2 · Santé. Prévoyance. Retraite. — one chord per word, a groove under the hold.
impact(T.words[0], 1.0);
const wordChords = [['A3', 'C#4', 'E4', 'A4'], ['F#3', 'A3', 'C#4', 'F#4'], ['D3', 'F#3', 'A3', 'D4']];
const wordPads = [['A2', 'E3', 'A3', 'C#4'], ['F#2', 'C#3', 'F#3', 'A3'], ['D2', 'A2', 'D3', 'F#3']];
const wordBass = ['A1', 'F#1', 'D2'];
T.words.forEach((tw, k) => {
  const end = tw + T.wordLen;
  if (k > 0) kick(tw, 0.9);
  stab(tw, wordChords[k], 0.28);
  pad(tw, end - 0.05, wordPads[k], 0.07, 1400, 0.02, 0.08, 0.35);
  beats(tw + 0.5, end, 0.5).forEach((b) => kick(b, 0.7));
  clap(tw + 1.0, 0.18);
  beats(tw + 0.25, end, 0.5).forEach((b) => hat(b, 0.08));
  beats(tw, end - 0.1, 0.25).forEach((b) => bassNote(b, 0.22, hz(wordBass[k]), 0.26));
  for (let j = 0; j < 26; j++) tick(tw + 0.04 + j * 0.0115, 0.02, -0.4);
  blip(tw + 0.12, 1320, 0.07);
  whoosh(end - 0.21, 0.22, 0.26, 500, 6500);
});
impact(T.chaos, 0.55);

// 3 · Complexité
const CH = T.freeze - T.chaos;
pad(T.chaos, T.freeze, ['F2', 'C3', 'G3', 'B3', 'E4'], 0.13, (t) => 350 + 2400 * ((t - T.chaos) / CH) ** 2, 0.4, 0.05);
for (const t of beats(T.chaos, T.freeze - 0.01, 0.125)) bassNote(t, 0.12, hz('F2'), 0.12 + 0.12 * ((t - T.chaos) / CH));
[...beats(T.chaos + 0.5, T.freeze, 0.5), T.shock - 0.25].forEach((t) => kick(t, 0.85));
beats(T.chaos + 1.0, T.freeze, 1.0).forEach((t) => clap(t, 0.22));
for (const t of beats(T.chaos + 0.25, T.freeze, 0.25)) hat(t, 0.07);
for (const t of beats(T.chaos + 1.5, T.freeze, 0.125)) hat(t, 0.03 + 0.04 * ((t - T.chaos - 1.5) / (CH - 1.5)));
const lydian = ['F5', 'G5', 'A5', 'C6', 'E6', 'G6'].map(hz);
for (const term of TERMS_LIST) {
  const f = lydian[term.i % lydian.length];
  blip(term.tA, f, 0.055, (term.x / 1920) * 1.6 - 0.8);
  tick(term.tA + 0.07, 0.04, (term.x / 1920) * 1.6 - 0.8);
}
reverseCymbal(T.headline - 0.3, 0.3, 0.1);
impact(T.headline, 0.45);
for (let t = T.freeze - 0.86; t < T.freeze; t += 0.0625) if (rand() < 0.25 + (t - T.freeze + 0.86) * 0.5) glitch(t, 0.035, 0.12);
riser(T.freeze - 1.01, 1.0, 1.0);
reverseCymbal(T.shock - 0.75, 0.74, 0.3, FX);
mallet(T.freeze, hz('A6'), 0.08, 0, 0.9, 1.4, FX);

// 4–6 · Ordre → Méthode → Indépendance: one continuous groove.
impact(T.shock, 1.25);
const chords = [
  [T.shock, T.shock + 2.0, ['A2', 'E3', 'A3', 'C#4', 'E4'], 'A1'],
  [T.shock + 2.0, T.method, ['D3', 'A3', 'D4', 'F#4'], 'D2'],
  [T.method, T.method + 2.0, ['F#2', 'C#3', 'F#3', 'A3', 'C#4'], 'F#1'],
  [T.method + 2.0, T.indep, ['E2', 'B2', 'E3', 'G#3', 'B3'], 'E1'],
  [T.indep, T.iris + 0.22, ['D2', 'A2', 'D3', 'F#3', 'A3'], 'D2'],
];
chords.forEach(([a, b, notes], i) => pad(a, b, notes, i === 4 ? 0.12 : 0.13 - i * 0.003, i === 4 ? 2800 : 2500, i === 0 ? 0.02 : 0.05, i === 4 ? 0.08 : 0.2));
const root = (t) => chords.find(([a, b]) => t >= a && t < b)?.[3] || 'D2';
for (const t of beats(T.shock, T.logo - 0.25, 0.25)) bassNote(t, 0.24, hz(root(t)), 0.24);
beats(T.shock + 0.5, T.logo - 0.1, 0.5).forEach((t) => kick(t, 0.85));
beats(T.shock + 0.5, T.logo - 0.1, 1.0).forEach((t) => clap(t, 0.26));
beats(T.shock + 0.25, T.method, 0.5).forEach((t, k) => hat(t, 0.09, k % 4 === 3));
beats(T.method, T.indep, 0.125).forEach((t) => hat(t, Math.round(t * 8) % 2 ? 0.05 : 0.09));
beats(T.indep + 0.25, T.logo - 0.1, 0.5).forEach((t) => hat(t, 0.08));
T.verbs.forEach((tv, k) => {
  whoosh(tv - 0.14, 0.2, 0.08, 800, 4000);
  mallet(tv, motif[k], 0.32, (k - 1) * 0.5);
  blip(tv + 0.3, 1760, 0.05, (k - 1) * 0.5);
});
for (let j = 0; j < 6; j++) tick(T.subline + j * 0.07, 0.035);
whoosh(T.whip - 0.06, 0.44, 0.45, 250, 7000, 0.8, -0.8);

const nodeNotes = ['E5', 'F#5', 'A5', 'C#6'].map(hz);
T.nodes.forEach((tn, i) => {
  mallet(tn, nodeNotes[i], 0.28, -0.6 + i * 0.4);
  mallet(tn + 0.01, nodeNotes[i] * 2, 0.05, -0.6 + i * 0.4, 0.7, 1.2);
  if (i > 0) whoosh(tn - 0.46, 0.46, 0.05, 900, 3000, -1.0 + i * 0.4, -0.6 + i * 0.4);
});
const arp = (t) => (t < T.method + 2.0 ? ['F#4', 'A4', 'C#5', 'F#5'] : ['E4', 'G#4', 'B4', 'E5']).map(hz);
beats(T.method, T.shutter - 0.1, 0.125).forEach((t, k) => pluck(t, arp(t)[k % 4], 0.12, k % 2 ? 0.45 : -0.45));

for (let j = 0; j < 8; j++) {
  noise({ t0: T.shutter + j * 0.016 + 0.17, dur: 0.05, amp: 0.12, f0: 2600, q: 3, env: (x, u) => Math.exp(-u * 90), pan0: -0.8 + j * 0.23, send: 0.1 });
}
whoosh(T.shutter - 0.05, 0.3, 0.2, 400, 5000, -0.6, 0.6);
impact(T.indep, 0.7);
stab(T.indep, ['D3', 'F#3', 'A3', 'D4'], 0.22);
for (let j = 0; j < 30; j++) tick(T.indep + 0.04 + j * 0.01, 0.02, 0.2);
[0, 1, 2].forEach((j) => blip(T.indep + 0.2 + j * 0.09, [1320, 1480, 1760][j], 0.09, -0.4 + j * 0.4));
blip(T.indep + 0.3, 990, 0.07);
whoosh(T.iris - 0.02, 0.32, 0.4, 7000, 250, 0, 0, FX);
reverseCymbal(T.iris - 0.08, 0.37, 0.28, FX);

// 7 · Signature
const L0 = T.logo;
impact(L0, 1.1, FX);
pad(L0, DUR - 0.6, ['A2', 'E3', 'A3', 'B3', 'C#4', 'E4'], 0.13, (t) => 3000 - 1700 * ((t - L0) / (DUR - L0)), 0.01, 0.5, 0.55);
[L0, L0 + 0.06, L0 + 0.14].forEach((t, i) => mallet(t, motif[i], 0.3, (i - 1) * 0.4, 0.4, 0.9, FX));
whoosh(L0 + 0.4, 0.5, 0.12, 600, 3500, 0.3, -0.1, FX);
const sparkle = ['A6', 'B6', 'C#7', 'E7', 'F#6', 'E6'].map(hz);
for (let j = 0; j < 14; j++) blip(L0 + 0.6 + j * 0.028, sparkle[j % sparkle.length], 0.025, white() * 0.7, FX);
mallet(L0 + 1.35, hz('E6'), 0.14, 0.2, 0.8, 1.5, FX);
mallet(L0 + 1.36, hz('A6'), 0.06, -0.2, 0.8, 1.5, FX);
for (let j = 0; j < 16; j++) tick(L0 + 1.78 + j * 0.0225, 0.045, 0, FX);
noise({ t0: L0 + 2.0, dur: 0.7, amp: 0.05, type: 'hp', f0: 6000, f1: 11000, q: 0.7, env: (x) => Math.sin(Math.PI * x), pan0: -0.6, pan1: 0.6, send: 0.4, b: FX });
['A5', 'C#6', 'E6'].forEach((nm, i) => mallet(L0 + 2.25 + i * 0.15, hz(nm), 0.17, (i - 1) * 0.5, 0.6, 1.0, FX));

// ─── Mix ─────────────────────────────────────────────────────────────────
function gate(t) {
  const ramp = (a, b) => Math.min(1, Math.max(0, Math.min((t - a) / 0.004, (b - t) / 0.004)));
  const cuts = [[T.freeze + 0.004, T.shock - 0.004, 0.04], [T.logo - 0.07, T.logo - 0.003, 0.25]];
  let g = 1;
  for (const [a, b, floor] of cuts) g = Math.min(g, 1 - (1 - floor) * ramp(a, b));
  return g;
}

function freeverb(inp, spread) {
  const scale = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0, store: 0 }));
  const aps = [556, 441, 341, 225].map((d) => ({ buf: new Float32Array(Math.round((d + spread) * scale)), i: 0 }));
  const out = new Float32Array(N);
  const fb = 0.86;
  const damp = 0.25;
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.015;
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * fb;
      c.i = (c.i + 1) % c.buf.length;
      s += y;
    }
    for (const a of aps) {
      const b = a.buf[a.i];
      a.buf[a.i] = s + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      s = b - s;
    }
    out[n] = s;
  }
  return out;
}

const wetL = freeverb(SEND[0], 0);
const wetR = freeverb(SEND[1], 23);
const outL = new Float32Array(N);
const outR = new Float32Array(N);
let hpL = 0; let hpR = 0; let pxL = 0; let pxR = 0;
const hpA = Math.exp((-TAU * 25) / SR);
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const g = gate(t);
  let l = (MUSIC[0][n] + wetL[n] * 0.9) * g + FX[0][n];
  let r = (MUSIC[1][n] + wetR[n] * 0.9) * g + FX[1][n];
  // DC / rumble high-pass.
  hpL = hpA * (hpL + l - pxL); pxL = l; l = hpL;
  hpR = hpA * (hpR + r - pxR); pxR = r; r = hpR;
  outL[n] = l;
  outR[n] = r;
}

// Gentle glue: soft clip then normalise to −1 dBFS, fade the tail.
let peak = 0;
let prePeak = 0;
for (let n = 0; n < N; n++) {
  prePeak = Math.max(prePeak, Math.abs(outL[n]), Math.abs(outR[n]));
  outL[n] = Math.tanh(outL[n] * 1.1);
  outR[n] = Math.tanh(outR[n] * 1.1);
  peak = Math.max(peak, Math.abs(outL[n]), Math.abs(outR[n]));
}
const norm = 10 ** (-1 / 20) / peak;
const fadeStart = (DUR - 0.6) * SR;
for (let n = 0; n < N; n++) {
  let g = norm * Math.min(1, n / 240);
  if (n > fadeStart) g *= 0.5 + 0.5 * Math.cos((Math.PI * (n - fadeStart)) / (N - fadeStart));
  outL[n] *= g;
  outR[n] *= g;
}

// 24-bit PCM WAV.
const bytes = N * 2 * 3;
const wav = Buffer.alloc(44 + bytes);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + bytes, 4); wav.write('WAVE', 8);
wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 6, 28); wav.writeUInt16LE(6, 32); wav.writeUInt16LE(24, 34);
wav.write('data', 36); wav.writeUInt32LE(bytes, 40);
let o = 44;
for (let n = 0; n < N; n++) {
  for (const v of [outL[n], outR[n]]) {
    const s = Math.max(-8388608, Math.min(8388607, Math.round(v * 8388607)));
    wav.writeIntLE(s, o, 3);
    o += 3;
  }
}
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true });
const file = path.join(ROOT, 'out', 'soundtrack.wav');
fs.writeFileSync(file, wav);
console.log(`${file}  mix peak ${(20 * Math.log10(prePeak)).toFixed(1)} dBFS before soft clip`);
