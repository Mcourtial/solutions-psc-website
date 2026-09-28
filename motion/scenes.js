import {
  W, H, C, E, F, clamp, lerp, prog, spring, wobble, squash, rng, noise1, mix, rgba,
  layout, alignX, revealText, trackedText, typeText, disc, ring, partialPath, roundRect,
  fillBg, vignette,
} from './engine.js';
import { T, DURATION } from './timeline.js';

export { T, DURATION };

// Moments with very fast motion get more motion-blur samples.
const FAST = [
  [1.68, 2.06],
  ...T.words.map((w) => [w + T.wordLen - 0.22, w + T.wordLen + 0.06]),
  [T.shock - 0.04, T.shock + 0.32], [T.whip - 0.04, T.whip + 0.38],
  [T.shutter - 0.02, T.shutter + 0.38], [T.iris - 0.04, T.logo + 0.24],
];
export const subframesAt = (t) => (FAST.some(([a, b]) => t >= a && t <= b) ? 24 : 8);

const CX = W / 2;
const CY = H / 2;

// Screen shake from the big hits.
const IMPACTS = [
  [T.words[0], 9], [T.shock, 22], [T.indep, 7], [T.logo, 10],
];
function shake(t) {
  let x = 0;
  let y = 0;
  for (const [ti, a] of IMPACTS) {
    const u = t - ti;
    if (u < 0 || u > 0.5) continue;
    const k = a * Math.exp(-u * 11);
    x += noise1(u * 38, ti) * k;
    y += noise1(u * 38, ti + 5) * k;
  }
  return [x, y];
}

// ─── Scene 1 · Ouverture ─────────────────────────────────────────────────
const BRAND = [C.navy, C.blue, C.grey];
const R0 = 85;
const S0 = R0 * 2 * 0.69;

function introCircle(i, t) {
  const tImp = T.drops[i];
  const fall = 0.32;
  let x = CX + (i - 1) * S0;
  let y = CY;
  let r = R0;
  let sx = 1;
  let sy = 1;
  if (t < tImp - fall) return null;
  if (t < tImp) {
    const p = prog(t, tImp - fall, fall);
    y = lerp(-R0 - 60, CY, p * p);
    sy = 1 + 0.28 * p * p;
    sx = 1 - 0.14 * p * p;
  } else {
    const u = t - tImp;
    const b = u < 0.2 ? Math.sin((Math.PI * u) / 0.2) : u < 0.3 ? 0.28 * Math.sin((Math.PI * (u - 0.2)) / 0.1) : 0;
    y = CY - 46 * b;
    const s = squash(u, 4.2, 13);
    sx = 1 + 0.32 * s;
    sy = 1 - 0.32 * s;
  }
  // Formation → spinning triangle.
  const op = E.inOutCubic(prog(t, 1.08, 0.32));
  if (op > 0) {
    const spin = t > 1.08 ? 2 * Math.PI * 1.4 * ((t - 1.08) / 0.7) ** 2 : 0;
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3 + spin;
    const tx = CX + Math.cos(a) * 150;
    const ty = CY + Math.sin(a) * 150;
    x = lerp(x, tx, op);
    y = lerp(y, ty, op);
    r = lerp(R0, 60, op);
  }
  // Exit: blue takes the frame, the others are flung out.
  if (i === 1) {
    const pc = E.inOutCubic(prog(t, 1.7, 0.2));
    x = lerp(x, CX, pc);
    y = lerp(y, CY, pc);
    r = lerp(r, 1450, E.inExpo(prog(t, 1.74, 0.26)));
  } else {
    const pf = E.inExpo(prog(t, 1.7, 0.3));
    const dx = x - CX;
    const dy = y - CY;
    const d = Math.hypot(dx, dy) || 1;
    x += (dx / d) * 1500 * pf;
    y += (dy / d) * 1500 * pf;
  }
  return { x, y, r, sx, sy };
}

function brandDisc(ctx, c, color, glow) {
  const cy = c.y + c.r * (1 - c.sy); // squash anchored at the floor
  disc(ctx, c.x, cy, c.r, color, c.sx, c.sy);
  if (glow > 0 && c.r < 400) {
    ctx.save();
    const g = ctx.createRadialGradient(c.x - c.r * 0.4, cy - c.r * 0.5, 0, c.x, cy, c.r * 1.05);
    g.addColorStop(0, `rgba(255,255,255,${0.22 * glow})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(c.x, cy, c.r * c.sx, c.r * c.sy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function sceneIntro(ctx, t) {
  fillBg(ctx, C.night);
  ctx.save();
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 900);
  g.addColorStop(0, '#12204A');
  g.addColorStop(1, 'rgba(7,11,24,0)');
  ctx.globalAlpha = E.outCubic(prog(t, 0, 0.8));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Dot grid revealed radially from the centre.
  const R = E.outExpo(prog(t, 0.05, 1.3)) * 1250;
  ctx.fillStyle = '#FFFFFF';
  for (let gx = 24; gx < W; gx += 48) {
    for (let gy = 18; gy < H; gy += 48) {
      const d = Math.hypot(gx - CX, gy - CY);
      const a = clamp((R - d) / 160) * 0.13;
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillRect(gx - 1, gy - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;

  // Registration crosshair.
  const pl = E.outExpo(prog(t, 0.04, 0.55));
  const la = lerp(0.35, 0.07, E.inOutCubic(prog(t, 0.5, 0.6))) * (1 - prog(t, 1.7, 0.2));
  if (pl > 0 && la > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${la})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - (W / 2) * pl, CY);
    ctx.lineTo(CX + (W / 2) * pl, CY);
    ctx.moveTo(CX, CY - (H / 2) * pl);
    ctx.lineTo(CX, CY + (H / 2) * pl);
    ctx.stroke();
    const lp = prog(t, 0.12, 0.25) * (1 - prog(t, 0.42, 0.1));
    if (lp > 0) {
      ctx.globalAlpha = lp;
      typeText(ctx, 'X 960  Y 540', CX + 16, CY - 16, { font: F.mono(13), size: 13, color: '#9DB4E8', t, start: 0.12, dur: 0.18, tracking: 1.5, cursor: false });
      ctx.globalAlpha = 1;
    }
  }

  // Ripples on each landing.
  for (let i = 0; i < 3; i++) {
    const p = prog(t, T.drops[i], 0.75);
    if (p <= 0 || p >= 1) continue;
    const x = CX + (i - 1) * S0;
    ring(ctx, x, CY + R0 * 0.1, R0 + 260 * E.outExpo(p), rgba(i === 2 ? '#BFBFBF' : C.sky, 0.55 * (1 - p)), 2);
  }

  // Light trails while spinning.
  if (t > 1.1 && t < 1.95) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 14; j >= 1; j--) {
      const tj = t - j * 0.011;
      for (const i of [0, 2, 1]) {
        const c = introCircle(i, tj);
        if (!c || c.r > 200) continue;
        ctx.globalAlpha = 0.16 * (1 - j / 15);
        disc(ctx, c.x, c.y, c.r * (1 - j * 0.035), i === 0 ? '#3A5AA8' : BRAND[i]);
      }
    }
    ctx.restore();
  }

  for (const i of [0, 2, 1]) {
    const c = introCircle(i, t);
    if (!c) continue;
    brandDisc(ctx, c, BRAND[i], 1);
    if (i === 0 && c.r < 400) {
      ctx.strokeStyle = 'rgba(157,180,232,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + c.r * (1 - c.sy), c.r * c.sx, c.r * c.sy, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  vignette(ctx, 0.45);
}

// ─── Scene 2 · Santé. Prévoyance. Retraite. ──────────────────────────────
const WORDS = [
  { text: 'Santé', t0: T.words[0], bg: C.blue, fg: C.white, dot: C.navy, label: '01 — FRAIS DE SANTÉ', num: '01' },
  { text: 'Prévoyance', t0: T.words[1], bg: C.navy, fg: C.white, dot: C.paper, label: '02 — PRÉVOYANCE COLLECTIVE', num: '02' },
  { text: 'Retraite', t0: T.words[2], bg: C.paper, fg: C.navy, dot: C.ink, label: '03 — RETRAITE SUPPLÉMENTAIRE', num: '03' },
];

function sceneWords(ctx, t) {
  const k = t < T.words[1] ? 0 : t < T.words[2] ? 1 : 2;
  const w = WORDS[k];
  const lt = t - w.t0;
  fillBg(ctx, w.bg);

  const size = 232;
  const font = F.display(size);
  const tracking = -size * 0.025;
  const L = layout(ctx, w.text, font, tracking);
  const dotR = size * 0.088;
  const gap = size * 0.045;
  const total = L.width + gap + dotR * 2;
  const x0 = CX - total / 2;
  const base = CY + size * 0.36;
  const dx = x0 + L.width + gap + dotR;
  const dy = base - dotR;

  // Camera: slow push, then a dive into the full stop.
  const end = w.t0 + T.wordLen;
  const dive = E.inExpo(prog(t, end - 0.2, 0.2));
  const scale = 1 + 0.07 * (lt / T.wordLen) + 0.5 * dive;
  ctx.save();
  ctx.translate(dx, dy);
  ctx.scale(scale, scale);
  ctx.translate(-dx, -dy);

  // Giant outlined index drifting behind.
  ctx.save();
  ctx.font = F.display(700);
  ctx.strokeStyle = rgba(w.fg === C.white ? '#FFFFFF' : C.navy, 0.1);
  ctx.lineWidth = 2;
  ctx.strokeText(w.num, 1180 - 70 * lt, 1010);
  ctx.restore();

  // Label typed above the word.
  ctx.globalAlpha = 0.85;
  typeText(ctx, w.label, x0 + 6, base - size * 0.86 - 22, { font: F.mono(21), size: 21, color: w.fg, t, start: w.t0 + 0.04, dur: 0.3, tracking: 2.5 });
  ctx.globalAlpha = 1;

  // Underline sweep.
  const ul = E.outExpo(prog(t, w.t0 + 0.08, 0.35));
  if (ul > 0) {
    ctx.fillStyle = rgba(w.fg === C.white ? '#FFFFFF' : C.navy, 0.35);
    ctx.fillRect(x0 + 6, base + 52, (total - 6) * ul, 2);
  }

  revealText(ctx, w.text, x0, base, {
    font, size, color: w.fg, t, start: w.t0 - 0.03, stagger: 0.024, dur: 0.42, tracking, rise: 1.02, rot: 0.12,
  });

  // The full stop: a brand circle that becomes the next frame.
  const pop = spring(t - (w.t0 + 0.12), 3, 9);
  const grow = E.inExpo(prog(t, end - 0.19, 0.19));
  const r = lerp(dotR * pop, 2600 / scale, grow);
  disc(ctx, dx, dy, r, w.dot);
  ctx.restore();

  if (w.bg !== C.paper) vignette(ctx, 0.22);
}

// ─── Scenes 3 + 4 · Complexité → Ordre ───────────────────────────────────
const TERMS = [
  'URSSAF', 'CCN', 'DUE', 'ANI', 'Loi Évin', 'PER', 'Contrat responsable', '100 % Santé',
  'Portabilité', 'Décret 2012-25', 'Art. L911-1', 'Incapacité', 'Invalidité', 'Décès',
  'Sinistralité', 'Cotisations', 'Garanties', 'Redressement', 'Conformité', 'Mutuelle',
  'Accord d’entreprise', 'Dispenses', 'Catégories objectives', 'Loi Pacte', 'DSN',
  'Degré élevé de solidarité', 'Forfait social', 'Résiliation', 'Ayants droit',
  'Comptes de résultat', 'Renouvellement', 'Surcomplémentaire',
];

const STYLES = ['mono', 'mono', 'bold', 'bold', 'serif', 'outline', 'pill', 'mono', 'bold', 'pill'];
const GRID_COLS = 8;
const GRID_ROWS = 8;
const CELL_W = W / GRID_COLS;
const CELL_H = H / GRID_ROWS;
const SHOCK_R = 1250;
const SHOCK_DUR = 0.7;

function buildTerms() {
  const r = rng(20260927);
  const list = [];
  const N = GRID_COLS * GRID_ROWS;
  for (let i = 0; i < N; i++) {
    const style = STYLES[Math.floor(r() * STYLES.length)];
    let x;
    let y;
    let tries = 0;
    do {
      x = 90 + r() * (W - 180);
      y = 120 + r() * (H - 240);
      tries++;
    } while (tries < 40 && Math.abs(x - CX) < 700 && Math.abs(y - 545) < 175);
    const z = 0.75 + r() * 0.7;
    const u = i / (N - 1);
    const tA = Math.round((T.chaos + 0.4 + (T.freeze - T.chaos - 0.46) * Math.sqrt(u)) * 16) / 16;
    const size = style === 'mono' ? 17 + r() * 7
      : style === 'pill' ? 16 + r() * 3
      : style === 'bold' ? 30 + r() * 26
      : style === 'serif' ? 42 + r() * 30
      : 58 + r() * 36;
    list.push({
      i, text: TERMS[i % TERMS.length], style, x, y, z, tA, size,
      rot: (r() - 0.5) * 0.4,
      vx: (r() - 0.5) * 70,
      vy: (r() - 0.5) * 50,
      spin: (r() - 0.5) * 0.25,
      parent: i > 2 ? Math.floor(r() * i) : -1,
    });
  }
  // Order: sort into columns by x, rows by y → short, mostly parallel paths.
  const byX = [...list].sort((a, b) => a.x - b.x);
  for (let c = 0; c < GRID_COLS; c++) {
    const col = byX.slice(c * GRID_ROWS, (c + 1) * GRID_ROWS).sort((a, b) => a.y - b.y);
    col.forEach((term, row) => {
      term.gx = (c + 0.5) * CELL_W;
      term.gy = (row + 0.5) * CELL_H + 4;
    });
  }
  return list;
}
export const TERMS_LIST = buildTerms();

function chaosCamera(t) {
  const tc = Math.min(t, T.freeze);
  const zoom = 1 + 0.13 * E.inOutCubic(prog(tc, T.chaos, T.freeze - T.chaos + 0.04));
  const rot = -0.035 * E.inOutCubic(prog(tc, T.chaos + 0.3, T.freeze - T.chaos - 0.26));
  const a = 7 * E.inQuad(prog(tc, T.freeze - 1.26, 1.26));
  const shx = noise1(tc * 19, 3) * a;
  const shy = noise1(tc * 19, 9) * a;
  return { zoom, rot, shx, shy, tc };
}

function chaosState(term, t) {
  const cam = chaosCamera(t);
  const age = Math.max(0, cam.tc - term.tA);
  const px = term.x + term.vx * age;
  const py = term.y + term.vy * age;
  const par = 1 + (cam.zoom - 1) * term.z * 1.6;
  let x = CX + (px - CX) * par;
  let y = CY + (py - CY) * par;
  const cr = Math.cos(cam.rot);
  const sr = Math.sin(cam.rot);
  const rx = CX + (x - CX) * cr - (y - CY) * sr;
  const ry = CY + (x - CX) * sr + (y - CY) * cr;
  x = rx + cam.shx * term.z;
  y = ry + cam.shy * term.z;
  return { x, y, rot: term.rot + term.spin * age + cam.rot, scale: term.z * par * 0.85 };
}

// Time at which the shockwave front reaches a point at distance d from the centre.
function shockArrival(d) {
  const f = Math.min(0.999, d / SHOCK_R);
  return T.shock + (SHOCK_DUR * -Math.log2(1 - f)) / 10;
}

function termColor(style) {
  switch (style) {
    case 'mono': return C.mist;
    case 'serif': return C.sky;
    case 'pill': return '#E6EBF5';
    default: return '#FFFFFF';
  }
}

function drawChaosTerm(ctx, term, st, t, fade) {
  const appear = prog(t, term.tA, 0.22);
  if (appear <= 0) return;
  const text = term.style === 'mono' || term.style === 'pill' ? term.text.toUpperCase() : term.text;
  const font = term.style === 'mono' || term.style === 'pill' ? F.mono(term.size)
    : term.style === 'serif' ? F.serif(term.size)
    : term.style === 'outline' ? F.display(term.size)
    : F.bold(term.size);
  const tracking = term.style === 'mono' || term.style === 'pill' ? 2 : 0;
  const L = layout(ctx, text, font, tracking);
  const s = st.scale * (0.6 + 0.4 * E.outBack(appear));
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.rotate(st.rot);
  ctx.scale(s, s);
  ctx.globalAlpha *= fade;
  const x0 = -L.width / 2;
  const top = -term.size * 0.8;
  const hgt = term.size * 1.05;

  // Marker-box wipe: a block sweeps in, then retracts to uncover the text.
  const e2 = E.outExpo(prog(t, term.tA, 0.16));
  const e1 = E.outExpo(prog(t, term.tA + 0.07, 0.2));
  const boxColor = term.style === 'serif' ? C.sky : term.style === 'bold' ? '#FFFFFF' : C.blue;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 12, top - 20, (L.width + 24) * e1, hgt + 40);
  ctx.clip();
  const col = termColor(term.style);
  if (term.style === 'pill') {
    roundRect(ctx, x0 - 18, top - 10, L.width + 36, hgt + 20, (hgt + 20) / 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1.5 / s;
    ctx.stroke();
  }
  trackedTextFill(ctx, L, text, x0, 0, font, col, term.style === 'outline' ? 1.6 / s : 0, term.style === 'mono' ? 0.75 : 1);
  ctx.restore();
  if (e1 < 1) {
    ctx.fillStyle = boxColor;
    const bx0 = x0 - 12 + (L.width + 24) * e1;
    const bx1 = x0 - 12 + (L.width + 24) * e2;
    if (bx1 > bx0) ctx.fillRect(bx0, top - 6, bx1 - bx0, hgt + 12);
  }
  ctx.restore();
}

function trackedTextFill(ctx, L, text, x0, y, font, color, stroke, alpha) {
  ctx.font = font;
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha *= alpha;
  if (stroke) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = stroke;
  } else {
    ctx.fillStyle = color;
  }
  for (let i = 0; i < L.chars.length; i++) {
    if (stroke) ctx.strokeText(L.chars[i], x0 + L.xs[i], y);
    else ctx.fillText(L.chars[i], x0 + L.xs[i], y);
  }
}

function drawGridTerm(ctx, term, x, y, rot, alpha) {
  const text = term.text.toUpperCase();
  const font = F.mono(12.5);
  const L = layout(ctx, text, font, 1.4);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= alpha;
  ctx.font = font;
  ctx.fillStyle = '#9AA3B3';
  const x0 = -L.width / 2;
  for (let i = 0; i < L.chars.length; i++) ctx.fillText(L.chars[i], x0 + L.xs[i], 0);
  ctx.restore();
}

// Order progress for each term (spring with overshoot once the wave passes).
function orderProgress(term, t) {
  if (t < T.shock) return 0;
  const st = chaosState(term, T.freeze);
  const d = Math.hypot(st.x - CX, st.y - CY);
  return spring(t - shockArrival(d) - 0.02, 1.7, 7.5);
}

function drawTerms(ctx, t) {
  const gridFade = lerp(1, 0.42, E.inOutCubic(prog(t, T.shock + 0.55, 0.5)));
  // Connector web.
  ctx.save();
  ctx.lineWidth = 1;
  for (const term of TERMS_LIST) {
    if (term.parent < 0) continue;
    const lp = E.outCubic(prog(t, term.tA + 0.05, 0.22));
    const q = orderProgress(term, t);
    const a = 0.2 * (1 - clamp(q * 2.5));
    if (lp <= 0 || a <= 0) continue;
    const p = TERMS_LIST[term.parent];
    if (t < p.tA) continue;
    const s1 = chaosState(p, t);
    const s2 = chaosState(term, t);
    ctx.strokeStyle = `rgba(157,180,232,${a})`;
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(lerp(s1.x, s2.x, lp), lerp(s1.y, s2.y, lp));
    ctx.stroke();
  }
  ctx.restore();

  for (const term of TERMS_LIST) {
    if (t < term.tA) continue;
    const q = orderProgress(term, t);
    const st = chaosState(term, t);
    if (q <= 0) {
      drawChaosTerm(ctx, term, st, t, 1);
      continue;
    }
    const x = lerp(st.x, term.gx, q);
    const y = lerp(st.y, term.gy, q);
    const rot = lerp(st.rot, 0, clamp(q));
    const qc = clamp(q);
    if (qc < 0.6) drawChaosTerm(ctx, term, { x, y, rot, scale: lerp(st.scale, 0.35, qc) }, t, 1 - qc / 0.6);
    drawGridTerm(ctx, term, x, y, rot, clamp(q * 1.6) * gridFade);
  }
}

function drawGridLines(ctx, t) {
  const p0 = T.shock + 0.08;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.line;
  for (let k = 1; k < GRID_COLS; k++) {
    const x = k * CELL_W;
    const p = E.outExpo(prog(t, p0 + Math.abs(k - 4) * 0.035, 0.7));
    if (p <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(x, CY - (H / 2) * p);
    ctx.lineTo(x, CY + (H / 2) * p);
    ctx.stroke();
  }
  for (let k = 1; k < GRID_ROWS; k++) {
    const y = k * CELL_H;
    const p = E.outExpo(prog(t, p0 + Math.abs(k - 4) * 0.035, 0.7));
    if (p <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(CX - (W / 2) * p, y);
    ctx.lineTo(CX + (W / 2) * p, y);
    ctx.stroke();
  }
  // Registration crosses on intersections.
  ctx.strokeStyle = '#B9C1CE';
  const cp = E.outBack(prog(t, p0 + 0.25, 0.4));
  if (cp > 0) {
    ctx.beginPath();
    for (let a = 1; a < GRID_COLS; a++) {
      for (let b = 1; b < GRID_ROWS; b++) {
        const x = a * CELL_W;
        const y = b * CELL_H;
        const s = 5 * cp;
        ctx.moveTo(x - s, y);
        ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s);
        ctx.lineTo(x, y + s);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function glitchSlices(ctx, t, draw, intensity) {
  // Horizontal slice displacement for the unstable headline.
  const slices = 9;
  const top = 380;
  const bottom = 700;
  const h = (bottom - top) / slices;
  const step = Math.floor(t * 30);
  for (let s = 0; s < slices; s++) {
    const n = noise1(step * 1.7 + s * 3.1, 4);
    const off = Math.abs(n) > 0.45 ? n * 60 * intensity : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top + s * h, W, h + 0.5);
    ctx.clip();
    ctx.translate(off, 0);
    draw();
    ctx.restore();
  }
}

function drawHeadline(ctx, t) {
  const tc = Math.min(t, T.freeze);
  // Soft dark backdrop so the headline reads over the web.
  const bd = prog(t, T.chaos + 0.4, 0.4);
  if (bd > 0) {
    ctx.save();
    const g = ctx.createRadialGradient(CX, 560, 0, CX, 560, 820);
    g.addColorStop(0, `rgba(10,16,34,${0.9 * bd})`);
    g.addColorStop(0.55, `rgba(10,16,34,${0.55 * bd})`);
    g.addColorStop(1, 'rgba(10,16,34,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  const g = E.inQuad(prog(tc, T.freeze - 0.86, 0.85));
  const draw = () => {
    revealText(ctx, 'La protection sociale complémentaire', CX, 462, {
      font: F.brand(50), size: 50, color: 'rgba(255,255,255,0.88)', t: tc, start: T.chaos + 0.02, stagger: 0.011, dur: 0.5, align: 'center', tracking: 1,
    });
    const txt = 'devient complexe.';
    const size = 184;
    const font = F.serif(size);
    const L = layout(ctx, txt, font, 0);
    const x0 = CX - L.width / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 440, W, 260);
    ctx.clip();
    ctx.font = font;
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < L.chars.length; i++) {
      const p = E.outExpo(prog(tc, T.headline + i * 0.028, 0.6));
      if (p <= 0) continue;
      const jx = noise1(tc * 22 + i * 7, 11) * 10 * g;
      const jy = noise1(tc * 22 + i * 5, 12) * 8 * g;
      const x = x0 + L.xs[i] + jx;
      const y = 650 + (1 - p) * size * 0.95 + jy;
      if (g > 0.25) {
        ctx.fillStyle = rgba(C.blue, 0.8 * g);
        ctx.fillText(L.chars[i], x - 7 * g, y);
        ctx.fillStyle = rgba(C.grey, 0.7 * g);
        ctx.fillText(L.chars[i], x + 7 * g, y);
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(L.chars[i], x, y);
    }
    ctx.restore();
  };
  if (g > 0.45) glitchSlices(ctx, tc, draw, g);
  else draw();
}

const CARDS = [
  { x: 500, verb: 'Structurer', color: C.navy, idx: '01', desc: ['Des garanties adaptées', 'aux besoins réels des salariés.'] },
  { x: 960, verb: 'Sécuriser', color: C.blue, idx: '02', desc: ['Prévenir les redressements', 'grâce à une veille continue.'] },
  { x: 1420, verb: 'Piloter', color: C.grey, idx: '03', desc: ['Des comptes suivis de près,', 'un budget maîtrisé dans le temps.'] },
];
const CARD_W = 420;
const CARD_H = 530;
const CARD_TOP = 250;

function drawIcon(ctx, k, cx, cy, t, t0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (k === 0) {
    const bars = [[-26, -18, 52], [-26, 0, 34], [-26, 18, 52]];
    bars.forEach(([x, y, w], j) => {
      const p = E.outExpo(prog(t, t0 + 0.14 + j * 0.07, 0.35));
      if (p <= 0) return;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * p, y);
      ctx.stroke();
    });
  } else if (k === 1) {
    const shield = [[0, -31], [24, -22], [24, 2], [17, 16], [0, 30], [-17, 16], [-24, 2], [-24, -22], [0, -31]];
    partialPath(ctx, shield, E.inOutCubic(prog(t, t0 + 0.1, 0.4)));
    partialPath(ctx, [[-10, -1], [-3, 7], [11, -9]], E.outCubic(prog(t, t0 + 0.42, 0.2)));
  } else {
    partialPath(ctx, [[-28, 18], [-11, 1], [0, 10], [25, -16]], E.inOutCubic(prog(t, t0 + 0.1, 0.38)));
    partialPath(ctx, [[12, -17], [25, -16], [25, -3]], E.outCubic(prog(t, t0 + 0.44, 0.16)));
  }
  ctx.restore();
}

function drawCards(ctx, t) {
  CARDS.forEach((card, k) => {
    const tv = T.verbs[k];
    const pc = E.outExpo(prog(t, tv - 0.12, 0.55));
    if (pc <= 0) return;
    const left = card.x - CARD_W / 2;
    const top = CARD_TOP + (1 - pc) * 90;
    ctx.save();
    ctx.globalAlpha = clamp(pc * 1.4);
    ctx.shadowColor = 'rgba(27,49,96,0.12)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 18;
    roundRect(ctx, left, top, CARD_W, CARD_H, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, left, top, CARD_W, CARD_H, 22);
    ctx.clip();
    trackedText(ctx, card.idx, left + 36, top + 56, F.mono(16), C.blue, 2);
    trackedText(ctx, '— PSC', left + CARD_W - 36, top + 56, F.mono(13), '#B4BCC9', 2, 'right');

    const cy = top + 190;
    const r = 62 * spring(t - tv, 2.6, 8);
    const rp = prog(t, tv, 0.65);
    if (rp > 0 && rp < 1) ring(ctx, card.x, cy, 62 + 90 * E.outExpo(rp), rgba(card.color, 0.4 * (1 - rp)), 2);
    disc(ctx, card.x, cy, r, card.color);
    if (r > 20) drawIcon(ctx, k, card.x, cy, t, tv);

    const size = 56;
    const font = F.display(size);
    const L = layout(ctx, card.verb, font, -1);
    const dotR = size * 0.09;
    const total = L.width + 6 + dotR * 2;
    const vx = card.x - total / 2;
    const vy = top + 345;
    revealText(ctx, card.verb, vx, vy, { font, size, color: C.navy, t, start: tv + 0.06, stagger: 0.02, dur: 0.45, tracking: -1 });
    disc(ctx, vx + L.width + 6 + dotR, vy - dotR, dotR * spring(t - (tv + 0.3), 3, 9), card.color);

    card.desc.forEach((line, j) => {
      revealText(ctx, line, card.x, top + 405 + j * 32, {
        font: F.brand(22), size: 22, color: '#6B7382', t, start: tv + 0.2 + j * 0.06, stagger: 0.006, dur: 0.4, align: 'center',
      });
    });
    const ap = E.outExpo(prog(t, tv + 0.3, 0.5));
    ctx.fillStyle = card.color;
    ctx.fillRect(card.x - 30, top + 478, 60 * ap, 3);
    ctx.restore();
  });

  const words = ['vos', 'régimes', 'santé,', 'prévoyance', 'et', 'retraite.'];
  const font = F.brand(38);
  const sp = layout(ctx, ' ', font, 0).width;
  const widths = words.map((w) => layout(ctx, w, font, 0).width);
  let x = CX - (widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1)) / 2;
  words.forEach((w, j) => {
    revealText(ctx, w, x, 880, {
      font, size: 38, color: j >= 2 ? C.navy : '#6B7382', t, start: T.subline + j * 0.07, stagger: 0.012, dur: 0.45,
    });
    x += widths[j] + sp;
  });
}

function sceneChaosOrder(ctx, t) {
  fillBg(ctx, C.ink);
  const shockP = prog(t, T.shock, SHOCK_DUR);
  if (t < T.shock + SHOCK_DUR) {
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1000);
    g.addColorStop(0, '#111C3D');
    g.addColorStop(1, C.ink);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (t >= T.shock) {
    const R = SHOCK_R * E.outExpo(shockP);
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.clip();
    fillBg(ctx, C.paper);
    drawGridLines(ctx, t);
    ctx.restore();
  }
  if (t < T.shock) {
    // Big-bang title card at the start of the scene.
    drawTerms(ctx, t);
    drawHeadline(ctx, t);
    const fz = prog(t, T.freeze, 0.05);
    if (fz > 0) {
      ctx.fillStyle = `rgba(4,7,16,${0.45 * fz})`;
      ctx.fillRect(0, 0, W, H);
      const pr = E.outBack(prog(t, T.freeze, 0.12));
      const glow = ctx.createRadialGradient(CX, CY, 0, CX, CY, 120);
      glow.addColorStop(0, `rgba(157,180,232,${0.6 * pr})`);
      glow.addColorStop(1, 'rgba(157,180,232,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(CX - 120, CY - 120, 240, 240);
      disc(ctx, CX, CY, 11 * pr, '#FFFFFF');
    }
    vignette(ctx, 0.5);
    return;
  }
  drawTerms(ctx, t);
  if (shockP < 1) {
    const R = SHOCK_R * E.outExpo(shockP);
    ring(ctx, CX, CY, R, rgba(C.navy, 0.7 * (1 - shockP)), 4);
    ring(ctx, CX, CY, R * 0.9, rgba(C.blue, 0.5 * (1 - shockP)), 2);
    const fl = 1 - E.outCubic(prog(t, T.shock, 0.2));
    if (fl > 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.75 * fl})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
  drawCards(ctx, t);
}

// ─── Scene 5 · Méthode ───────────────────────────────────────────────────
const STEPS = [
  { title: 'État des lieux', sub: 'Audit des contrats et des comptes', color: C.navy },
  { title: 'Cahier des charges', sub: 'Besoins, population, budget', color: C.blue },
  { title: 'Mise en concurrence', sub: 'Consultation des assureurs', color: C.grey },
  { title: 'Suivi annuel', sub: 'Pilotage et renouvellements', color: C.navy },
];
const LINE_Y = 600;
const NODE_X = [242, 682, 1122, 1562];

function headX(t) {
  const n = T.nodes;
  if (t <= n[0]) return NODE_X[0];
  for (let i = 0; i < n.length - 1; i++) {
    if (t <= n[i + 1]) return lerp(NODE_X[i], NODE_X[i + 1], E.inOutCubic(prog(t, n[i + 1] - 0.46, 0.46)));
  }
  return NODE_X[n.length - 1];
}

function sceneMethod(ctx, t) {
  // Faint dot grid.
  ctx.fillStyle = '#D5DAE3';
  for (let gx = 24; gx < W; gx += 48) {
    for (let gy = 18; gy < H; gy += 48) ctx.fillRect(gx - 1, gy - 1, 2, 2);
  }
  const drift = lerp(30, -30, prog(t, T.method, T.shutter + 0.3 - T.method));
  ctx.save();
  ctx.translate(drift, 0);

  typeText(ctx, 'NOTRE APPROCHE', 210, 262, { font: F.mono(18), size: 18, color: C.blue, t, start: T.method - 0.02, dur: 0.22, tracking: 4 });
  revealText(ctx, 'Du diagnostic au pilotage.', 202, 352, {
    font: F.display(78), size: 78, color: C.navy, t, start: T.method + 0.02, stagger: 0.016, dur: 0.5, tracking: -1.5,
  });

  // Base track.
  const bp = E.outExpo(prog(t, T.method - 0.04, 0.6));
  ctx.fillStyle = '#DCE0E8';
  ctx.fillRect(NODE_X[0], LINE_Y - 1, (NODE_X[3] - NODE_X[0] + 120) * bp, 2);

  // Progress line with glowing head.
  const hx = headX(t);
  const lp = prog(t, T.method + 0.12, 0.13);
  if (lp > 0) {
    ctx.fillStyle = C.navy;
    ctx.fillRect(NODE_X[0], LINE_Y - 2, (hx - NODE_X[0]) * lp, 4);
    const glow = ctx.createRadialGradient(hx, LINE_Y, 0, hx, LINE_Y, 34);
    glow.addColorStop(0, 'rgba(74,106,179,0.45)');
    glow.addColorStop(1, 'rgba(74,106,179,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(hx - 34, LINE_Y - 34, 68, 68);
    disc(ctx, hx, LINE_Y, 7 * lp, C.blue);
  }

  STEPS.forEach((s, i) => {
    const tn = T.nodes[i];
    const x = NODE_X[i];
    const rp = prog(t, tn, 0.7);
    if (rp > 0 && rp < 1) ring(ctx, x, LINE_Y, 36 + 80 * E.outExpo(rp), rgba(s.color, 0.45 * (1 - rp)), 2);
    const r = 36 * spring(t - tn, 2.8, 8);
    disc(ctx, x, LINE_Y, r, s.color);
    if (r > 8) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, LINE_Y, Math.max(0, r), 0, Math.PI * 2);
      ctx.clip();
      const np = E.outExpo(prog(t, tn + 0.05, 0.4));
      trackedText(ctx, String(i + 1), x, LINE_Y + 10 + (1 - np) * 40, F.bold(28), '#FFFFFF', 0, 'center');
      ctx.restore();
    }
    revealText(ctx, s.title, x - 36, 700, { font: F.bold(36), size: 36, color: C.navy, t, start: tn + 0.06, stagger: 0.013, dur: 0.42 });
    revealText(ctx, s.sub, x - 36, 742, { font: F.brand(22), size: 22, color: '#6B7382', t, start: tn + 0.16, stagger: 0.006, dur: 0.4 });
  });
  ctx.restore();
}

// ─── Scene 6 · Indépendance ──────────────────────────────────────────────
const BARS = 8;
function barCover(j, t) {
  return E.inOutExpo(prog(t, T.shutter + j * 0.016, 0.2));
}
function barsPath(ctx, t) {
  ctx.beginPath();
  const bw = W / BARS;
  for (let j = 0; j < BARS; j++) {
    const p = barCover(j, t);
    if (p <= 0) continue;
    const h = H * p;
    if (j % 2 === 0) ctx.rect(j * bw - 0.5, 0, bw + 1, h);
    else ctx.rect(j * bw - 0.5, H - h, bw + 1, h);
  }
}

function drawIndepContent(ctx, t) {
  fillBg(ctx, C.deep);
  // Concentric protection rings.
  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate((t - T.indep) * 0.25);
  for (let k = 1; k <= 7; k++) {
    const rp = E.outExpo(prog(t, T.indep - 0.05 + k * 0.03, 0.8));
    ctx.setLineDash(k % 2 ? [] : [4, 10]);
    ring(ctx, 0, 0, (120 + k * 115) * rp, `rgba(157,180,232,${0.09 - k * 0.006})`, 1.5);
  }
  ctx.setLineDash([]);
  ctx.restore();

  typeText(ctx, 'ENTIÈREMENT DÉDIÉ À VOS INTÉRÊTS', CX, 420, {
    font: F.mono(19), size: 19, color: C.sky, t, start: T.indep + 0.04, dur: 0.3, tracking: 4, align: 'center',
  });
  const size = 132;
  const font = F.display(size);
  const txt = 'Courtier indépendant';
  const L = layout(ctx, txt, font, -2.5);
  const dotR = size * 0.088;
  const total = L.width + 8 + dotR * 2;
  const x0 = CX - total / 2;
  revealText(ctx, txt, x0, 590, { font, size, color: '#FFFFFF', t, start: T.indep - 0.01, stagger: 0.016, dur: 0.45, tracking: -2.5, rot: 0.08 });
  disc(ctx, x0 + L.width + 8 + dotR, 590 - dotR, dotR * spring(t - (T.indep + 0.3), 3, 9), '#6F8FD8');

  const pills = ['ORIAS', 'RC PROFESSIONNELLE', 'GARANTIE FINANCIÈRE'];
  const pf = F.mono(17);
  const pw = pills.map((p) => layout(ctx, p, pf, 2).width + 64);
  const gap = 18;
  let px = CX - (pw.reduce((a, b) => a + b, 0) + gap * (pills.length - 1)) / 2;
  pills.forEach((p, j) => {
    const s = spring(t - (T.indep + 0.2 + j * 0.09), 2.8, 8);
    if (s > 0) {
      const w = pw[j];
      const cx = px + w / 2;
      ctx.save();
      ctx.translate(cx, 690);
      ctx.scale(s, s);
      roundRect(ctx, -w / 2, -24, w, 48, 24);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      disc(ctx, -w / 2 + 24, 0, 4.5, C.sky);
      trackedText(ctx, p, -w / 2 + 40, 6, pf, '#FFFFFF', 2);
      ctx.restore();
    }
    px += pw[j] + gap;
  });
  vignette(ctx, 0.35);
}

function irisRadius(t) {
  return lerp(1150, 110, E.inQuart(prog(t, T.iris, T.logo - T.iris)));
}

// ─── Scene 7 · Signature ─────────────────────────────────────────────────
function logoLayout(ctx) {
  const probe = layout(ctx, 'Solutions PSC', F.brand(100), 0).width;
  const Wt = 1000;
  const size = (100 * Wt) / probe;
  const font = F.brand(size);
  const left = CX - Wt / 2;
  const right = CX + Wt / 2;
  const base = 478;
  const d = 0.0916 * Wt;
  const s = d * 0.69;
  const gx = right + 0.0082 * Wt - d / 2;
  const cy = base - 0.2216 * Wt;
  const tagProbe = layout(ctx, 'Experts en Protection Sociale', F.brand(100), 0).width;
  const tagSize = (100 * 0.745 * Wt) / tagProbe;
  return {
    size, font, left, right, base, d, s, cy,
    cx: [gx - 2 * s, gx - s, gx],
    tagSize, tag1: base + 0.0965 * Wt, tag2: base + 0.151 * Wt,
    solW: layout(ctx, 'Solutions ', font, 0).width,
  };
}

function sceneLogo(ctx, t) {
  const L0 = T.logo;
  fillBg(ctx, C.white);
  const LG = logoLayout(ctx);
  const cam = 1 + 0.028 * E.outCubic(prog(t, L0 + 0.4, DURATION - L0 - 0.4));
  ctx.save();
  ctx.translate(CX, CY);
  ctx.scale(cam, cam);
  ctx.translate(-CX, -CY);

  // Mark: navy lands, blue and grey split out of it, then the mark flies into the lockup.
  const bigR = 110;
  const bigS = bigR * 2 * 0.69;
  const navyX = CX - bigS * E.outExpo(prog(t, L0 + 0.02, 0.42));
  const pb = spring(t - (L0 + 0.06), 2.2, 7.5);
  const pg = spring(t - (L0 + 0.14), 2.2, 7.5);
  const blueX = lerp(navyX, CX, pb);
  const greyX = lerp(blueX, CX + bigS, pg);
  const big = [
    { x: navyX, r: bigR * (1 - 0.13 * wobble(t - L0, 2.6, 7)) },
    { x: blueX, r: bigR * E.outCubic(prog(t, L0 + 0.06, 0.22)) },
    { x: greyX, r: bigR * E.outCubic(prog(t, L0 + 0.14, 0.22)) },
  ];
  const breathe = [L0 + 2.25, L0 + 2.4, L0 + 2.55];
  big.forEach((b, i) => {
    const pm = E.inOutExpo(prog(t, L0 + 0.45 + i * 0.035, 0.58));
    const x = lerp(b.x, LG.cx[i], pm);
    const y = lerp(CY, LG.cy, pm);
    const bw = wobble(t - breathe[i], 3.2, 9);
    const r = lerp(b.r, LG.d / 2, pm) * (1 + 0.14 * bw);
    disc(ctx, x, y - 10 * Math.max(0, bw), r, BRAND[i]);
  });

  const solP = { font: LG.font, size: LG.size, t, stagger: 0.03, dur: 0.55, rise: 1.0 };
  revealText(ctx, 'Solutions', LG.left, LG.base, { ...solP, color: '#8E8E8E', start: L0 + 0.6 });
  revealText(ctx, 'PSC', LG.left + LG.solW, LG.base, { ...solP, color: '#1B2F57', start: L0 + 0.76, stagger: 0.05 });

  // Light sweep across the wordmark.
  const sw = prog(t, L0 + 2.0, 0.7);
  if (sw > 0 && sw < 1) {
    ctx.save();
    const bx = lerp(LG.left - 300, LG.right + 300, E.inOutCubic(sw));
    ctx.beginPath();
    ctx.moveTo(bx - 60, LG.base - LG.size);
    ctx.lineTo(bx + 30, LG.base - LG.size);
    ctx.lineTo(bx - 50, LG.base + 40);
    ctx.lineTo(bx - 140, LG.base + 40);
    ctx.closePath();
    ctx.clip();
    trackedText(ctx, 'Solutions', LG.left, LG.base, LG.font, '#C4C4C4');
    trackedText(ctx, 'PSC', LG.left + LG.solW, LG.base, LG.font, '#4F6CB5');
    ctx.restore();
  }

  const tf = F.brand(LG.tagSize);
  revealText(ctx, 'Experts en Protection Sociale', LG.right, LG.tag1, { font: tf, size: LG.tagSize, color: '#8E8E8E', t, start: L0 + 0.95, stagger: 0.008, dur: 0.45, align: 'right' });
  revealText(ctx, 'Complémentaire', LG.right, LG.tag2, { font: tf, size: LG.tagSize, color: '#8E8E8E', t, start: L0 + 1.03, stagger: 0.01, dur: 0.45, align: 'right' });

  const dp = E.outExpo(prog(t, L0 + 1.25, 0.5));
  ctx.fillStyle = C.blue;
  ctx.fillRect(CX - 36 * dp, LG.base + 232, 72 * dp, 2);

  revealText(ctx, 'Expertise et indépendance.', CX, LG.base + 322, {
    font: F.serif(60), size: 60, color: C.blue, t, start: L0 + 1.35, stagger: 0.016, dur: 0.6, align: 'center',
  });
  typeText(ctx, 'solutions-psc.fr', CX, LG.base + 386, {
    font: F.mono(21), size: 21, color: '#8E8E8E', t, start: L0 + 1.78, dur: 0.36, tracking: 5, align: 'center',
    cursorUntil: (Math.floor(t * 2.2) % 2 === 0) ? 99 : 0,
  });
  ctx.restore();
}

// ─── HUD ─────────────────────────────────────────────────────────────────
const SECTIONS = [
  [0, '01', 'OUVERTURE'], [T.words[0], '02', 'EXPERTISES'], [T.chaos, '03', 'ENJEUX'],
  [T.shock, '04', 'MISSION'], [T.method, '05', 'MÉTHODE'], [T.indep, '06', 'INDÉPENDANCE'],
];
function isDark(t) {
  return t < T.words[2] || (t >= T.chaos && t < T.shock + 0.08) || (t >= T.indep && t < T.iris + 0.2);
}

function hud(ctx, t) {
  const a = E.outCubic(prog(t, 0.3, 0.5)) * (1 - prog(t, T.iris + 0.05, 0.15));
  if (a <= 0) return;
  const col = isDark(t) ? '#FFFFFF' : C.navy;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = a * 0.7;
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;
  const m = 44;
  const l = 22;
  ctx.beginPath();
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.moveTo(x, y + sy * l);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * l, y);
  }
  ctx.stroke();

  const f = F.mono(13);
  // Brand mini-mark.
  BRAND.forEach((c, i) => disc(ctx, 80 + i * 9, 79, 6, isDark(t) && i === 0 ? '#3A5AA8' : c));
  trackedText(ctx, 'SOLUTIONS PSC', 112, 84, f, col, 3);

  // Section index with slot-machine swap.
  let s = 0;
  for (let i = 0; i < SECTIONS.length; i++) if (t >= SECTIONS[i][0]) s = i;
  const sp = E.outExpo(prog(t, SECTIONS[s][0], 0.35));
  ctx.save();
  ctx.beginPath();
  ctx.rect(W - 520, 62, 440, 30);
  ctx.clip();
  const lab = (i) => `${SECTIONS[i][1]} / 06 — ${SECTIONS[i][2]}`;
  if (s > 0 && sp < 1) trackedText(ctx, lab(s - 1), W - 80, 84 - 26 * sp, f, col, 3, 'right');
  trackedText(ctx, lab(s), W - 80, 84 + 26 * (1 - sp), f, col, 3, 'right');
  ctx.restore();

  // Timecode.
  const fr = Math.round(t * 60);
  const ss = Math.floor(fr / 60);
  const ff = fr % 60;
  const tc = `00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  disc(ctx, 84, H - 84, 4, Math.floor(t * 2) % 2 === 0 ? '#E0544B' : rgba('#E0544B', 0.25));
  trackedText(ctx, tc, 100, H - 79, f, col, 2);
  trackedText(ctx, 'COURTIER EN PROTECTION SOCIALE COMPLÉMENTAIRE', W - 80, H - 79, f, col, 2.5, 'right');

  // Progress hairline.
  ctx.globalAlpha = a * 0.25;
  ctx.fillStyle = col;
  ctx.fillRect(360, H - 84, W - 1100, 1);
  ctx.globalAlpha = a * 0.7;
  ctx.fillRect(360, H - 85, (W - 1100) * clamp(t / DURATION), 3);
  ctx.restore();
}

// ─── Master ──────────────────────────────────────────────────────────────
export function drawScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const [sx, sy] = shake(t);
  ctx.translate(sx, sy);

  if (t < T.words[0]) {
    sceneIntro(ctx, t);
  } else if (t < T.chaos) {
    sceneWords(ctx, t);
  } else if (t < T.whip) {
    sceneChaosOrder(ctx, t);
  } else if (t < T.shutter) {
    const camX = -W * E.inOutExpo(prog(t, T.whip, T.whipDur));
    if (camX > -W + 0.5) {
      ctx.save();
      ctx.translate(camX, 0);
      sceneChaosOrder(ctx, t);
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(camX + W, -40, W + 80, H + 80);
    ctx.clip();
    fillBg(ctx, C.paper);
    ctx.translate(camX + W, 0);
    sceneMethod(ctx, t);
    ctx.restore();
  } else if (t < T.iris) {
    const covered = barCover(BARS - 1, t) >= 1 && barCover(0, t) >= 1;
    if (!covered) {
      fillBg(ctx, C.paper);
      sceneMethod(ctx, t);
    }
    ctx.save();
    barsPath(ctx, t);
    ctx.clip();
    drawIndepContent(ctx, t);
    ctx.restore();
  } else if (t < T.logo) {
    fillBg(ctx, C.white);
    const R = irisRadius(t);
    const k = R / 1150;
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(CX, CY);
    ctx.scale(lerp(1, 0.2, 1 - k), lerp(1, 0.2, 1 - k));
    ctx.translate(-CX, -CY);
    drawIndepContent(ctx, t);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(CX, CY, R, 0, Math.PI * 2);
    ctx.fillStyle = rgba(C.navy, clamp(E.inCubic(1 - k) * 1.37));
    ctx.fill();
    ctx.restore();
  } else {
    sceneLogo(ctx, t);
  }
  hud(ctx, t);
}
