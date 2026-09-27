"""Run scripts/eval/questions.md against a live POST /api/rag/chat/ and dump a
readable report (question / answer / retrieved sources / similarity scores) for
manual review - see issue #73. No auto-grading: a human reads the report.

    python scripts/eval/run_eval.py                    # against localhost:8000
    python scripts/eval/run_eval.py --limit 5           # quick smoke test
    python scripts/eval/run_eval.py --api-url http://backend:8000

Standalone (no Django). Needs `requests` (already in requirements.txt). Talks
to the real HTTP endpoint - same throttle, same serializer, same SSE framing a
browser gets - not the internal services directly.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

import requests

DEFAULT_QUESTIONS = Path(__file__).parent / "questions.md"
DEFAULT_REPORT = Path(__file__).parent / "report.md"
# Ollama's own read timeout (OLLAMA_READ_TIMEOUT) is 120s by default - give the
# HTTP client more room than that so a slow-but-alive generation doesn't look
# like a client-side timeout.
REQUEST_TIMEOUT = (5, 180)


@dataclass
class Result:
    category: str
    question: str
    answer: str = ""
    sources: list[dict] = field(default_factory=list)
    status: str = "ok"  # ok | http-error | stream-error | request-error
    detail: str = ""


def parse_questions(path: Path) -> list[tuple[str, str]]:
    """`## Category` headings, `- question` bullets underneath."""
    category = None
    out: list[tuple[str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        heading = re.match(r"^##\s+(.+)", line)
        if heading:
            category = heading.group(1).strip()
            continue
        bullet = re.match(r"^-\s+(.+)", line)
        if bullet and category:
            out.append((category, bullet.group(1).strip()))
    return out


def iter_sse_events(lines):
    """Reconstruct (event, data) pairs from a raw SSE line stream - same
    `event: X` / `data: Y` framing as apps/rag/views._sse."""
    event = None
    for line in lines:
        if line is None:
            continue
        if line.startswith("event: "):
            event = line[len("event: "):]
        elif line.startswith("data: "):
            yield event, json.loads(line[len("data: "):])
            event = None


def ask(api_url: str, question: str) -> Result:
    result = Result(category="", question=question)
    try:
        response = requests.post(
            f"{api_url}/api/rag/chat/",
            json={"question": question},
            stream=True,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as exc:
        result.status = "request-error"
        result.detail = str(exc)
        return result

    if response.status_code != 200:
        result.status = "http-error"
        result.detail = f"HTTP {response.status_code}: {response.text[:300]}"
        return result

    # The response has no charset in its Content-Type, so `requests` defaults
    # to ISO-8859-1 per the old HTTP spec for text/* - the body is UTF-8
    # (the browser client gets this right for free via TextDecoder).
    response.encoding = "utf-8"

    tokens = []
    try:
        for event, data in iter_sse_events(response.iter_lines(decode_unicode=True)):
            if event == "sources":
                result.sources = data
            elif event == "token":
                tokens.append(data["text"])
            elif event == "error":
                result.status = "stream-error"
                result.detail = data.get("detail", "")
    except (requests.RequestException, json.JSONDecodeError) as exc:
        result.status = "stream-error"
        result.detail = str(exc)
    finally:
        response.close()

    result.answer = "".join(tokens)
    return result


def row_status(r: Result) -> str:
    if r.status != "ok":
        return r.status
    return "ok" if r.sources else "aucune source"


def render_report(results: list[Result], *, api_url: str) -> str:
    by_category: dict[str, list[Result]] = {}
    for r in results:
        by_category.setdefault(r.category, []).append(r)

    lines = [
        "# Rapport d'évaluation - #73",
        "",
        f"- Généré : {time.strftime('%Y-%m-%d %H:%M:%S')}",
        f"- Cible : `{api_url}/api/rag/chat/`",
        f"- Questions : {len(results)}",
        f"- Sans source retrouvée (< seuil de similarité) : "
        f"{sum(1 for r in results if r.status == 'ok' and not r.sources)}",
        f"- Erreurs : {sum(1 for r in results if r.status != 'ok')}",
        "",
        "## Sommaire",
        "",
    ]
    for i, category in enumerate(by_category, start=1):
        lines.append(f"{i}. [{category}](#cat-{i})")
    lines.append("")

    lines.append("## Vue d'ensemble")
    lines.append("")
    lines.append("| # | Catégorie | Question | Statut | Sources |")
    lines.append("|---|-----------|----------|--------|---------|")
    for i, r in enumerate(results, start=1):
        lines.append(
            f"| {i} | {r.category} | [{r.question}](#q-{i}) | {row_status(r)} | "
            f"{len(r.sources) if r.status == 'ok' else '-'} |"
        )
    lines.append("")

    n = 0
    for cat_i, (category, items) in enumerate(by_category.items(), start=1):
        lines.append(f'<a id="cat-{cat_i}"></a>')
        lines.append(f"## {category}")
        lines.append("")
        for r in items:
            n += 1
            lines.append(f'<a id="q-{n}"></a>')
            lines.append(f"### {n}. {r.question}")
            lines.append("")
            if r.status != "ok":
                lines.append(f"**{r.status}** : {r.detail}")
                lines.append("")
                continue
            lines.append("**Réponse :**")
            lines.append("")
            lines.append("> " + (r.answer.replace("\n", "\n> ") or "_(réponse vide)_"))
            lines.append("")
            if r.sources:
                lines.append(f"**Sources ({len(r.sources)}) :**")
                lines.append("")
                lines.append("| # | Pays | Section | Similarité |")
                lines.append("|---|------|---------|------------|")
                for i, s in enumerate(r.sources, start=1):
                    lines.append(
                        f"| {i} | {s['title']} | {s['heading_path']} | {s['similarity']:.3f} |"
                    )
            else:
                lines.append("**Aucune source retrouvée au-dessus du seuil.**")
            lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", default="http://localhost:8000")
    parser.add_argument("--questions", type=Path, default=DEFAULT_QUESTIONS)
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--limit", type=int, default=None, help="only run the first N questions")
    parser.add_argument(
        "--sleep", type=float, default=1.5,
        help="delay between requests (s) - stays well under rag_chat's per-IP throttle",
    )
    args = parser.parse_args()

    pairs = parse_questions(args.questions)
    if args.limit:
        pairs = pairs[: args.limit]
    if not pairs:
        print(f"No questions found in {args.questions}", file=sys.stderr)
        return 1

    results = []
    for i, (category, question) in enumerate(pairs, start=1):
        print(f"[{i}/{len(pairs)}] ({category}) {question}")
        result = ask(args.api_url, question)
        result.category = category
        results.append(result)
        if result.status != "ok":
            print(f"  -> {result.status}: {result.detail}")
        if i < len(pairs):
            time.sleep(args.sleep)

    args.output.write_text(render_report(results, api_url=args.api_url), encoding="utf-8")
    print(f"\nReport written to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
