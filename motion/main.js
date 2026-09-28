import { W, H, FPS, SHUTTER } from './engine.js';
import { drawScene, subframesAt, DURATION } from './scenes.js';

const out = document.getElementById('c');
const octx = out.getContext('2d');
const sub = document.createElement('canvas');
sub.width = W;
sub.height = H;
const sctx = sub.getContext('2d', { willReadFrequently: false });

const FONTS = [
  '500 100px "Inter Tight"', '700 100px "Inter Tight"', '800 100px "Inter Tight"',
  'italic 400 100px "Instrument Serif"', '400 100px "Questrial"', '500 100px "JetBrains Mono"',
];
const ready = Promise.all(FONTS.map((f) => document.fonts.load(f, 'AéÉçÀ’—'))).then(() => document.fonts.ready);

/** Draw one output frame, averaging sub-frames across the shutter for true motion blur. */
function renderAt(T, blur = true) {
  const k = blur ? subframesAt(T) : 1;
  const shutter = SHUTTER / FPS;
  octx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < k; i++) {
    const t = k === 1 ? T : T + ((i + 0.5) / k - 0.5) * shutter;
    drawScene(sctx, Math.max(0, t));
    octx.globalAlpha = 1 / (i + 1);
    octx.drawImage(sub, 0, 0);
  }
  octx.globalAlpha = 1;
}

window.__ready = ready.then(() => true);
window.__frame = (frame) => renderAt(frame / FPS);
window.__capture = (frame) => {
  renderAt(frame / FPS);
  return out.toDataURL('image/png');
};
window.__still = (t, blur = false) => {
  renderAt(t, blur);
  return out.toDataURL('image/png');
};

const params = new URLSearchParams(location.search);
if (params.has('preview')) {
  document.body.classList.add('preview');
  const scrub = document.getElementById('scrub');
  scrub.max = String(DURATION);
  const tcEl = document.getElementById('tc');
  const btn = document.getElementById('play');
  let playing = true;
  let t0 = performance.now() - Number(params.get('t') || 0) * 1000;
  let t = 0;
  btn.onclick = () => {
    playing = !playing;
    btn.textContent = playing ? '⏸' : '▶';
    t0 = performance.now() - t * 1000;
  };
  scrub.oninput = () => {
    t = Number(scrub.value);
    t0 = performance.now() - t * 1000;
    renderAt(t, false);
    tcEl.textContent = t.toFixed(3);
  };
  const loop = () => {
    if (playing) {
      t = ((performance.now() - t0) / 1000) % DURATION;
      renderAt(t, params.has('blur'));
      scrub.value = String(t);
      tcEl.textContent = t.toFixed(3);
    }
    requestAnimationFrame(loop);
  };
  ready.then(loop);
}
