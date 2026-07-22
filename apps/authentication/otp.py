import secrets
import time

from django.core.cache import cache

OTP_TTL_SECONDS = 10 * 60
MAX_ATTEMPTS = 5


def _cache_key(email):
    return f'otp:{email.strip().lower()}'


def generate_and_store_otp(email):
    """Generates a fresh 6-digit code, stores it (replacing any previous one) and returns it."""
    code = f'{secrets.randbelow(1_000_000):06d}'
    entry = {'code': code, 'attempts': 0, 'expires_at': time.time() + OTP_TTL_SECONDS}
    cache.set(_cache_key(email), entry, OTP_TTL_SECONDS)
    return code


def get_otp_entry(email):
    return cache.get(_cache_key(email))


def register_failed_attempt(email):
    """Increments the attempt counter without resetting the code's remaining TTL."""
    entry = get_otp_entry(email)
    if not entry:
        return None
    entry['attempts'] += 1
    remaining = max(int(entry['expires_at'] - time.time()), 1)
    cache.set(_cache_key(email), entry, remaining)
    return entry


def clear_otp(email):
    cache.delete(_cache_key(email))
