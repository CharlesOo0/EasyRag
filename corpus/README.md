# Corpus — CIA World Factbook (195 sovereign countries)

One Markdown file per country, in the format described in
[`docs/corpus-format.md`](../docs/corpus-format.md). This file is **not** ingested.

## Source

Generated from [`factbook/factbook.json`](https://github.com/factbook/factbook.json)
at commit [`c8cfe21`](https://github.com/factbook/factbook.json/tree/c8cfe21cd019d7748a6b0d57a75d6a77f5ec6ac6),
keeping the 195 sovereign countries listed in that repo's `SUMMARY.md` (oceans,
the "World" entry, dependencies and miscellaneous entities are excluded).

## Licence

**Public domain.** The World Factbook is a work of the U.S. Government and carries
no copyright. The CIA took the Factbook offline in February 2026; `factbook.json`
is an archived copy, and each document's `source_url` points at the pinned JSON
there rather than the defunct cia.gov pages.

## Regenerating

```bash
python scripts/adapters/factbook.py
```

Downloads the pinned commit, rewrites every `corpus/*.md` (except this README).
To point at newer data, bump `PINNED_SHA` in `scripts/adapters/factbook.py`.

## Swapping in a different corpus

Delete these files, drop in your own Markdown (see `docs/corpus-format.md` for the
format), and run `python manage.py ingest_corpus --reset`. Nothing else changes.
