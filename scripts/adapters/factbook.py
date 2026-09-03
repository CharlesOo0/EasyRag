"""Adapter: CIA World Factbook (factbook/factbook.json) -> EasyRag corpus format.

Downloads the `factbook/factbook.json` repo at a pinned commit, keeps the 195
sovereign countries listed in its SUMMARY.md, and writes one Markdown file per
country under `corpus/` (see docs/corpus-format.md).

    python scripts/adapters/factbook.py            # regenerate corpus/
    python scripts/adapters/factbook.py --limit 5  # quick check

Standalone (no Django). Needs `requests` (already in requirements.txt).

The CIA took the Factbook offline in February 2026; this data is public domain
(a U.S. Government work) and the pinned commit is the archived source of record.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import tarfile
import unicodedata
from pathlib import Path

import requests

SOURCE_REPO = "factbook/factbook.json"
# factbook/factbook.json @ master, 2026-09-03. Bump deliberately.
PINNED_SHA = "c8cfe21cd019d7748a6b0d57a75d6a77f5ec6ac6"
ARCHIVE_URL = f"https://codeload.github.com/{SOURCE_REPO}/tar.gz/{PINNED_SHA}"

REGIONS = {
    "africa", "antarctica", "australia-oceania", "central-america-n-caribbean",
    "central-asia", "east-n-southeast-asia", "europe", "middle-east",
    "north-america", "oceans", "south-america", "south-asia", "world",
}

# Canonical section order from the Factbook; sections missing for a country are skipped.
SECTION_ORDER = [
    "Introduction", "Geography", "People and Society", "Environment", "Government",
    "Economy", "Energy", "Communications", "Transportation",
    "Military and Security", "Space", "Terrorism", "Transnational Issues",
]

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "corpus"

_BR_RE = re.compile(r"<\s*br\s*/?\s*>|</\s*p\s*>", re.I)
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"[ \t]+")


def clean_text(value: str) -> str:
    """Strip the Factbook's inline HTML and tidy whitespace."""
    text = _BR_RE.sub("\n", value)
    text = _TAG_RE.sub("", text)
    text = text.replace(" ", " ")
    text = _WS_RE.sub(" ", text)
    text = re.sub(r" *\n *", "\n", text)
    return text.strip()


def slugify(name: str) -> str:
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text


def fetch_archive() -> dict[str, bytes]:
    """Return {repo-relative path: bytes} for SUMMARY.md and every country JSON."""
    resp = requests.get(ARCHIVE_URL, timeout=60)
    resp.raise_for_status()
    files: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(resp.content), mode="r:gz") as tar:
        for member in tar.getmembers():
            if not member.isfile():
                continue
            rel = member.name.split("/", 1)[1] if "/" in member.name else member.name
            parts = rel.split("/")
            is_country = (
                len(parts) == 2
                and parts[0] in REGIONS
                and re.fullmatch(r"[a-z]{2}\.json", parts[1])
            )
            if rel == "SUMMARY.md" or is_country:
                files[rel] = tar.extractfile(member).read()
    return files


def parse_sovereign(summary_md: str) -> list[tuple[str, str]]:
    match = re.search(
        r"### Sovereign Countries \(\d+\)(.*?)(?:\n### |\Z)", summary_md, re.S
    )
    if not match:
        raise RuntimeError("Could not find the 'Sovereign Countries' section in SUMMARY.md")
    pairs = re.findall(r"`([a-z]{2})`\s+(.+)", match.group(1))
    if len(pairs) < 190:
        raise RuntimeError(f"Only parsed {len(pairs)} sovereign countries; expected ~195")
    return [(code, name.strip()) for code, name in pairs]


def _is_leaf(value: dict) -> bool:
    return "text" in value


def _render_value(name: str, value, depth: int, lines: list[str]) -> None:
    indent = "  " * depth
    label = name.strip()
    if isinstance(value, str):  # a bare "note" string
        note = clean_text(value)
        if note:
            lines.append(f"{indent}- {note}" if depth else f"{note}")
        return
    if not isinstance(value, dict):
        return

    if _is_leaf(value):
        text = clean_text(str(value.get("text", "")))
        tail = label.split(":")[-1].strip()
        if tail and text.lower().startswith(f"{tail.lower()}:"):
            text = text[len(tail) + 1:].strip()
        if text:
            lines.append(f"{indent}- **{label}:** {text}" if depth else f"**{label}:** {text}")
        note = value.get("note")
        if note:
            _render_value("note", note, depth + 1 if depth else 1, lines)
        return

    # Nested group of sub-fields.
    lines.append(f"{indent}- **{label}:**" if depth else f"**{label}:**")
    for sub_name, sub_value in value.items():
        if sub_name == "note":
            continue
        _render_value(sub_name, sub_value, depth + 1, lines)
    if "note" in value:
        _render_value("note", value["note"], depth + 1, lines)


def json_to_markdown(country: dict) -> str:
    blocks: list[str] = []
    seen = set()
    for section in list(SECTION_ORDER) + [k for k in country if k not in SECTION_ORDER]:
        data = country.get(section)
        if not isinstance(data, dict) or not data or section in seen:
            continue
        seen.add(section)
        lines: list[str] = [f"## {section}", ""]
        for field, value in data.items():
            _render_value(field, value, 0, lines)
        if len(lines) > 2:
            blocks.append("\n".join(lines).rstrip())
    return "\n\n".join(blocks) + "\n"


def frontmatter(name: str, code: str, region: str) -> str:
    url = f"https://github.com/{SOURCE_REPO}/blob/{PINNED_SHA}/{region}/{code}.json"
    return (
        "---\n"
        f"title: {name}\n"
        f"source: CIA World Factbook (archived)\n"
        f"source_url: {url}\n"
        "license: Public domain (U.S. Government work)\n"
        f"country_code: {code}\n"
        f"tags: [country, {region}]\n"
        "---\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output dir (default: corpus/)")
    parser.add_argument("--limit", type=int, default=0, help="only convert the first N countries")
    args = parser.parse_args()

    print(f"Fetching {SOURCE_REPO} @ {PINNED_SHA[:10]} ...")
    files = fetch_archive()
    sovereign = parse_sovereign(files["SUMMARY.md"].decode("utf-8"))
    if args.limit:
        sovereign = sovereign[: args.limit]

    by_code = {}
    for path in files:
        m = re.fullmatch(r"([^/]+)/([a-z]{2})\.json", path)
        if m:
            by_code[m.group(2)] = (m.group(1), path)

    args.out.mkdir(parents=True, exist_ok=True)
    for stale in args.out.glob("*.md"):
        if stale.name != "README.md":
            stale.unlink()

    written = 0
    missing = []
    for code, name in sovereign:
        if code not in by_code:
            missing.append((code, name))
            continue
        region, path = by_code[code]
        country = json.loads(files[path])
        body = json_to_markdown(country)
        (args.out / f"{slugify(name)}.md").write_text(
            f"{frontmatter(name, code, region)}\n# {name}\n\n{body}",
            encoding="utf-8",
            newline="\n",
        )
        written += 1

    print(f"Wrote {written} country files to {args.out}/")
    if missing:
        print(f"WARNING: no JSON found for {len(missing)}: {missing}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
