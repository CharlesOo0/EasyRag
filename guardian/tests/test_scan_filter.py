import pytest

from app.scan_filter import is_known_scan_path


@pytest.mark.parametrize(
    "path",
    [
        "/.env",
        "/.env.production",
        "/backend/.env",
        "/.git/config",
        "/.git/HEAD",
        "/wp-content/plugins/hellopress/wp_filemanager.php",
        "/wp-admin/setup-config.php",
        "/xmlrpc.php",
        "/info.php",
        "/actuator/env",
        "/.aws/credentials",
        "/.ssh/id_rsa",
        "/cgi-bin/eval-stdin",
    ],
)
def test_known_scan_signatures_are_blocked(path):
    assert is_known_scan_path(path) is True


@pytest.mark.parametrize(
    "path",
    [
        "/",
        "/chat",
        "/corpus",
        "/api/rag/chat/",
        "/api/rag/documents/",
        "/assets/entry.client-BfrVr6lG.js",
        "/favicon.svg",
        "/robots.txt",
        "/sitemap.xml",
    ],
)
def test_real_app_paths_are_not_blocked(path):
    assert is_known_scan_path(path) is False
