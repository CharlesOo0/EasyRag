import re
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase

from apps.rag.serializers import MAX_QUESTION_CHARS

FRONTEND_TYPES_FILE = Path(settings.BASE_DIR) / "front/app/features/chat/types.ts"


class MaxQuestionCharsStaysInSyncWithTheFrontendTests(SimpleTestCase):
    """The composer enforces MAX_QUESTION_CHARS client-side too (so a user finds
    out before sending, not via a 400) with its own, independent constant -
    nothing but this test ties the two together. Catches a silent drift if one
    changes without the other."""

    def test_frontend_constant_matches_the_serializer(self):
        content = FRONTEND_TYPES_FILE.read_text(encoding="utf-8")
        match = re.search(r"MAX_QUESTION_CHARS\s*=\s*(\d+)", content)
        self.assertIsNotNone(
            match, f"MAX_QUESTION_CHARS not found in {FRONTEND_TYPES_FILE}"
        )
        self.assertEqual(int(match.group(1)), MAX_QUESTION_CHARS)
