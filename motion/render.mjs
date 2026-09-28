// Renders the film frame by frame in headless Chrome, then encodes with ffmpeg.
//   node render.mjs                      full render → out/solutions-psc-showreel.mp4
//   node render.mjs --stills 1.2,6.4     review stills → out/stills/
//   FRAMES_DIR=/tmp/x node render.mjs    where to keep the PNG sequence
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { DURATION } from './timeline.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = 60;
const OUT_DIR = path.join(ROOT, 'out');
const FRAMES_DIR = process.env.FRAMES_DIR || path.join(ROOT, '.frames');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png' };

function serve() {
  const srv = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => resolve(srv)));
}

async function openPage(port) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--mute-audio'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.evaluate(() => window.__ready);
  return { browser, page };
}

const decode = (dataUrl) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');

async function stills(port, times, blur) {
  const dir = path.join(OUT_DIR, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  const { browser, page } = await openPage(port);
  for (const t of times) {
    const url = await page.evaluate((tt, b) => window.__still(tt, b), t, blur);
    const file = path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`);
    fs.writeFileSync(file, decode(url));
    console.log(file);
  }
  await browser.close();
}

async function full(port) {
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const total = FPS * DURATION;
  const workers = Math.max(1, Math.min(Number(process.env.WORKERS) || os.cpus().length - 2, 8));
  let next = 0;
  let done = 0;
  const started = Date.now();
  const worker = async () => {
    const { browser, page } = await openPage(port);
    while (next < total) {
      const f = next++;
      const url = await page.evaluate((fr) => window.__capture(fr), f);
      fs.writeFileSync(path.join(FRAMES_DIR, `${String(f).padStart(5, '0')}.png`), decode(url));
      done++;
      if (done % 60 === 0) {
        const s = (Date.now() - started) / 1000;
        console.log(`frames ${done}/${total}  ${s.toFixed(0)}s  eta ${((s / done) * (total - done)).toFixed(0)}s`);
      }
    }
    await browser.close();
  };
  await Promise.all(Array.from({ length: workers }, worker));
  console.log(`captured ${total} frames with ${workers} workers in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  await encode();
}

function encode() {
  const audio = path.join(OUT_DIR, 'soundtrack.wav');
  const hasAudio = fs.existsSync(audio);
  const out = path.join(OUT_DIR, 'solutions-psc-showreel.mp4');
  const args = [
    '-y', '-loglevel', 'error', '-nostats',
    '-framerate', String(FPS), '-i', path.join(FRAMES_DIR, '%05d.png'),
    ...(hasAudio ? ['-i', audio] : []),
    '-filter_complex', '[0:v]noise=alls=4:allf=t+u,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]',
    '-map', '[v]', ...(hasAudio ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '320k'] : []),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
    '-t', String(DURATION), '-movflags', '+faststart', out,
  ];
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? (console.log(out), resolve()) : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

const argv = process.argv.slice(2);
const srv = await serve();
const { port } = srv.address();
try {
  const si = argv.indexOf('--stills');
  if (si >= 0) await stills(port, argv[si + 1].split(',').map(Number), argv.includes('--blur'));
  else if (argv.includes('--encode')) await encode();
  else await full(port);
} finally {
  srv.close();
}
