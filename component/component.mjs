#!/usr/bin/env node
// Optional Phase B helper, sibling of ../fieldmap/fieldmap.mjs: decide which
// project component renders each Figma node, using Jev (TypeSafe System One) as
// a closed-set selector. YOU list the candidates from the project's own
// component library — the model only picks among them, and can answer
// __plain_markup__ or __no_match__ rather than reaching for the nearest name.
//
// This is the "Table or Descriptions, Modal or Drawer, Select or Radio.Group"
// decision that recurs on every page. Jev is text only (no image input), so it
// judges node names, layout props, variants and the strings inside — never the
// picture. A pick is a proposal for the SPEC, not a measured fact.
//
//   node component.mjs component.json [--threshold 0.75] [--model M] [--json] [--dry]
//
// Route: OPENROUTER_API_KEY -> openrouter.ai/api/v1/systemone, else
// TYPESAFE_API_KEY -> api.typesafe.ai/v1/systemone. Same body either way.
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
  console.error('usage: node component.mjs component.json [--threshold 0.75] [--model M] [--json] [--dry]');
  process.exit(2);
}

const spec = JSON.parse(readFileSync(path.resolve(specPath), 'utf8'));
const nodes = spec.nodes ?? [];
const candidates = spec.candidates ?? {};
if (!nodes.length) { console.error('no "nodes" in spec'); process.exit(2); }
if (Object.keys(candidates).length < 2) {
  console.error('"candidates" needs at least 2 components — list them from the project\'s own library');
  process.exit(2);
}
const PLAIN = '__plain_markup__'; // correct answer: a div and CSS, no component
const NOMATCH = '__no_match__';   // open question: needs a component nobody listed

// ---- request ---------------------------------------------------------------
// Question ids are for code only and are never sent, so each node's full
// meaning goes in its instructions.
const key = (n, i) => `q${i}_${String(n.id ?? '').replace(/\W/g, '') || i}`;
const criteria = {
  ...candidates,
  [PLAIN]: 'No component is needed: plain markup and CSS render this — a heading, a wrapper, a spacer, a line of body text, an icon on its own.',
  [NOMATCH]: 'This clearly wants a real component, but none of the listed ones renders it. A new component, or a library the project has not adopted.',
};
// ponytail: one question per node, all sharing the section's state. Chunk a
// section that ever exceeds Jev's state budget.
const state = {
  screen: spec.context ?? '',
  section: spec.section ?? '',
  all_nodes: nodes.map((n) => ({ name: n.name, role: n.role ?? '' })),
};
const questions = Object.fromEntries(nodes.map((n, i) => [key(n, i), {
  type: 'choice',
  instructions: {
    task: 'Which project component should render this Figma node?',
    node_name: n.name,
    where_it_sits: n.role ?? '',
    layout: n.layout ?? '',
    variants: n.variants ?? '',
    text_inside: n.text ?? '',
    warning: `Judge the behaviour the node needs, not the resemblance of its name. Answer ${NOMATCH} rather than the closest-looking component: a wrong pick is rewritten at implement time, when it is expensive. Use ${PLAIN} only when no component is warranted at all.`,
  },
  criteria,
}]));

const route = process.env.OPENROUTER_API_KEY
  ? { url: 'https://openrouter.ai/api/v1/systemone', token: process.env.OPENROUTER_API_KEY }
  : process.env.TYPESAFE_API_KEY
    ? { url: 'https://api.typesafe.ai/v1/systemone', token: process.env.TYPESAFE_API_KEY }
    : null;
// Bare id: TypeSafe takes it as-is, OpenRouter maps it to typesafe/jev-1.13.
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
// runner_up makes a split distribution legible: "Table 0.52 / Descriptions"
// says which two the section is really between, without opening the JSON.
const rows = nodes.map((n, i) => {
  const a = out.answers[key(n, i)];
  const p = a.probabilities[a.choice] ?? 0;
  const ranked = Object.entries(a.probabilities).sort((x, y) => y[1] - x[1]);
  const status = p < opt.threshold || a.choice === NOMATCH ? 'DECIDE'
    : a.choice === PLAIN ? 'plain'
      : 'picked';
  return {
    node: n.node ?? n.id ?? '',
    name: n.name,
    component: a.choice,
    runner_up: ranked[1]?.[0] ?? '',
    p,
    confidence: a.confidence,
    status,
  };
});

if (opt.json) {
  console.log(JSON.stringify({ model: out.model, threshold: opt.threshold, usage: out.usage, rows }, null, 2));
} else {
  console.log('| Node | nodeId | Component | Runner-up | p | conf | Status |');
  console.log('|---|---|---|---|---|---|---|');
  for (const r of rows) {
    console.log(`| ${r.name} | ${r.node} | ${r.component} | ${r.runner_up} | ${r.p.toFixed(2)} | ${r.confidence.toFixed(2)} | ${r.status} |`);
  }
}
const decide = rows.filter((r) => r.status === 'DECIDE').length;
const plain = rows.filter((r) => r.status === 'plain').length;
const cost = out.usage?.cost != null ? `, $${Number(out.usage.cost).toFixed(6)}` : '';
console.log(`--- ${rows.length - decide - plain} picked, ${plain} plain, ${decide} decide  (threshold ${opt.threshold}, ${out.model}${cost})`);
process.exitCode = decide > 0 ? 1 : 0;
