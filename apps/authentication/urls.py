from django.urls import path, include, re_path
from django.shortcuts import redirect
from django.conf import settings
from django.views.generic import TemplateView
from dj_rest_auth.registration.views import VerifyEmailView
from . import views

def email_confirmation_redirect(request, key):
    return redirect(f"{settings.FRONTEND_URL}/auth/verify-email/{key}")

urlpatterns = [
    # High-priority redirect to the frontend
    re_path(
        r'^registration/account-confirm-email/(?P<key>[-:\w]+)/$',
        email_confirmation_redirect,
        name='account_confirm_email',
    ),

    # Throttled overrides - must come before the dj_rest_auth includes below
    # so they take precedence over the default (unthrottled) views.
    path('login/', views.LoginView.as_view(), name='rest_login'),
    path('registration/', views.RegisterView.as_view(), name='rest_register'),
    path('google/', views.GoogleLogin.as_view(), name='google_login'),
    path('verify-otp/', views.VerifyOTPView.as_view(), name='verify_otp'),
    path('resend-otp/', views.ResendOTPView.as_view(), name='resend_otp'),
    path('password-policy/', views.PasswordPolicyView.as_view(), name='password_policy'),

    path('', include('dj_rest_auth.urls')),

    # Registration is wired up manually here rather than via
    # include('dj_rest_auth.registration.urls'): that include also bundles
    # resend-email/ (ResendEmailVerificationView), which is unthrottled and
    # calls allauth's send_confirmation() - i.e. it lets anyone trigger a
    # working, link-based confirmation email for any address, which logs
    # the account in on click. That fully bypasses the OTP-only
    # verification flow this app actually uses (RegisterView/send_otp_email
    # in views.py), so it must not be exposed.
    #
    # verify-email/ is kept (same URL dj-rest-auth would have used) so any
    # confirmation link already sent before OTP verification was introduced
    # keeps working; it only accepts an HMAC-signed key that can't be forged
    # without SECRET_KEY, so exposing it costs nothing.
    re_path(r'^registration/verify-email/?$', VerifyEmailView.as_view(), name='rest_verify_email'),

    # Dummy placeholder allauth needs internally - some of its own
    # account-linking code paths call reverse() on this name. Never
    # actually rendered: this app doesn't use allauth's own signup/
    # confirmation HTML views, only the API endpoints above.
    path(
        'registration/account-email-verification-sent/',
        TemplateView.as_view(),
        name='account_email_verification_sent',
    ),
]
