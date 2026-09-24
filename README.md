# figma-layout-spec

[![skills.sh](https://skills.sh/b/kunchit/figma-layout-spec)](https://skills.sh/kunchit/figma-layout-spec)

Decompose a Figma page/frame into sections, write a layout-first SPEC, wait for
approval, then implement one section at a time.

Portable Agent Skill — works in Cursor, Claude Code, Codex, and any harness
with **Figma MCP** (`get_metadata`, `get_design_context`, `get_screenshot`).

**Use when:** user pastes a full-page Figma URL, asks to break down / decompose
a design before implementing, or wants layout + paint fidelity (structure,
spacing, background, border, radius, shadow, text colour) without type-family
or motion polish. Ships a Playwright measure gate so verification is a text
diff of computed styles vs Figma numbers, closed by one element-by-element
visual diff and a drift re-read of the Figma node (Done check).

## What it does

1. **Phase A — Map.** `get_metadata` on the page/frame, decompose into
   implementable sections with nodeIds and risks. No code.
2. **Phase B — SPEC.** Writes a SPEC file (`.cursor/plans/figma-{slug}.md` or
   `docs/figma/{slug}.md`) from `spec-template.md`: section table, ASCII wires,
   Auto Layout → CSS map, column-width table for Table/Grid (Figma child `w`
   is not `column.width`), reuse guesses, asset crop check. **Stops and waits
   for approval.**
3. **Phase C — Implement.** One approved section per turn. Layout pass only
   (structure / order / gap / padding / alignment / sizing). No absolute
   positioning unless the node has no Auto Layout. Honors the Figma hint
   priority ladder (Code Connect → docs → annotations → tokens → raw hex) and
   the asset rules (exported assets only, never hand-authored SVG).
4. **Phase D — Measure gate.** Write `expected.json` from the Figma Auto
   Layout facts, run `measure/measure.mjs` (Playwright, `getComputedStyle` /
   `getBoundingClientRect`), loop on the text diff until `0 fail, 0 missing`.
   One screenshot at the end. Seconds per run instead of an LLM round trip
   per check.

Hard rules: never implement a whole page in one shot, no code before SPEC
approval, preserve Figma structure (no "improvements"), MCP React+Tailwind
output is layout IR only.

## Install

Via [skills.sh](https://skills.sh/kunchit/figma-layout-spec) (works with
Cursor, Claude Code, Codex, and more):

```bash
npx skills add kunchit/figma-layout-spec
```

Or manually — clone and link into your agent skills folders:

```bash
git clone https://github.com/kunchit/figma-layout-spec.git ~/dev/figma-layout-spec

# Cursor / ~/.agents convention
mkdir -p ~/.agents/skills ~/.cursor/skills
ln -s ~/dev/figma-layout-spec ~/.agents/skills/figma-layout-spec
ln -s ~/dev/figma-layout-spec ~/.cursor/skills/figma-layout-spec

# Claude Code
mkdir -p ~/.claude/skills
ln -s ~/dev/figma-layout-spec ~/.claude/skills/figma-layout-spec
```

## Usage

```
/figma-layout-spec https://www.figma.com/design/<fileKey>/<name>?node-id=<id>&m=dev
```

Or just paste a Figma URL and ask to decompose / write a spec before
implementing.

## Requirements

- Working Figma MCP server (tools: `get_metadata`, `get_design_context`,
  `get_screenshot`; optional `get_variable_defs`, `get_code_connect_map`).
  No Figma tools → the skill says so and stops.
- Node 18+ and `playwright` resolvable from the project root (`@playwright/test`
  installed) or via `PW_ROOT`, for the Phase D measure gate.

## Files

- `SKILL.md` — the skill (process control: decompose → spec → gated implement)
- `spec-template.md` — SPEC file template used in Phase B
- `table-notes.md` — Figma width → `column.width` arithmetic for table libraries
  (loaded only when a section is a data table)
- `measure/measure.mjs` — Phase D measure gate; `measure/expected.example.json`
  is the input format; `measure/selfcheck.sh` runs it against `measure/fixture/`
  (`PW_ROOT=/path/to/a/project/with/playwright sh measure/selfcheck.sh`)
- `fieldmap/fieldmap.mjs` — **optional** Phase B assist: maps Figma sample
  strings to project data fields with Jev (TypeSafe System One), picking only
  from candidate fields you list and flagging the rest as `ASK BACKEND`.
  Node 18+ and `OPENROUTER_API_KEY` (or `TYPESAFE_API_KEY`), no install — plain
  fetch; without a key, write the map by hand. `fieldmap/example.json` is the
  input format, `fieldmap/selfcheck.sh` proves the request builder with no API
  key (`--dry`).
- `component/component.mjs` — **optional** Phase B assist, same route and key:
  picks one project component per Figma node (Table vs Descriptions, Modal vs
  Drawer) from the components you list, with the runner-up, and flags `DECIDE`
  rows. `component/example.json` is the input format, `component/selfcheck.sh`
  runs `--dry` with no key.

## License

MIT
