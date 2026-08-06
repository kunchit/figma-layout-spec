# Figma layout SPEC — {title}

## Source

- URL:
- fileKey:
- root nodeId:
- Date:

## Goal

Layout-first: structure, order, direction, gap, padding, alignment, sizing.
Not in scope unless listed: pixel-perfect type, motion, new design tokens.

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

## AL → project map

| Figma | This project |
|-------|----------------|
| horizontal stack | |
| vertical stack | |
| gap / itemSpacing | |
| padding | |
| Hug / Fill / Fixed | |

## Component reuse (guesses)

| Figma | Code (path or package) | Confidence |
|-------|------------------------|------------|
| | | guess / confirmed |

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
