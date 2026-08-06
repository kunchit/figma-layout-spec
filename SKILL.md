---
name: figma-layout-spec
description: >-
  Decompose a Figma page/frame into sections, write a layout-first SPEC (with
  ASCII wire guides), wait for approval, then implement one section at a time.
  Use when the user pastes a full-page Figma URL, asks to break down / decompose /
  สเปค before implement, wants markdown/ASCII layout guides, or wants layout
  fidelity without pixel-perfect polish. Pair with a browser CDP measure gate
  (getComputedStyle) after layout lands.
---

# Figma Layout Spec

**Portable:** Agent Skills format. Works in Cursor, Claude Code, Codex, and any
harness with **Figma MCP** (`get_metadata`, `get_design_context`, `get_screenshot`,
optional `get_variable_defs` / `get_code_connect_map`). No Cursor-only APIs.

**Honest scope:** This skill is **process control** (decompose → spec → gated
implement). It does **not** magically fix bad Figma structure or skip layout drift
from Tailwind-IR → your stack. Layout target = direction / order / gap / padding /
alignment / sizing — not pixel-perfect type.

**ASCII wire = human guide only.** Boxes show order / nesting / rough relative
size. They do **not** replace section table, `nodeId`, or AL → CSS map. Layout
fidelity comes from Auto Layout facts, not from drawing prettier boxes.

**Requires:** Working Figma MCP. No Figma tools → say so and stop.

**Related:** After a section’s layout is accepted, use a measured/CDP loop
(`getComputedStyle`, `getBoundingClientRect`) if the user wants measured proof.

## Hard rules

1. **Never implement the whole page in one shot.** Full-page `get_design_context`
   truncates; treat page URL as a map, not a codegen target.
2. **No code until SPEC is written and user approves** (unless user explicitly
   says “skip approve / just do it”).
3. **Preserve Figma structure.** Do not invent nicer flex/grid. Do not “improve UX”
   or “apply best practices” that rewrite stacks.
4. **MCP React+Tailwind output = layout IR only.** Adapt to the project’s real
   stack (components, CSS approach, tokens). Never paste IR as final code.
5. **One section per implement turn** after approval.

## Pipeline

### Phase A — Map (no code)

1. Parse Figma URL → `fileKey` + `nodeId` (`232-1313` → `232:1313`). Branch URLs:
   use `branchKey` as fileKey when present.
2. Call **`get_metadata`** on the page/frame node.
3. If metadata is huge, save/parse offline; do not dump the whole tree into the
   reply.
4. Decompose into **implementable sections** (header, filters, table, footer, …).
   Each section needs: name, `nodeId`, role, Auto Layout hint if visible
   (horizontal/vertical/none), child summary, risks (absolute, unnamed frames,
   instance variants, no AL).

**Completion:** section list with nodeIds + risks. Optional: rough page ASCII
wire in chat (preview only). No code.

### Phase B — SPEC (no code)

Write a SPEC file in the repo (prefer one of):

- `.cursor/plans/figma-{slug}.md`
- `docs/figma/{slug}.md`
- path the user names

Use the template in [`spec-template.md`](spec-template.md).

SPEC must include:

- Source URL + fileKey/nodeId
- Goal: **layout-first** (structure/spacing/align); polish deferred
- Section table (order, nodeId, depends-on)
- **ASCII wire (required):**
  - One **page-level** wire: top→bottom (or L→R) section boxes matching implement order
  - One **per-section** wire for each section: direct children only (name + AL hint H/V)
  - Plain monospace boxes (`+---+` / `| |`); no Unicode art required
  - Label regions by section name; put `nodeId` on the line above or inside the box
  - Show nesting with indented inner boxes when a section has clear sub-regions
  - Do **not** invent regions absent from Figma metadata
  - Do **not** encode px gaps/padding in the wire — those live in the AL map / notes
- AL → CSS map convention for this project (see Phase C)
- Reuse guesses (design-system / local components) — mark guesses as guesses
- Out of scope (pixel type, animations unless asked)
- Implement order (dependencies first)
- **Asset Crop Check**: For non-Auto Layout / image frames, inspect `get_design_context` CSS in Phase B to catch `overflow: hidden` wrappers and inner image negative offsets (`top: -XX%`, `height: YY%`) so SPEC coordinates account for cropped assets.

**Completion:** SPEC path printed (include that ASCII wires are in SPEC). **Stop and wait for approval.**

### Phase C — Implement (after approval only)

For **one** approved section per turn:

1. `get_design_context` on that section’s `nodeId` (not the whole page).
2. `get_screenshot` for visual reference.
3. Optional: `get_variable_defs`, `get_code_connect_map` when tokens/components matter.
4. If truncated → `get_metadata` on section → fetch children one by one.
5. **Layout pass only first:** map Auto Layout → project layout primitives.
   Use the section ASCII wire only to verify **child order / nesting**; use the
   AL → CSS map for gap/padding/align/sizing. Never invent layout from the wire
   alone.

   | Figma | CSS / layout |
   |-------|----------------|
   | HORIZONTAL / VERTICAL | `flex-direction` row/column |
   | `itemSpacing` | `gap` |
   | padding | `padding` |
   | primary/counter align | `justify-content` / `align-items` |
   | Hug / Fill / Fixed | fit-content / `flex: 1` / fixed size |

6. Do **not** use absolute positioning unless that node has no Auto Layout.
7. Reuse existing project components when role matches; keep **outer tree** =
   Figma tree. Library defaults must not replace the skeleton.
8. Stop when structure + spacing + alignment look right vs screenshot.
   Defer color/type polish unless user asked in the same turn.

**Completion:** section done + what remains. Ask before next section.

### Phase D — Optional measure

If user wants proof: use a browser CDP loop
(`getBoundingClientRect` / `getComputedStyle` for gap/padding/size). Do not claim
“measured” without real computed numbers.

## Anti-prompts (never invent these goals)

Do not optimize for: “make it beautiful”, “polish”, “improve UX”, “modernize”,
“feel free to restructure”, “use CSS Grid because it’s better”, “regenerate the
whole screen”.

If the user says those during Phase C, **refuse the rewrite** and offer a
diff-scoped layout fix instead.

## When NOT to use this skill

- Single small component/card → implement that node directly (design-to-code
  flow); skip full decompose.
- Design is mostly absolute / flattened images → say layout fidelity will stay
  weak; ask for Auto Layout or pick a smaller AL subtree.
- User only wants a visual vibe from a screenshot → wrong tool.

## Tool name portability

Call Figma MCP tools by these names (server wrapper may differ by host):

- `get_metadata`
- `get_design_context`
- `get_screenshot`
- `get_variable_defs`
- `get_code_connect_map`

If the host exposes Desktop selection MCP without URL, still record the resolved
`nodeId` in the SPEC so other agents can resume from the same file.
