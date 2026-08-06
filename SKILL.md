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
6. **Never hand-author an icon or image.** No invented `<svg>`/`<path>`, no
   placeholder, no dropped icon. Use the exported asset (see Phase C assets).

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
- **Absolute map**: for no-AL sections, record each child's `x/y/w/h` **relative
  to the no-AL container** (subtract container origin) plus paint order — the
  implement turn must not re-measure.
- **Asset Crop Check**: For non-Auto Layout / image frames, inspect `get_design_context` CSS in Phase B to catch `overflow: hidden` wrappers and inner image negative offsets (`top: -XX%`, `height: YY%`) so SPEC coordinates account for cropped assets.
- **Assets table**: icons/images per section with their box size and a plan
  (commit the exported file / reuse a project icon whose glyph matches / wire to
  a real data source). Exported asset URLs expire ~7 days.

**Completion:** SPEC path printed (include that ASCII wires are in SPEC). **Stop and wait for approval.**

### Phase C — Implement (after approval only)

For **one** approved section per turn:

1. `get_design_context` on that section’s `nodeId` (not the whole page). This is
   the primary call — `get_metadata` / `get_screenshot` orient and validate, they
   never substitute for it.
2. `get_screenshot` for visual reference.
3. Optional: `get_variable_defs`, `get_code_connect_map` when tokens/components matter.
4. If truncated → `get_metadata` on section → fetch children one by one.
5. **Honor response hints by priority** — earlier overrides later:
   1. Code Connect snippet → use that codebase component directly.
   2. Component documentation link → follow it.
   3. Design annotation → follow the designer note.
   4. Design token / CSS variable → map to the project's token system.
   5. Raw hex / absolute position → weakest; lean on the screenshot for intent.
6. **Layout pass only first:** map Auto Layout → project layout primitives.
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

7. **No-AL (absolute) subtrees** — when a section has no Auto Layout:
   - Container: `position: relative`, fixed Figma w/h. Do not fluid-scale it.
   - Children: `position: absolute`, Figma `x/y` → `left/top` offsets from the
     **absolute map** in the SPEC (already relative to the container).
   - Alternative: single-cell grid overlay (all children `grid-area: 1/1` +
     margin offsets) — matches MCP IR. Pick one convention per project, record
     it in the SPEC.
   - Paint order = Figma child order (later children on top). Add `z-index`
     only when DOM order must differ.
   - Do not "fix" overlaps by converting to flex — overlap is often intentional
     (podiums, badges, decorations). Ask before restructuring a no-AL subtree.
   - Responsive caveat: absolute subtrees do not reflow. Keep container fixed
     size, or scale the whole container — flag the choice in the SPEC.
8. **Reuse before writing.** Search the project for an existing component,
   layout pattern, or token that matches the design intent, and use it instead
   of generating an equivalent. Keep the **outer tree** = Figma tree; library
   defaults must not replace the skeleton.
9. **Assets — icons and images.** `get_design_context` returns them as `<img>`
   with a remote asset `src`. Rules:
   - Render every icon/image from its **exported asset**. Never hand-write
     `<svg>`/`<path>`, never author an icon file, never leave a placeholder —
     you do not have the vector data, so anything you draw is wrong.
   - The asset URL works as `src` immediately but **expires in ~7 days**. For
     committed code: download and commit the exact asset bytes, or wire dynamic
     content images to the project's real data source (API / CDN / props).
   - Reuse a project icon component only when the **glyph** clearly matches — a
     name match is not enough.
   - Size explicitly: fixed-size container with **both** width and height
     (icons usually square, e.g. `24×24`, `overflow: hidden`), leaf `<img>`
     fills it (`100%` or fixed px). Never `auto` — it renders at intrinsic size.
   - Cropped frames: honor the SPEC's asset crop notes (wrapper `overflow:
     hidden` + inner negative offset), do not re-derive them here.
10. Stop when structure + spacing + alignment look right vs screenshot.
    Defer polish (Phase E) unless user asked in the same turn.

**Completion:** section done + what remains. Ask before next section.

### Phase D — Optional measure

If user wants proof: use a browser CDP loop
(`getBoundingClientRect` / `getComputedStyle` for gap/padding/size). Do not claim
“measured” without real computed numbers.

### Phase E — Optional polish (on request only)

Polish = applying **Figma's own** visual props faithfully — color, type
(family/size/weight/line-height), radius, border, shadow, icon/art assets.
Polish is **not** beautifying: no new styles, no taste, no “improvements”.

- Run only after layout is accepted; one section or whole page per request.
- Token-first: map Figma values to project tokens/classes. Hex/px literal only
  when no token exists — note the gap, do not invent tokens.
- Structure is frozen: polish touches styles and assets, never the tree.
- Verify vs `get_screenshot`; CDP-measure if user wants numbers.

## Error recovery

- On any Figma MCP error: **stop and read the message** before retrying. Do not
  retry the identical call blind.
- URL has no `node-id` (file-only URL) → ask the user for a node-specific URL.
  Never guess a nodeId, never pass an empty one.
- Timeout → retry against a smaller node (a child from the section table).
- Truncated → `get_metadata` on the node, then fetch children one by one.
- **Never** silently fall back to hand-writing a section from the screenshot
  alone while `get_design_context` can still return context.

## Anti-prompts (never invent these goals)

Do not optimize for: “make it beautiful”, “polish”, “improve UX”, “modernize”,
“feel free to restructure”, “use CSS Grid because it’s better”, “regenerate the
whole screen”.

If the user says those during Phase C, **refuse the rewrite** and offer a
diff-scoped layout fix instead. (A user-requested **Phase E polish pass** —
Figma's own visual props, no improvisation — is fine; the ban is on inventing
taste.)

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

When the host's `get_design_context` accepts a `skillNames` parameter, pass
`figma-layout-spec` (prefix `resource:` if this skill was loaded as an MCP
resource). It is logging only and does not change behavior.

If the host exposes Desktop selection MCP without URL, still record the resolved
`nodeId` in the SPEC so other agents can resume from the same file.
