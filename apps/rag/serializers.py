from rest_framework import serializers

from apps.rag.models import Document

MAX_QUESTION_CHARS = 2000
MAX_HISTORY_MESSAGES = 10


class DocumentListSerializer(serializers.ModelSerializer):
    """One entry in `GET /api/rag/documents/` - enough to list and filter."""

    slug = serializers.ReadOnlyField()

    class Meta:
        model = Document
        fields = ["slug", "title", "metadata"]


class DocumentDetailSerializer(serializers.ModelSerializer):
    """`GET /api/rag/documents/<slug>/` - adds the raw Markdown body."""

    slug = serializers.ReadOnlyField()

    class Meta:
        model = Document
        fields = ["slug", "title", "metadata", "body"]


class HistoryMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(max_length=MAX_QUESTION_CHARS, trim_whitespace=False)


class ChatRequestSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=MAX_QUESTION_CHARS)
    history = HistoryMessageSerializer(many=True, required=False, default=list)

    def validate_history(self, value):
        # Keep only the most recent turns.
        return [dict(message) for message in value[-MAX_HISTORY_MESSAGES:]]
