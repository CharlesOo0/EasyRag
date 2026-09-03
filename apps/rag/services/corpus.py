"""Read a corpus-format directory: Markdown files with optional YAML frontmatter.

See docs/corpus-format.md. Generic - no knowledge of any particular corpus.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

_FRONTMATTER_RE = re.compile(r"\A---\n(?P<fm>.*?)\n---\n(?P<body>.*)\Z", re.S)
_HEADING_RE = re.compile(r"^#{1,6}\s+(.*\S)\s*$", re.M)


@dataclass
class CorpusDocument:
    source_path: str          # POSIX path relative to the corpus root
    title: str
    body: str                 # Markdown, frontmatter removed
    metadata: dict            # frontmatter minus `title`
    content_hash: str         # sha256 of the raw file bytes


def parse_document(raw: bytes, *, source_path: str) -> CorpusDocument:
    # Normalise line endings so CRLF vs LF checkouts hash (and chunk) identically.
    text = raw.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
    content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

    metadata: dict = {}
    body = text
    match = _FRONTMATTER_RE.match(text)
    if match:
        loaded = yaml.safe_load(match.group("fm")) or {}
        if not isinstance(loaded, dict):
            raise ValueError(f"{source_path}: frontmatter must be a mapping")
        metadata = loaded
        body = match.group("body")

    title = metadata.pop("title", None)
    if not title:
        heading = _HEADING_RE.search(body)
        title = heading.group(1).strip() if heading else Path(source_path).stem

    return CorpusDocument(source_path, str(title), body, metadata, content_hash)


def iter_corpus(root: Path):
    """Yield one CorpusDocument per `*.md` under `root` (README.md excluded)."""
    for path in sorted(root.rglob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        source_path = path.relative_to(root).as_posix()
        yield parse_document(path.read_bytes(), source_path=source_path)
