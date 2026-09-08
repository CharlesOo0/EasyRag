"""URL configuration for the EasyRag project."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/rag/", include("apps.rag.urls")),
]
