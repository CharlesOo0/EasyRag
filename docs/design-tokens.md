# Design tokens — the "Atlas" identity

EasyRag's corpus *is* a reference atlas (the CIA World Factbook, an encyclopedia
of places). The UI borrows the visual grammar of a printed reference map rather
than the generic shadcn default:

- a cool bone-white ground (not warm cream), ink text with a faint green bias;
- **hairline rules** as the main structural device — not filled, shadowed cards;
- **boundary red** for anything the reader can act on or follow (links, the send
  button, citations) — used sparingly, like a border line on a map;
- **relief green** for the machine's own readouts (retrieval, similarity scores,
  focus rings);
- a **monospace "instrument" face** for coordinates, similarity scores, token
  counts, heading paths, route labels.

Everything lives in `front/app/app.css`. Components consume the tokens through
Tailwind v4 utilities (`bg-card`, `text-muted-foreground`, `ring-border`, …) and
the shadcn primitive classes — no component hard-codes a colour.

## Colour

Roles map onto shadcn's token names so the `components/ui/` primitives work
unchanged; the two Atlas accents (`relief`, `graticule`) are additions.

| Token | Light | Dark | Role |
|---|---|---|---|
| `background` | `#f3f3ef` | `#141715` | page ground |
| `foreground` | `#1b1e1c` | `#e9e9e2` | body text, headings |
| `card` / `popover` | `#fbfbf8` | `#1c201d` | raised surface |
| `primary` | `#8f2d2d` | `#d98a8a` | **boundary red** — actions, links, citations |
| `primary-foreground` | `#f6f2ec` | `#241413` | text on primary |
| `secondary` / `muted` | `#e8e7de` | `#262b27` | quiet fill |
| `muted-foreground` | `#55594f` | `#a7aaa2` | secondary text |
| `accent` | `#dde7e2` | `#22312c` | hover surface (relief-green wash) |
| `accent-foreground` | `#173a34` | `#cfe4dd` | text on accent |
| `destructive` | `#b23b2e` | `#e07a5f` | **semantic error** — kept distinct from boundary red |
| `border` | `#d5d6cd` | `#313530` | neatline |
| `input` | `#cdcec3` | `#3a3f39` | field edge |
| `ring` | `#1f4e46` | `#7ab8ab` | focus ring (relief green) |
| `relief` / `relief-foreground` / `relief-wash` | `#1f4e46` / `#f6f2ec` / `#dde7e2` | `#7ab8ab` / `#10201c` / `#22312c` | **relief green** — retrieval readouts, scores |
| `graticule` | `#a97f27` | `#cfa451` | **graticule gold** — coordinates, ticks, small non-semantic accents |
| `chart-1..4` | gold / relief / slate `#3a5a7a` / boundary | lifted equivalents | pipeline steps: ingest · embed · retrieve · generate |

Dark is defined twice, kept in sync: once on `:root.dark` (explicit override) and
once inside `@media (prefers-color-scheme: dark) { :root:not(.light) }` (the OS
default). There is no theme toggle yet — that's for a later ticket; the `.dark` /
`.light` classes are already wired so adding one is only a `<html>` class.

## Typography

| Face | Where |
|---|---|
| **Spectral** (serif, 300–700) | the whole reading surface — body, headings (`--font-sans`, `--font-serif`, `--font-heading`). A serif with a slightly engraved cut that suits a reference work. |
| **IBM Plex Mono** (400–600) | every machine readout — `--font-mono`, applied to `<code>`, `Label`, and anything showing coordinates / scores / counts. |

Loaded via a Google Fonts `<link>` in `front/app/root.tsx`. Fallback stacks are
declared in `@theme` (`Cambria`/`Georgia` for the serif, `ui-monospace` for the
mono) so a blocked font host degrades gracefully.

## Shape & spacing

`--radius: 0.25rem` — sharp, architectural, closer to a drawn neatline than a
rounded product card. The shadcn radius scale (`--radius-sm` … `--radius-4xl`) is
derived from it. `Card` is pulled in to `rounded-sm` with a `ring-border`
hairline; `Button` / `Input` inherit the small radius.

Spacing follows Tailwind's default `--spacing: 0.25rem` scale; layout uses
flex / grid `gap`, not per-element margins.
