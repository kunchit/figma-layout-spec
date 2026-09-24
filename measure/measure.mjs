#!/usr/bin/env node
// Figma → DOM measure gate. Compares real computed layout numbers against an
// expected.json derived from Figma Auto Layout facts. Text diff out, exit 1 on
// any FAIL/MISSING, so an agent can loop "fix → run → read diff" without
// screenshots.
//
//   node measure.mjs expected.json [--url URL] [--dump] [--json]
//                                  [--screenshot out.png] [--storage auth.json]
//
// Resolves `playwright` from the current working directory (any project with
// @playwright/test installed), or from $PW_ROOT.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : true;
};
const opt = {
  url: flag('--url'),
  dump: flag('--dump') === true,
  json: flag('--json') === true,
  screenshot: flag('--screenshot'),
  storage: flag('--storage'),
};
const specPath = args[0];
if (!specPath) {
  console.error('usage: node measure.mjs expected.json [--url URL] [--dump] [--json] [--screenshot out.png] [--storage auth.json]');
  process.exit(2);
}

const specDir = path.dirname(path.resolve(specPath));
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const tol = Number(spec.tolerance ?? 1);
let url = opt.url ?? spec.url;
if (!url) { console.error('no url: set "url" in spec or pass --url'); process.exit(2); }
if (!/^[a-z]+:\/\//i.test(url)) url = pathToFileURL(path.resolve(specDir, url)).href;

// ---- playwright resolution -------------------------------------------------
function loadPlaywright() {
  const roots = [process.env.PW_ROOT, process.cwd()].filter(Boolean);
  for (const root of roots) {
    try {
      const req = createRequire(path.join(path.resolve(root), 'package.json'));
      return req('playwright');
    } catch { /* try next */ }
  }
  console.error(`cannot resolve "playwright" from ${roots.join(', ')}.\n` +
    'run from a project with @playwright/test installed, or set PW_ROOT=/path/to/that/project');
  process.exit(2);
}

// ---- normalisation ---------------------------------------------------------
const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0');
function normColor(v) {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  let m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/);
  if (m) {
    let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    const rgb = `#${hex2(+m[1])}${hex2(+m[2])}${hex2(+m[3])}`;
    if (a <= 0.001) return 'transparent';
    return a >= 0.999 ? rgb : rgb + hex2(a * 255);
  }
  m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length === 8 && h.endsWith('ff')) h = h.slice(0, 6);
    return '#' + h;
  }
  return s;
}
const COLOR_KEYS = /color$/i;
function norm(key, v) {
  if (COLOR_KEYS.test(key)) return normColor(v);
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return v;
  const s = v.trim();
  const px = s.match(/^(-?[\d.]+)px$/);
  if (px) return parseFloat(px[1]);
  if (/^-?[\d.]+$/.test(s)) return parseFloat(s);
  return s.toLowerCase();
}
function same(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= tol;
  return String(a) === String(b);
}

// ---- browser side ----------------------------------------------------------
const DUMP_KEYS = ['display', 'flexDirection', 'justifyContent', 'alignItems', 'gap',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontSize', 'fontWeight',
  'lineHeight', 'color', 'backgroundColor', 'borderRadius', 'borderTopWidth', 'boxShadow',
  'width', 'height', 'childCount', 'painted'];

// Runs in the page. `keys` = style/geometry keys to read.
function readNode(el, keys) {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const out = {};
  for (const k of keys) {
    if (k === 'width' || k === 'height' || k === 'x' || k === 'y') out[k] = Math.round(r[k] * 100) / 100;
    else if (k === 'childCount') out[k] = el.children.length;
    else if (k === 'text') out[k] = el.textContent.trim();
    // `painted: true` — the element must put ink on screen. A 0-area box paints nothing even
    // with a box-shadow (the shadow is the box's own shape), and a transparent bg with no
    // border is invisible. This is the check that catches "the divider is there in the DOM".
    else if (k === 'painted') {
      const area = r.width * r.height > 0;
      const bg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
      const border = ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none');
      const shadow = cs.boxShadow !== 'none' && area;
      out[k] = area && (bg || border || shadow || cs.backgroundImage !== 'none');
    }
    else out[k] = cs[k];
  }
  return out;
}

// ---- main ------------------------------------------------------------------
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: spec.viewport ?? { width: 1440, height: 900 },
  storageState: opt.storage ?? spec.storageState ?? undefined,
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
if (spec.waitFor) await page.locator(spec.waitFor).first().waitFor();

// Optional `steps` open a surface that has no URL of its own (a drawer, a tab, a modal):
// [{ "click": "sel" } | { "fill": "sel", "text": "…" } | { "waitFor": "sel" }] in order.
for (const step of spec.steps ?? []) {
  if (step.click) await page.locator(step.click).first().click();
  if (step.fill) await page.locator(step.fill).first().fill(step.text ?? '');
  if (step.waitFor) await page.locator(step.waitFor).first().waitFor();
}

const nodes = Array.isArray(spec.nodes)
  ? spec.nodes
  : Object.entries(spec.nodes ?? {}).map(([name, n]) => ({ name, ...n }));

const results = [];
for (const n of nodes) {
  const loc = page.locator(n.selector);
  const count = await loc.count();
  if (count === 0) { results.push({ name: n.name, selector: n.selector, missing: true }); continue; }
  const target = loc.nth(n.nth ?? 0);
  const keys = opt.dump ? DUMP_KEYS : Object.keys(n.expect ?? {});
  const actual = await target.evaluate(readNode, keys);
  const diffs = [];
  if (!opt.dump) {
    for (const [k, exp] of Object.entries(n.expect ?? {})) {
      const a = norm(k, actual[k]), e = norm(k, exp);
      if (!same(a, e)) diffs.push({ key: k, expected: e, actual: a, delta: typeof a === 'number' && typeof e === 'number' ? +(a - e).toFixed(2) : undefined });
    }
  }
  results.push({ name: n.name, selector: n.selector, figma: n.figma, count, actual, diffs, props: keys.length });
}
if (opt.screenshot) await page.screenshot({ path: opt.screenshot, fullPage: true });
await browser.close();

// ---- report ----------------------------------------------------------------
if (opt.json) { console.log(JSON.stringify({ url, tolerance: tol, results }, null, 2)); }
else if (opt.dump) {
  for (const r of results) {
    if (r.missing) { console.log(`MISSING ${r.name}  selector "${r.selector}"`); continue; }
    console.log(`${r.name}  ${r.selector}${r.count > 1 ? `  (${r.count} matches, nth ${0})` : ''}`);
    for (const [k, v] of Object.entries(r.actual)) console.log(`  ${k}: ${JSON.stringify(norm(k, v))}`);
  }
} else {
  let pass = 0, fail = 0, missing = 0, okProps = 0, allProps = 0;
  for (const r of results) {
    if (r.missing) { missing++; console.log(`MISSING ${r.name}  selector "${r.selector}"`); continue; }
    allProps += r.props; okProps += r.props - r.diffs.length;
    if (r.diffs.length === 0) { pass++; console.log(`PASS ${r.name}  (${r.props} props)`); continue; }
    fail++;
    const multi = r.count > 1 ? `  [${r.count} matches, checked nth 0]` : '';
    for (const d of r.diffs) {
      const delta = d.delta === undefined ? '' : `  (Δ ${d.delta > 0 ? '+' : ''}${d.delta})`;
      console.log(`FAIL ${r.name} ${d.key}: expected ${JSON.stringify(d.expected)} got ${JSON.stringify(d.actual)}${delta}${multi}`);
    }
  }
  console.log(`--- ${pass} pass, ${fail} fail, ${missing} missing  (${okProps}/${allProps} props, tolerance ${tol}px)`);
  process.exitCode = fail + missing > 0 ? 1 : 0;
}
