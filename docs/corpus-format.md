# Corpus format

EasyRag ingests a **directory of Markdown files**. One file is one document. The
format is deliberately plain so any source (a dataset, an export, PDFs run
through a converter) can target it, and so the corpus stays readable and
diff-able in the repo.

Swapping the corpus is: replace the files under `corpus/`, run
`python manage.py ingest_corpus --reset`.

## File layout

```
corpus/
  README.md          # describes the corpus (source, licence) - NOT ingested
  <slug>.md          # one document
  <slug>.md
  ...
```

Sub-directories are allowed; every `*.md` except `README.md` is ingested. A
document's `source_path` is its path relative to `corpus/`.

## Document file

Optional YAML frontmatter, then Markdown body:

```markdown
---
title: France
source_url: https://example.org/france
source: CIA World Factbook
license: Public domain (U.S. Government work)
tags: [country, europe]
---

## Geography

Location: Western Europe, bordering the Bay of Biscay and English Channel...

Area: total 643,801 sq km

## Government

Capital: Paris

Government type: semi-presidential republic
```

### Frontmatter

| Key | Required | Use |
|-----|----------|-----|
| `title` | yes | Document title; shown in citations. |
| `source_url` | no | Link back to the original, shown in citations. |
| anything else | no | Stored verbatim on `Document.metadata` (JSON). |

If there is no frontmatter, the title falls back to the first `#`/`##` heading,
then the filename.

### Body

Plain Markdown. `##` and `###` headings define the structure the chunker uses:
each chunk records its heading path (e.g. `France > Geography`) as the citation
location. Keep sections reasonably focused; the chunker splits long sections into
overlapping token windows but never merges across a `##` boundary.

Code fences, lists and tables are kept as-is in chunk text.

## Ingestion

`python manage.py ingest_corpus` walks the directory, and for each file:

1. computes `sha256` of the raw bytes (`Document.content_hash`);
2. skips it if a `Document` with the same `source_path` and hash already exists;
3. otherwise upserts the `Document`, drops its old chunks, re-chunks, embeds, and
   writes new `Chunk` rows.

See `ingest_corpus --help` for `--reset`, `--path`, `--dry-run`.
