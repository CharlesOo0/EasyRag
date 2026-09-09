from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.rag.models import Document


class DocumentAPITests(APITestCase):
    def setUp(self):
        cache.clear()  # reset the scoped-throttle counter between tests
        self.nepal = Document.objects.create(
            source_path="nepal.md",
            title="Nepal",
            body="## Geography\n\nRugged Himalayas in the north.\n",
            content_hash="h1",
            metadata={"source_url": "https://example.org/np", "tags": ["country", "south-asia"]},
        )
        self.chad = Document.objects.create(
            source_path="chad.md",
            title="Chad",
            body="## Geography\n\nLandlocked, north-central Africa.\n",
            content_hash="h2",
            metadata={"source_url": "https://example.org/td"},
        )

    def test_list_returns_every_document(self):
        response = self.client.get(reverse("rag_documents"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual([d["slug"] for d in data], ["chad", "nepal"])  # ordered by source_path
        entry = next(d for d in data if d["slug"] == "nepal")
        self.assertEqual(entry["title"], "Nepal")
        self.assertEqual(entry["metadata"]["source_url"], "https://example.org/np")

    def test_list_is_unpaginated_and_omits_the_body(self):
        data = self.client.get(reverse("rag_documents")).json()
        self.assertIsInstance(data, list)
        self.assertNotIn("body", data[0])

    def test_detail_returns_the_markdown_body(self):
        response = self.client.get(reverse("rag_document", args=["nepal"]))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["slug"], "nepal")
        self.assertEqual(data["title"], "Nepal")
        self.assertEqual(data["body"], "## Geography\n\nRugged Himalayas in the north.\n")
        self.assertEqual(data["metadata"]["tags"], ["country", "south-asia"])

    def test_detail_404_for_an_unknown_slug(self):
        response = self.client.get(reverse("rag_document", args=["atlantis"]))
        self.assertEqual(response.status_code, 404)

    def test_endpoints_are_public(self):
        self.assertEqual(self.client.get(reverse("rag_documents")).status_code, 200)
        self.assertEqual(
            self.client.get(reverse("rag_document", args=["chad"])).status_code, 200
        )
