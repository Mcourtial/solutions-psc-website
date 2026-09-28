// Tiny deterministic motion engine: every value is a pure function of time.

export const W = 1920;
export const H = 1080;
export const FPS = 60;
export const SHUTTER = 0.6; // fraction of a frame the virtual shutter stays open

export const C = {
  navy: '#1B3160',
  blue: '#4A6AB3',
  grey: '#8E8E8E',
  night: '#070B18',
  ink: '#0A1022',
  deep: '#13244A',
  paper: '#F4F5F8',
  white: '#FFFFFF',
  mist: '#C3CAD6',
  sky: '#9DB4E8',
  line: '#DFE3EA',
};

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, start, dur) => clamp((t - start) / dur);

export const E = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - (1 - x) ** 3,
  inOutCubic: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  inQuart: (x) => x ** 4,
  outQuart: (x) => 1 - (1 - x) ** 4,
  inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),
  outQuint: (x) => 1 - (1 - x) ** 5,
  inExpo: (x) => (x <= 0 ? 0 : 2 ** (10 * x - 10)),
  outExpo: (x) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  inOutExpo: (x) =>
    x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2,
  outBack: (x) => {
    const c1 = 1.70158;
    return 1 + (c1 + 1) * (x - 1) ** 3 + c1 * (x - 1) ** 2;
  },
};

/** Damped spring response from 0 to 1 (overshoots, then settles). */
export const spring = (t, freq = 3, damp = 7) =>
  t <= 0 ? 0 : 1 - Math.exp(-damp * t) * Math.cos(2 * Math.PI * freq * t);

/** Decaying oscillation starting at 0: a "boing" impulse. */
export const wobble = (t, freq = 3, damp = 8) =>
  t <= 0 ? 0 : Math.exp(-damp * t) * Math.sin(2 * Math.PI * freq * t);

/** Decaying cosine starting at 1: squash that recovers. */
export const squash = (t, freq = 4, damp = 12) =>
  t <= 0 ? 0 : Math.exp(-damp * t) * Math.cos(2 * Math.PI * freq * t);

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 17.13), hash(i + 1 + seed * 17.13), u) * 2 - 1;
}

const rgbCache = new Map();
export function hexToRgb(hex) {
  let v = rgbCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    rgbCache.set(hex, v);
  }
  return v;
}

export function mix(a, b, t) {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const k = clamp(t);
  return `rgb(${Math.round(lerp(x[0], y[0], k))},${Math.round(lerp(x[1], y[1], k))},${Math.round(lerp(x[2], y[2], k))})`;
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export const F = {
  display: (s) => `800 ${s}px "Inter Tight"`,
  bold: (s) => `700 ${s}px "Inter Tight"`,
  medium: (s) => `500 ${s}px "Inter Tight"`,
  serif: (s) => `italic 400 ${s}px "Instrument Serif"`,
  brand: (s) => `400 ${s}px "Questrial"`,
  mono: (s) => `500 ${s}px "JetBrains Mono"`,
};

const layoutCache = new Map();

/** Per-character x offsets (kerning preserved) plus optional tracking. */
export function layout(ctx, text, font, tracking = 0) {
  const key = `${font}|${tracking}|${text}`;
  let L = layoutCache.get(key);
  if (L) return L;
  ctx.save();
  ctx.font = font;
  const chars = [...text];
  const xs = [];
  let prefix = '';
  for (let i = 0; i < chars.length; i++) {
    xs.push(ctx.measureText(prefix).width + i * tracking);
    prefix += chars[i];
  }
  const width = ctx.measureText(text).width + Math.max(0, chars.length - 1) * tracking;
  ctx.restore();
  L = { chars, xs, width };
  layoutCache.set(key, L);
  return L;
}

export function alignX(x, width, align) {
  return align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
}

/**
 * Letters rise out of a mask one after another.
 * Returns the left edge and width so callers can attach decorations.
 */
export function revealText(ctx, text, x, y, o) {
  const {
    font, size, color, t, start,
    stagger = 0.02, dur = 0.5, align = 'left', tracking = 0,
    ease = E.outExpo, rise = 1.05, rot = 0, alpha = 1, mask = true,
    outStart = Infinity, outDur = 0.3, stroke = 0,
  } = o;
  const L = layout(ctx, text, font, tracking);
  const x0 = alignX(x, L.width, align);
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.globalAlpha *= alpha;
  if (stroke) {
    ctx.strokeStyle = color;
    ctx.lineWidth = stroke;
  } else {
    ctx.fillStyle = color;
  }
  if (mask) {
    ctx.beginPath();
    ctx.rect(x0 - size, y - size * 1.08, L.width + size * 2, size * 1.42);
    ctx.clip();
  }
  const n = L.chars.length;
  for (let i = 0; i < n; i++) {
    const p = ease(prog(t, start + i * stagger, dur));
    if (p <= 0) continue;
    const q = E.inExpo(prog(t, outStart + i * stagger * 0.6, outDur));
    if (q >= 1) continue;
    const dy = (1 - p) * size * rise - q * size * rise;
    const ch = L.chars[i];
    if (ch === ' ') continue;
    const cx = x0 + L.xs[i];
    if (rot) {
      ctx.save();
      ctx.translate(cx, y + dy);
      ctx.rotate((1 - p) * rot);
      if (stroke) ctx.strokeText(ch, 0, 0);
      else ctx.fillText(ch, 0, 0);
      ctx.restore();
    } else if (stroke) {
      ctx.strokeText(ch, cx, y + dy);
    } else {
      ctx.fillText(ch, cx, y + dy);
    }
  }
  ctx.restore();
  return { x0, width: L.width };
}

/** Plain text with tracking, no animation. */
export function trackedText(ctx, text, x, y, font, color, tracking = 0, align = 'left') {
  const L = layout(ctx, text, font, tracking);
  const x0 = alignX(x, L.width, align);
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if (!tracking) ctx.fillText(text, x0, y);
  else for (let i = 0; i < L.chars.length; i++) ctx.fillText(L.chars[i], x0 + L.xs[i], y);
  ctx.restore();
  return { x0, width: L.width };
}

/** Typewriter: characters appear over [start, start+dur] with a block cursor. */
export function typeText(ctx, text, x, y, o) {
  const { font, size, color, t, start, dur, tracking = 0, align = 'left', cursor = true, cursorUntil = start + dur + 0.15 } = o;
  const L = layout(ctx, text, font, tracking);
  const x0 = alignX(x, L.width, align);
  const n = L.chars.length;
  const k = Math.floor(prog(t, start, dur) * n + 1e-6);
  if (t < start) return;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < k; i++) ctx.fillText(L.chars[i], x0 + L.xs[i], y);
  if (cursor && t < cursorUntil) {
    const cx = k < n ? x0 + L.xs[k] : x0 + L.width + tracking;
    ctx.fillRect(cx + 2, y - size * 0.78, size * 0.55, size * 0.95);
  }
  ctx.restore();
}

export function disc(ctx, x, y, r, color, sx = 1, sy = 1) {
  if (r <= 0) return;
  ctx.beginPath();
  if (sx === 1 && sy === 1) ctx.arc(x, y, r, 0, Math.PI * 2);
  else ctx.ellipse(x, y, r * sx, r * sy, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

export function ring(ctx, x, y, r, color, width) {
  if (r <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Stroke the first `p` (0..1) of a polyline's length. */
export function partialPath(ctx, pts, p) {
  if (p <= 0 || pts.length < 2) return;
  let total = 0;
  const seg = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let remain = total * clamp(p);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && remain > 0; i++) {
    const d = seg[i - 1];
    const k = Math.min(1, remain / d);
    ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k));
    remain -= d;
  }
  ctx.stroke();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Fill the whole frame regardless of the current transform. */
export function fillBg(ctx, color) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function vignette(ctx, strength, color = '#000000') {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(1, rgba(color, strength));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
