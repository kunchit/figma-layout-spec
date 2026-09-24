---
name: figma-layout-spec
description: >-
  Decompose a Figma page/frame into sections, write a layout + paint SPEC (with
  ASCII wire guides, per-section bg/border/radius/shadow/text colour, text→field
  map), wait for approval, then implement one section at a time. Use when the
  user pastes a full-page Figma URL, asks to break down / decompose / สเปค
  before implement, or says a page "ไม่ตรงกับ figma". Ships a Playwright
  measure gate (measure/measure.mjs, incl. `painted`) that diffs computed
  styles against Figma numbers, and closes every section with a Done check:
  Figma drift re-read + one element-by-element visual diff.
---

# Figma Layout Spec

**Portable:** Agent Skills format. Works in Cursor, Claude Code, Codex, and any
harness with **Figma MCP** (`get_metadata`, `get_design_context`, `get_screenshot`,
optional `get_variable_defs` / `get_code_connect_map`). No Cursor-only APIs.

**Honest scope:** This skill is **process control** (decompose → spec → gated
implement). It does **not** magically fix bad Figma structure or skip layout drift
from Tailwind-IR → your stack. Target = **layout + paint**: direction / order /
gap / padding / alignment / sizing **and** each section's background, border,
radius, shadow and text colour. Type family, motion and new design tokens stay
out unless asked. Paint is in scope because a reader sees a missing grey ground,
an extra border or an invisible divider long before a 23-vs-24 gap — a "layout
only" page that ships those is not done (see Done check).

**ASCII wire = human guide only.** Boxes show order / nesting / rough relative
size. They do **not** replace section table, `nodeId`, or AL → CSS map. Layout
fidelity comes from Auto Layout facts, not from drawing prettier boxes.

**Requires:** Working Figma MCP. No Figma tools → say so and stop.

**Verify = measure, then look once, properly.** Phase D runs `measure/measure.mjs`
(Playwright, `getComputedStyle` / `getBoundingClientRect`) against an
`expected.json` written from the Figma facts. One run takes a few seconds and
prints a text diff. But the gate is a mirror of the SPEC: it cannot see a SPEC
that drifted from Figma, a fact the SPEC never recorded, or an element that is
in the DOM and paints nothing. So Phase D ends with **one element-by-element
visual diff** (Done check) — not a screenshot loop, one disciplined pass.

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
7. **Never flatten a container into its children.** If a Figma frame wraps
   several sections (a white card holding a sub-header and a list), that frame
   is a section of its own with its own paint; its children are nested sections.
   Decomposing straight to the leaves loses the card and ships loose bands.
8. **Every sample text maps to a data field** in the SPEC before implement
   (`A1201 → Unit.unitNumber`, not "the room code"). A field guessed at
   implement time picks the longest string the entity has and then widens the
   Figma box to fit it.
9. **A library component's defaults are not Figma facts.** When a section is
   mapped to a library component (antd `Segmented`, `Card`, `Table`, …), diff
   the component's rendered tokens (bg, border, radius, shadow, text colour)
   against the node's paint facts and record the deltas; fix them at the theme
   level when the Figma component is shared.
10. **Library Table/Grid: Figma child `width` is not `column.width`.**
   In Figma that number is the text/content box — gap and padding live on the
   parent. `column.width` (antd, MUI DataGrid, HTML `<col>`) is the whole cell,
   padding included. Write both numbers in the SPEC column-width table and
   compute the cell width, or headers wrap while flexible columns eat the
   leftover. Nested/tree tables append the expand toggle into the first data
   cell, so those two Figma columns are **one** `column.width`. Arithmetic,
   per-library names, and worked failures: [`table-notes.md`](table-notes.md)
   — read it before writing a column set.

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
   instance variants, no AL). If the section will be a table
   library (not a flex copy of the Figma row), put "Figma w ≠ cell w" in Risks.
   If Figma drew an expand/toggle column and the code is a nest/tree table, also
   put "nest expand merges into first data col".

5. **Ground and containment (section 0).** Record the root frame's own fill
   (the page ground — e.g. Gray/100 under white cards, or white), whether that
   ground runs edge to edge or inside a margin, which frames are cards (fill,
   radius, border, shadow) and which are bare, and any full-width bars (a
   tabs bar on its own white strip). A card on the wrong ground, or a ground
   that stops at the content margin, is the most visible miss there is.
6. **Node snapshot.** From `get_metadata`, note the root's direct-child ids and
   names in the SPEC. The Done check compares against it: Figma frames get
   edited after the SPEC is written, and a green gate cannot tell.
7. **Page-level spacing.** Read the root frame's own layout: Auto Layout
   direction / `itemSpacing` / padding if it has AL, otherwise each section's
   `y` + `h` on the frame. Record the gap between every pair of adjacent
   sections and the frame's bottom padding. Section-internal AL does not
   capture this, and it is where "too close to the pagination" bugs come from.

**Delegated inspection.** When Figma is read through an agent (e.g. an
`inspector`) instead of calling the MCP tools directly, the agent must return
**Auto Layout facts per node** — direction, padding, itemSpacing, primary /
counter alignment, Hug/Fill/Fixed with w×h, text style — as a child tree,
plus the page-level spacing above. Never accept a verdict ("same as X",
"identical controls", "right-aligned") in place of those facts; a verdict
compares copy, not layout. Re-dispatch with the field list if it comes back
as prose.

Dispatch granularity follows the phase, not a per-page habit:

| Phase | One dispatch per | Fetches |
|---|---|---|
| A — Map | page | `get_metadata` on the root: sections, node snapshot, ground, page spacing |
| B — SPEC facts | **section** | `get_design_context` on that section's node, AL tree down to every control it builds, paint, provenance label per value |
| B — exit rule | section's leftovers | every still-`assumed` / metadata-only node of that section, in one call |

A section dispatch fetches a different node each time, so it re-fetches nothing.
Squeezing a whole page's facts into one return is what turns component numbers
into `assumed`. Never split below a section (one call per card or column).

**Completion:** section list with nodeIds + risks + page-level spacing.
Optional: rough page ASCII wire in chat (preview only). No code.

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
- **Column-width table** when the section is a library Table/Grid. Template in
  `spec-template.md`, arithmetic in [`table-notes.md`](table-notes.md). Each column: Figma content width, Hug/Fill/Fixed, cell
  width, and the arithmetic. Fill is not the header's hug width. `scroll.x` is
  the Figma row/frame width, not the sum of the children. Header and body
  columns often disagree. Pick one set and say why.
- Reuse guesses (design-system / local components) — mark guesses as guesses
- **Paint table per section**: background, border (width/colour), radius,
  shadow, text colour — `measured` from `get_design_context`. These are cheap to
  read and the first thing a reviewer sees; a SPEC without them is the reason
  "layout done" pages come back with "ยังไม่ตรง design".
- **Text → data field map**: every sample string in the frame and the field
  that renders it (hard rule 8). Unknown field = question for the backend, not a
  guess at implement time. Optional assist for a long frame:
  [`fieldmap/fieldmap.mjs`](fieldmap/fieldmap.mjs) — see *Field map assist* below.
- **Library component delta table**: for each library component used, Figma
  paint vs the component's default tokens, and where the delta is fixed (theme
  vs local prop). Hard rule 9.
- **Provenance table**: every spacing number labelled `measured` / `derived` /
  `assumed`, plus any node where `get_design_context` returned metadata-only.
  It fails soft on large nodes, so a container you never read looks like one you
  did. Only a `measured` number may become a gate assertion. Template in
  `spec-template.md`
- **Container reconcile**: `Σ children + gap × (n−1) + padding == parent h`, from
  `get_metadata` geometry, for every container before writing its spacing. Also
  decide whether a divider is a sibling in the parent's gap or nested in the item
  — getting that backwards misstates the row-to-row distance
- **One full-frame screenshot**, downscaled if tall. Per-section shots crop away
  the very gaps that go wrong
- Out of scope (pixel type, animations unless asked)
- Implement order (dependencies first)
- **Page-level spacing table**: root frame AL (direction / gap / padding) or,
  for a freeform frame, each section's `y` / `h`; the gap between adjacent
  sections; the frame's bottom padding; which sections are pinned (sticky /
  fixed) and the space the flow must reserve for them. Template in
  `spec-template.md`.
- **Absolute map**: for no-AL sections, record each child's `x/y/w/h` **relative
  to the no-AL container** (subtract container origin) plus paint order — the
  implement turn must not re-measure.
- **Asset Crop Check**: For non-Auto Layout / image frames, inspect `get_design_context` CSS in Phase B to catch `overflow: hidden` wrappers and inner image negative offsets (`top: -XX%`, `height: YY%`) so SPEC coordinates account for cropped assets.
- **Assets table**: icons/images per section with their box size and a plan
  (commit the exported file / reuse a project icon whose glyph matches / wire to
  a real data source). Exported asset URLs expire ~7 days.

#### Field map assist (optional — Jev / TypeSafe)

A table frame carries thirty sample strings and every one of them needs a real
field before implement. [`fieldmap/fieldmap.mjs`](fieldmap/fieldmap.mjs) turns
that into a closed-set selection: **you** list the candidate fields from the
project's own types and Jev only picks among them. Two extra outcomes are always
on the list, so the model never has to reach for the closest-looking field:
`__static_label__` (design copy that never changes with data — a correct answer)
and `__unknown_field__` (clearly a data value, nothing listed fits — an open
question for the backend).

```bash
node ~/.claude/skills/figma-layout-spec/fieldmap/fieldmap.mjs docs/figma/{slug}.fieldmap.json
```

Prints the SPEC's text→field rows with `p` / `confidence` per row, and exits 1
while any row is `ASK BACKEND` (below `--threshold`, default 0.75, or
`__unknown_field__`). Those rows go to the backend owner; they never become a
SPEC row on their own. `static` rows need no field and do not fail the run.

- **Optional, never required.** Node 18+ and a key, no install: it posts plain
  JSON to `/v1/systemone` either way — `OPENROUTER_API_KEY` →
  `openrouter.ai/api` (OpenRouter mirrors TypeSafe's API, bills it, and returns
  `usage.cost`; no TypeSafe account needed), else `TYPESAFE_API_KEY` →
  `api.typesafe.ai`. No key → write the map by hand, as before. The skill's own
  requirement is still Figma MCP only.
- **Cost is not a reason to skip it or to batch it oddly:** a five-string
  section measured $0.00009 per run.
- **Jev takes text only** — no image, audio or video input. It covers this map
  and nothing else in the pipeline. The measure gate, the drift check and the
  column arithmetic stay deterministic; the Done-check visual diff needs eyes on
  a picture, so it stays a human/vision pass.
- A returned field is a proposal, not a `measured` fact. It earns a SPEC row
  once you recognise the field; the length check in the row is still yours.
- `--dry` prints the request without calling the API; `fieldmap/selfcheck.sh`
  proves the builder against `fieldmap/example.json`.

#### Component pick assist (optional — Jev / TypeSafe)

The same closed-set trick for the other recurring question: Table or
Descriptions, Modal or Drawer, Select or Radio.Group.
[`component/component.mjs`](component/component.mjs) takes the section's nodes
and **your** list of project components — from Code Connect, `src/components`,
or the UI library in use — and returns one pick per node.

```bash
node ~/.claude/skills/figma-layout-spec/component/component.mjs docs/figma/{slug}.component.json
```

Prints a row per node with `p`, `confidence` and the **runner-up**, and exits 1
while any row is `DECIDE`. Two outcomes are always on the list so the model
never reaches for the nearest name: `__plain_markup__` (a div and CSS, no
component — a correct answer) and `__no_match__` (wants a real component, none
listed fits — your call, possibly a new one).

- Give each node its `name`, `role`, `layout`, `variants` and the `text` inside.
  Layout is what separates a Table from a Descriptions list; the name rarely is.
- The runner-up is the point of the report. `Table 0.52 / Descriptions` tells you
  which two the section is actually between, which is the argument worth having
  before Phase C, not after.
- A pick is a SPEC proposal, never a `measured` fact. It is cheap to overrule
  here and expensive to overrule once the section is built.
- Same route, key and cost profile as the field map. `--dry` needs no key;
  `component/selfcheck.sh` proves the builder against `component/example.json`.

#### Exit rule — no guessed node reaches the gate

Before asking for approval, walk the Provenance table. Every node that will get
an `expected.json` entry — each control or component the section builds, not
only the section container — must have its asserted keys `measured`, and no node
may still read "metadata-only". For each one that does not:

1. Run `get_design_context` on **that node itself** (the component instance, or
   the child that failed soft), not on the section again.
2. Still truncated → `get_metadata` on it, then its children one by one.
3. Relabel the numbers you read as `measured`.

A value still `derived` / `assumed` after that stays out of the gate and goes on
the approval message as an open item, with its node id. Batch a section's
leftover nodes into one call (or one `inspector` dispatch), not one per node.

This is the per-component inspect that used to happen **after** a section came
back "ไม่ตรง figma". A gate built on a SPEC with 9 `assumed` and 14 `derived`
numbers passes on exactly the values nobody read.

**Completion:** SPEC path printed (include that ASCII wires are in SPEC), exit
rule met or its open items listed. **Stop and wait for approval.**

### Phase C — Implement (after approval only)

For **one** approved section per turn:

1. `get_design_context` on that section’s `nodeId` (not the whole page). This is
   the primary call — `get_metadata` / `get_screenshot` orient and validate, they
   never substitute for it.
   If the host also ships a design-to-code skill that declares itself a
   prerequisite of `get_design_context` (e.g. Figma's own `figma-design-to-code`),
   load it and follow its per-node guidance — but its scope is **one node**. It
   does not override this skill's section gating: still one approved section per
   turn, still no whole-page codegen, still layout pass before polish.
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

   **Table components.** Figma drew a flex row with gap and padding; the code is
   a table library. Do not copy the row as flex, and do not copy Figma widths
   into `column.width` — use the conversion and arithmetic in
   [`table-notes.md`](table-notes.md), driven by the SPEC's column-width table.

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
   **Reuse still requires step 1.** "Same Figma component / instance as the one
   already built" is not evidence the existing code is right — it may never
   have been measured. Run `get_design_context` on *this* section's node and
   diff its AL facts (gap tiers, alignment, sizing, label type, button
   placement) against the component before mounting it; fix the component or
   add a variant when they differ. Same for icons: match the exported asset's
   path/glyph, not a name or a screenshot description.
   **A new node never justifies deleting existing UI.** Retract only the part
   of an earlier decision the new node contradicts; before removing anything
   visible, cite the frame that shows it gone. Removals get their own approval
   line in the SPEC, never a row inside a bulk-approved table.
9. **Assets — icons and images.** `get_design_context` returns them as `<img>`
   with a remote asset `src`. Hard rule 6 applies: exported asset only, never
   hand-authored. Mechanics for this pass:
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
10. **Paint pass in the same turn.** Apply the section's paint table (bg,
    border, radius, shadow, text colour) with project tokens where they exist.
    Decorative elements (dividers, hairlines, shadows) must be real boxes with
    area: a `height: 0` div with a `box-shadow` paints **nothing** — the shadow
    is the shape of the box. Use `height: 1` + background (and a negative
    margin if it must not take flow space), and gate it with `painted: true`.
11. Run the Phase D measure gate for this section's nodes. Loop
    "fix → run → read diff" until it prints `0 fail, 0 missing`. Then do the
    Done check below before reporting. Never loop on screenshots.
    Defer type-family / motion polish (Phase E) unless user asked.

**Completion:** section done + what remains. Ask before next section.

### Phase D — Measure gate (default, every section)

Script: [`measure/measure.mjs`](measure/measure.mjs). Plain Node + the
project's own `playwright` (any repo with `@playwright/test` installed; else
`PW_ROOT=/path/to/such/project`). Format reference:
[`measure/expected.example.json`](measure/expected.example.json).

1. **Write `expected.json` next to the SPEC** (`docs/figma/{slug}.expected.json`)
   while implementing the section — one entry per Figma node you built:
   `name`, `figma` nodeId, DOM `selector`, and `expect` with the numbers taken
   from the AL facts, not from the rendered page:

   | Figma fact | expect key |
   |---|---|
   | direction H / V | `display: "flex"`, `flexDirection: "row" \| "column"` |
   | itemSpacing | `gap` |
   | padding T/R/B/L | `paddingTop` … `paddingLeft` |
   | primary / counter align | `justifyContent` / `alignItems` |
   | Fixed w×h (border-box) | `width`, `height` (`getBoundingClientRect`, includes padding) |
   | child count / order | `childCount` |
   | text style | `fontSize`, `fontWeight`, `lineHeight`, `color` |
   | fills / radius | `backgroundColor`, `borderRadius` |
   | border / shadow | `borderTopWidth`, `borderColor`, `boxShadow` |
   | decorative element exists on screen | `painted: true` (area > 0 and bg / border / shadow / image) |

   Colors accept hex or `rgb()`; px values as numbers. Anything else in
   `expect` is read verbatim from `getComputedStyle` and compared as a string.
   Hug/Fill sizes: omit `width`/`height`, assert the parent's gap/padding
   instead. Optional top-level: `viewport`, `waitFor`, `storageState`
   (Playwright auth JSON for logged-in pages), `tolerance` (px, default 1),
   per-node `nth` when a selector matches several elements.

2. **Run from the project root** with the dev server up:

   ```bash
   node ~/.claude/skills/figma-layout-spec/measure/measure.mjs docs/figma/{slug}.expected.json --url http://localhost:3000/page
   ```

   Output is one line per mismatch, e.g.
   `FAIL filters gap: expected 12 got 8  (Δ -4)`, then
   `--- 2 pass, 1 fail, 0 missing (14/17 props, tolerance 1px)`; exit 1 on
   any FAIL/MISSING. `MISSING` = selector matched nothing → fix the selector
   or the markup, never delete the entry.

3. **Loop on the diff.** Fix the CSS the diff names, rerun. Do not screenshot
   between runs. `--dump` prints the actual values of the standard key set
   for every selector (use it once to find the right selectors or to see what
   the page renders now); `--json` for machine output; `--screenshot out.png`
   grabs the full page in the same run, for the single final human look.

4. **Report the last run's summary line verbatim.** "Measured" without that
   line is a claim, not a measurement. Numbers off by more than tolerance
   stay FAIL — do not raise tolerance to pass.

Ceiling (`ponytail`): one selector per node, no pixel diff, no table column
widths — assert `th`/`td` widths as separate nodes if a Table/Grid needs it.
`measure/selfcheck.sh` proves the script against `measure/fixture/`.

### Done check (before the word "done", every section and the page)

The gate proves "the page matches the SPEC". These three prove "the SPEC still
matches Figma and the page matches the picture". Skip any of them and the
report is a claim.

1. **Drift check.** `get_metadata` on the root again; compare direct children
   with the SPEC's node snapshot. Any added / removed / renamed child → write a
   dated drift row in the SPEC and re-spec that section before continuing.
2. **Visual diff, element by element.** Take `get_screenshot` of the node and a
   2× crop of the live page at the same region (`--screenshot`, or a throwaway
   Playwright script). Walk the Figma image top-to-bottom and tick every visible
   thing against the live crop: ground colour, each card's fill/border/radius,
   every divider line, every control's track/pill/shadow, icon glyphs, text
   weight and colour, spacing that is obviously off. Report the ticks and the
   misses, not "looks the same". A miss here is a bug even if the gate is green.
3. **Gate line.** The last `--- N pass, 0 fail, 0 missing` summary, verbatim,
   after the two checks above (the visual diff usually adds nodes).

Real misses this check would have caught in one pass, all on a green gate: a
filter Select the designer had deleted; three loose bands instead of one card;
dividers that never painted; cells widened to fit the wrong data field; a
Segmented track invisible because the theme's `colorBgLayout` was white; the
page ground and card borders.

### Phase E — Optional polish (on request only)

Polish = what the paint pass (Phase C step 10) left out: type family, letter
spacing, motion, hover/focus states, icon/art fidelity. Colour, border, radius
and shadow are **not** polish any more — they ship with the section.
Polish is **not** beautifying: no new styles, no taste, no “improvements”.

- Run only after layout is accepted; one section or whole page per request.
- Token-first: map Figma values to project tokens/classes. Hex/px literal only
  when no token exists — note the gap, do not invent tokens.
- Structure is frozen: polish touches styles and assets, never the tree.
- Verify with the Phase D measure gate (add `fontFamily`, `letterSpacing` … to
  `expect`), then the Done check.

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
whole screen”, “copy Figma width onto column.width”.

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
