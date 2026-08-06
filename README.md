# figma-layout-spec

[![skills.sh](https://skills.sh/b/kunchit/figma-layout-spec)](https://skills.sh/kunchit/figma-layout-spec)

Decompose a Figma page/frame into sections, write a layout-first SPEC, wait for
approval, then implement one section at a time.

Portable Agent Skill — works in Cursor, Claude Code, Codex, and any harness
with **Figma MCP** (`get_metadata`, `get_design_context`, `get_screenshot`).

**Use when:** user pastes a full-page Figma URL, asks to break down / decompose
a design before implementing, or wants layout fidelity without pixel-perfect
polish. Complements a browser CDP `getComputedStyle` measure loop (verify
computed layout after it lands).

## What it does

1. **Phase A — Map.** `get_metadata` on the page/frame, decompose into
   implementable sections with nodeIds and risks. No code.
2. **Phase B — SPEC.** Writes a SPEC file (`.cursor/plans/figma-{slug}.md` or
   `docs/figma/{slug}.md`) from `spec-template.md`: section table, ASCII wires,
   Auto Layout → CSS map, reuse guesses, asset crop check. **Stops and waits
   for approval.**
3. **Phase C — Implement.** One approved section per turn. Layout pass only
   (structure / order / gap / padding / alignment / sizing). No absolute
   positioning unless the node has no Auto Layout. Honors the Figma hint
   priority ladder (Code Connect → docs → annotations → tokens → raw hex) and
   the asset rules (exported assets only, never hand-authored SVG).
4. **Phase D — Optional measure.** Hand off to a browser CDP
   `getComputedStyle` loop if proof is wanted.

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

## Files

- `SKILL.md` — the skill (process control: decompose → spec → gated implement)
- `spec-template.md` — SPEC file template used in Phase B

## License

MIT
