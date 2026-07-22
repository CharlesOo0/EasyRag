import secrets

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import translation
from django.utils.translation import gettext as _
from dj_rest_auth.app_settings import api_settings
from dj_rest_auth.jwt_auth import set_jwt_cookies
from dj_rest_auth.utils import jwt_encode
from dj_rest_auth.views import LoginView as DefaultLoginView
from dj_rest_auth.registration.views import RegisterView as DefaultRegisterView
from allauth.account.models import EmailAddress
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView
from rest_framework import status

from . import otp
from . import validators

User = get_user_model()


def send_otp_email(user):
    """
    Generates a fresh OTP for the user's e-mail and sends it, rendered in the
    user's stored language regardless of the current request's Accept-Language
    (resend can be triggered from a page that hasn't loaded the user's profile).
    """
    code = otp.generate_and_store_otp(user.email)
    with translation.override(user.language):
        subject = render_to_string('account/email/otp_subject.txt', {'user_display': user.username}).strip()
        message = render_to_string('account/email/otp_message.txt', {'user_display': user.username, 'code': code})
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])


class LoginView(DefaultLoginView):
    """Same as dj-rest-auth's LoginView, rate-limited against brute force."""
    throttle_scope = 'login'


class RegisterView(DefaultRegisterView):
    """
    Same as dj-rest-auth's RegisterView, rate-limited against abuse, but
    sends a 6-digit OTP code by e-mail instead of allauth's default
    link-based confirmation e-mail (the account stays unverified/unusable -
    see LoginSerializer - until POST /api/verify-otp/ succeeds).
    """
    throttle_scope = 'registration'

    def perform_create(self, serializer):
        user = serializer.save(self.request)
        send_otp_email(user)
        return user

    def get_response_data(self, user):
        return {'detail': _('Verification code sent.'), 'email': user.email}


class OTPResendThrottle(SimpleRateThrottle):
    """3 requests per 10 minutes, keyed by the submitted e-mail address."""
    scope = 'resend_otp'

    def get_cache_key(self, request, view):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': email}

    def parse_rate(self, rate):
        # DRF's rate-string parser only supports single time units (s/m/h/d),
        # so the "3 per 10 minutes" window is hardcoded here instead.
        return (3, 10 * 60)


class OTPResendIPThrottle(SimpleRateThrottle):
    """
    Per-IP cap alongside OTPResendThrottle's per-email one, so a single IP
    can't mail-bomb many different addresses each staying under the
    per-email limit.
    """
    scope = 'resend_otp_ip'

    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}

    def parse_rate(self, rate):
        return (20, 10 * 60)


class VerifyOTPView(APIView):
    """
    POST {email, code}. On success, marks the e-mail verified, activates the
    account and logs the user in (same JWT cookie mechanism as LoginView).
    """
    permission_classes = [AllowAny]
    throttle_scope = 'verify_otp'

    def post(self, request, *args, **kwargs):
        email = (request.data.get('email') or '').strip().lower()
        code = (request.data.get('code') or '').strip()

        if not email or not code:
            return Response(
                {'code': 'invalid_otp', 'detail': _('Email and code are required.')},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invalid_response = Response(
            {'code': 'invalid_otp', 'detail': _('This code is invalid or has expired.')},
            status=status.HTTP_400_BAD_REQUEST,
        )

        entry = otp.get_otp_entry(email)
        if not entry or entry['attempts'] >= otp.MAX_ATTEMPTS:
            otp.clear_otp(email)
            return invalid_response

        if not secrets.compare_digest(entry['code'], code):
            otp.register_failed_attempt(email)
            return invalid_response

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            otp.clear_otp(email)
            return invalid_response

        otp.clear_otp(email)
        EmailAddress.objects.filter(user=user, email__iexact=email).update(verified=True)

        access_token, refresh_token = jwt_encode(user)
        data = {'user': user, 'access': access_token, 'refresh': ''}
        serializer = api_settings.JWT_SERIALIZER(instance=data, context=self.get_serializer_context())
        response = Response(serializer.data, status=status.HTTP_200_OK)
        set_jwt_cookies(response, access_token, refresh_token)
        return response

    def get_serializer_context(self):
        return {'request': self.request, 'view': self}


class ResendOTPView(APIView):
    """
    POST {email}. Regenerates and resends the OTP for an existing, unverified
    account. Always returns 200 with a generic message to avoid leaking
    whether an e-mail address is registered.
    """
    permission_classes = [AllowAny]
    throttle_classes = [OTPResendThrottle, OTPResendIPThrottle]

    def post(self, request, *args, **kwargs):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'detail': _('Email is required.')}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            user = None

        if user and not EmailAddress.objects.filter(user=user, email__iexact=email, verified=True).exists():
            send_otp_email(user)

        return Response(
            {'detail': _('If an account exists for this address, a new code has been sent.')},
            status=status.HTTP_200_OK,
        )


class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    # The frontend uses @react-oauth/google's popup-based auth-code flow
    # (see google-login-button.tsx), which obtains an authorization code
    # with no real page redirect involved. Google's token endpoint requires
    # such codes to be exchanged with the literal string "postmessage" as
    # redirect_uri, not an actual URL - using settings.FRONTEND_URL here
    # would make every code exchange fail with redirect_uri_mismatch.
    callback_url = 'postmessage'
    client_class = OAuth2Client
    throttle_scope = 'login'


class PasswordPolicyView(APIView):
    """
    GET-only, unauthenticated. Exposes the password rules actually enforced
    by ComplexityValidator/MinimumLengthValidator (apps/authentication/validators.py)
    so the frontend's register/reset-password forms can validate against the
    same single source of truth instead of hardcoding their own copy of
    these rules, which could otherwise silently drift from what the backend
    enforces.
    """
    permission_classes = [AllowAny]

    def get(self, request, *args, **kwargs):
        return Response({
            'min_length': validators.MIN_LENGTH,
            'special_chars': validators.SPECIAL_CHARS,
        })
