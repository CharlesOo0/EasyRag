import re
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import RequestFactory
from rest_framework import status
from rest_framework.test import APITestCase
from allauth.account.models import EmailAddress, EmailConfirmationHMAC
from allauth.account.utils import user_pk_to_url_str
from allauth.socialaccount.adapter import get_adapter as get_social_adapter
from allauth.socialaccount.models import SocialAccount, SocialLogin

from apps.authentication import otp, validators, views
from apps.authentication.serializers import UserSerializer

User = get_user_model()


class RegistrationTests(APITestCase):
    def setUp(self):
        # ScopedRateThrottle counters live in the cache backend, not the DB,
        # so they aren't reset by APITestCase's transaction rollback between
        # tests - clear them explicitly to avoid order-dependent 429s.
        cache.clear()

    def test_weak_password_is_rejected(self):
        response = self.client.post('/api/registration/', {
            'username': 'bob',
            'email': 'bob@example.com',
            'password1': 'alllowercase',
            'password2': 'alllowercase',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='bob').exists())

    def test_strong_password_creates_unverified_user(self):
        response = self.client.post('/api/registration/', {
            'username': 'alice',
            'email': 'alice@example.com',
            'password1': 'Str0ng!Pass',
            'password2': 'Str0ng!Pass',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='alice')
        self.assertFalse(EmailAddress.objects.get(user=user).verified)

    def test_duplicate_verified_email_is_rejected(self):
        # allauth only blocks re-registration once the original email is
        # verified (anti-enumeration: an unverified signup can be redone,
        # e.g. if the first confirmation email was lost).
        existing = User.objects.create_user(username='existing', email='taken@example.com', password='Str0ng!Pass')
        EmailAddress.objects.create(user=existing, email='taken@example.com', primary=True, verified=True)
        response = self.client.post('/api/registration/', {
            'username': 'newuser',
            'email': 'taken@example.com',
            'password1': 'Str0ng!Pass',
            'password2': 'Str0ng!Pass',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_language_preference_is_persisted(self):
        response = self.client.post('/api/registration/', {
            'username': 'ines',
            'email': 'ines@example.com',
            'password1': 'Str0ng!Pass',
            'password2': 'Str0ng!Pass',
            'language': 'en',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='ines')
        self.assertEqual(user.language, 'en')

    def test_unsupported_language_is_rejected(self):
        # Must be a 400, not a 500: the `language` model field is
        # max_length=10, and a bare user.save() (not full_clean()) doesn't
        # enforce that - an unvalidated overlong value would otherwise reach
        # the DB and raise an unhandled DataError on Postgres.
        response = self.client.post('/api/registration/', {
            'username': 'overlong',
            'email': 'overlong@example.com',
            'password1': 'Str0ng!Pass',
            'password2': 'Str0ng!Pass',
            'language': 'this-is-way-too-long',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='overlong').exists())


class LoginTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username='carol', email='carol@example.com', password='Str0ng!Pass',
        )

    def test_login_blocked_before_email_verification(self):
        response = self.client.post('/api/login/', {
            'email': 'carol@example.com',
            'password': 'Str0ng!Pass',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('code'), ['email_not_verified'])

    def test_login_succeeds_and_sets_jwt_cookies_after_verification(self):
        EmailAddress.objects.create(
            user=self.user, email=self.user.email, primary=True, verified=True,
        )
        response = self.client.post('/api/login/', {
            'email': 'carol@example.com',
            'password': 'Str0ng!Pass',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('jwt-auth', response.cookies)
        self.assertIn('jwt-refresh-auth', response.cookies)

    def test_logout_clears_jwt_cookies(self):
        EmailAddress.objects.create(
            user=self.user, email=self.user.email, primary=True, verified=True,
        )
        self.client.post('/api/login/', {
            'email': 'carol@example.com',
            'password': 'Str0ng!Pass',
        })
        response = self.client.post('/api/logout/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.cookies['jwt-auth'].value, '')
        self.assertEqual(response.cookies['jwt-refresh-auth'].value, '')

    def test_logout_blacklists_refresh_token(self):
        from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

        EmailAddress.objects.create(
            user=self.user, email=self.user.email, primary=True, verified=True,
        )
        self.client.post('/api/login/', {
            'email': 'carol@example.com',
            'password': 'Str0ng!Pass',
        })
        self.assertEqual(OutstandingToken.objects.filter(user=self.user).count(), 1)
        self.assertEqual(BlacklistedToken.objects.count(), 0)

        self.client.post('/api/logout/')

        self.assertEqual(BlacklistedToken.objects.count(), 1)


class ThrottleTests(APITestCase):
    """
    Exercises the real 'login'/'registration' rates from core/settings.py
    rather than overriding them: DRF's SimpleRateThrottle.THROTTLE_RATES is
    bound to api_settings.DEFAULT_THROTTLE_RATES once, at module-import
    time (a plain class-attribute snapshot, not a live/reactive lookup) -
    so @override_settings(REST_FRAMEWORK=...) silently has no effect on it
    once rest_framework.throttling has already been imported by the test
    runner, which happens well before any test body runs.
    """
    def setUp(self):
        cache.clear()

    def test_login_endpoint_is_rate_limited(self):
        credentials = {'email': 'nobody@example.com', 'password': 'wrong'}
        for _ in range(5):
            response = self.client.post('/api/login/', credentials)
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        response = self.client.post('/api/login/', credentials)
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_registration_endpoint_is_rate_limited(self):
        for i in range(5):
            self.client.post('/api/registration/', {
                'username': f'throttleuser{i}',
                'email': f'throttleuser{i}@example.com',
                'password1': 'wrong',
                'password2': 'wrong',
            })
        response = self.client.post('/api/registration/', {
            'username': 'throttleuser5',
            'email': 'throttleuser5@example.com',
            'password1': 'wrong',
            'password2': 'wrong',
        })
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


class EmailConfirmationRedirectTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='frank', email='frank@example.com', password='Str0ng!Pass',
        )
        self.email_address = EmailAddress.objects.create(
            user=self.user, email=self.user.email, primary=True, verified=False,
        )
        self.key = EmailConfirmationHMAC(self.email_address).key

    def test_confirmation_link_redirects_to_frontend(self):
        response = self.client.get(f'/api/registration/account-confirm-email/{self.key}/')
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, f'{settings.FRONTEND_URL}/auth/verify-email/{self.key}')

    def test_verify_email_endpoint_marks_email_verified(self):
        response = self.client.post('/api/registration/verify-email/', {'key': self.key})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.email_address.refresh_from_db()
        self.assertTrue(self.email_address.verified)

    def test_verify_email_with_invalid_key_is_rejected(self):
        response = self.client.post('/api/registration/verify-email/', {'key': 'not-a-real-key'})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_resend_email_bypass_endpoint_is_not_exposed(self):
        # dj-rest-auth's own resend-email/ (ResendEmailVerificationView) is
        # deliberately not wired up - it's unthrottled and would let anyone
        # trigger a working, link-based confirmation email for any address,
        # bypassing the OTP-only verification flow entirely. See
        # apps/authentication/urls.py.
        response = self.client.post('/api/registration/resend-email/', {'email': self.user.email})
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(len(mail.outbox), 0)


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='dave', email='dave@example.com', password='Str0ng!Pass',
        )
        EmailAddress.objects.create(
            user=self.user, email=self.user.email, primary=True, verified=True,
        )

    def test_request_reset_sends_email_with_frontend_link(self):
        response = self.client.post('/api/password/reset/', {'email': 'dave@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(f'{settings.FRONTEND_URL}/auth/reset-password/', mail.outbox[0].body)

    def test_confirm_with_valid_link_changes_password(self):
        self.client.post('/api/password/reset/', {'email': 'dave@example.com'})
        match = re.search(r'/auth/reset-password/([^/]+)/([^/]+)/', mail.outbox[0].body)
        uid, token = match.group(1), match.group(2)

        response = self.client.post('/api/password/reset/confirm/', {
            'uid': uid,
            'token': token,
            'new_password1': 'NewStr0ng!Pass',
            'new_password2': 'NewStr0ng!Pass',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewStr0ng!Pass'))

    def test_confirm_with_invalid_token_is_rejected(self):
        uid = user_pk_to_url_str(self.user)
        response = self.client.post('/api/password/reset/confirm/', {
            'uid': uid,
            'token': 'garbage-token',
            'new_password1': 'NewStr0ng!Pass',
            'new_password2': 'NewStr0ng!Pass',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Str0ng!Pass'))


class GoogleOAuthTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_new_google_user_is_created_and_signed_in(self):
        email = 'newgoogle@example.com'
        user = User(email=email, username='newgoogle')
        user.set_unusable_password()
        account = SocialAccount(provider='google', uid='google-uid-123', extra_data={'email': email})
        request = RequestFactory().post('/api/google/')
        provider = get_social_adapter().get_provider(request, provider='google')
        fake_login = SocialLogin(
            user=user,
            account=account,
            provider=provider,
            email_addresses=[EmailAddress(email=email, verified=True, primary=True)],
        )

        with patch(
            'dj_rest_auth.registration.serializers.SocialLoginSerializer.get_social_login',
            return_value=fake_login,
        ):
            response = self.client.post('/api/google/', {'access_token': 'fake-token'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('jwt-auth', response.cookies)
        created_user = User.objects.get(email=email)
        self.assertTrue(
            SocialAccount.objects.filter(user=created_user, provider='google', uid='google-uid-123').exists()
        )

    def test_google_login_with_already_registered_email_does_not_500(self):
        # Regression test: allauth's enumeration-prevention path (an
        # unlinked Google login for an email that already has an account)
        # calls reverse('account_signup') internally, which 500'd with
        # NoReverseMatch until allauth.urls was included in core/urls.py.
        email = 'existing@example.com'
        User.objects.create_user(username='existing', email=email, password='Str0ng!Pass')

        user = User(email=email, username='existing-google')
        user.set_unusable_password()
        account = SocialAccount(provider='google', uid='google-uid-456', extra_data={'email': email})
        request = RequestFactory().post('/api/google/')
        provider = get_social_adapter().get_provider(request, provider='google')
        fake_login = SocialLogin(
            user=user,
            account=account,
            provider=provider,
            email_addresses=[EmailAddress(email=email, verified=True, primary=True)],
        )

        with patch(
            'dj_rest_auth.registration.serializers.SocialLoginSerializer.get_social_login',
            return_value=fake_login,
        ):
            response = self.client.post('/api/google/', {'access_token': 'fake-token'})

        self.assertLess(response.status_code, 500)

    def test_code_flow_exchanges_code_with_postmessage_redirect(self):
        # The frontend uses @react-oauth/google's popup-based auth-code flow
        # (see google-login-button.tsx), which requires the code to be
        # exchanged with the literal redirect_uri "postmessage" - see
        # GoogleLogin.callback_url in views.py. Mocks the actual HTTP call
        # to Google's token endpoint (OAuth2Client.get_access_token) since
        # there's no real Google client to exchange a code with in tests.
        email = 'codeflow@example.com'
        user = User(email=email, username='codeflowuser')
        user.set_unusable_password()
        account = SocialAccount(provider='google', uid='google-uid-code', extra_data={'email': email})
        request = RequestFactory().post('/api/google/')
        provider = get_social_adapter().get_provider(request, provider='google')
        fake_login = SocialLogin(
            user=user,
            account=account,
            provider=provider,
            email_addresses=[EmailAddress(email=email, verified=True, primary=True)],
        )

        with patch(
            'allauth.socialaccount.providers.oauth2.client.OAuth2Client.get_access_token',
            return_value={'access_token': 'exchanged-fake-token'},
        ) as mock_get_access_token:
            with patch(
                'dj_rest_auth.registration.serializers.SocialLoginSerializer.get_social_login',
                return_value=fake_login,
            ):
                response = self.client.post('/api/google/', {'code': 'fake-auth-code'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('jwt-auth', response.cookies)
        mock_get_access_token.assert_called_once_with('fake-auth-code')
        self.assertEqual(views.GoogleLogin.callback_url, 'postmessage')


class CORSHeaderTests(APITestCase):
    def test_allowed_origin_receives_cors_header(self):
        response = self.client.get('/api/user/', HTTP_ORIGIN='http://localhost:5173')
        self.assertEqual(response['Access-Control-Allow-Origin'], 'http://localhost:5173')

    def test_disallowed_origin_has_no_cors_header(self):
        response = self.client.get('/api/user/', HTTP_ORIGIN='http://evil.example.com')
        self.assertNotIn('Access-Control-Allow-Origin', response)


class UserSerializerReadOnlyFieldsTests(APITestCase):
    def test_role_flags_and_email_are_not_writable(self):
        user = User.objects.create_user(username='eve', email='eve@example.com', password='Str0ng!Pass')
        serializer = UserSerializer(user, data={
            'is_administrator': True,
            'is_customer': False,
            'email': 'new@example.com',
            'username': 'eve',
            'language': 'en',
        }, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()

        self.assertFalse(updated.is_administrator)
        self.assertTrue(updated.is_customer)
        self.assertEqual(updated.email, 'eve@example.com')
        self.assertEqual(updated.language, 'en')


class OTPVerificationTests(APITestCase):
    def setUp(self):
        cache.clear()

    def register(self, email='otp@example.com', username='otpuser'):
        response = self.client.post('/api/registration/', {
            'username': username,
            'email': email,
            'password1': 'Str0ng!Pass',
            'password2': 'Str0ng!Pass',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response

    def test_registration_sends_otp_instead_of_confirmation_link(self):
        self.register()
        self.assertEqual(len(mail.outbox), 1)
        entry = otp.get_otp_entry('otp@example.com')
        self.assertIsNotNone(entry)
        self.assertRegex(entry['code'], r'^\d{6}$')
        self.assertIn(entry['code'], mail.outbox[0].body)
        self.assertNotIn('http://', mail.outbox[0].body)

    def test_login_blocked_until_otp_verified(self):
        self.register()
        response = self.client.post('/api/login/', {
            'email': 'otp@example.com',
            'password': 'Str0ng!Pass',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('code'), ['email_not_verified'])

    def test_verify_otp_with_correct_code_activates_and_logs_in(self):
        self.register()
        code = otp.get_otp_entry('otp@example.com')['code']

        response = self.client.post('/api/verify-otp/', {'email': 'otp@example.com', 'code': code})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('jwt-auth', response.cookies)
        self.assertIn('jwt-refresh-auth', response.cookies)
        user = User.objects.get(username='otpuser')
        self.assertTrue(EmailAddress.objects.get(user=user).verified)
        self.assertIsNone(otp.get_otp_entry('otp@example.com'))

    def test_verify_otp_with_wrong_code_is_rejected(self):
        self.register()

        response = self.client.post('/api/verify-otp/', {'email': 'otp@example.com', 'code': '000000'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('code'), 'invalid_otp')
        user = User.objects.get(username='otpuser')
        self.assertFalse(EmailAddress.objects.get(user=user).verified)

    def test_verify_otp_locks_after_max_failed_attempts(self):
        self.register()
        correct_code = otp.get_otp_entry('otp@example.com')['code']

        for _ in range(otp.MAX_ATTEMPTS):
            self.client.post('/api/verify-otp/', {'email': 'otp@example.com', 'code': '000000'})

        response = self.client.post('/api/verify-otp/', {'email': 'otp@example.com', 'code': correct_code})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('code'), 'invalid_otp')

    def test_verify_otp_with_no_pending_code_is_rejected(self):
        response = self.client.post('/api/verify-otp/', {'email': 'nobody@example.com', 'code': '123456'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('code'), 'invalid_otp')

    def test_resend_otp_regenerates_code(self):
        self.register()
        old_code = otp.get_otp_entry('otp@example.com')['code']

        response = self.client.post('/api/resend-otp/', {'email': 'otp@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 2)

        new_code = otp.get_otp_entry('otp@example.com')['code']
        self.assertNotEqual(old_code, new_code)

        stale_attempt = self.client.post('/api/verify-otp/', {'email': 'otp@example.com', 'code': old_code})
        self.assertEqual(stale_attempt.status_code, status.HTTP_400_BAD_REQUEST)

        fresh_attempt = self.client.post('/api/verify-otp/', {'email': 'otp@example.com', 'code': new_code})
        self.assertEqual(fresh_attempt.status_code, status.HTTP_200_OK)

    def test_resend_otp_is_rate_limited(self):
        self.register()

        for _ in range(3):
            response = self.client.post('/api/resend-otp/', {'email': 'otp@example.com'})
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        throttled = self.client.post('/api/resend-otp/', {'email': 'otp@example.com'})
        self.assertEqual(throttled.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_resend_otp_does_not_reveal_unknown_email(self):
        response = self.client.post('/api/resend-otp/', {'email': 'unknown@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)


class PurgeUnverifiedUsersTests(APITestCase):
    def test_purges_only_stale_unverified_accounts(self):
        from django.core.management import call_command
        from django.utils import timezone
        from datetime import timedelta

        stale_unverified = User.objects.create_user(username='stale', email='stale@example.com', password='Str0ng!Pass')
        EmailAddress.objects.create(user=stale_unverified, email=stale_unverified.email, primary=True, verified=False)
        User.objects.filter(pk=stale_unverified.pk).update(date_joined=timezone.now() - timedelta(hours=48))

        recent_unverified = User.objects.create_user(username='recent', email='recent@example.com', password='Str0ng!Pass')
        EmailAddress.objects.create(user=recent_unverified, email=recent_unverified.email, primary=True, verified=False)

        stale_verified = User.objects.create_user(username='verified', email='verified@example.com', password='Str0ng!Pass')
        EmailAddress.objects.create(user=stale_verified, email=stale_verified.email, primary=True, verified=True)
        User.objects.filter(pk=stale_verified.pk).update(date_joined=timezone.now() - timedelta(hours=48))

        call_command('purge_unverified_users', '--older-than-hours=24')

        self.assertFalse(User.objects.filter(username='stale').exists())
        self.assertTrue(User.objects.filter(username='recent').exists())
        self.assertTrue(User.objects.filter(username='verified').exists())


class PasswordPolicyTests(APITestCase):
    def test_policy_endpoint_is_publicly_readable(self):
        response = self.client.get('/api/password-policy/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {
            'min_length': validators.MIN_LENGTH,
            'special_chars': validators.SPECIAL_CHARS,
        })

    def test_policy_matches_what_registration_actually_enforces(self):
        # Regression guard for the single-source-of-truth claim: the policy
        # endpoint's numbers must match what ComplexityValidator/
        # MinimumLengthValidator actually reject at registration time.
        too_short_password = 'Ab1' + validators.SPECIAL_CHARS[0]
        self.assertLess(len(too_short_password), validators.MIN_LENGTH)

        response = self.client.post('/api/registration/', {
            'username': 'shortpass',
            'email': 'shortpass@example.com',
            'password1': too_short_password,
            'password2': too_short_password,
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(username='shortpass').exists())
