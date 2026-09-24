#!/usr/bin/env node
// Optional Phase B helper (hard rule 8): map every Figma sample string to a real
// data field, using Jev (TypeSafe System One) as a closed-set selector. The
// candidate fields come from the project's own types — the model only picks
// among them and can answer __none__, so an unknown field becomes a question
// for the backend instead of a guess at implement time.
//
// Jev is text only (no image, audio or video input), so this covers the SPEC's
// text -> field map, never the Done-check visual diff.
//
//   node fieldmap.mjs fieldmap.json [--threshold 0.75] [--model M] [--json] [--dry]
//
// Route: OPENROUTER_API_KEY -> openrouter.ai/api/v1/systemone, else
// TYPESAFE_API_KEY -> api.typesafe.ai/v1/systemone. OpenRouter mirrors
// TypeSafe's System One API at that path with the same body, maps a bare model
// id into its typesafe/ namespace, and adds usage.cost to the response.
// No SDK, no install: plain fetch, Node 18+.
// --dry prints the request without calling anything (no key needed).
import { readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : true;
};
const opt = {
  threshold: Number(flag('--threshold') ?? 0.75),
  model: flag('--model'),
  json: flag('--json') === true,
  dry: flag('--dry') === true,
};
const specPath = args[0];
if (!specPath) {
  console.error('usage: node fieldmap.mjs fieldmap.json [--threshold 0.75] [--model M] [--json] [--dry]');
  process.exit(2);
}

const spec = JSON.parse(readFileSync(path.resolve(specPath), 'utf8'));
const strings = spec.strings ?? [];
const candidates = spec.candidates ?? {};
if (!strings.length) { console.error('no "strings" in spec'); process.exit(2); }
if (Object.keys(candidates).length < 2) {
  console.error('"candidates" needs at least 2 fields — list them from the project\'s own types');
  process.exit(2);
}
const STATIC = '__static_label__';   // correct answer: design copy, no field
const UNKNOWN = '__unknown_field__'; // open question: looks like data, nothing fits

// ---- request ---------------------------------------------------------------
// Question ids are for code only and are never sent, so the full meaning of
// each sample goes in its instructions.
const key = (s, i) => `q${i}_${String(s.id ?? '').replace(/\W/g, '') || i}`;
const criteria = {
  ...candidates,
  [STATIC]: 'Static design copy that never changes with data: a section title, a column header, a button label, an empty-state sentence.',
  [UNKNOWN]: 'This string clearly comes from data — a value that differs row to row or record to record — but no listed field renders it.',
};
// ponytail: one request for every string in the section. Chunk if a section
// ever exceeds Jev's 32k-token state budget.
const state = {
  screen: spec.context ?? '',
  section: spec.section ?? '',
  all_sample_strings: strings.map((s) => ({ text: s.text, where: s.role ?? '' })),
};
const questions = Object.fromEntries(strings.map((s, i) => [key(s, i), {
  type: 'choice',
  instructions: {
    task: 'Which field of the application data model renders this sample string in the Figma design?',
    sample_text: s.text,
    where_it_sits: s.role ?? '',
    warning: `Answer ${UNKNOWN} rather than the closest-looking field: a wrong field ships a wrong column width and wrong data. Use ${STATIC} only for text that is the same for every record.`,
  },
  criteria,
}]));

const route = process.env.OPENROUTER_API_KEY
  ? { url: 'https://openrouter.ai/api/v1/systemone', token: process.env.OPENROUTER_API_KEY }
  : process.env.TYPESAFE_API_KEY
    ? { url: 'https://api.typesafe.ai/v1/systemone', token: process.env.TYPESAFE_API_KEY }
    : null;
// Bare id: TypeSafe takes it as-is, OpenRouter maps it to typesafe/jev-1.13.
// Pinned rather than jev-latest so a model release cannot move the thresholds.
const body = { model: opt.model ?? 'jev-1.13', state, questions };

if (opt.dry) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }
if (!route) { console.error('no key: export OPENROUTER_API_KEY (or TYPESAFE_API_KEY)'); process.exit(2); }

const res = await fetch(route.url, {
  method: 'POST',
  headers: { Authorization: `Bearer ${route.token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
if (!res.ok) { console.error(`${route.url} → ${res.status}: ${(await res.text()).slice(0, 400)}`); process.exit(2); }
const out = await res.json();

// ---- report ----------------------------------------------------------------
const rows = strings.map((s, i) => {
  const a = out.answers[key(s, i)];
  const p = a.probabilities[a.choice] ?? 0;
  const status = p < opt.threshold || a.choice === UNKNOWN ? 'ASK BACKEND'
    : a.choice === STATIC ? 'static'
      : 'mapped';
  return { sample: s.text, node: s.node ?? '', field: a.choice, p, confidence: a.confidence, status };
});

if (opt.json) {
  console.log(JSON.stringify({ model: out.model, threshold: opt.threshold, usage: out.usage, rows }, null, 2));
} else {
  console.log('| Sample | nodeId | Field | p | conf | Status |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.sample} | ${r.node} | ${r.field} | ${r.p.toFixed(2)} | ${r.confidence.toFixed(2)} | ${r.status} |`);
  }
}
const asked = rows.filter((r) => r.status === 'ASK BACKEND').length;
const statics = rows.filter((r) => r.status === 'static').length;
const cost = out.usage?.cost != null ? `, $${Number(out.usage.cost).toFixed(6)}` : '';
console.log(`--- ${rows.length - asked - statics} mapped, ${statics} static, ${asked} ask-backend  (threshold ${opt.threshold}, ${out.model}${cost})`);
process.exitCode = asked > 0 ? 1 : 0;
