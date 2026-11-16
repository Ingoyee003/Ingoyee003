#!/usr/bin/env node
/**
 * Renders the canvas dragon into a seamless looping README banner.
 *
 *   node scripts/dragon-banner/render.mjs                       # tech theme -> assets/dragon-tech.webp
 *   node scripts/dragon-banner/render.mjs --theme fire
 *   node scripts/dragon-banner/render.mjs --theme ice --fire 2.2-4.2
 *   node scripts/dragon-banner/render.mjs --only 30,70,110      # just dump a few preview PNGs
 *
 * Options
 *   --theme  tech|fire|ice        (default tech)
 *   --w --h                       canvas size in px   (default 1000 x 460)
 *   --s                           dragon scale        (default 0.56)
 *   --T                           loop length, s      (default 12)
 *   --fps                         frames per second   (default 24)
 *   --fire                        breath windows in seconds (default "2.2-4.2,5.4-6.8")
 *   --flame / --flamea            flame density / opacity multipliers (default 0.55 / 0.62)
 *   --out                         output name without extension (default assets/dragon-<theme>)
 *   --tmp                         where to keep frame PNGs     (default OS temp dir)
 *   --only                        comma list of frame numbers to save as PNG, no encoding
 *   --keep                        keep the frame PNGs
 *   --webp-q                      WebP quality 0-100 (default 72)
 *   --gif                         ALSO write a light GIF fallback (--gif-width 720, --gif-colors 64)
 *
 * Needs: playwright (chromium) and python3 + Pillow. ffmpeg only for --gif.
 */
import { createRequire } from 'node:module';
import { mkdir, rm, stat, mkdtemp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// playwright is often installed globally; createRequire finds it the same way plain `require` does
const { chromium } = createRequire(import.meta.url)('playwright');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const flag = (n) => argv.includes(n);

const here = path.dirname(fileURLToPath(import.meta.url));
const theme = opt('--theme', 'tech');
const W = +opt('--w', 1000), H = +opt('--h', 460), S = +opt('--s', 0.56);
const T = +opt('--T', 12), FPS = +opt('--fps', 24);
const fire = opt('--fire', '2.2-4.2,5.4-6.8');
const flame = opt('--flame', '0.55'), flamea = opt('--flamea', '0.62');
const out = opt('--out', path.join('assets', `dragon-${theme}`));
const only = opt('--only', '') ? opt('--only').split(',').map(Number) : null;
const gifColors = +opt('--gif-colors', 64);
const gifWidth = +opt('--gif-width', 720);
const webpQ = +opt('--webp-q', 72);

const tmpRoot = opt('--tmp', null) ?? (await mkdtemp(path.join(tmpdir(), 'dragon-frames-')));
const framesDir = path.join(tmpRoot, `${theme}-frames`);
await rm(framesDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const url = pathToFileURL(path.join(here, 'dragon-banner.html')).href +
  `?w=${W}&h=${H}&s=${S}&T=${T}&fps=${FPS}&theme=${theme}&fire=${encodeURIComponent(fire)}&flame=${flame}&flamea=${flamea}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => { console.error('Page error:', e.message); process.exit(1); });
await page.goto(url);
await page.waitForFunction(() => window.__banner);
const frames = await page.evaluate(() => window.__banner.frames);
console.log(`Rendering ${frames} frames (${W}x${H}, ${FPS} fps, ${T}s loop, theme=${theme})...`);

const canvas = page.locator('canvas');
for (let i = 0; i < frames; i++) {
  await page.evaluate((n) => window.__banner.advance(n), i);
  if (only && !only.includes(i)) continue;
  await canvas.screenshot({ path: path.join(framesDir, `f${String(i).padStart(4, '0')}.png`) });
  if (i % 48 === 0) process.stdout.write(`  frame ${i}/${frames}\n`);
}
await browser.close();

if (only) {
  console.log(`Preview frames saved in ${framesDir}`);
  process.exit(0);
}

await mkdir(path.dirname(out), { recursive: true });
const outputs = [];

// Animated WebP (main output): true colour, no banding, ~2 MB for a 12 s loop.
// Pillow writes exact per-frame timing, so the loop is exactly T seconds.
{
  const r = spawnSync('python3', [path.join(here, 'encode_webp.py'), framesDir, `${out}.webp`, String(FPS), String(webpQ)], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('WebP encoding failed (needs python3 + Pillow: pip install pillow)'); process.exit(1); }
  outputs.push('webp');
}

// Optional GIF fallback (--gif). GIF cannot hold gradients cheaply, so this one is
// deliberately light: smaller, 12 fps, 64 colours (~5 MB). Expect a little banding in the sky.
if (flag('--gif')) {
  const r = spawnSync('ffmpeg', [
    '-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(framesDir, 'f%04d.png'),
    '-vf', `fps=${Math.min(12, FPS)},scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${gifColors}:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`,
    '-loop', '0', `${out}.gif`,
  ], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg failed while making the GIF'); process.exit(1); }
  outputs.push('gif');
}

for (const ext of outputs) {
  const { size } = await stat(`${out}.${ext}`);
  console.log(`  ${out}.${ext}  ${(size / 1048576).toFixed(2)} MB`);
}
if (!flag('--keep')) await rm(framesDir, { recursive: true, force: true });
console.log('Done.');
