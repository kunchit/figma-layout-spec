# Library Table/Grid — Figma width to column width

Load this when a section is a data-table component (antd Table, MUI DataGrid,
TanStack Table, a plain `<table>` with `<col>`), not a flex copy of the Figma
row. The core rule lives in SKILL.md hard rule 7; the arithmetic is here.

## Why the naive mapping breaks

In Figma the child `width` you read off the inspector is the **text/content
box**. Gap and padding belong to the parent Auto Layout frame. A table library's
`column.width` is the **whole cell**, padding included. Paste one into the other
and every column loses `pad x 2` of content space: headers wrap, and the columns
you left flexible absorb the leftover width.

## Conversion (antd Table; adapt names per library)

| Figma | Table |
|-------|-------|
| parent `itemSpacing` (gap) | `cellPaddingInline` = gap/2. Each cell pads both sides, so two pads equal one gap |
| parent padding-inline | extra pad on the first cell (left) and last cell (right), included in those column widths |
| child Fixed width | `column.width` = content + (cell pad x 2). First/last also add leftover row pad |
| child Fill | omit `column.width`. Use `table-layout: fixed` so leftover width lands here |
| header `whitespace-nowrap` | nowrap on header cells. Wrapping must not shrink columns |
| row/frame width | `scroll.x` / min-width of the table |
| Figma expand col + first data col, code is nest/tree Table | one `column.width` = both cell widths. Toggle in that cell. Do not add `Table.EXPAND_COLUMN` expecting an extra `<td>` |

Header and body column sets often disagree in the Figma file. Pick one, and say
which in the SPEC.

## Nested / tree tables

With antd `children` / `childrenColumnName`, Figma's expand column is **not** its
own `<td>`. The toggle icon is appended into the first data cell
(`ant-table-cell-with-append`). Spec those two Figma columns as **one**
`column.width` — the sum of both computed cell widths — and lay the toggle out
inside that cell (flex + the Figma gap between toggle and text).
`Table.EXPAND_COLUMN` does not add a separate cell in nest mode, so a CDP check
will report N-1 columns and a short name-column x offset.

## Worked failures

Both from one back-office settings page.

**Pasted Figma width.** Figma column 73px, cells pad 16+16, code set
`width: 73`. Header text is 65px, gets 73-32 = 41px, wraps.

**Split the expand column.** Figma expand 32 + first data col 100 declared as
two antd columns. Nest mode appended the toggle into the data cell, so the name
started at x=124 instead of 180. Correct value is one column at
16 + 32 + 16 + 100 + 8 = 172.
