"""Split a corpus-format Markdown document into retrieval-sized chunks.

Generic: no knowledge of any particular corpus. See docs/corpus-format.md.

- Sections are delimited by `##` / `###` headings; a chunk never spans a heading
  boundary, and it records its heading path (e.g. ``"France > Geography"``) as the
  citation location.
- Each section is packed into overlapping token windows sized for the embedding
  model's context window (`RAG_CHUNK_TOKENS` / `RAG_CHUNK_OVERLAP`).
- Token counts use `estimate_tokens` - a deterministic, dependency-free
  approximation (no tokenizer / model load). It is a rough upper bound, which is
  what we want: it keeps real chunks comfortably inside the model window.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

from django.conf import settings

_FRONTMATTER_RE = re.compile(r"\A---\n.*?\n---\n", re.S)
_HEADING_RE = re.compile(r"^(#{1,6})\s+(.*\S)\s*$")
# Sentence-ish boundary: after . ! ? ;  followed by whitespace and a capital /
# digit / opening bracket. Deliberately conservative so "**Field:** value" and
# lowercase continuations are not split.
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?;])\s+(?=[A-Z0-9(\[])")


@dataclass(frozen=True)
class Segment:
    position: int
    heading_path: str
    content: str
    token_count: int

    @property
    def embed_text(self) -> str:
        """What to embed: the heading path prefixed to the content. Chunk text
        often doesn't repeat the document title or section, so without this a
        chunk carries no signal about which country / section it belongs to."""
        return f"{self.heading_path}\n\n{self.content}" if self.heading_path else self.content


def estimate_tokens(text: str) -> int:
    """Approximate transformer token count without loading a tokenizer.

    Uses the larger of the ``chars / 4`` and ``words * 1.5`` heuristics, so it
    tends to over- rather than under-estimate. Deterministic.
    """
    text = text.strip()
    if not text:
        return 0
    return max((len(text) + 3) // 4, int(len(text.split()) * 1.5) + 1)


def _iter_sections(body: str, title: str):
    """Yield ``(heading_path, text)`` pairs, one per heading-delimited section."""
    stack: list[tuple[int, str]] = []
    buf: list[str] = []
    out: list[tuple[str, str]] = []

    def flush():
        text = "\n".join(buf).strip()
        if text:
            path = " > ".join([title, *(h for _, h in stack)])
            out.append((path, text))
        buf.clear()

    for line in body.splitlines():
        match = _HEADING_RE.match(line)
        if not match:
            buf.append(line)
            continue
        flush()
        level = len(match.group(1))
        if level <= 1:
            # `# Title` - already carried via the `title` arg; not part of the path.
            stack.clear()
            continue
        while stack and stack[-1][0] >= level:
            stack.pop()
        stack.append((level, match.group(2).strip()))

    flush()
    return out


def _split_units(text: str) -> list[str]:
    units: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        units.extend(part.strip() for part in _SENTENCE_SPLIT_RE.split(line) if part.strip())
    return units


def _hard_split(unit: str, max_tokens: int, count: Callable[[str], int]) -> list[str]:
    """Word-split a single unit that is on its own larger than a window."""
    pieces: list[str] = []
    current: list[str] = []
    for word in unit.split():
        if current and count(" ".join([*current, word])) > max_tokens:
            pieces.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        pieces.append(" ".join(current))
    return pieces or [unit]


def _pack(
    units: list[str],
    heading_path: str,
    start_position: int,
    max_tokens: int,
    overlap_tokens: int,
    count: Callable[[str], int],
) -> tuple[list[Segment], int]:
    segments: list[Segment] = []
    position = start_position
    i, n = 0, len(units)

    while i < n:
        j = i
        while j < n:
            if j > i and count(" ".join(units[i : j + 1])) > max_tokens:
                break
            j += 1
        content = " ".join(units[i:j]).strip()
        segments.append(Segment(position, heading_path, content, count(content)))
        position += 1
        if j >= n:
            break
        # Step back so the next window re-includes ~overlap_tokens of trailing text.
        k, back = j, 0
        while k > i + 1 and back + count(units[k - 1]) <= overlap_tokens:
            k -= 1
            back += count(units[k])
        i = k

    return segments, position


def chunk_document(
    body: str,
    *,
    title: str,
    count_tokens: Callable[[str], int] = estimate_tokens,
) -> list[Segment]:
    """Chunk a document body (frontmatter, if present, is ignored)."""
    body = _FRONTMATTER_RE.sub("", body, count=1)
    max_tokens = int(getattr(settings, "RAG_CHUNK_TOKENS", 110))
    overlap_tokens = int(getattr(settings, "RAG_CHUNK_OVERLAP", 20))

    segments: list[Segment] = []
    position = 0
    for heading_path, text in _iter_sections(body, title):
        units: list[str] = []
        for unit in _split_units(text):
            if count_tokens(unit) > max_tokens:
                units.extend(_hard_split(unit, max_tokens, count_tokens))
            else:
                units.append(unit)
        if not units:
            continue
        section_segments, position = _pack(
            units, heading_path, position, max_tokens, overlap_tokens, count_tokens
        )
        segments.extend(section_segments)

    return segments
