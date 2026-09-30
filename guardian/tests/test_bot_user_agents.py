import pytest

from app.bot_user_agents import is_blocked_user_agent


@pytest.mark.parametrize(
    "user_agent",
    [
        None,
        "",
        "curl/8.4.0",
        "Wget/1.21.3",
        "python-requests/2.31.0",
        "Python-urllib/3.11",
        "Go-http-client/1.1",
        "libwww-perl/6.72",
        "okhttp/4.9.0",
        "Scrapy/2.11 (+https://scrapy.org)",
        "masscan/1.3",
        "PostmanRuntime/7.36.0",
    ],
)
def test_known_script_user_agents_are_blocked(user_agent):
    assert is_blocked_user_agent(user_agent) is True


@pytest.mark.parametrize(
    "user_agent",
    [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    ],
)
def test_browser_and_known_crawler_user_agents_are_not_blocked(user_agent):
    assert is_blocked_user_agent(user_agent) is False
