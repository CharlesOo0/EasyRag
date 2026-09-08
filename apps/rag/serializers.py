from rest_framework import serializers

MAX_QUESTION_CHARS = 2000
MAX_HISTORY_MESSAGES = 10


class HistoryMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(max_length=MAX_QUESTION_CHARS, trim_whitespace=False)


class ChatRequestSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=MAX_QUESTION_CHARS)
    history = HistoryMessageSerializer(many=True, required=False, default=list)

    def validate_history(self, value):
        # Keep only the most recent turns.
        return [dict(message) for message in value[-MAX_HISTORY_MESSAGES:]]
