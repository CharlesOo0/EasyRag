import pytest

from app.wake_paths import is_allowed_wake_path


@pytest.mark.parametrize(
    "path",
    [
        "/",
        "/chat",
        "/chat.data",
        "/corpus",
        "/corpus.data",
        "/corpus/some-document",
        "/corpus/some-document.data",
        "/api/rag/chat/",
        "/api/rag/documents/",
        "/api/rag/documents/russia/",
        "/admin",
        "/admin/",
        "/admin/rag/document/",
        "/static/admin/css/base.css",
        "/assets/entry.client-BfrVr6lG.js",
        "/favicon.svg",
        "/favicon.ico",
        "/__manifest",
    ],
)
def test_real_routes_are_allowed(path):
    assert is_allowed_wake_path(path) is True


@pytest.mark.parametrize(
    "path",
    [
        "/.env",
        "/.git/config",
        "/wp-content/plugins/hellopress/wp_filemanager.php",
        "/wp-admin/setup-config.php",
        # A real scanner pattern (Joomla admin panels) that must not slip
        # through just because it starts with the same letters as /admin.
        "/administrator/index.php",
        "/robots.txt",
        "/sitemap.xml",
        "/config.json",
        "/xmlrpc.php",
        "/some-random-path-a-bot-invented",
        "/chatbot-exploit",
    ],
)
def test_unrecognized_paths_are_rejected(path):
    assert is_allowed_wake_path(path) is False
