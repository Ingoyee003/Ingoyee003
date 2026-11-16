#!/usr/bin/env node
/**
 * Neon README generator
 * ---------------------
 * Pulls LIVE data from the GitHub GraphQL API and renders every visual of the
 * profile README as a self-contained neon SVG (no third-party widgets, so
 * nothing can show up as a broken image).
 *
 *   node scripts/generate.mjs                 -> live data (needs a token)
 *   node scripts/generate.mjs --demo          -> fake data, for local preview
 *   node scripts/generate.mjs --out some/dir  -> write somewhere else
 *
 * Env:
 *   GH_USER          GitHub login to analyse            (default: Ingoyee003)
 *   GH_STATS_TOKEN   optional PAT (read:user) – needed to count private
 *                    contributions. Falls back to GITHUB_TOKEN.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

const OUT = opt('--out', 'assets');
const USER = process.env.GH_USER || 'Ingoyee003';
const TOKEN = process.env.GH_STATS_TOKEN || process.env.GITHUB_TOKEN || '';
const DEMO = flag('--demo');

/* ------------------------------------------------------------------ */
/*  PROFILE CONTENT – edit this block to change the static sections    */
/* ------------------------------------------------------------------ */
const PROFILE = {
  name: 'MAHMUDA ISLAM RIFAH',
  roles: [
    { text: 'Game Developer', color: 'rose' },
    { text: 'Software Engineer (Web & App)', color: 'blue' },
    { text: 'SQA Engineer', color: 'cyan' },
  ],
  typing: [
    'Unity (C#) games, Godot & a custom Java render engine',
    'React, Next.js, Kotlin & Flutter products',
    'Selenium, Playwright, Appium & Newman CI/CD',
  ],
  links: [
    { id: 'portfolio', label: 'Portfolio', detail: 'rifah-s-portfolio.vercel.app', href: 'https://rifah-s-portfolio.vercel.app', color: 'blue' },
    { id: 'github', label: 'GitHub', detail: 'github.com/Ingoyee003', href: 'https://github.com/Ingoyee003', color: 'purple' },
    { id: 'linkedin', label: 'LinkedIn', detail: 'in/mahmuda-islam-rifah', href: 'https://www.linkedin.com/in/mahmuda-islam-rifah', color: 'cyan' },
    { id: 'astrodrive', label: 'AstroDrive', detail: 'astrodrive.fun', href: 'https://astrodrive.fun', color: 'teal' },
    // { id: 'email', label: 'Email', detail: 'you@example.com', href: 'mailto:you@example.com', color: 'rose' },
  ],
  skills: [
    { label: 'GAME DEV', color: 'rose', items: ['Unity (C#)', 'Godot', 'Custom Java Render Engine', 'BFS Procedural Gen'] },
    { label: 'WEB & APP', color: 'blue', items: ['React', 'Next.js', 'Kotlin', 'Flutter', 'Supabase'] },
    { label: 'QA AUTOMATION', color: 'cyan', items: ['Selenium', 'Playwright', 'Appium', 'Postman / Newman CI/CD'] },
    { label: 'RESEARCH', color: 'purple', items: ['IEEE QPAIN 2026', 'Explainable ML Ensemble', 'Scopus-Indexed', '2nd Nationally (EDGE / 500+)', 'Top 5 IUPC'] },
  ],
  highlights: [
    { value: '10+', label: 'Playable Unity, Godot & Java Games', color: 'blue' },
    { value: '-35%', label: 'Frame-Drop Reduction (Custom Render Loop)', color: 'purple' },
    { value: '98%', label: 'Critical QA Coverage, 0 Escaped Bugs', color: 'rose' },
    { value: '2nd / 500+', label: 'National Android Rank & IEEE First Author', color: 'teal' },
  ],
  // Terminal card in the About section: [tokenText, colorKey] per line
  about: {
    title: 'vscode - ~/ingoyee003/workspace',
    command: 'npx tsx src/profile.ts',
    lines: [
      [['export const ', 'rose'], ['developer', 'sky'], [' = {', 'slate']],
      [['  name: ', 'dim'], ['"Mahmuda Islam Rifah"', 'amber'], [',', 'dim']],
      [['  roles: ', 'dim'], ['[', 'slate'], ['"Game Developer"', 'rose'], [', ', 'dim'], ['"Software Engineer (Web and App)"', 'sky'], [', ', 'dim'], ['"SQA Engineer"', 'cyan'], ['],', 'slate']],
      [['  games: ', 'dim'], ['"10+ Unity (C#), Godot & Custom Java Render Engine (-35% drops)"', 'green'], [',', 'dim']],
      [['  saas: ', 'dim'], ['"React, Next.js, Kotlin, Flutter · 5+ paying clients"', 'green'], [',', 'dim']],
      [['  qa: ', 'dim'], ['"Selenium, Playwright, Appium, Newman CI/CD (98% cov)"', 'green']],
      [['};', 'slate']],
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Theme (taken from the tokyonight card in the screenshot) + neon    */
/* ------------------------------------------------------------------ */
const C = {
  bg: '#1a1b27', ink: '#0b0c14', blue: '#70a5fd', purple: '#bf91f3', teal: '#38bdae',
  rose: '#fb7185', amber: '#fbbf24', cyan: '#22d3ee', text: '#c0caf5', dim: '#7982a9',
  sky: '#7dd3fc', slate: '#cbd5e1', green: '#6ee7b7', track: '#24263a',
};
const NEON = [C.blue, C.purple, C.teal, C.rose, C.amber, C.cyan];
const col = (k) => C[k] || k;

const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const BASE_CSS = `
text{font-family:${FONT}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}
@keyframes flicker{0%,19%,21%,23%,55%,57%,100%{opacity:1}20%,22%{opacity:.45}56%{opacity:.7}}
@keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes drift{from{transform:translateX(0)}to{transform:translateX(-200px)}}
@keyframes growX{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.hbar{transform-box:fill-box;transform-origin:0 50%;animation:growX 1.1s cubic-bezier(.2,.8,.2,1) both}
.pulse{animation:pulse 2.8s ease-in-out infinite}
.flick{animation:flicker 6s linear infinite}
.bar{transform-box:fill-box;transform-origin:50% 100%;animation:grow .9s cubic-bezier(.2,.8,.2,1) both}
.wave{animation:drift 7s linear infinite}
.wave2{animation:drift 11s linear infinite}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;

const DEFS = `
<filter id="glowS" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="glowL" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<linearGradient id="neon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.blue}"/><stop offset=".5" stop-color="${C.purple}"/><stop offset="1" stop-color="${C.teal}"/></linearGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.blue}" stop-opacity=".10"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></linearGradient>
<linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.purple}"/><stop offset="1" stop-color="${C.blue}"/></linearGradient>
`;

function svg(w, h, title, body, { extraDefs = '', extraCss = '', width, height } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width || w}" height="${height || h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<defs>${DEFS}${extraDefs}</defs>
<style>${BASE_CSS}${extraCss}</style>
${body}
</svg>
`;
}

const frame = (w, h) => `
<rect width="${w}" height="${h}" rx="14" fill="${C.bg}"/>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="13" fill="url(#sheen)"/>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="13" fill="none" stroke="url(#neon)" stroke-width="1.6" filter="url(#glowS)"/>`;

const live = (w) => `
<g transform="translate(${w - 72} 21)">
  <circle cx="6" cy="6" r="3.5" fill="${C.teal}" class="pulse" filter="url(#glow)"/>
  <text x="16" y="10" font-size="10" letter-spacing="1.6" fill="${C.teal}" class="pulse">LIVE</text>
</g>`;

const cardTitle = (t, color) =>
  `<text x="22" y="33" font-size="12" font-weight="700" letter-spacing="2.4" fill="${color}" filter="url(#glowS)">${esc(t)}</text>`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const fmtDate = (iso, withYear = true) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
});
const fmtNum = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k' : n.toLocaleString('en-US'));

function computeStreaks(days) {
  let longest = { len: 0, start: null, end: null };
  let run = 0, runStart = null;
  for (const d of days) {
    if (d.count > 0) {
      if (run === 0) runStart = d.date;
      run++;
      if (run > longest.len) longest = { len: run, start: runStart, end: d.date };
    } else run = 0;
  }
  // current streak: today may still be empty – the streak is alive until the day ends
  const cur = { len: 0, start: null, end: null };
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--;
  while (i >= 0 && days[i].count > 0) {
    if (!cur.end) cur.end = days[i].date;
    cur.start = days[i].date;
    cur.len++;
    i--;
  }
  const total = days.reduce((a, d) => a + d.count, 0);
  const first = days.find((d) => d.count > 0)?.date ?? null;
  return { total, first, longest, current: cur, today: days[days.length - 1]?.date };
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const Q_BASE = `
query($login:String!){
  user(login:$login){
    login name createdAt
    followers{ totalCount }
    pullRequests{ totalCount }
    issues{ totalCount }
    contributionsCollection{ contributionYears }
    repositories(ownerAffiliations:OWNER, isFork:false, first:100, orderBy:{field:PUSHED_AT, direction:DESC}){
      totalCount
      nodes{
        stargazerCount
        languages(first:8, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name } } }
      }
    }
  }
}`;

const Q_YEAR = `
query($login:String!,$from:DateTime!,$to:DateTime!){
  user(login:$login){
    contributionsCollection(from:$from, to:$to){
      totalCommitContributions
      contributionCalendar{ weeks{ contributionDays{ date contributionCount } } }
    }
  }
}`;

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'neon-readme-stats' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GitHub GraphQL error: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function fetchLive() {
  if (!TOKEN) throw new Error('No token found. Set GITHUB_TOKEN (Actions provides it) or GH_STATS_TOKEN.');
  const { user } = await gql(Q_BASE, { login: USER });
  if (!user) throw new Error(`GitHub user "${USER}" not found`);

  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const years = [...user.contributionsCollection.contributionYears].sort((a, b) => a - b);

  const byDate = new Map();
  let commitsThisYear = 0;
  for (const y of years) {
    const from = `${y}-01-01T00:00:00Z`;
    const to = y === thisYear ? now.toISOString() : `${y}-12-31T23:59:59Z`;
    const data = await gql(Q_YEAR, { login: USER, from, to });
    const cc = data.user.contributionsCollection;
    if (y === thisYear) commitsThisYear = cc.totalCommitContributions;
    for (const w of cc.contributionCalendar.weeks)
      for (const d of w.contributionDays) byDate.set(d.date, d.contributionCount);
  }
  const days = [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, count]) => ({ date, count }));

  const repos = user.repositories.nodes;
  const langSize = new Map();
  for (const r of repos) for (const e of r.languages.edges) langSize.set(e.node.name, (langSize.get(e.node.name) || 0) + e.size);

  return {
    days,
    stats: {
      stars: repos.reduce((a, r) => a + r.stargazerCount, 0),
      commits: commitsThisYear,
      commitsYear: thisYear,
      prs: user.pullRequests.totalCount,
      issues: user.issues.totalCount,
      repos: user.repositories.totalCount,
      followers: user.followers.totalCount,
    },
    langSize,
  };
}

function fetchDemo() {
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const days = [];
  const start = new Date('2023-06-20T00:00:00Z');
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    let c = rnd() < 0.09 ? 1 + Math.floor(rnd() * 5) : 0;
    if (iso >= '2023-07-17' && iso <= '2023-07-21') c = 2;
    days.push({ date: iso, count: c });
  }
  // recent activity so the 30-day chart has some shape
  for (let i = 3; i < 25; i += 2) days[days.length - 1 - i].count = 1 + Math.floor(rnd() * 6);
  days[days.length - 1].count = 0;
  return {
    days,
    stats: { stars: 42, commits: 318, commitsYear: new Date().getUTCFullYear(), prs: 27, issues: 9, repos: 31, followers: 18 },
    langSize: new Map([['C#', 520000], ['TypeScript', 410000], ['Java', 260000], ['Kotlin', 190000], ['Dart', 120000], ['Python', 60000], ['GDScript', 30000]]),
  };
}

/* ------------------------------------------------------------------ */
/*  Dynamic cards (495 x 195 so they pair nicely side by side)         */
/* ------------------------------------------------------------------ */
function streakCard(s) {
  const w = 495, h = 195, cy = 86, r = 36;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.88;
  const rot = -68.4;
  const cx = w / 2;

  const dateRange = (a, b) => (a && b ? `${fmtDate(a)} - ${fmtDate(b)}` : '-');
  const curSub = s.current.len > 0 ? `${fmtDate(s.current.start, false)} - ${fmtDate(s.current.end, false)}` : fmtDate(s.today, false);

  const side = (x, num, label, sub) => `
  <text x="${x}" y="98" text-anchor="middle" font-size="30" font-weight="700" fill="${C.blue}" filter="url(#glow)">${esc(num)}</text>
  <text x="${x}" y="126" text-anchor="middle" font-size="13" fill="${C.blue}" filter="url(#glowS)">${esc(label)}</text>
  <text x="${x}" y="150" text-anchor="middle" font-size="9.5" fill="${C.teal}">${esc(sub)}</text>`;

  const body = `${frame(w, h)}
  <rect x="14" y="14" width="32" height="32" rx="8" fill="${C.ink}" stroke="${C.blue}" stroke-opacity=".45"/>
  <text x="30" y="34" text-anchor="middle" font-size="12" font-weight="700" fill="${C.purple}" filter="url(#glowS)">&lt;/&gt;</text>
  ${live(w)}
  <line x1="165" y1="56" x2="165" y2="160" stroke="${C.dim}" stroke-opacity=".6"/>
  <line x1="330" y1="56" x2="330" y2="160" stroke="${C.dim}" stroke-opacity=".6"/>
  ${side(82, fmtNum(s.total), 'Total Contributions', s.first ? `${fmtDate(s.first)} - Present` : '-')}
  ${side(412, String(s.longest.len), 'Longest Streak', dateRange(s.longest.start, s.longest.end))}

  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.blue}" stroke-width="5" stroke-linecap="round"
    stroke-dasharray="${arc.toFixed(1)} ${(circ - arc).toFixed(1)}" transform="rotate(${rot} ${cx} ${cy})" filter="url(#glow)">
    <animate attributeName="stroke-opacity" values=".7;1;.7" dur="3.2s" repeatCount="indefinite"/>
  </circle>
  <circle r="3" fill="#fff" filter="url(#glow)">
    <animateMotion dur="5s" repeatCount="indefinite" path="M${cx + r},${cy} A${r},${r} 0 1,1 ${cx - r},${cy} A${r},${r} 0 1,1 ${cx + r},${cy}"/>
  </circle>
  <g transform="translate(${cx} ${cy - r}) scale(1.15)" filter="url(#glow)" class="flick">
    <path d="M0 -11 C3 -6 9 -3 9 3 C9 8 5 11 0 11 C-5 11 -9 8 -9 3 C-9 -1 -6 -3 -4 -7 C-3 -4 -2 -3 0 -2 C1 -5 1 -8 0 -11 Z"
      fill="${C.purple}" fill-opacity=".25" stroke="${C.purple}" stroke-width="1.6" stroke-linejoin="round"/>
  </g>
  <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="30" font-weight="700" fill="${C.purple}" filter="url(#glow)">${s.current.len}</text>
  <text x="${cx}" y="148" text-anchor="middle" font-size="13" font-weight="700" fill="${C.purple}" filter="url(#glowS)">Current Streak</text>
  <text x="${cx}" y="168" text-anchor="middle" font-size="11" fill="${C.teal}">${esc(curSub)}</text>`;
  return svg(w, h, `GitHub streak: ${s.total} contributions, current streak ${s.current.len}, longest streak ${s.longest.len}`, body);
}

function statsCard(st) {
  const w = 495, h = 195;
  const items = [
    ['Total Stars', fmtNum(st.stars), C.amber],
    [`Commits ${st.commitsYear}`, fmtNum(st.commits), C.blue],
    ['Pull Requests', fmtNum(st.prs), C.purple],
    ['Issues', fmtNum(st.issues), C.rose],
    ['Repositories', fmtNum(st.repos), C.teal],
    ['Followers', fmtNum(st.followers), C.cyan],
  ];
  const cells = items.map(([label, val, color], i) => {
    const x = 82 + (i % 3) * 165, y = i < 3 ? 94 : 154;
    return `<text x="${x}" y="${y}" text-anchor="middle" font-size="26" font-weight="700" fill="${color}" filter="url(#glow)">${esc(val)}</text>
  <text x="${x}" y="${y + 20}" text-anchor="middle" font-size="11" fill="${C.dim}">${esc(label)}</text>`;
  }).join('\n  ');
  const body = `${frame(w, h)}
  ${cardTitle('GITHUB STATS', C.blue)}
  ${live(w)}
  <line x1="22" y1="46" x2="${w - 22}" y2="46" stroke="url(#neon)" stroke-opacity=".5"/>
  <line x1="165" y1="64" x2="165" y2="172" stroke="${C.dim}" stroke-opacity=".45"/>
  <line x1="330" y1="64" x2="330" y2="172" stroke="${C.dim}" stroke-opacity=".45"/>
  ${cells}`;
  return svg(w, h, 'GitHub stats', body);
}

function languagesCard(langSize) {
  const w = 495, h = 195;
  const total = [...langSize.values()].reduce((a, b) => a + b, 0) || 1;
  const top = [...langSize.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = top[0]?.[1] || 1;
  const rows = top.map(([name, size], i) => {
    const y = 62 + i * 21;
    const color = NEON[i % NEON.length];
    const bw = Math.max(4, Math.round((size / max) * 280));
    return `<text x="22" y="${y + 8}" font-size="11" fill="${C.text}">${esc(name)}</text>
  <rect x="128" y="${y}" width="280" height="8" rx="4" fill="${C.track}"/>
  <rect class="hbar" x="128" y="${y}" width="${bw}" height="8" rx="4" fill="${color}" filter="url(#glowS)" style="animation-delay:${(i * 0.12).toFixed(2)}s"/>
  <text x="${w - 22}" y="${y + 8}" text-anchor="end" font-size="11" fill="${color}">${((size / total) * 100).toFixed(1)}%</text>`;
  }).join('\n  ');
  const body = `${frame(w, h)}
  ${cardTitle('TOP LANGUAGES', C.purple)}
  ${live(w)}
  ${rows}`;
  return svg(w, h, 'Top languages', body);
}

function activityCard(days) {
  const w = 495, h = 195;
  const last = days.slice(-30);
  const total = last.reduce((a, d) => a + d.count, 0);
  const max = Math.max(1, ...last.map((d) => d.count));
  const x0 = 24, areaW = w - 48, slot = areaW / last.length, bw = Math.max(4, slot - 5);
  const base = 150, maxH = 78;
  const bars = last.map((d, i) => {
    const bh = d.count === 0 ? 2 : Math.max(4, (d.count / max) * maxH);
    const x = x0 + i * slot + (slot - bw) / 2;
    return `<rect class="bar" x="${x.toFixed(1)}" y="${(base - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2"
    fill="${d.count === 0 ? C.track : 'url(#bar)'}" ${d.count ? 'filter="url(#glowS)"' : ''} style="animation-delay:${i * 28}ms"/>`;
  }).join('\n  ');
  const body = `${frame(w, h)}
  ${cardTitle('LAST 30 DAYS', C.teal)}
  <text x="${w - 90}" y="33" text-anchor="end" font-size="11" fill="${C.text}">${fmtNum(total)} contributions</text>
  ${live(w)}
  ${bars}
  <line x1="${x0}" y1="${base + 2}" x2="${w - x0}" y2="${base + 2}" stroke="url(#neon)" stroke-opacity=".7" filter="url(#glowS)"/>
  <text x="${x0}" y="172" font-size="10" fill="${C.dim}">${last[0] ? fmtDate(last[0].date, false) : ''}</text>
  <text x="${w - x0}" y="172" text-anchor="end" font-size="10" fill="${C.dim}">${last.length ? fmtDate(last[last.length - 1].date, false) : ''}</text>`;
  return svg(w, h, `Contribution activity over the last 30 days: ${total} contributions`, body);
}

/* ------------------------------------------------------------------ */
/*  Static neon pieces                                                 */
/* ------------------------------------------------------------------ */
function headerSvg() {
  const w = 1000, h = 290;
  const roles = PROFILE.roles
    .map((r, i) => `${i ? `<tspan fill="${C.dim}"> | </tspan>` : ''}<tspan fill="${col(r.color)}">${esc(r.text)}</tspan>`)
    .join('');
  const typing = PROFILE.typing.map((t, i) => `
  <g opacity="0">
    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.04;.30;.34;1" dur="${PROFILE.typing.length * 3}s" begin="${i * 3}s" repeatCount="indefinite"/>
    <text x="500" y="244" text-anchor="middle" font-size="15"><tspan fill="${C.rose}">~/rifah $ </tspan><tspan fill="${C.blue}">${esc(t)}</tspan></text>
  </g>`).join('');
  const extraDefs = `
  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${C.blue}" stroke-opacity=".10"/></pattern>
  <radialGradient id="gB" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.blue}" stop-opacity=".30"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0"/></radialGradient>
  <radialGradient id="gP" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${C.purple}" stop-opacity=".28"/><stop offset="1" stop-color="${C.purple}" stop-opacity="0"/></radialGradient>
  <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset=".5" stop-color="${C.cyan}" stop-opacity=".16"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>`;
  const body = `
  <rect width="${w}" height="${h}" fill="${C.ink}"/>
  <rect width="${w}" height="${h}" fill="url(#grid)"/>
  <ellipse cx="170" cy="70" rx="360" ry="150" fill="url(#gB)"/>
  <ellipse cx="860" cy="250" rx="360" ry="150" fill="url(#gP)"/>
  <rect y="-40" width="${w}" height="40" fill="url(#scan)"><animate attributeName="y" from="-40" to="${h}" dur="6s" repeatCount="indefinite"/></rect>
  <rect width="${w}" height="3" fill="url(#neon)" filter="url(#glow)"/>
  <rect y="${h - 3}" width="${w}" height="3" fill="url(#neon)" filter="url(#glow)"/>
  <path d="M26 26 H70 M26 26 V70" stroke="${C.cyan}" stroke-width="2" fill="none" filter="url(#glowS)"/>
  <path d="M${w - 26} ${h - 26} H${w - 70} M${w - 26} ${h - 26} V${h - 70}" stroke="${C.rose}" stroke-width="2" fill="none" filter="url(#glowS)"/>
  <text x="500" y="70" text-anchor="middle" font-size="13" letter-spacing="7" fill="${C.teal}" class="pulse">// PORTFOLIO.EXE · ONLINE</text>
  <g class="flick">
    <text x="500" y="145" text-anchor="middle" font-size="52" font-weight="800" letter-spacing="3" fill="url(#neon)" filter="url(#glowL)">${esc(PROFILE.name)}</text>
    <text x="500" y="145" text-anchor="middle" font-size="52" font-weight="800" letter-spacing="3" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8">${esc(PROFILE.name)}</text>
  </g>
  <rect x="300" y="165" width="400" height="2" rx="1" fill="url(#neon)" filter="url(#glow)"/>
  <text x="500" y="203" text-anchor="middle" font-size="19" font-weight="700" filter="url(#glowS)">${roles}</text>
  ${typing}`;
  return svg(w, h, `${PROFILE.name} - Game Developer, Software Engineer, SQA Engineer`, body, { extraDefs });
}

function sectionSvg(title, colorKey) {
  const w = 1000, h = 64, c = col(colorKey);
  const tw = Math.round(title.length * 19.2);
  const extraDefs = `<linearGradient id="fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient>`;
  const body = `
  <path d="M6 20 L20 32 L6 44" fill="none" stroke="${c}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)" class="pulse"/>
  <text x="36" y="41" font-size="24" font-weight="800" letter-spacing="4" fill="${c}" filter="url(#glow)">${esc(title.toUpperCase())}</text>
  <rect x="36" y="52" width="${tw}" height="2.5" rx="1.2" fill="${c}" filter="url(#glow)"/>
  <rect x="${36 + tw}" y="53" width="${w - 36 - tw}" height="1" fill="url(#fade)" opacity=".7"/>`;
  return svg(w, h, title, body, { extraDefs });
}

function dividerSvg() {
  const w = 1000, h = 24;
  const body = `
  <rect x="0" y="11" width="${w}" height="2" fill="url(#neon)" filter="url(#glow)" opacity=".85"/>
  <path d="M500 3 L509 12 L500 21 L491 12 Z" fill="${C.ink}" stroke="${C.purple}" stroke-width="1.6" filter="url(#glow)" class="pulse"/>
  <circle cy="12" r="3" fill="#fff" filter="url(#glow)"><animate attributeName="cx" from="0" to="${w}" dur="5s" repeatCount="indefinite"/></circle>`;
  return svg(w, h, 'divider', body);
}

function aboutSvg() {
  const w = 1000, lineH = 26, top = 118;
  const lines = PROFILE.about.lines;
  const h = top + lines.length * lineH + 40;
  const rows = lines.map((toks, i) => {
    const y = top + i * lineH;
    const spans = toks.map(([t, k]) => `<tspan fill="${col(k)}">${esc(t)}</tspan>`).join('');
    return `<text x="34" y="${y}" font-size="13" fill="${C.dim}" opacity=".7">${i + 1}</text>
  <text x="66" y="${y}" font-size="14" style="white-space:pre" xml:space="preserve">${spans}</text>`;
  }).join('\n  ');
  const body = `${frame(w, h)}
  <rect x="1" y="1" width="${w - 2}" height="42" rx="13" fill="${C.ink}"/>
  <circle cx="26" cy="22" r="6" fill="${C.rose}" filter="url(#glowS)"/><circle cx="46" cy="22" r="6" fill="${C.amber}" filter="url(#glowS)"/><circle cx="66" cy="22" r="6" fill="${C.sky}" filter="url(#glowS)"/>
  <text x="92" y="26" font-size="12" fill="${C.dim}">${esc(PROFILE.about.title)}</text>
  <rect x="1" y="43" width="${w - 2}" height="1.4" fill="url(#neon)" filter="url(#glowS)"/>
  <text x="34" y="78" font-size="14" fill="${C.rose}" filter="url(#glowS)">&gt;</text>
  <text x="54" y="78" font-size="14" fill="${C.text}">${esc(PROFILE.about.command)}</text>
  <line x1="28" y1="92" x2="${w - 28}" y2="92" stroke="${C.dim}" stroke-opacity=".3"/>
  ${rows}
  <rect x="66" y="${top + lines.length * lineH - 14}" width="9" height="17" fill="${C.blue}" filter="url(#glow)"><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;.5;.5;1" dur="1.1s" repeatCount="indefinite"/></rect>`;
  return svg(w, h, 'About: profile.ts', body);
}

function skillsSvg() {
  const w = 1000, fs = 12, cw = fs * 0.602;
  const chipH = 30, gapX = 10, gapY = 8, startX = 190, maxX = w - 22, padY = 20, rowGap = 22;
  let y = padY;
  // chips wrap onto extra lines instead of running off the card
  const rows = PROFILE.skills.map((g) => {
    const c = col(g.color);
    let x = startX, line = 0;
    const chips = g.items.map((it) => {
      const cwid = Math.round(it.length * cw + 26);
      if (x + cwid > maxX && x > startX) { x = startX; line++; }
      const cy = y + line * (chipH + gapY);
      const chip = `<g transform="translate(${x} ${cy})">
    <rect width="${cwid}" height="${chipH}" rx="15" fill="${c}" fill-opacity=".09" stroke="${c}" stroke-opacity=".9" filter="url(#glowS)"/>
    <text x="${cwid / 2}" y="19.5" text-anchor="middle" font-size="${fs}" fill="${c}">${esc(it)}</text></g>`;
      x += cwid + gapX;
      return chip;
    }).join('');
    const hgt = (line + 1) * chipH + line * gapY;
    const block = `<text x="20" y="${y + hgt / 2 + 4}" font-size="12" font-weight="700" letter-spacing="2.4" fill="${c}" filter="url(#glowS)">${esc(g.label)}</text>
  <rect x="164" y="${y + 3}" width="2" height="${hgt - 6}" fill="${c}" filter="url(#glow)"/>
  ${chips}`;
    y += hgt + rowGap;
    return block;
  }).join('\n  ');
  const h = y - rowGap + padY;
  return svg(w, h, 'Skills: ' + PROFILE.skills.map((g) => `${g.label}: ${g.items.join(', ')}`).join('; '), `<rect width="${w}" height="${h}" rx="14" fill="${C.bg}"/>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="13" fill="url(#sheen)"/>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="13" fill="none" stroke="url(#neon)" stroke-width="1.6" filter="url(#glowS)"/>
  ${rows}`);
}

function wrapText(s, max) {
  const out = []; let cur = '';
  for (const word of s.split(' ')) {
    if ((cur + ' ' + word).trim().length > max) { out.push(cur); cur = word; } else cur = (cur + ' ' + word).trim();
  }
  if (cur) out.push(cur);
  return out;
}

function highlightsSvg() {
  const w = 1000, h = 128, tw = 232, gap = 24;
  const tiles = PROFILE.highlights.map((t, i) => {
    const x = i * (tw + gap), c = col(t.color);
    const lines = wrapText(t.label, 30).map((l, j) => `<text x="${tw / 2}" y="${88 + j * 15}" text-anchor="middle" font-size="11" fill="${C.dim}">${esc(l)}</text>`).join('');
    return `<g transform="translate(${x} 0)">
    <rect x="1" y="1" width="${tw - 2}" height="${h - 2}" rx="14" fill="${C.bg}" stroke="${c}" stroke-opacity=".9" stroke-width="1.5" filter="url(#glowS)"/>
    <rect x="1" y="1" width="${tw - 2}" height="${h - 2}" rx="14" fill="${c}" fill-opacity=".05"/>
    <text x="${tw / 2}" y="60" text-anchor="middle" font-size="32" font-weight="800" fill="${c}" filter="url(#glow)" class="flick">${esc(t.value)}</text>
    ${lines}</g>`;
  }).join('\n  ');
  return svg(w, h, 'Highlights: ' + PROFILE.highlights.map((t) => `${t.value} ${t.label}`).join('; '), tiles);
}

function buttonSvg(l) {
  const w = 220, h = 52, c = col(l.color);
  const body = `
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="12" fill="${C.bg}" stroke="${c}" stroke-width="1.6" filter="url(#glow)"/>
  <rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="12" fill="${c}" fill-opacity=".07"/>
  <text x="18" y="23" font-size="14" font-weight="800" letter-spacing="1" fill="${c}" filter="url(#glowS)">${esc(l.label)}</text>
  <text x="18" y="40" font-size="10.5" fill="${C.dim}">${esc(l.detail)}</text>
  <path d="M${w - 34} 32 L${w - 20} 18 M${w - 32} 18 H${w - 20} V30" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowS)" class="pulse"/>`;
  return svg(w, h, `${l.label} - ${l.detail}`, body);
}

function footerSvg() {
  const w = 1000, h = 120;
  const wave = (amp, phase, y0) => {
    let d = '';
    for (let x = -200; x <= w + 200; x += 10) {
      const y = y0 + Math.sin(((x + phase) / 200) * Math.PI * 2) * amp;
      d += (d ? ' L' : 'M') + `${x} ${y.toFixed(2)}`;
    }
    return d;
  };
  const body = `
  <g class="wave"><path d="${wave(9, 0, 34)}" fill="none" stroke="${C.blue}" stroke-width="2.2" filter="url(#glow)"/></g>
  <g class="wave2"><path d="${wave(7, 70, 40)}" fill="none" stroke="${C.purple}" stroke-width="1.8" filter="url(#glow)" opacity=".85"/></g>
  <text x="500" y="88" text-anchor="middle" font-size="13" letter-spacing="3" fill="${C.teal}" filter="url(#glowS)" class="pulse">FORGED IN NEON · STATS REFRESH AUTOMATICALLY</text>
  <text x="500" y="108" text-anchor="middle" font-size="10.5" fill="${C.dim}">game dev · web &amp; app · qa automation · research</text>`;
  return svg(w, h, 'Footer', body);
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */
async function write(name, content) {
  await writeFile(path.join(OUT, name), content, 'utf8');
  console.log('  wrote', path.join(OUT, name));
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(DEMO ? 'Using DEMO data' : `Fetching live data for ${USER}...`);

  const data = DEMO ? fetchDemo() : await fetchLive();
  const streak = computeStreaks(data.days);

  await write('streak.svg', streakCard(streak));
  await write('stats.svg', statsCard(data.stats));
  await write('languages.svg', languagesCard(data.langSize));
  await write('activity.svg', activityCard(data.days));

  await write('header.svg', headerSvg());
  await write('divider.svg', dividerSvg());
  await write('footer.svg', footerSvg());
  await write('about.svg', aboutSvg());
  await write('skills.svg', skillsSvg());
  await write('highlights.svg', highlightsSvg());
  for (const [id, title, color] of [
    ['about', 'About', 'rose'], ['stack', 'Tech Stack', 'blue'], ['highlights', 'Highlights', 'purple'],
    ['analytics', 'Live GitHub Analytics', 'teal'],
  ]) await write(`section-${id}.svg`, sectionSvg(title, color));
  for (const l of PROFILE.links) await write(`btn-${l.id}.svg`, buttonSvg(l));

  console.log(`Done. total=${streak.total} current=${streak.current.len} longest=${streak.longest.len}`);
}

main().catch((err) => { console.error('Failed:', err.message); process.exit(1); });
