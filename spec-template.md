# Figma layout SPEC — {title}

## Source

- URL:
- fileKey:
- root nodeId:
- Date:

## Goal

Layout + paint: structure, order, direction, gap, padding, alignment, sizing,
and per section background / border / radius / shadow / text colour.
Not in scope unless listed: type family, motion, new design tokens.

## Section 0 — ground and containment

- Page ground (root fill): `measured`
- Ground extent: edge to edge / inside the content margin
- Full-width bars (tabs, headers) and their fill:
- Cards (fill, radius, border, shadow) vs bare bands:

| Frame | nodeId | card? | fill | radius | border | shadow |
|-------|--------|-------|------|--------|--------|--------|
| | | yes / no | | | none / … | none / … |

## Node snapshot (for the Done check)

Root direct children from `get_metadata`, in order — `id · name · w×h`:

- 

Re-read at Done check on: ____ → unchanged / drift rows below.

ASCII wires below = human guide (order / nesting / rough size). Contract for
implement fidelity = section table + AL map + nodeIds.

## Stack notes

- Project styling:
- Prefer components:
- IR rule: Figma MCP React+Tailwind = reference only; adapt, do not paste.

## Sections (implement order)

| # | Section | nodeId | AL (H/V/none) | Depends on | Risks |
|---|---------|--------|---------------|------------|-------|
| 1 | | | | | |
| 2 | | | | | |

## Wire — page

```
+---------------------------+
| header                    |
+---------------------------+
| filters                   |
+---------------------------+
| table                     |
+---------------------------+
| footer                    |
+---------------------------+
```

## Wire — per section

### {section name} (`{nodeId}`) — {H|V|none}

```
+---------------------------+
| left          | right     |
+---------------------------+
```

Notes: children order = Figma order; AL = {H|V|none}; gap/pad in AL map only.

## Paint per section (`measured`)

| Section | bg | border | radius | shadow | text colour(s) |
|---------|----|--------|--------|--------|----------------|
| | | | | | |

## Text → data field

Every sample string in the frame, and what renders it. "Unknown" is a question,
not a licence to guess at implement time.

| Figma text | Section | Field / expression | Length check (longest real value fits the box?) |
|-----------|---------|--------------------|-----------------------------------------------|
| `A1201` | room cell | `Unit.unitNumber` | 5–8 chars, fits 78 |

Source of each row: `read` (recognised from the codebase) or `jev p=0.xx`
(proposed by `fieldmap/fieldmap.mjs`, then recognised). Rows the helper left as
`ASK BACKEND` live here instead, as open questions:

| Figma text | Section | Asked | Status |
|-----------|---------|-------|--------|
| `ว่าง` | status chip | is this `Unit.status` or a derived label? | open |

## Library component deltas

| Section | Component | Figma paint | Component default | Fix at |
|---------|-----------|-------------|-------------------|--------|
| | e.g. antd `Segmented` | track `#F5F5F5`, pill r6, shadow 0 2 8 .05 | `trackBg=colorBgLayout`, r4, 3-layer shadow | theme.tsx `components.Segmented` |

## Provenance (fill this in as you go, not at the end)

Every number below carries how it was obtained. This is not bookkeeping — an
unlabelled guess is indistinguishable from a measurement, and the measure gate
will happily assert it and go green.

| Label | Means |
|-------|-------|
| `measured` | read directly from `get_design_context` on that node |
| `derived` | arithmetic over `get_metadata` geometry (say which nodes) |
| `assumed` | neither — a plausible value, still unverified |

**Gate rule: `expected.json` may only assert a `measured` number.** A `derived`
one goes in the SPEC prose but not the gate until it is measured. An `assumed`
one is a question for the designer, not an expectation.

**`get_design_context` fails soft.** On a large node it returns metadata only,
with no error, so you can believe you read a container you never saw. When that
happens, record it here against the node id rather than filling the number in
from a child — and derive from the geometry of *all* siblings, never from one
child generalised to the rest.

| Node | Number | How | Note |
|------|--------|-----|------|
| | | measured / derived / assumed | e.g. "get_design_context returned metadata-only" |

**Exit rule (before approval):** every node headed for `expected.json` is
`measured` on the keys it asserts; each `derived` / `assumed` / metadata-only row
got a `get_design_context` on that node itself. Rows still open after that:

- [ ] none, or: ____ (node id, number, why it is still open)

### Reconcile every container against its children

Before writing a container's spacing, check it adds up:

```
Σ children heights + gap × (n − 1) + paddingTop + paddingBottom  ==  parent height
```

`get_metadata` already carries every child's `y`/`h`, so this costs no extra
call. If it does not reconcile, the spacing is wrong — do not write it down.
Record the arithmetic:

| Container | Σ children | gaps | padding | = | parent `h` | reconciles? |
|-----------|-----------|------|---------|---|------------|-------------|
| | | | | | | yes / no → |

Watch for a **divider that is a sibling, not a child of the item** it appears to
belong to: a 0-height line between rows sits *in* the parent's gap, so the row's
own box excludes it and the row-to-row distance is `gap + 0 + gap`, not `gap`.
Folding it into the row is exactly the error this table catches.

### Full-frame screenshot (required)

Take one screenshot of the whole root frame, downscaled if it is tall. Spacing
errors are obvious in a picture and invisible in a table of numbers. Per-section
screenshots do not substitute — they crop away the gaps between sections.

- Full-frame screenshot taken: [ ] path:

## AL → project map

| Figma | This project |
|-------|----------------|
| horizontal stack | |
| vertical stack | |
| gap / itemSpacing | |
| padding | |
| Hug / Fill / Fixed | |

## Page-level spacing

Root frame: AL {H|V|none}, gap = , padding = . Freeform frame → fill `y` / `h`.

| Section | nodeId | y | h | gap to next | How | pinned? (sticky / fixed) |
|---------|--------|---|---|-------------|-----|--------------------------|
| | | | | | measured / derived / assumed | |

Bottom padding of the frame: . Space the flow reserves for pinned bars
(bar height + gap above it): .

## Column widths (Table/Grid only)

Figma `w` is the child's content. `column.width` is the whole cell, padding
included. Don't paste Figma `w` into `column.width`.

- Parent AL: gap=  pad=  nowrap headers? yes/no
- Figma row/frame width (`scroll.x` / min-width):
- Header and body widths differ? pick header / body / mixed, and why:
- Nest/tree Table? expand col merges into first data col — one Cell w, arithmetic = expand cell + first data cell:

| # | Col | nodeId | Figma content w | Hug/Fill/Fixed | Cell w | Arithmetic |
|---|-----|--------|-----------------|----------------|--------|------------|
| 1 | | | | | | content + pad×2. Fill = omit width |

## Component reuse (guesses)

Reuse is a guess until the section node's `get_design_context` has been
diffed against the component (Phase C step 8). Record the diff result here.

| Figma | Code (path or package) | Confidence | AL diff vs node |
|-------|------------------------|------------|-----------------|
| | | guess / confirmed | not yet / matches / differs: … |

## Removals (each needs its own approval)

| Existing UI | Frame that shows it gone | Approved |
|-------------|--------------------------|----------|
| | | [ ] |

## Assets (icons / images)

Exported asset URLs expire ~7 days — committed code must use downloaded bytes
or a real data source. Never hand-authored SVG.

| Section | Asset | Box (w×h) | Plan | Crop note |
|---------|-------|-----------|------|-----------|
| | | | commit file / project icon / dynamic src | overflow+offset if cropped |

## Out of scope

-

## Approval

- [ ] User approved section order
- [ ] User approved ASCII wires (structure only)
- [ ] User approved first section to implement: `{name}` (`{nodeId}`)

## Progress

| Section | Status | Notes |
|---------|--------|-------|
| | pending / done | |

## Done check

- [ ] Drift: `get_metadata` re-read on ____, children match the Node snapshot (else drift rows below)
- [ ] Visual diff, element by element, Figma shot vs 2× live crop — ticks / misses listed:
- [ ] Every decorative element (divider, hairline, shadow) has a `painted: true` gate node

| Date | Node | SPEC said | Node now | Fix |
|------|------|-----------|----------|-----|
| | | | | |

## Measure gate

- expected.json: `docs/figma/{slug}.expected.json` (format: skill `measure/expected.example.json`)
- Every asserted number is `measured` per the Provenance table — a gate built
  from a guess passes and proves nothing
- Gate proved non-vacuous: feed one expectation a wrong value, confirm it FAILs
- Run: `node <skill>/measure/measure.mjs docs/figma/{slug}.expected.json --url http://localhost:PORT/path`
- Last summary line:
