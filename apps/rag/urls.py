from django.urls import path

from apps.rag.views import ChatView, DocumentDetailView, DocumentListView

urlpatterns = [
    path("chat/", ChatView.as_view(), name="rag_chat"),
    path("documents/", DocumentListView.as_view(), name="rag_documents"),
    path("documents/<path:slug>/", DocumentDetailView.as_view(), name="rag_document"),
]
