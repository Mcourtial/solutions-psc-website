// Master timeline in seconds, shared by the picture (scenes.js), the score (audio.mjs)
// and the renderer. 120 BPM: one beat = 0.5 s, so every hit sits on the beat grid.

const WORD = 1.5; // Santé / Prévoyance / Retraite: reveal, then ~1 s fully readable
const CHAOS = 3.0; // « … devient complexe. » build-up until the shockwave
const ORDER = 3.78; // shockwave → whip: three cards + subline, then a readable hold
const NODE_GAP = 1.0; // between two method steps (line travels 0.46 s, rests the rest)
const METHOD_HOLD = 1.75; // last step → « Courtier indépendant. »
const INDEP = 2.0; // « Courtier indépendant. » + badges before the iris
const OUTRO = 4.0; // logo lockup and final hold

const words = [2.0, 2.0 + WORD, 2.0 + 2 * WORD];
const chaos = 2.0 + 3 * WORD;
const shock = chaos + CHAOS;
const whip = shock + ORDER;
const method = whip + 0.22;
const nodes = [0, 1, 2, 3].map((i) => method + 0.25 + i * NODE_GAP);
const indep = nodes[3] + METHOD_HOLD;
const logo = indep + INDEP;

export const DURATION = logo + OUTRO;

export const T = {
  drops: [0.5, 0.75, 1.0],
  words,
  wordLen: WORD,
  chaos,
  headline: chaos + 0.55,
  freeze: shock - 0.14,
  shock,
  verbs: [shock + 0.5, shock + 1.0, shock + 1.5],
  subline: shock + 2.0,
  whip,
  whipDur: 0.34,
  method,
  nodes,
  nodeGap: NODE_GAP,
  shutter: indep - 0.24,
  indep,
  iris: logo - 0.3,
  logo,
  end: DURATION,
};
