from django.contrib import admin

from .models import Chunk, Document


class ChunkInline(admin.TabularInline):
    model = Chunk
    fields = ("position", "heading_path", "token_count", "has_embedding")
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True

    @admin.display(boolean=True, description="embedded")
    def has_embedding(self, obj):
        return obj.embedding is not None


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "source_path", "chunk_count", "updated_at")
    search_fields = ("title", "source_path")
    readonly_fields = ("content_hash", "created_at", "updated_at")
    inlines = [ChunkInline]

    @admin.display(description="chunks")
    def chunk_count(self, obj):
        return obj.chunks.count()


@admin.register(Chunk)
class ChunkAdmin(admin.ModelAdmin):
    list_display = ("document", "position", "heading_path", "token_count", "has_embedding")
    list_filter = ("document",)
    search_fields = ("content", "heading_path", "document__title")
    readonly_fields = ("created_at",)

    @admin.display(boolean=True, description="embedded")
    def has_embedding(self, obj):
        return obj.embedding is not None
