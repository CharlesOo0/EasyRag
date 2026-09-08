from django.urls import path

from apps.rag.views import ChatView

urlpatterns = [
    path("chat/", ChatView.as_view(), name="rag_chat"),
]
