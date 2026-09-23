"""Assemble the chat messages sent to the LLM from retrieved context.

Generic: knows nothing about any particular corpus. Produces an Ollama-style
`[{"role": ..., "content": ...}]` list - a grounding system message, optional
prior turns, then the user turn carrying numbered context passages and the
question.
"""

from __future__ import annotations

from django.conf import settings

from apps.rag.services.retrieval import RetrievedChunk

SYSTEM_PROMPT = (
    "You answer questions using only a fixed reference corpus.\n"
    "\n"
    "Rules:\n"
    "- Use only the numbered context passages provided with the question. "
    "Do not rely on outside knowledge.\n"
    "- After each claim, cite the passages it comes from with their bracketed "
    "numbers, e.g. [1] or [2][3].\n"
    "- If the passages do not contain the answer, say so plainly and do not "
    "guess.\n"
    "- Answer in the language of the question. Be concise.\n"
)

_NO_CONTEXT = "(no relevant passages were found)"
# Below this a truncated passage isn't worth including at all.
_MIN_PASSAGE_CHARS = 200


def format_context(chunks: list[RetrievedChunk], *, budget_chars: int | None = None) -> str:
    """Numbered passages, capped at `budget_chars` total (chunk text only) so a
    CPU model isn't stuck prefilling thousands of tokens of context. Retrieval
    still returns every chunk - this only trims what the LLM sees."""
    if not chunks:
        return _NO_CONTEXT
    if budget_chars is None:
        budget_chars = int(getattr(settings, "RAG_PROMPT_CONTEXT_CHARS", 4500))

    blocks = []
    used = 0
    for i, hit in enumerate(chunks, start=1):
        remaining = budget_chars - used
        if remaining < _MIN_PASSAGE_CHARS:
            break
        content = hit.chunk.content
        if len(content) > remaining:
            content = content[:remaining].rsplit(" ", 1)[0] + " …"
        used += len(content)
        blocks.append(f"[{i}] {hit.chunk.heading_path}\n{content}")
    return "\n\n".join(blocks)


def _budget_history(history: list[dict], budget_chars: int | None = None) -> list[dict]:
    """Keep the most recent turns whose content fits under `budget_chars`
    total, dropping older ones first. The most recent turn is always kept
    even alone over budget, so one long turn can't zero out history entirely."""
    if budget_chars is None:
        budget_chars = int(getattr(settings, "RAG_MAX_HISTORY_CHARS", 4000))

    kept: list[dict] = []
    used = 0
    for message in reversed(history):
        cost = len(message["content"])
        if kept and used + cost > budget_chars:
            break
        kept.append(message)
        used += cost
    kept.reverse()
    return kept


def build_messages(
    question: str,
    chunks: list[RetrievedChunk],
    *,
    history: list[dict] | None = None,
) -> list[dict]:
    """Return the chat messages for a single question given its retrieved chunks."""
    user_turn = (
        f"Context passages:\n\n{format_context(chunks)}\n\n"
        f"---\nQuestion: {question.strip()}"
    )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        *_budget_history(history or []),
        {"role": "user", "content": user_turn},
    ]
